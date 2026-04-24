#!/usr/bin/env bash
# 停止所有本地 ai-code-agent 服务
# 读取 start-local.sh 写入的 PID 文件，逐一终止进程

ROOT="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$ROOT/configs/config"
PID_FILE="$ROOT/tmp/local.pids"

if [ ! -f "$PID_FILE" ]; then
  echo "[stop] 未找到 PID 文件：$PID_FILE"
  echo "[stop] 服务可能未在运行，或已被手动停止"
  exit 0
fi

# 从配置文件读取端口（用于清理残留进程）
PORT=3000
if [ -f "$CONFIG_FILE" ]; then
  _PORT=$(grep '^PORT=' "$CONFIG_FILE" | cut -d= -f2 | tr -d '[:space:]')
  [ -n "$_PORT" ] && PORT="$_PORT"
fi

echo "[stop] 正在停止本地服务..."

STOPPED=0
FAILED=0

while IFS= read -r PID; do
  [ -z "$PID" ] && continue
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null && echo "[stop] ✓ 已终止进程 PID=$PID" && STOPPED=$((STOPPED + 1)) \
      || { echo "[stop] ✗ 无法终止 PID=$PID"; FAILED=$((FAILED + 1)); }
  else
    echo "[stop] ⚠ 进程 PID=$PID 已不存在（跳过）"
  fi
done < "$PID_FILE"

sleep 1

# 清理端口残留（只清理本配置的端口，不影响其他服务）
RELAY_PID_ON_PORT=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
if [ -n "$RELAY_PID_ON_PORT" ]; then
  echo "[stop] 清理端口 $PORT 残留进程: PID=$RELAY_PID_ON_PORT"
  kill $RELAY_PID_ON_PORT 2>/dev/null || true
fi

rm -f "$PID_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  已停止：$STOPPED 个进程"
[ "$FAILED" -gt 0 ] && echo "  失败：$FAILED 个进程"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
