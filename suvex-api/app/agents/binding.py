"""Suvex 2.1 Agent 角色画像执行器绑定层。

在 v1 中 `AgentProfile` 仅停留在配置展示面；本模块将其真正接入执行引擎：
- 根据 `agent_profile_id`（或 `key`）解析启用中的角色画像；
- 将画像声明的 `tools` 列表收窄为运行时 `allowed_tools` 白名单；
- 将画像声明的 `skills` / `mcp_servers` 合并进对话上下文与工具发现；
- 生成清晰的角色职责声明段落注入系统提示词。
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.models import AgentProfile


@dataclass(frozen=True, slots=True)
class ResolvedAgentBinding:
    profile_id: str
    profile_key: str
    name: str
    description: str
    tools: tuple[str, ...]
    skills: tuple[str, ...]
    mcp_servers: tuple[str, ...]

    @property
    def allowed_tools_set(self) -> set[str] | None:
        """空列表表示继承平台默认工具集；非空列表表示显式收窄白名单。"""
        return set(self.tools) if self.tools else None


def resolve_agent_binding(
    db: Session | None, profile_ref: str | None
) -> ResolvedAgentBinding | None:
    """按 id 或 key 解析已启用的 AgentProfile。禁用或不存在返回 None。"""
    if db is None or not profile_ref:
        return None

    ref = profile_ref.strip()
    if not ref:
        return None

    profile = db.get(AgentProfile, ref)
    if profile is None:
        profile = db.scalars(
            select(AgentProfile).where(AgentProfile.key == ref)
        ).first()
    if profile is None or not profile.enabled:
        return None

    tools = tuple(str(t).strip() for t in (profile.tools or []) if str(t).strip())
    skills = tuple(str(s).strip() for s in (profile.skills or []) if str(s).strip())
    mcps = tuple(str(m).strip() for m in (profile.mcp_servers or []) if str(m).strip())

    return ResolvedAgentBinding(
        profile_id=profile.id,
        profile_key=profile.key,
        name=profile.name,
        description=(profile.description or "").strip(),
        tools=tools,
        skills=skills,
        mcp_servers=mcps,
    )


def merge_allowed_tools(
    base_allowed: set[str] | None, binding: ResolvedAgentBinding | None
) -> set[str] | None:
    """合并调用方工具白名单与角色画像白名单（两者都非空时取交集，保持最小权限）。"""
    if binding is None or not binding.tools:
        return base_allowed
    profile_set = set(binding.tools)
    if base_allowed is None:
        return profile_set
    return base_allowed & profile_set


def render_profile_prompt_section(binding: ResolvedAgentBinding | None) -> str:
    """生成注入系统提示词的角色画像章节。"""
    if binding is None:
        return ""

    lines = [
        "",
        f"## 绑定的专家角色画像：{binding.name} (`{binding.profile_key}`)",
    ]
    if binding.description:
        lines.append(f"职责定义：{binding.description}")
    if binding.tools:
        lines.append(
            f"允许调用的工具边界：{', '.join(binding.tools)}（严禁越界调用未授权工具）。"
        )
    if binding.skills:
        lines.append(f"推荐优先遵循的技能卡：{', '.join(binding.skills)}。")
    if binding.mcp_servers:
        lines.append(f"关联外部 MCP 服务：{', '.join(binding.mcp_servers)}。")
    return "\n".join(lines) + "\n"
