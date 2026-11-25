"""运行中打断：支持**毫秒级抢占式停止**与**中断并继续**（v2.2 升级）。

## 两种中断语义

- **停止（`request_stop`）**：抢占式立即终止。通过跨线程 `asyncio.Event` 唤醒机制，
  在 <1ms 内通知正在等待的模型流（含 TTFT 首字思考阶段）、运行中的 `run_shell` 沙箱
  进程组（先容器内 `SIGTERM` 进程组再 `SIGKILL` + 杀本地 `docker exec`）以及 MCP/HTTP
  工具，保留已产出的半截输出并写入 `[已被用户手动中断]` 后将本轮落为 `cancelled`
  （后台 `resumer` 不会自动接手）。
- **继续（`request_continue`） / 插话（`request_steer`）**：立刻唤醒并打断当前
  流式模型输出（不砍断已产生副作用的运行中工具），下一轮把用户补充并入上下文继续推进。
"""

from __future__ import annotations

import asyncio
import threading

_LOCK = threading.Lock()
#: session_id -> 用户补充（还没被引擎取走）。空串表示"没写说明"。
_NOTES: dict[str, str] = {}
#: 要求停止的会话集合。
_STOPS: set[str] = set()
#: 要求“停在当前模型输出、下一轮读新消息”的会话（插话用）。
_STEERS: set[str] = set()
#: 跨线程实时唤醒列表：session_id -> {(loop, event, stop_only), ...}
_WAITERS: dict[str, set[tuple[asyncio.AbstractEventLoop, asyncio.Event, bool]]] = {}


def _notify_waiters(session_id: str, *, is_stop: bool) -> None:
    """在锁外安全唤醒订阅该会话中断事件的协程（支持跨线程 `call_soon_threadsafe`）。"""
    with _LOCK:
        waiters = list(_WAITERS.get(session_id, ()))
    for loop, ev, stop_only in waiters:
        if stop_only and not is_stop:
            continue
        if loop.is_closed():
            continue
        try:
            loop.call_soon_threadsafe(ev.set)
        except RuntimeError:
            pass


def request_continue(session_id: str, note: str) -> None:
    """请求「中断并继续」，可带一句说明（可为空）。"""
    with _LOCK:
        _NOTES[session_id] = (note or "").strip()
        _STOPS.discard(session_id)
    _notify_waiters(session_id, is_stop=False)


def request_steer(session_id: str) -> None:
    """插话：停在当前模型输出处，但**不注入额外模板**。

    用户消息已经由 `/interject` 写进历史；下一轮重建上下文时自然读到。
    与 `request_continue` 的区别是：不把「用户补充：…」再写一条过程消息。
    """
    with _LOCK:
        _STEERS.add(session_id)
    _notify_waiters(session_id, is_stop=False)


def take_steer(session_id: str) -> bool:
    with _LOCK:
        if session_id not in _STEERS:
            return False
        _STEERS.discard(session_id)
        return True


def request_stop(session_id: str) -> None:
    """请求「彻底停止」。同时清掉可能挂着的说明并立刻唤醒所有等待者（停止优先）。"""
    with _LOCK:
        _STOPS.add(session_id)
        _NOTES.pop(session_id, None)
        _STEERS.discard(session_id)
    _notify_waiters(session_id, is_stop=True)


def stop_requested(session_id: str) -> bool:
    with _LOCK:
        return session_id in _STOPS


def take_note(session_id: str) -> str | None:
    """取走挂着的补充说明（`None` = 没有请求）。取走即消费。"""
    with _LOCK:
        if session_id not in _NOTES:
            return None
        return _NOTES.pop(session_id)


def has_pending(session_id: str) -> bool:
    with _LOCK:
        return session_id in _STOPS or session_id in _NOTES or session_id in _STEERS


def should_break(session_id: str) -> bool:
    """流式循环里的判据：该不该立刻停止收字。"""
    return has_pending(session_id)


async def wait_for_interrupt(session_id: str, *, stop_only: bool = False) -> None:
    """事件驱动等待中断信号；信号到达后 <1ms 返回（无轮询开销）。"""
    loop = asyncio.get_running_loop()
    ev = asyncio.Event()
    entry = (loop, ev, stop_only)
    with _LOCK:
        already = (
            session_id in _STOPS
            if stop_only
            else (session_id in _STOPS or session_id in _NOTES or session_id in _STEERS)
        )
        if already:
            return
        _WAITERS.setdefault(session_id, set()).add(entry)
    try:
        await ev.wait()
    finally:
        with _LOCK:
            bucket = _WAITERS.get(session_id)
            if bucket is not None:
                bucket.discard(entry)
                if not bucket:
                    _WAITERS.pop(session_id, None)


async def wait_for_stop(session_id: str) -> None:
    """事件驱动等待「彻底停止」信号（忽略软插话/继续，专供运行中工具抢占取消用）。"""
    await wait_for_interrupt(session_id, stop_only=True)


def clear(session_id: str) -> None:
    """一轮结束时清干净 —— 否则残留的停止信号会把**下一轮**也打断。"""
    with _LOCK:
        _STOPS.discard(session_id)
        _NOTES.pop(session_id, None)
        _STEERS.discard(session_id)


def reset_all() -> None:
    """测试用：清空全部状态。"""
    with _LOCK:
        _STOPS.clear()
        _NOTES.clear()
        _STEERS.clear()
        _WAITERS.clear()
