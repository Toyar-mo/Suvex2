"""Suvex 2.1 异步实时事件总线（ActivityEventBus）。

解决 v1 同步轮询 SSE 的两个架构瓶颈：
1. 同步生成器在 Starlette 线程池中每连接占 1 条线程且每秒空轮询 DB；
2. 1 秒轮询粒度导致事件到达延迟高。

本总线采用「事务提交后唤醒 + AsyncIO 队列扇出 + DB 游标权威重放」设计：
- 写侧可在任意同步/异步线程通过 `publish(scan_id)` 通知（由 SQLAlchemy
  `after_commit` 钩子触发，保证 DB 事务已提交可见）；
- 读侧通过 `async with activity_bus.subscribe(scan_id=...) as queue:` 零线程
  等待实时推送，平均延迟 <50ms；
- 即使存在跨进程写库场景，SSE 仍保留低频兜底检查与 `Last-Event-ID` 断点补发。
"""

from __future__ import annotations

import asyncio
import threading
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass(slots=True)
class _Subscriber:
    sub_id: int
    scan_id: str | None
    loop: asyncio.AbstractEventLoop
    queue: asyncio.Queue[str]


class ActivityEventBus:
    """线程安全的进程内异步事件通知总线。"""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._next_id = 1
        self._subs: dict[int, _Subscriber] = {}
        self._total_published = 0
        self._last_published_at: float | None = None

    @asynccontextmanager
    async def subscribe(
        self, *, scan_id: str | None = None
    ) -> AsyncIterator[asyncio.Queue[str]]:
        """注册异步订阅者，退出上下文时自动清理。"""
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue[str] = asyncio.Queue(maxsize=64)
        with self._lock:
            sub_id = self._next_id
            self._next_id += 1
            self._subs[sub_id] = _Subscriber(
                sub_id=sub_id,
                scan_id=scan_id,
                loop=loop,
                queue=queue,
            )
        try:
            yield queue
        finally:
            with self._lock:
                self._subs.pop(sub_id, None)

    def publish(self, scan_id: str) -> int:
        """从任意线程广播某条扫描产生了新事件，返回被唤醒的订阅者数量。"""
        with self._lock:
            self._total_published += 1
            self._last_published_at = time.time()
            targets = [
                sub
                for sub in self._subs.values()
                if sub.scan_id is None or sub.scan_id == scan_id
            ]

        woken = 0
        for sub in targets:
            if sub.loop.is_closed():
                continue
            try:
                sub.loop.call_soon_threadsafe(self._enqueue_nowait, sub.queue, scan_id)
                woken += 1
            except RuntimeError:
                continue
        return woken

    @staticmethod
    def _enqueue_nowait(queue: asyncio.Queue[str], scan_id: str) -> None:
        """队列满时丢弃冗余唤醒信号（消费者醒来后会从 DB 拉取全部增量）。"""
        try:
            queue.put_nowait(scan_id)
        except asyncio.QueueFull:
            pass

    def stats(self) -> dict[str, object]:
        with self._lock:
            active = len(self._subs)
            published = self._total_published
            last_ts = self._last_published_at
        return {
            "mode": "async-event-bus",
            "activeSubscribers": active,
            "totalPublished": published,
            "lastPublishedAt": (
                datetime.fromtimestamp(last_ts, tz=timezone.utc).isoformat()
                if last_ts is not None
                else None
            ),
        }


activity_bus = ActivityEventBus()
