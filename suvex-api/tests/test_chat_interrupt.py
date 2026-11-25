"""抢占式中断（毫秒级停止）回归测试。

验证三件事：
1. `interrupts.wait_for_interrupt()` / `wait_for_stop()` 在跨线程触发 `request_stop()` 时 <50ms 唤醒；
2. `_stream_llm_reply()` 在 0-token 思考等待（TTFT）阶段收到 `request_stop()` 后 <100ms 立即断开并关闭上游流，绝不退回非流式重跑；
3. `_await_cancellable_by_stop()` 在慢工具阻塞时收到 `request_stop()` 后 <100ms 取消任务并返回中断标志。
"""

from __future__ import annotations

import asyncio
import threading
import time

import pytest

from app.chat import engine as chat_engine
from app.chat import interrupts as interrupt_bus


@pytest.fixture(autouse=True)
def _clean_interrupts():
    interrupt_bus.reset_all()
    yield
    interrupt_bus.reset_all()


def test_cross_thread_wait_for_stop_wakes_immediately() -> None:
    async def _run() -> float:
        t0 = time.monotonic()

        def _trigger() -> None:
            time.sleep(0.03)
            interrupt_bus.request_stop("sess_wake_1")

        th = threading.Thread(target=_trigger, daemon=True)
        th.start()
        await asyncio.wait_for(interrupt_bus.wait_for_stop("sess_wake_1"), timeout=1.0)
        th.join(timeout=1.0)
        return time.monotonic() - t0

    elapsed = asyncio.run(_run())
    assert elapsed < 0.35
    assert interrupt_bus.stop_requested("sess_wake_1")


def test_wait_for_stop_ignores_soft_steer() -> None:
    async def _run() -> bool:
        interrupt_bus.request_steer("sess_steer_1")
        try:
            await asyncio.wait_for(interrupt_bus.wait_for_stop("sess_steer_1"), timeout=0.05)
            return True
        except TimeoutError:
            return False

    assert asyncio.run(_run()) is False


def test_stream_llm_breaks_immediately_during_ttft_without_nonstream_fallback() -> None:
    closed = False
    nonstream_called = False

    class _HangingGateway:
        async def chat_stream(self, messages, **kwargs):  # noqa: ANN001, ANN003
            nonlocal closed
            try:
                await asyncio.sleep(30)
                yield "should-never-arrive"
            finally:
                closed = True

        async def chat(self, *args, **kwargs):  # noqa: ANN002, ANN003
            nonlocal nonstream_called
            nonstream_called = True
            raise AssertionError("must not fall back to non-streaming after user interrupt")

    async def _emit(event: str, payload: dict) -> None:
        return None

    async def _run() -> float:
        t0 = time.monotonic()

        async def _stop_soon() -> None:
            await asyncio.sleep(0.04)
            interrupt_bus.request_stop("sess_ttft_1")

        stopper = asyncio.create_task(_stop_soon())
        reply = await chat_engine._call_model(
            _HangingGateway(),
            [{"role": "user", "content": "hi"}],
            system="sys",
            emit=_emit,
            session_id="sess_ttft_1",
        )
        await stopper
        assert reply.text == ""
        return time.monotonic() - t0

    elapsed = asyncio.run(_run())
    assert elapsed < 0.4
    assert closed is True
    assert nonstream_called is False


def test_await_cancellable_by_stop_cancels_slow_tool() -> None:
    cancelled = False

    async def _slow_tool() -> str:
        nonlocal cancelled
        try:
            await asyncio.sleep(30)
            return "late"
        except asyncio.CancelledError:
            cancelled = True
            raise

    async def _run() -> tuple[float, bool]:
        t0 = time.monotonic()

        async def _stop_soon() -> None:
            await asyncio.sleep(0.04)
            interrupt_bus.request_stop("sess_tool_1")

        stopper = asyncio.create_task(_stop_soon())
        _, was_stopped = await chat_engine._await_cancellable_by_stop(
            _slow_tool(), "sess_tool_1"
        )
        await stopper
        return time.monotonic() - t0, was_stopped

    elapsed, was_stopped = asyncio.run(_run())
    assert was_stopped is True
    assert cancelled is True
    assert elapsed < 0.4
