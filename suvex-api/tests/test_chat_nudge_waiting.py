"""中途等待/进度播报与多步旁白不中断的回归测试（v2.2）。

覆盖线上实测案例（`chat_01M8931T560449ZNKMW5G5BSDT`）：
1. 第 31 轮（33 工具）：「环境正在启动，等它就绪后获取访问地址。」
2. 第 17 轮（16 工具）：「环境已就绪，开始探查 XSS1。」
3. 任意未列举动词的多步简短旁白（如「靶机 80 端口开放。」「拿到源码，切到下一阶段。」）
均必须自动纠偏继续，同时确保真实结论、提问与单步问答不被误打回。
"""

from __future__ import annotations

import pytest

from app.chat import nudge
from app.chat.prompts import render_format_reminder, render_waiting_continue_reminder


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
        "环境已就绪，开始探查 XSS1。",
        "切到下一题。",
        "靶机 80 端口已开放。",
        "登录态有效，进入后台页面。",
    ],
)
def test_midtask_transition_and_short_blurb_trigger_nudge_after_multiple_tools(text: str) -> None:
    assert (
        nudge.should_nudge(
            at_limit=False,
            said_final=False,
            actions=[],
            truncated=False,
            tools_used=6,
            text=text,
            nudges_used=0,
            max_nudges=2,
            tool_nudges_used=0,
            max_tool_nudges=8,
        )
        is True
    )


@pytest.mark.parametrize(
    ("text", "tools_used"),
    [
        ("已解出 flag{cookie_store_pwned}。", 12),
        ("当前工作目录是 `/work`。", 1),
        ("需要我继续攻破下一道题吗？", 12),
        ("结果\n- 目标：Cookie Store\n- 结论：已提交正确 flag\n- 证据：平台返回 accepted", 12),
        ("扫描完成：未发现高危漏洞，所有接口均做了权限校验。", 12),
    ],
)
def test_real_conclusions_questions_and_single_tool_answers_not_falsely_nudged(
    text: str, tools_used: int
) -> None:
    assert nudge.looks_like_waiting(text) is False
    assert (
        nudge.should_nudge(
            at_limit=False,
            said_final=False,
            actions=[],
            truncated=False,
            tools_used=tools_used,
            text=text,
            nudges_used=0,
            max_nudges=2,
            tool_nudges_used=0,
            max_tool_nudges=8,
        )
        is False
    )


def test_short_midtask_blurb_caps_at_two_consecutive_nudges() -> None:
    # 防止极端情况无限循环：无显式计划词的纯旁白连续最多推 2 次
    text = "靶机 80 端口已开放。"
    assert nudge.looks_like_plan(text) is False
    assert (
        nudge.should_nudge(
            at_limit=False,
            said_final=False,
            actions=[],
            truncated=False,
            tools_used=5,
            text=text,
            nudges_used=0,
            max_nudges=2,
            tool_nudges_used=1,
            max_tool_nudges=8,
        )
        is True
    )
    assert (
        nudge.should_nudge(
            at_limit=False,
            said_final=False,
            actions=[],
            truncated=False,
            tools_used=5,
            text=text,
            nudges_used=0,
            max_nudges=2,
            tool_nudges_used=2,
            max_tool_nudges=8,
        )
        is False
    )


def test_native_reminders_do_not_ask_for_text_action_protocol() -> None:
    w = render_waiting_continue_reminder("环境正在启动，等它就绪后获取访问地址。", native_tools=True)
    assert "sleep 3" in w
    assert "ACTION:" not in w
    f = render_format_reminder(native_tools=True)
    assert "ACTION:" not in f
