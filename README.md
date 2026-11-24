# Suvex 2

**新一代自治安全测试与 CTF 智能体工作台**

Suvex 2 是 [Suvex](https://github.com/Toyar-mo/Suvex) 的第二代演进版本。首期升级从零重构了全新 **Editorial Studio** 风格前端工程（`suvex-web`），并采用完全独立隔离的多实例部署架构。

---

## 已完成前端全模块重构（20 个工作台页面）与 Suvex 2.1 架构升级

- **后端架构升级（Suvex 2.1）**：
  - **异步实时事件总线 (`app/events/bus.py` + `stream.py`)**：将 SSE 从「每连接独占线程 + 每秒同步轮询 DB」升级为 SQLAlchemy `after_commit` 触发的异步 `ActivityEventBus` 实时推送（`<50ms` 延迟、零线程耗尽，保留 `Last-Event-ID` 断点补发与 `resync`）。
  - **Agent 角色画像执行器绑定 (`app/agents/binding.py` + `app/chat/profile_runtime.py`)**：新增 `chat_sessions.agent_profile_id`（Alembic `s9a0b1c2d3e4`），角色画像声明的 `tools` 白名单、`skills`、`mcpServers` 与职责提示词在执行引擎真正生效。
  - **统一系统遥测 API (`GET /api/v1/system/telemetry`)**：聚合 EventBus 订阅数、扫描/CTF 队列、运行中 Docker 沙箱容器、模型连通性与数据库连接池状态。
- **全新 Editorial Studio 视觉体系**：默认清爽瓷白 / 暖石浅色工作台（支持一键切换深色工作室模式），本地打包 Geist / Noto Sans SC / JetBrains Mono 字体，配 `⌘K` 全局命令面板。
- **运行与交互**：总览 (`/overview`，含实时 SSE + Token 趋势图 + 质量评分卡 + 系统遥测)、对话工作台 (`/chat`，含角色画像绑定 + 分支 Fork/树 + 计划条 + 断线自动续接 + 中断恢复 + 工作区文件 + 攻击链路径图 + JSONL 导出)、扫描任务 (`/scans`，含双扫描差异对比 + 批量操作)、**多智能体协同作战图 (`/missions`)**、智能体活动 (`/activity`，含 5 阶段泳道视图)、内网会话 (`/intranet`)。
- **资产与产出**：漏洞发现 (`/findings`，含分组视图 + 批量处置 + 一键派发 Retester/Verifier 自动验证闭环 + 附件存证)、资产总览 (`/assets`，含交互式攻击面拓扑图 + 蜜罐研判)、交付报告 (`/reports`)、凭据库 (`/credentials`)、文件管理 (`/files`)。
- **自动化与专项**：CTF 夺旗 (`/ctf`，含多模型赛跑自动托管 + 批量开解 + 按分值排优)、应急响应 (`/ir`)、定时复查 (`/schedules`)。
- **能力与治理**：工具与 MCP (`/tools`)、技能库 (`/skills`)、Agent 角色 (`/agents`)、审批记录 (`/approvals`)、模型接入 (`/models`)、系统设置 (`/settings`)。
- **独立隔离部署（Kali VM `192.168.44.128`）**：
  - 目录：`/opt/suvex2`
  - PostgreSQL：`suvex2-db` (`127.0.0.1:55434`)
  - 后端 API：`suvex2-api.service` (`127.0.0.1:8002`)，独立会话 Cookie `suvex2_session`
  - 前端入口：Nginx `:8090` (`http://192.168.44.128:8090`)

---

## 目录结构

```text
Suvex2/
├── suvex-web/          # Suvex 2 全新独立前端（React 19 + TS + Tailwind）
├── suvex-api/          # FastAPI + SQLAlchemy + Alembic 后端与自治执行内核
├── deploy/suvex2/      # Suvex 2 独立 systemd 与 Nginx 部署配置
├── docs/               # API 契约文档 (api-contract.md)
├── prompts/            # 智能体提示词资产
└── scripts/            # 运维与校验脚本
```

## 本地开发

```bash
# 1. 前端开发服务器（默认代理 /api -> http://127.0.0.1:8002）
cd suvex-web
npm install
npm run dev

# 2. 构建与测试
npm run typecheck
npm run test
npm run build
```
