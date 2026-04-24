#!/usr/bin/env bash
# 停止所有本地 ai-code-agent 服务
# 读取 start-local.sh 写入的 PID 文件，逐一终止进程

PID_FILE="/tmp/ai-code-agent-local.pids"

if [ ! -f "$PID_FILE" ]; then
  echo "[stop] 未找到 PID 文件：$PID_FILE"
  echo "[stop] 服务可能未在运行，或已被手动停止"
  exit 0
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

# 等待一秒后清理端口残留进程（兜底）
sleep 1

# 额外：清理仍占用 3000 端口的进程（防止 nohup 子进程逃逸）
RELAY_PID_ON_PORT=$(lsof -ti tcp:3000 2>/dev/null || true)
if [ -n "$RELAY_PID_ON_PORT" ]; then
  echo "[stop] 清理端口 3000 残留进程: PID=$RELAY_PID_ON_PORT"
  kill $RELAY_PID_ON_PORT 2>/dev/null || true
fi

rm -f "$PID_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  已停止：$STOPPED 个进程"
[ "$FAILED" -gt 0 ] && echo "  失败：$FAILED 个进程"
echo "  PID 文件已清理：$PID_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
