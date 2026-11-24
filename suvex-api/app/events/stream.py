"""SSE 帧的编码与异步事件流生成（Suvex 2.1 EventBus 架构）。

## 帧格式（契约 §4.2）

```
id: evt_09
event: activity
data: {"id":"evt_09", ...}

```

## Suvex 2.1 升级要点

- `stream_events` 升级为真正的 **async generator**，不再为每条 SSE 连接独占
  Starlette 线程池线程；
- 订阅 `activity_bus`，当任意线程提交 `ActivityEvent` 后在 `<50ms` 内实时推送；
- 保留 `encode_open()` 首字节立即刷出响应头、`Last-Event-ID` / `?lastEventId=`
  断点补发、`resync` 溢出告知，以及低频 DB 兜底巡检（兼容跨进程写入）。
"""

from __future__ import annotations

import asyncio
import json
import time
from collections.abc import AsyncIterator

from app.core.config import get_settings
from app.core.db import get_session_factory
from app.events import service
from app.events.bus import activity_bus
from app.events.models import ActivityEvent
from app.events.schemas import ActivityEventOut

SSE_MEDIA_TYPE = "text/event-stream"

# 一帧最多带多少条事件。
BATCH_LIMIT = 200

# 兜底轮询间隔（秒）：进程内写入通过 ActivityEventBus 毫秒级唤醒，
# 此间隔仅用于兜底跨进程直写 DB 场景。
FALLBACK_POLL_SECONDS = 5.0

SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


def encode_event(event: ActivityEvent) -> str:
    """一条完整事件 → 一个 SSE 帧。"""
    payload = ActivityEventOut.model_validate(event).model_dump(mode="json")
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    return f"id: {event.id}\nevent: activity\ndata: {data}\n\n"


def encode_keepalive() -> str:
    """注释行心跳。"""
    return ": keepalive\n\n"


def encode_open() -> str:
    """连接建立后立刻发的首字节注释帧，确保代理立即刷出响应头。"""
    return ": open\n\n"


def encode_resync(reason: str) -> str:
    payload = json.dumps({"reason": reason}, ensure_ascii=False)
    return f"event: resync\ndata: {payload}\n\n"


def resolve_cursor(
    scan_id: str | None, last_event_id: str | None
) -> tuple[int, str | None]:
    """算出起始游标，以及是否需要先发一帧 `resync`。返回 `(游标, resync 原因)`。"""
    cfg = get_settings()
    factory = get_session_factory()

    with factory() as db:
        latest = service.latest_seq(db, scan_id)

        if not last_event_id:
            return latest, None

        seq = service.seq_for_event_id(db, last_event_id)
        if seq is None:
            return latest, "请求的事件已被清理，请重新拉取历史后再订阅。"
        if latest - seq > cfg.sse_replay_max_events:
            return latest, (
                f"待补发的事件超过上限（{cfg.sse_replay_max_events} 条），"
                "请重新拉取历史后再订阅。"
            )
        return seq, None


def _fetch_frames_after(
    scan_id: str | None, cursor: int
) -> tuple[list[str], int]:
    """短命会话拉取 `seq > cursor` 的增量事件帧。"""
    factory = get_session_factory()
    with factory() as db:
        events = service.events_after(
            db, cursor=cursor, scan_id=scan_id, limit=BATCH_LIMIT
        )
        frames = [encode_event(event) for event in events]
        next_cursor = events[-1].seq if events else cursor
        return frames, next_cursor


async def stream_events(
    *,
    scan_id: str | None,
    last_event_id: str | None,
) -> AsyncIterator[str]:
    """异步 SSE 生成器（EventBus 实时唤醒 + DB 游标补发）。"""
    cfg = get_settings()

    yield encode_open()

    cursor, resync_reason = await asyncio.to_thread(
        resolve_cursor, scan_id, last_event_id
    )
    if resync_reason:
        yield encode_resync(resync_reason)

    last_keepalive = time.monotonic()

    # 先订阅总线再查增量，杜绝「查完到订阅之间」的竞态漏事件窗口。
    async with activity_bus.subscribe(scan_id=scan_id) as queue:
        while True:
            frames, cursor = await asyncio.to_thread(
                _fetch_frames_after, scan_id, cursor
            )
            for frame in frames:
                yield frame

            if frames:
                last_keepalive = time.monotonic()
                if len(frames) >= BATCH_LIMIT:
                    continue

            now = time.monotonic()
            remaining_hb = max(0.5, cfg.sse_heartbeat_seconds - (now - last_keepalive))
            wait_sec = min(FALLBACK_POLL_SECONDS, remaining_hb)

            try:
                await asyncio.wait_for(queue.get(), timeout=wait_sec)
                # 合并短时间内连续到达的多个唤醒信号，减少重复查询
                while not queue.empty():
                    try:
                        queue.get_nowait()
                    except asyncio.QueueEmpty:
                        break
            except TimeoutError:
                pass

            now = time.monotonic()
            if now - last_keepalive >= cfg.sse_heartbeat_seconds:
                yield encode_keepalive()
                last_keepalive = now
