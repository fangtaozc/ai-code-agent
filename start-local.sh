#!/usr/bin/env bash
# 本地启动脚本 —— cloud-relay 跑在 localhost:3000
# 服务启动后自动转入后台运行，日志写入 /tmp/ai-code-agent-*.log
# 用法：./start-local.sh [项目路径1] [项目路径2] ...

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
RELAY_LOCAL="ws://localhost:3000/ws/bridge"
PID_FILE="/tmp/ai-code-agent-local.pids"
RELAY_LOG="/tmp/ai-code-agent-relay.log"

# ── 检查是否已在运行 ─────────────────────────────────────────────────────────
if [ -f "$PID_FILE" ]; then
  echo "[local] 检测到已存在的 PID 文件：$PID_FILE"
  echo "[local] 请先运行 ./stop-local.sh 停止旧进程，或删除该文件后重试"
  exit 1
fi

# ── 清空旧日志 ───────────────────────────────────────────────────────────────
: > "$RELAY_LOG"

# ── 1. 构建 cloud-relay（清理旧缓存，避免 chunk 丢失报错）───────────────────
echo "[local] 构建 cloud-relay..."
cd "$ROOT/cloud-relay"
rm -rf .next
if ! npm run build >> "$RELAY_LOG" 2>&1; then
  echo "[local] ❌ cloud-relay 构建失败，请查看日志：$RELAY_LOG"
  exit 1
fi
echo "[local] ✓ 构建完成"

# ── 2. 后台启动 cloud-relay ──────────────────────────────────────────────────
echo "[local] 启动 cloud-relay (port 3000) → 日志：$RELAY_LOG"
nohup env IS_LOCAL=true AGENT_BRIDGE_DIR="$ROOT/agent-bridge" npm run start >> "$RELAY_LOG" 2>&1 &
RELAY_PID=$!
echo "$RELAY_PID" > "$PID_FILE"

# 等待 relay 就绪（最多 40 秒）—— 用 /bridge 做健康探测（basePath=/bridge）
echo "[local] 等待 relay 就绪..."
for i in $(seq 1 40); do
  if curl -sf http://localhost:3000/bridge > /dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$RELAY_PID" 2>/dev/null; then
    echo "[local] ❌ relay 进程意外退出，请查看日志：$RELAY_LOG"
    rm -f "$PID_FILE"
    exit 1
  fi
  sleep 1
done

if ! curl -sf http://localhost:3000/bridge > /dev/null 2>&1; then
  echo "[local] ❌ relay 未能在 40 秒内就绪，请查看日志：$RELAY_LOG"
  rm -f "$PID_FILE"
  exit 1
fi
echo "[local] ✓ cloud-relay 已就绪 → http://localhost:3000/bridge"

# ── 3. 后台启动 agent-bridge（每个项目路径一个进程）───────────────────────────
cd "$ROOT/agent-bridge"
set -o allexport
source .env
set +o allexport

PROJECTS=("$@")
BRIDGE_INDEX=0
if [ ${#PROJECTS[@]} -eq 0 ]; then
  echo "[local] 未传入项目路径，跳过 agent-bridge 启动"
  echo "[local] 手动启动示例："
  echo "  cd agent-bridge && RELAY_URL=$RELAY_LOCAL npm run cloud -- --cloud /你的/项目路径"
else
  for PROJECT in "${PROJECTS[@]}"; do
    BRIDGE_LOG="/tmp/ai-code-agent-bridge-${BRIDGE_INDEX}.log"
    : > "$BRIDGE_LOG"
    echo "[local] 启动 bridge → $PROJECT (日志：$BRIDGE_LOG)"
    nohup env RELAY_URL="$RELAY_LOCAL" node --import tsx/esm src/bridge-ws.ts --cloud "$PROJECT" \
      >> "$BRIDGE_LOG" 2>&1 &
    BRIDGE_PID=$!
    echo "$BRIDGE_PID" >> "$PID_FILE"
    echo "[local] ✓ bridge PID=$BRIDGE_PID for $PROJECT"
    BRIDGE_INDEX=$((BRIDGE_INDEX + 1))
  done
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ 所有服务已在后台启动"
echo "  Web UI   → http://localhost:3000/bridge"
echo "  Relay WS → ws://localhost:3000/ws/bridge"
echo "  Relay WS → ws://localhost:3000/ws/ui"
echo "  Relay 日志 → $RELAY_LOG"
echo "  PID 文件  → $PID_FILE"
echo "  停止服务  → ./stop-local.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
