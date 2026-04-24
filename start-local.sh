#!/usr/bin/env bash
# 本地启动脚本 —— cloud-relay + agent-bridge 全部在后台运行
# 日志和 PID 文件写入项目根目录的 tmp/ 下（已 gitignore）
# 用法：
#   ./start-local.sh                        # 只启动服务，在网页中添加项目
#   ./start-local.sh /项目A路径 /项目B路径   # 同时启动指定项目的 bridge

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$ROOT/configs/config"

# ── 检查配置文件 ──────────────────────────────────────────────────────────────
if [ ! -f "$CONFIG_FILE" ]; then
  echo "[local] ❌ 未找到配置文件：$CONFIG_FILE"
  echo "[local] 请先运行 ./setup.sh，然后编辑 configs/config 填写 API Key"
  exit 1
fi

# ── 加载配置 ──────────────────────────────────────────────────────────────────
set -o allexport
# shellcheck disable=SC1090
source "$CONFIG_FILE"
set +o allexport

PORT="${PORT:-3000}"
RELAY_LOCAL="ws://localhost:${PORT}/ws/bridge"

# ── 运行时文件（项目相对路径，gitignore 忽略）────────────────────────────────
TMP_DIR="$ROOT/tmp"
mkdir -p "$TMP_DIR"
PID_FILE="$TMP_DIR/local.pids"
RELAY_LOG="$TMP_DIR/relay.log"

# ── 检查是否已在运行 ─────────────────────────────────────────────────────────
if [ -f "$PID_FILE" ]; then
  echo "[local] 检测到已存在的 PID 文件：$PID_FILE"
  echo "[local] 请先运行 ./stop-local.sh 停止旧进程，或删除该文件后重试"
  exit 1
fi

# ── 清空旧日志 ───────────────────────────────────────────────────────────────
: > "$RELAY_LOG"

# ── 1. 构建 cloud-relay ───────────────────────────────────────────────────────
echo "[local] 构建 cloud-relay..."
cd "$ROOT/cloud-relay"
rm -rf .next
if ! npm run build >> "$RELAY_LOG" 2>&1; then
  echo "[local] ❌ cloud-relay 构建失败，请查看日志：$RELAY_LOG"
  exit 1
fi
echo "[local] ✓ 构建完成"

# ── 2. 后台启动 cloud-relay ──────────────────────────────────────────────────
echo "[local] 启动 cloud-relay (port $PORT) → 日志：$RELAY_LOG"
nohup env IS_LOCAL=true NODE_ENV=production AGENT_BRIDGE_DIR="$ROOT/agent-bridge" npm run start >> "$RELAY_LOG" 2>&1 &
RELAY_PID=$!
echo "$RELAY_PID" > "$PID_FILE"

# 等待 relay 就绪（最多 40 秒）
echo "[local] 等待服务就绪..."
for i in $(seq 1 40); do
  if curl -sf "http://localhost:${PORT}/bridge" > /dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$RELAY_PID" 2>/dev/null; then
    echo "[local] ❌ relay 进程意外退出，请查看日志：$RELAY_LOG"
    rm -f "$PID_FILE"
    exit 1
  fi
  sleep 1
done

if ! curl -sf "http://localhost:${PORT}/bridge" > /dev/null 2>&1; then
  echo "[local] ❌ relay 未能在 40 秒内就绪，请查看日志：$RELAY_LOG"
  rm -f "$PID_FILE"
  exit 1
fi
echo "[local] ✓ cloud-relay 已就绪 → http://localhost:${PORT}/bridge"

# ── 3. 后台启动 agent-bridge（每个项目路径一个进程）───────────────────────────
PROJECTS=("$@")
BRIDGE_INDEX=0
if [ ${#PROJECTS[@]} -eq 0 ]; then
  echo "[local] 未传入项目路径，服务已启动"
  echo "[local] 请在网页中添加项目：http://localhost:${PORT}/bridge"
  echo "[local]   → 点击左下角「管理项目」→「添加项目」→ 填入项目路径 → 启动"
else
  for PROJECT in "${PROJECTS[@]}"; do
    BRIDGE_LOG="$TMP_DIR/bridge-${BRIDGE_INDEX}.log"
    : > "$BRIDGE_LOG"
    echo "[local] 启动 bridge → $PROJECT (日志：$BRIDGE_LOG)"
    nohup env RELAY_URL="$RELAY_LOCAL" node --import tsx/esm "$ROOT/agent-bridge/src/bridge-ws.ts" --cloud "$PROJECT" \
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
echo "  Web UI    → http://localhost:${PORT}/bridge"
echo "  Relay WS  → ws://localhost:${PORT}/ws/bridge"
echo "  Relay 日志 → $RELAY_LOG"
echo "  停止服务   → ./stop-local.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
