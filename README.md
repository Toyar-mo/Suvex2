# Suvex 2

**新一代自治安全测试与 CTF 智能体工作台**

Suvex 2 是 [Suvex](https://github.com/Toyar-mo/Suvex) 的第二代演进版本。首期升级从零重构了全新 **Editorial Studio** 风格前端工程（`suvex-web`），并采用完全独立隔离的多实例部署架构。

---

## 第一阶段升级亮点

- **全新 Editorial Studio 视觉体系**：默认清爽瓷白 / 暖石浅色工作台（支持一键切换深色工作室模式），本地打包 Geist / Noto Sans SC / JetBrains Mono 字体，克制的层次与等宽数字遥测排版。
- **从零新建独立前端工程（React 19 + TypeScript + Vite + Tailwind CSS）**：
  - **着陆页 (`/`) & 鉴权页 (`/login`, `/setup`)**：自动探测实例初始化与会话状态，严格校验强口令规则。
  - **全局态势总览 (`/overview`)**：行为流优先布局，实时活动流 + 综合风险指数 + 待关注事项 + 累积统计。
  - **对话工作台 (`/chat`)**：全视口分栏会话管理、SSE 逐 token 流式输出、可折叠思考过程、结构化工具调用卡、高危工具人工审批、运行中插话纠偏与附件上传。
  - **扫描任务 (`/scans`)**：支持 Web / Git 仓库 / 本地路径 / 裸 TCP 服务 / 纯附件五类目标，三档成功判据（`findVulns` / `captureFlag` / `verifyFix`），强制逐字授权声明留痕、附件暂存、人工线索注入与题解报告预览。
  - **智能体实时活动流 (`/activity`)**：先拉历史种子再建 SSE 订阅（带 `lastEventId` 游标），实时协作智能体编制与载荷检视。
  - **漏洞发现与处置 (`/findings`)**：证据强度（PoC 确证 / 启发式线索）与处置状态双轴解耦，支持 PoC 一键复制、修复步骤与 SARIF / JSON 导出。
  - **CTF 夺旗工作台 (`/ctf`)**：赛题平台绑定、一键同步与单题拉取、自动解题队列、直连题目对话、Flag 校验与 Writeup 渲染。
  - **模型接入 (`/models`) & 系统设置 (`/settings`)**：大模型 Provider 增删改与连通性测活、实例深度自检、沙箱配额、API 令牌签发与口令管理。
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
