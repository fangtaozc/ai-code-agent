# CLAUDE.md — AI Code Agent 项目说明

## 项目是什么

在浏览器里操控 Claude / Codex AI 帮你写代码。AI 运行在本地，可以读写你指定项目的文件，每次执行命令前会在网页上询问你是否批准。

## 整体架构

```
浏览器（网页 UI）
    │  WebSocket /ws/ui
    ▼
cloud-relay（Next.js 15 + WebSocket 服务器）
    │  WebSocket /ws/bridge
    ▼
agent-bridge（本地进程，每个项目一个）
    ├── Claude SDK（bridge-ws.ts）
    └── Codex SDK（bridge-ws-codex.ts）
```

- **cloud-relay** — 中间层，负责转发消息、管理项目列表、存储聊天历史、处理工具审批流程
- **agent-bridge** — 运行在本地的进程，连接到 relay，调用 Claude 或 Codex SDK，以项目目录作为工作目录

## 关键文件

| 文件 | 作用 |
|---|---|
| `cloud-relay/src/server.ts` | HTTP + WebSocket 入口，路由 `/ws/bridge` 和 `/ws/ui` |
| `cloud-relay/src/lib/store.ts` | 内存中的会话状态、消息历史、工具审批队列 |
| `cloud-relay/src/lib/local-manager.ts` | 启动/停止 bridge 子进程，状态持久化到 `~/.agent-bridge/local-state.json` |
| `cloud-relay/src/lib/types.ts` | 所有消息协议类型定义 |
| `cloud-relay/app/` | Next.js 前端页面和组件 |
| `agent-bridge/src/bridge-ws.ts` | Claude bridge 实现 |
| `agent-bridge/src/bridge-ws-codex.ts` | Codex bridge 实现 |
| `agent-bridge/src/session-store.ts` | 会话 ID 持久化，重启后可续接对话 |
| `agent-bridge/src/types.ts` | Bridge ↔ Relay 消息类型（与 cloud-relay/types.ts 同步） |

## 本地开发命令

```bash
# 首次安装
./setup.sh

# 一键启动（构建 + 启动 relay + 启动 bridge）
./start-local.sh /path/to/project

# 停止所有进程
./stop-local.sh

# Relay 开发模式（热更新，无需 build）
cd cloud-relay && npm run dev

# 单独启动 Claude bridge
cd agent-bridge
RELAY_URL=ws://localhost:3000/ws/bridge npm run cloud -- /path/to/project

# 单独启动 Codex bridge
cd agent-bridge
RELAY_URL=ws://localhost:3000/ws/bridge npm run cloud:codex -- /path/to/project

# 类型检查
cd cloud-relay && npm run typecheck
```

## 消息协议

- Bridge → Relay：`BridgeMessage`
- Relay → Bridge：`RelayToBridge`
- UI → Relay：`UIMessage`
- Relay → UI：`RelayToUI`

类型定义在 `cloud-relay/src/lib/types.ts`。

## 本地状态文件位置

- 项目列表 + PID：`~/.agent-bridge/local-state.json`
- Claude 会话 ID：`~/.agent-bridge/sessions.json`

## 环境变量

`agent-bridge/.env`：
- `ANTHROPIC_API_KEY` — Claude API Key
- `ANTHROPIC_BASE_URL` — 代理地址（可选）
- `OPENAI_API_KEY` — Codex API Key
- `OPENAI_BASE_URL` — Azure/代理地址（可选）
- `RELAY_URL` — cloud-relay 的 WebSocket 地址

`cloud-relay/.env`：
- `PORT` — 端口，默认 3000
- `NODE_ENV` — production / development
- `ACCESS_TOKEN` — 设置后启用登录页（本地使用留空）
