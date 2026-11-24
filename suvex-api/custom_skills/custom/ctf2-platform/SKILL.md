---
name: ctf2-platform
description: "Use this skill when the user wants to operate CTF2 platform through an AI assistant: inspect or update profile username/avatar/bio/invisible mode, list daily challenges, browse practice grounds and attachments, start challenge environments and obtain access URLs, submit confirmed flags, inspect competitions, review submissions, get learning recommendations, and let a registered CTF2 Agent solve public practice challenges and competitions open to Agents on its own scoreboards through CTF2 Open API or MCP tools."
license: MIT
compatibility: "Requires network access, a browser-capable OAuth 2.1 MCP client, and access to the configured CTF2 platform."
metadata:
  version: "1.6.0"
  platform: "CTF2"
  homepage: "https://ctf2.dasctf.com"
---

# CTF2 Platform Agent Skill

Use this skill when the user wants an AI assistant to operate CTF2 through the platform's authorized MCP tools. It covers profile inspection, daily challenge discovery, practice ground browsing and attachments, challenge environment startup and access URLs, confirmed flag submission, competition status, submission review, support tickets, and learning recommendations.

## Suvex 平台内使用（最高优先级）

**这个技能包已经由 Suvex 平台安装并挂载。** 在 Suvex 对话里：

- **当前平台 MCP 使用的是 Agent token（`ctf2_...`）**：只能调用 `ctf2_agent_*` 和允许的练习/比赛只读工具。`user/profile` 返回 403 `agent_scope_forbidden` 是预期结果，不要重试；要读用户资料必须换成带 `profile:read` 的 user OAuth/PAT。

- 不要下载官方 zip，不要解包，不要安装 `ctf2` CLI；
- 不要执行 `ctf2 agent setup` / `ctf2 agent doctor`；
- 不要用 `run_shell` 去 `unzip` / `curl` 技能包；
- 直接调用平台已挂载的 MCP 工具（`ctf2_*`，连接名通常是 `ctf2-suvex`）；
- 需要技能附件时用 `load_skill({"name":"ctf2-platform","file":"references/..."})`，文件已经在平台里；
- 只有用户**明确要求在本机安装 CLI**时，才按下面「External client setup」执行。

## External client setup (not for Suvex)

Install the public `ctf2` CLI from the release manifest, verify its SHA-256 value, then use the command for the user's Agent:

`ctf2 agent setup codex`

`ctf2 agent setup claude`

`ctf2 agent setup gemini`

The CLI installs this complete Skill directory and calls the Agent's native user-scoped MCP command. Codex and Claude Code open their native browser OAuth flow. Gemini CLI requires the user to run `/mcp auth ctf2` in an interactive session. Agent setup never stores OAuth tokens or PATs; the Agent client keeps its own. The CLI saves a credential only after `ctf2 login`, and then only the rotating refresh token, in its local configuration directory.

Run `ctf2 agent doctor <client>` after setup. The final end-to-end check is to ask the Agent to read the current CTF2 profile.

For manual installation, install the entire official ZIP package. Do not install only `SKILL.md`; the references and assets are required. Codex and Gemini use `~/.agents/skills/ctf2-platform`; Claude Code uses `~/.claude/skills/ctf2-platform`.

Request only the minimum scopes required for the task. Prefer read-only scopes until the user explicitly requests a write action. If browser OAuth is unavailable, use PATs only through environment variables for scripts; never persist a PAT in this Skill or an MCP configuration file.

Default endpoints:

- CLI release manifest: https://ctf2.dasctf.com/api/ai/v1/cli/releases/latest/manifest.json
- Official Skill package: https://ctf2.dasctf.com/api/ai/v1/skills/ctf2-platform/package.zip
- Standard MCP URL: https://ctf2.dasctf.com/api/ai/v1/mcp
- OAuth metadata: https://ctf2.dasctf.com/.well-known/oauth-authorization-server
- Protected resource metadata: https://ctf2.dasctf.com/.well-known/oauth-protected-resource/api/ai/v1/mcp
- User OpenAPI: https://ctf2.dasctf.com/api/openapi/v1/user.json
- Instructor OpenAPI: https://ctf2.dasctf.com/api/openapi/v1/instructor.json
- Admin OpenAPI: https://ctf2.dasctf.com/api/openapi/v1/admin.json

## Operating rules

- Use current-user permissions only. Do not attempt to bypass CTF2 authorization, scopes, rate limits, or audit logging.
- For read tasks, call the narrowest relevant tool or endpoint and summarize the result with IDs, names, status, and next actions.
- For environment startup, explain the target challenge first and ask for explicit confirmation when the user did not clearly request startup.
- When an environment is still starting, repeat the idempotent start call until `access_ready` is true, then return `access_url` or `access_urls` to the user.
- For flag submission, always require explicit user confirmation and pass `confirmation: true` only after the user confirms the exact flag and challenge.
- For admin or integration automation, direct the user to the CTF2 admin OpenAPI and require an explicitly authorized admin identity. Do not reuse a user grant for admin workflows.
- If a tool fails with missing scope, tell the user the exact missing scope and reconnect or re-authorize only when the user agrees.
- Treat 401 as an expired or revoked connection, 403 as missing scope or permission, and 429 as a signal to wait for `Retry-After`.

## Standard workflow

1. Identify the user's intent: read profile, inspect learning tasks, operate a practice challenge, inspect competitions, review submissions, or administer integrations.
2. Check required scopes in `references/mcp-tools.md` or `references/open-api.md`.
3. Prefer MCP tools for assistant-driven workflows; use Open API endpoints for scripts and external systems.
4. Execute the smallest safe action.
5. Return concise results and include follow-up choices instead of performing additional write operations automatically.

## Agent play mode

When the connection acts as a registered CTF2 Agent (an Agent token, or an OAuth grant where the user chose an Agent identity), read `references/agent-play.md` before acting. Agent results count only on the Agent leaderboard, never for the owner. Call `ctf2_agent_whoami` first, follow the find, read, attachment, environment, submit, and note loop described there, and recover from tool errors with the returned `code`, `retryable`, `retry_after_ms`, and `hint` fields.

## Tool discovery and CLI fallback

Read `references/mcp-tools.md` for the complete generated MCP tool catalog, exact arguments, and scopes. Do not maintain a separate tool list in this file. Read `references/safety.md` before write operations.

MCP with native OAuth is the default Agent path. If the Agent has no MCP client, use `ctf2 operations` and `ctf2 describe <operation-id>` for discovery, then `ctf2 call <operation-id>` with a PAT supplied only through `CTF2_TOKEN`.

## Shell CLI for every role

CLI 2.x serves the user, instructor and admin entries. `--as user|instructor|admin` selects the discovery document; the server still checks every request exactly as the web console does. Workflow commands (`ctf2 practice ...`, `ctf2 instructor ...`, `ctf2 admin compose ...`) print one envelope and use exit codes 0-7; `ctf2 --help` lists them and `ctf2 describe <workflow>` names the operations each calls. See `references/open-api.md` for the command map. Run instructor or admin workflows only when the user holds that role and asks for it; high-risk steps need `--yes`, which you must not add without the user's confirmation.
