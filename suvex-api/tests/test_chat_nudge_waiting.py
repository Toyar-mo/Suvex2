"""中途等待/进度播报不中断的回归测试（v2.2）。

覆盖线上实测案例：`chat_01M8931T560449ZNKMW5G5BSDT` 第 31 轮（33 次工具调用后），
模型只输出「环境正在启动，等它就绪后获取访问地址。」且无 tool_call，导致整轮静默
结束。本测试钉死所有等待/启动中/限流延时类叙述均会被识别并触发自动纠偏继续，
同时确保真实结论不会被误打回。
"""

from __future__ import annotations

import pytest

from app.chat import nudge
from app.chat.prompts import render_waiting_continue_reminder


@pytest.mark.parametrize(
    "text",
    [
        "环境正在启动，等它就绪后获取访问地址。",
        "遇到限流，延时重试。",
        "容器初始化中，稍后查询入口。",
        "靶机还在启动，等3秒再试。",
        "服务正在恢复，完成后继续探测。",
        "Environment is starting, waiting for it to be ready.",
        "Rate limited, will retry in a moment.",
    ],
)
def test_waiting_progress_phrases_trigger_plan_and_nudge(text: str) -> None:
    assert nudge.looks_like_waiting(text) is True
    assert nudge.looks_like_plan(text) is True
    assert (
        nudge.should_nudge(
            at_limit=False,
            said_final=False,
            actions=[],
            truncated=False,
            tools_used=12,
            text=text,
            nudges_used=0,
            max_nudges=2,
            tool_nudges_used=0,
            max_tool_nudges=8,
        )
        is True
    )


@pytest.mark.parametrize(
    "text",
    [
        "已解出 flag{cookie_store_pwned}。",
        "当前工作目录是 `/work`。",
        "结果\n- 目标：Cookie Store\n- 结论：已提交正确 flag\n- 证据：平台返回 accepted",
        "扫描完成：未发现高危漏洞，所有接口均做了权限校验。",
    ],
)
def test_real_conclusions_are_not_falsely_nudged(text: str) -> None:
    assert nudge.looks_like_waiting(text) is False
    assert nudge.looks_like_plan(text) is False
    assert (
        nudge.should_nudge(
            at_limit=False,
            said_final=False,
            actions=[],
            truncated=False,
            tools_used=12,
            text=text,
            nudges_used=0,
            max_nudges=2,
            tool_nudges_used=0,
            max_tool_nudges=8,
        )
        is False
    )


def test_native_waiting_reminder_does_not_ask_for_text_action_protocol() -> None:
    msg = render_waiting_continue_reminder("环境正在启动，等它就绪后获取访问地址。", native_tools=True)
    assert "sleep 3" in msg
    assert "ACTION:" not in msg
