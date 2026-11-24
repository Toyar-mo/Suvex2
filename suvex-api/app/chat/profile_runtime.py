"""对话执行引擎的角色画像运行时桥接模块（从 chat/engine.py 抽离）。"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.agents.binding import (
    ResolvedAgentBinding,
    merge_allowed_tools,
    render_profile_prompt_section,
    resolve_agent_binding,
)
from app.chat.models import ChatSession


@dataclass(frozen=True, slots=True)
class SessionProfileRuntime:
    binding: ResolvedAgentBinding | None
    effective_allowed_tools: set[str] | None
    prompt_section: str


def resolve_session_profile_runtime(
    db: Session | None,
    session: ChatSession,
    base_allowed_tools: set[str] | None = None,
) -> SessionProfileRuntime:
    """解析当前会话绑定的 AgentProfile，产出有效工具白名单与提示词段落。"""
    binding = resolve_agent_binding(db, getattr(session, "agent_profile_id", None))
    effective_tools = merge_allowed_tools(base_allowed_tools, binding)
    prompt_section = render_profile_prompt_section(binding)
    return SessionProfileRuntime(
        binding=binding,
        effective_allowed_tools=effective_tools,
        prompt_section=prompt_section,
    )
