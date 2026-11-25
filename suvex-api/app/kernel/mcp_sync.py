"""CTF2 官方远程 HTTP MCP 题板同步与工具桥接（Suvex 2.1）。

## 为什么需要这个模块

CTF2 新版 Agent 凭据（`CTF2_AGENT_TOKEN`）在旧版开放 REST 接口上对
`/competitions/` 与 `/writeups/` 返回 `403 agent_scope_forbidden`，而官方在
`https://ctf2.dasctf.com/api/ai/v1/mcp` 提供了完整的 Streamable-HTTP MCP 端点
（携带 `Authorization: Bearer <token>`），原生提供 24 个工具：

  - `ctf2_list_practice_grounds`
  - `ctf2_list_practice_challenges`
  - `ctf2_get_practice_challenge`
  - `ctf2_get_attachment_url`
  - `ctf2_list_competitions` / `ctf2_get_competition` / `ctf2_list_competition_challenges`
  - `ctf2_get_competition_challenge` / `ctf2_get_competition_attachment_url`
  - `ctf2_agent_whoami`

本模块复用项目自带的零依赖 `app.kernel.mcp.McpClient`（单次同步只建一条 HTTP 会话，
复用 `Mcp-Session-Id`），把 MCP 返回的题场、赛事、题目详情与签名附件 URL 归一化为
`app.kernel.service` 既有的落库结构。
"""

from __future__ import annotations

import json
import logging
from typing import Any

from app.kernel.mcp import McpClient, McpError, McpServerConfig

logger = logging.getLogger("suvex.ctf2.mcp_sync")

CTF2_DEFAULT_MCP_NAME = "ctf2-suvex"
CTF2_DEFAULT_MCP_URL = "https://ctf2.dasctf.com/api/ai/v1/mcp"
CTF2_DEFAULT_MCP_NOTES = "CTF2 官方远程 HTTP MCP（含练习场、赛事、靶机环境与 Flag 提交工具）"

# 单次同步默认从每个练习场拉取的题目上限（防止 3000+ 题大库拖垮单次 HTTP 请求）
DEFAULT_PER_GROUND_LIMIT = 50
# 指定同步某个题场/赛事时放宽单场拉取上限
SELECTED_PER_GROUND_LIMIT = 150
# 单次同步内联拉取完整题面与附件链接的题目预算（控制耗时在 ~8 秒内）
DEFAULT_DETAIL_ENRICH_BUDGET = 20


def build_ctf2_mcp_config(
    token: str,
    *,
    name: str = CTF2_DEFAULT_MCP_NAME,
    url: str = CTF2_DEFAULT_MCP_URL,
    call_timeout: float = 30.0,
) -> McpServerConfig:
    """构造连接 CTF2 远程 HTTP MCP 的配置对象。"""
    return McpServerConfig(
        name=name,
        type="http",
        url=url,
        headers={"Authorization": f"Bearer {token.strip()}"},
        notes=CTF2_DEFAULT_MCP_NOTES,
        call_timeout=call_timeout,
    )


def extract_mcp_json(raw: Any) -> Any:
    """从 MCP `tools/call` 响应里提取并反序列化 JSON 负载。"""
    if not isinstance(raw, dict):
        return raw
    is_error = bool(raw.get("isError"))
    parts: list[str] = []
    content = raw.get("content")
    if isinstance(content, list):
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                parts.append(str(item.get("text") or ""))
    elif isinstance(content, str):
        parts.append(content)
    text = "\n".join(p for p in parts if p).strip()
    if is_error:
        raise McpError(f"CTF2 MCP 工具调用返回错误：{text[:300] or '未知错误'}")
    if not text:
        return {}
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise McpError(
            f"CTF2 MCP 返回的不是合法 JSON：{text[:200]}", detail=str(exc)
        ) from exc


def _extract_items(payload: Any, *keys: str) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]
    if isinstance(payload, dict):
        for key in (*keys, "items", "data", "results", "challenges", "competitions"):
            val = payload.get(key)
            if isinstance(val, list):
                return [x for x in val if isinstance(x, dict)]
    return []


def _unwrap_object(payload: Any, *keys: str) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    for key in keys:
        inner = payload.get(key)
        if isinstance(inner, dict):
            return inner
    return payload


def normalize_mcp_attachments(
    files: Any,
    resolved_urls: dict[str, dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """把 CTF2 MCP 返回的 `files` 列表转换为 `plan_downloads` 识别的附件清单。"""
    if not isinstance(files, list):
        return []
    urls_map = resolved_urls or {}
    out: list[dict[str, Any]] = []
    for entry in files:
        if not isinstance(entry, dict):
            continue
        if entry.get("is_visible") is False:
            continue
        file_id = str(entry.get("id") or entry.get("file_id") or "").strip()
        meta = entry.get("file") if isinstance(entry.get("file"), dict) else {}
        resolved = urls_map.get(file_id) or {}
        name = (
            resolved.get("file_name")
            or meta.get("original_name")
            or entry.get("name")
            or entry.get("file_name")
            or (f"attachment-{file_id[:8]}" if file_id else "attachment")
        )
        url = str(
            resolved.get("url")
            or entry.get("url")
            or entry.get("download_url")
            or ""
        ).strip()
        size = resolved.get("size") or meta.get("size") or entry.get("size")
        item: dict[str, Any] = {"name": str(name)}
        if file_id:
            item["file_id"] = file_id
        if url:
            item["url"] = url
        if size is not None:
            try:
                item["size"] = int(size)
            except (TypeError, ValueError):
                pass
        out.append(item)
    return out


def normalize_mcp_challenge(
    summary: dict[str, Any],
    *,
    detail: dict[str, Any] | None = None,
    resolved_urls: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """合并列表项与详情为 `service._upsert_challenge` 接受的标准 dict。"""
    merged: dict[str, Any] = {}
    if isinstance(summary, dict):
        merged.update(summary)
    if isinstance(detail, dict):
        unwrapped = _unwrap_object(detail, "challenge", "data")
        merged.update(unwrapped)

    challenge_id = merged.get("id") or merged.get("challenge_id")
    title = merged.get("title") or merged.get("name") or (f"#{challenge_id}" if challenge_id else "")
    category = merged.get("category") or merged.get("type") or ""
    score = merged.get("points") if merged.get("points") is not None else merged.get("score")

    description = merged.get("description") or merged.get("content") or merged.get("detail")
    if not description and detail is None:
        # 列表项不含题面正文时，拼装精简元信息（真正拉取详情或单题拉取后会覆盖为完整题面）
        meta_parts: list[str] = []
        if merged.get("difficulty"):
            meta_parts.append(f"难度：{merged['difficulty']}")
        if merged.get("solve_count") is not None:
            meta_parts.append(f"已解人数：{merged['solve_count']}")
        if merged.get("friendly_id"):
            meta_parts.append(f"编号：{merged['friendly_id']}")
        if merged.get("has_container"):
            meta_parts.append("动态靶机")
        if merged.get("has_attachments"):
            meta_parts.append("含附件")
        if meta_parts:
            description = " · ".join(meta_parts)

    attachments: list[dict[str, Any]] | None = None
    if isinstance(merged.get("files"), list):
        attachments = normalize_mcp_attachments(merged["files"], resolved_urls)
    elif isinstance(merged.get("attachments"), list):
        attachments = normalize_mcp_attachments(merged["attachments"], resolved_urls)

    sub_flag_id = merged.get("sub_flag_id") or merged.get("subFlagId")
    if not sub_flag_id and isinstance(merged.get("sub_flags"), list) and merged["sub_flags"]:
        first_sub = merged["sub_flags"][0]
        if isinstance(first_sub, dict) and first_sub.get("id"):
            sub_flag_id = str(first_sub["id"])

    payload: dict[str, Any] = {
        "id": str(challenge_id) if challenge_id is not None else None,
        "title": str(title),
        "name": str(title),
        "category": str(category),
    }
    if description is not None:
        payload["description"] = str(description)
    if score is not None:
        payload["score"] = score
    if attachments is not None:
        payload["attachments"] = attachments
    if sub_flag_id:
        payload["sub_flag_id"] = str(sub_flag_id)
    return payload


async def probe_agent_via_mcp(
    token: str,
    *,
    mcp_url: str = CTF2_DEFAULT_MCP_URL,
) -> dict[str, Any]:
    """验证 Agent Token 在官方 MCP 端点上是否有效，返回 whoami 信息。"""
    cfg = build_ctf2_mcp_config(token, url=mcp_url)
    async with McpClient(cfg) as client:
        raw = await client.call_tool("ctf2_agent_whoami", {})
        data = extract_mcp_json(raw)
        return data if isinstance(data, dict) else {}


async def list_remote_sources_via_mcp(
    token: str,
    *,
    mcp_url: str = CTF2_DEFAULT_MCP_URL,
) -> list[dict[str, Any]]:
    """通过官方 MCP 列出所有可见赛事与练习场（不写库）。"""
    cfg = build_ctf2_mcp_config(token, url=mcp_url)
    out: list[dict[str, Any]] = []
    async with McpClient(cfg) as client:
        # 1. 赛事列表
        try:
            comp_raw = await client.call_tool("ctf2_list_competitions", {"page": 1, "page_size": 50})
            for item in _extract_items(extract_mcp_json(comp_raw), "competitions"):
                rid = item.get("id") or item.get("competition_id")
                if not rid:
                    continue
                out.append(
                    {
                        "remoteId": str(rid),
                        "name": str(item.get("name") or item.get("title") or f"#{rid}"),
                        "startAt": item.get("start_time") or item.get("start_at"),
                        "endAt": item.get("end_time") or item.get("end_at"),
                        "status": str(item.get("status") or item.get("state") or "competition"),
                        "kind": "competition",
                        "challengeCount": _safe_int(item.get("challenge_count")),
                    }
                )
        except McpError as exc:
            logger.warning("MCP 列出赛事失败（将继续列练习场）：%s", exc)

        # 2. 练习场列表
        pg_raw = await client.call_tool("ctf2_list_practice_grounds", {})
        for item in _extract_items(extract_mcp_json(pg_raw), "practice_grounds", "grounds"):
            rid = item.get("id") or item.get("practice_ground_id")
            if not rid:
                continue
            out.append(
                {
                    "remoteId": str(rid),
                    "name": str(item.get("name") or item.get("title") or f"#{rid}"),
                    "startAt": item.get("start_time") or item.get("start_at"),
                    "endAt": item.get("end_time") or item.get("end_at"),
                    "status": str(item.get("status") or "practice"),
                    "kind": "practice",
                    "challengeCount": _safe_int(item.get("challenge_count")),
                }
            )
    return out


async def _resolve_practice_attachments(
    client: McpClient,
    practice_id: str,
    challenge_id: str,
    files: list[Any],
) -> dict[str, dict[str, Any]]:
    resolved: dict[str, dict[str, Any]] = {}
    for entry in files[:10]:
        if not isinstance(entry, dict) or entry.get("is_visible") is False:
            continue
        file_id = str(entry.get("id") or entry.get("file_id") or "").strip()
        if not file_id:
            continue
        try:
            att_raw = await client.call_tool(
                "ctf2_get_attachment_url",
                {
                    "practice_ground_id": practice_id,
                    "challenge_id": challenge_id,
                    "file_id": file_id,
                },
            )
            att_data = _unwrap_object(extract_mcp_json(att_raw), "attachment", "data")
            if att_data.get("url"):
                resolved[file_id] = att_data
        except McpError as exc:
            logger.debug("MCP 获取附件签名 URL 失败 (%s/%s): %s", challenge_id, file_id, exc)
    return resolved


async def _resolve_competition_attachments(
    client: McpClient,
    competition_id: str,
    stage_id: str,
    challenge_id: str,
    files: list[Any],
) -> dict[str, dict[str, Any]]:
    resolved: dict[str, dict[str, Any]] = {}
    for entry in files[:10]:
        if not isinstance(entry, dict) or entry.get("is_visible") is False:
            continue
        file_id = str(entry.get("id") or entry.get("file_id") or "").strip()
        if not file_id:
            continue
        try:
            att_raw = await client.call_tool(
                "ctf2_get_competition_attachment_url",
                {
                    "competition_id": competition_id,
                    "stage_id": stage_id,
                    "challenge_id": challenge_id,
                    "file_id": file_id,
                },
            )
            att_data = _unwrap_object(extract_mcp_json(att_raw), "attachment", "data")
            if att_data.get("url"):
                resolved[file_id] = att_data
        except McpError as exc:
            logger.debug("MCP 获取赛事附件 URL 失败 (%s/%s): %s", challenge_id, file_id, exc)
    return resolved


async def sync_via_mcp(
    token: str,
    *,
    competition_ids: list[str] | None = None,
    known_remote_ids: set[str] | None = None,
    max_per_ground: int | None = None,
    detail_enrich_budget: int = DEFAULT_DETAIL_ENRICH_BUDGET,
    mcp_url: str = CTF2_DEFAULT_MCP_URL,
) -> dict[str, Any]:
    """通过 CTF2 官方远程 HTTP MCP 批量同步练习场与赛事题目。

    返回结构与 `service._sync_locked` 的 `collected` 完全对齐：
    `{"practice": [...], "practice_details": [...], "competitions": [...], "errors": [...], "mcp_synced": True}`。
    """
    known = known_remote_ids or set()
    wanted = [str(x).strip() for x in (competition_ids or []) if str(x).strip()]
    wanted_set = set(wanted)
    per_ground_limit = (
        max_per_ground
        if max_per_ground is not None
        else (SELECTED_PER_GROUND_LIMIT if wanted_set else DEFAULT_PER_GROUND_LIMIT)
    )

    collected: dict[str, Any] = {
        "practice": [],
        "practice_details": [],
        "competitions": [],
        "errors": [],
        "mcp_synced": True,
        "mcp_total_listed": 0,
    }

    cfg = build_ctf2_mcp_config(token, url=mcp_url)
    details_fetched = 0

    async with McpClient(cfg) as client:
        # 1. 获取全部练习场
        pg_raw = await client.call_tool("ctf2_list_practice_grounds", {})
        grounds = _extract_items(extract_mcp_json(pg_raw), "practice_grounds", "grounds")
        collected["practice"] = grounds
        ground_ids = {
            str(g.get("id") or g.get("practice_ground_id"))
            for g in grounds
            if g.get("id") or g.get("practice_ground_id")
        }

        # 筛选需要同步的练习场：
        #   · 用户没指定 id → 全部练习场（按题数从小到大排，小而精的日常/基础题场优先补全详情）；
        #   · 用户指定了 id → 只同步命中的练习场。
        if wanted_set:
            target_grounds = [
                g
                for g in grounds
                if str(g.get("id") or g.get("practice_ground_id") or "") in wanted_set
            ]
        else:
            target_grounds = sorted(
                grounds,
                key=lambda g: int(g.get("challenge_count") or 0),
            )

        for ground in target_grounds:
            gid = str(ground.get("id") or ground.get("practice_ground_id") or "").strip()
            gname = str(ground.get("name") or gid)
            if not gid:
                continue
            fetched_for_ground: list[dict[str, Any]] = []
            page = 1
            while len(fetched_for_ground) < per_ground_limit:
                page_limit = min(100, per_ground_limit - len(fetched_for_ground))
                try:
                    ch_raw = await client.call_tool(
                        "ctf2_list_practice_challenges",
                        {"practice_ground_id": gid, "page": page, "limit": page_limit},
                    )
                    ch_data = extract_mcp_json(ch_raw)
                except McpError as exc:
                    collected["errors"].append(f"练习场 {gname} 拉题失败：{exc}")
                    break
                items = _extract_items(ch_data, "challenges")
                if not items:
                    break
                fetched_for_ground.extend(items)
                total_page = int(ch_data.get("total_page") or 1) if isinstance(ch_data, dict) else 1
                if page >= total_page or len(items) < page_limit:
                    break
                page += 1

            collected["mcp_total_listed"] += len(fetched_for_ground)

            for item in fetched_for_ground:
                cid = str(item.get("id") or item.get("challenge_id") or "").strip()
                if not cid:
                    continue
                detail_obj: dict[str, Any] | None = None
                resolved_urls: dict[str, dict[str, Any]] = {}

                # 对新题目在预算内顺手拉取完整题面与签名附件 URL，
                # 既让题板立即有题面/附件，又不拖慢同步超时。
                if cid not in known and details_fetched < detail_enrich_budget:
                    try:
                        det_raw = await client.call_tool(
                            "ctf2_get_practice_challenge",
                            {"practice_ground_id": gid, "challenge_id": cid},
                        )
                        det_json = extract_mcp_json(det_raw)
                        detail_obj = _unwrap_object(det_json, "challenge", "data")
                        details_fetched += 1
                        files = detail_obj.get("files") if isinstance(detail_obj, dict) else None
                        if isinstance(files, list) and files:
                            resolved_urls = await _resolve_practice_attachments(
                                client, gid, cid, files
                            )
                    except McpError as exc:
                        logger.debug("MCP 补全题目详情失败 (%s/%s): %s", gid, cid, exc)

                normalized = normalize_mcp_challenge(
                    item, detail=detail_obj, resolved_urls=resolved_urls
                )
                collected["practice_details"].append(
                    {"practice_id": gid, "challenge": normalized}
                )

        # 2. 获取赛事列表（如果指定了非练习场 ID，或全量同步时平台有进行中赛事）
        comp_targets: list[str] = [cid for cid in wanted if cid not in ground_ids]
        if not wanted_set:
            try:
                comps_raw = await client.call_tool(
                    "ctf2_list_competitions", {"page": 1, "page_size": 20}
                )
                for comp in _extract_items(extract_mcp_json(comps_raw), "competitions"):
                    rid = str(comp.get("id") or comp.get("competition_id") or "").strip()
                    if rid:
                        comp_targets.append(rid)
            except McpError as exc:
                logger.debug("MCP 获取赛事列表跳过：%s", exc)

        for comp_id in dict.fromkeys(comp_targets):
            try:
                comp_raw = await client.call_tool(
                    "ctf2_get_competition", {"competition_id": comp_id}
                )
                comp_obj = _unwrap_object(extract_mcp_json(comp_raw), "competition", "data")
                stages = comp_obj.get("stages")
                if not isinstance(stages, list):
                    stages = []
                entry: dict[str, Any] = {
                    "remote_id": comp_id,
                    "status": comp_obj or {"id": comp_id, "name": f"#{comp_id}"},
                    "challenges": [],
                }
                for stage in stages:
                    if not isinstance(stage, dict):
                        continue
                    stage_id = str(stage.get("id") or stage.get("stage_id") or "").strip()
                    if not stage_id:
                        continue
                    sc_raw = await client.call_tool(
                        "ctf2_list_competition_challenges",
                        {"competition_id": comp_id, "stage_id": stage_id, "limit": 100},
                    )
                    for item in _extract_items(extract_mcp_json(sc_raw), "challenges"):
                        cid = str(item.get("id") or item.get("challenge_id") or "").strip()
                        if not cid:
                            continue
                        det_obj: dict[str, Any] | None = None
                        att_urls: dict[str, dict[str, Any]] = {}
                        if cid not in known and details_fetched < detail_enrich_budget:
                            try:
                                d_raw = await client.call_tool(
                                    "ctf2_get_competition_challenge",
                                    {
                                        "competition_id": comp_id,
                                        "stage_id": stage_id,
                                        "challenge_id": cid,
                                    },
                                )
                                det_obj = _unwrap_object(
                                    extract_mcp_json(d_raw), "challenge", "data"
                                )
                                details_fetched += 1
                                files = det_obj.get("files") if isinstance(det_obj, dict) else None
                                if isinstance(files, list) and files:
                                    att_urls = await _resolve_competition_attachments(
                                        client, comp_id, stage_id, cid, files
                                    )
                            except McpError as exc:
                                logger.debug("MCP 赛事题详情跳过 (%s): %s", cid, exc)
                        normalized = normalize_mcp_challenge(
                            item, detail=det_obj, resolved_urls=att_urls
                        )
                        entry["challenges"].append((stage_id, normalized))
                        collected["mcp_total_listed"] += 1
                collected["competitions"].append(entry)
            except McpError as exc:
                collected["errors"].append(f"赛事 {comp_id}：{exc}")

    return collected


async def pull_challenge_via_mcp(
    token: str,
    *,
    practice_ids: list[str],
    challenge_id: str,
    mcp_url: str = CTF2_DEFAULT_MCP_URL,
) -> tuple[str | None, dict[str, Any] | None]:
    """通过官方 MCP 按 challenge_id 拉取单题完整详情与签名附件 URL。"""
    cfg = build_ctf2_mcp_config(token, url=mcp_url)
    async with McpClient(cfg) as client:
        for pid in practice_ids:
            try:
                raw = await client.call_tool(
                    "ctf2_get_practice_challenge",
                    {"practice_ground_id": pid, "challenge_id": challenge_id},
                )
                detail = _unwrap_object(extract_mcp_json(raw), "challenge", "data")
            except McpError:
                continue
            if not detail or not (detail.get("id") or detail.get("challenge_id")):
                continue
            files = detail.get("files") if isinstance(detail.get("files"), list) else []
            resolved_urls = (
                await _resolve_practice_attachments(client, pid, challenge_id, files)
                if files
                else {}
            )
            return pid, normalize_mcp_challenge(
                detail, detail=detail, resolved_urls=resolved_urls
            )
    return None, None


def _safe_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


__all__ = [
    "CTF2_DEFAULT_MCP_NAME",
    "CTF2_DEFAULT_MCP_URL",
    "CTF2_DEFAULT_MCP_NOTES",
    "build_ctf2_mcp_config",
    "extract_mcp_json",
    "list_remote_sources_via_mcp",
    "normalize_mcp_attachments",
    "normalize_mcp_challenge",
    "probe_agent_via_mcp",
    "pull_challenge_via_mcp",
    "sync_via_mcp",
]
