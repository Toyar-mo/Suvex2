# Suvex 2

**新一代自治安全测试与 CTF 智能体工作台**

Suvex 2 是 [Suvex](https://github.com/Toyar-mo/Suvex) 的第二代演进版本。首期升级从零重构了全新 **Editorial Studio** 风格前端工程（`suvex-web`），并采用完全独立隔离的多实例部署架构。

---

## 已完成前端全模块重构（19 个工作台页面）

- **全新 Editorial Studio 视觉体系**：默认清爽瓷白 / 暖石浅色工作台（支持一键切换深色工作室模式），本地打包 Geist / Noto Sans SC / JetBrains Mono 字体，克制的层次与等宽数字遥测排版，配 `⌘K` 全局命令面板。
- **运行与交互**：总览 (`/overview`)、对话工作台 (`/chat`)、扫描任务 (`/scans`)、智能体实时活动流 (`/activity`)、内网会话台账 (`/intranet`)。
- **资产与产出**：漏洞发现与处置 (`/findings`)、资产覆盖总览 (`/assets`)、交付报告中心 (`/reports`)、凭据库 (`/credentials`)、文件管理 (`/files`)。
- **自动化与专项**：CTF 夺旗工作台 (`/ctf`)、应急响应复盘 (`/ir`)、定时复查计划 (`/schedules`)。
- **能力与治理**：工具与 MCP 管理 (`/tools`)、技能库编辑器 (`/skills`)、Agent 角色管理 (`/agents`)、审批记录 (`/approvals`)、模型接入 (`/models`)、系统设置 (`/settings`)。
- **着陆与鉴权**：品牌着陆页 (`/`)、首次管理员初始化 (`/setup`)、会话登录 (`/login`)。
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
