"""Suvex 2.1 后端架构升级单元测试（EventBus、AgentProfile 执行器绑定、系统遥测）。"""

from __future__ import annotations

import asyncio

from app.agents.binding import (
    ResolvedAgentBinding,
    merge_allowed_tools,
    render_profile_prompt_section,
)
from app.events.bus import ActivityEventBus


def test_activity_event_bus_async_pubsub_and_filtering():
    bus = ActivityEventBus()

    async def scenario():
        async with bus.subscribe(scan_id="scan_A") as q_a, bus.subscribe(scan_id=None) as q_all:
            assert bus.stats()["activeSubscribers"] == 2
            woken_b = bus.publish("scan_B")
            assert woken_b == 1  # only q_all
            assert await asyncio.wait_for(q_all.get(), timeout=1.0) == "scan_B"
            assert q_a.empty()

            woken_a = bus.publish("scan_A")
            assert woken_a == 2
            assert await asyncio.wait_for(q_a.get(), timeout=1.0) == "scan_A"
            assert await asyncio.wait_for(q_all.get(), timeout=1.0) == "scan_A"

        assert bus.stats()["activeSubscribers"] == 0
        assert bus.stats()["totalPublished"] == 2

    asyncio.run(scenario())


def test_agent_profile_tool_allowlist_and_prompt():
    binding = ResolvedAgentBinding(
        profile_id="ag_01",
        profile_key="api-auditor",
        name="API 鉴权审计专家",
        description="专注 IDOR 与 JWT 逻辑审计",
        tools=("run_shell", "browser", "read_file"),
        skills=("api-auth",),
        mcp_servers=("threat-intel",),
    )

    assert merge_allowed_tools(None, binding) == {"run_shell", "browser", "read_file"}
    assert merge_allowed_tools({"run_shell", "list_scans"}, binding) == {"run_shell"}
    assert merge_allowed_tools({"run_shell"}, None) == {"run_shell"}

    prompt = render_profile_prompt_section(binding)
    assert "API 鉴权审计专家" in prompt
    assert "api-auditor" in prompt
    assert "run_shell, browser, read_file" in prompt
    assert "api-auth" in prompt
    assert "threat-intel" in prompt


def test_ctf2_mcp_challenge_and_attachment_normalization():
    import pytest

    from app.kernel.mcp import McpError
    from app.kernel.mcp_sync import (
        extract_mcp_json,
        normalize_mcp_attachments,
        normalize_mcp_challenge,
    )

    raw_ok = {
        "content": [{"type": "text", "text": '{"items": [{"id": "c1", "name": "unipickle"}]}'}],
        "isError": False,
    }
    assert extract_mcp_json(raw_ok) == {"items": [{"id": "c1", "name": "unipickle"}]}

    with pytest.raises(McpError):
        extract_mcp_json({"content": [{"type": "text", "text": "unauthorized"}], "isError": True})

    files = [
        {
            "id": "f-1",
            "is_visible": True,
            "file": {"original_name": "unipickle.py", "size": 90},
        },
        {
            "id": "f-hidden",
            "is_visible": False,
            "file": {"original_name": "secret.txt", "size": 10},
        },
    ]
    resolved = {
        "f-1": {
            "url": "https://ctf2.dasctf.com/api/ai/v1/files/download/?token=abc",
            "file_name": "unipickle.py",
            "size": 90,
        }
    }
    atts = normalize_mcp_attachments(files, resolved)
    assert len(atts) == 1
    assert atts[0]["name"] == "unipickle.py"
    assert atts[0]["url"].startswith("https://ctf2.dasctf.com/api/ai/v1/files/download/")

    summary = {
        "id": "d78048b5-eaa3-4a06-8b1e-790d85930f6f",
        "name": "unipickle",
        "category": "PWN",
        "difficulty": "Easy",
        "points": 100,
        "solve_count": 53,
        "friendly_id": "PCHAL-2026-914282",
    }
    list_only = normalize_mcp_challenge(summary)
    assert list_only["id"] == summary["id"]
    assert list_only["title"] == "unipickle"
    assert list_only["score"] == 100
    assert "Easy" in list_only["description"]

    with_detail = normalize_mcp_challenge(
        summary,
        detail={"challenge": {**summary, "description": "Real prompt body", "files": files}},
        resolved_urls=resolved,
    )
    assert with_detail["description"] == "Real prompt body"
    assert len(with_detail["attachments"]) == 1
    assert with_detail["attachments"][0]["url"].startswith("https://ctf2.dasctf.com/")
