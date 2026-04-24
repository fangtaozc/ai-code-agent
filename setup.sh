#!/usr/bin/env bash
# 首次安装脚本 —— 安装依赖并生成配置文件
# 克隆项目后运行一次,可以重复运行,不会覆盖已有的 configs/config

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AI Code Agent — 首次安装"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 检查 Node.js 版本 ─────────────────────────────────────────────────────────
NODE_VERSION=$(node --version 2>/dev/null || echo "none")
MAJOR=$(echo "$NODE_VERSION" | sed 's/v\([0-9]*\).*/\1/')
if [ "$NODE_VERSION" = "none" ] || [ "${MAJOR:-0}" -lt 22 ] 2>/dev/null; then
  echo ""
  echo "❌ 需要 Node.js 22 或更高版本,当前版本:$NODE_VERSION"
  echo ""
  echo "   安装方法:"
  echo "   1. 打开 https://nodejs.org"
  echo "   2. 下载 LTS 版本并安装"
  echo "   3. 重新打开终端,再运行此脚本"
  exit 1
fi
echo "✓ Node.js $NODE_VERSION"

# ── 安装依赖 ─────────────────────────────────────────────────────────────────
echo ""
echo "[1/3] 安装 agent-bridge 依赖包（首次可能需要 1-2 分钟）..."
cd "$ROOT/agent-bridge" && npm install --silent
echo "✓ agent-bridge 依赖安装完成"

echo "[2/3] 安装 cloud-relay 依赖包（首次可能需要 1-2 分钟）..."
cd "$ROOT/cloud-relay" && npm install --silent
echo "✓ cloud-relay 依赖安装完成"

# ── 生成配置文件 ──────────────────────────────────────────────────────────────
echo "[3/3] 生成配置文件..."

CONFIG="$ROOT/configs/config"
if [ ! -f "$CONFIG" ]; then
  cp "$ROOT/configs/config.example" "$CONFIG"
  echo "  已创建 configs/config"
else
  echo "  configs/config 已存在,跳过"
fi

# ── 完成 ──────────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ 安装完成！"
echo ""
echo "  下一步:"
echo ""
echo "  1. 打开 configs/config,填写你的 API Key:"
echo "     • 用 Claude:填写 ANTHROPIC_API_KEY"
echo "     • 用 Codex :填写 OPENAI_API_KEY"
echo ""
echo "  2. 启动服务（把路径换成你的项目路径）:"
echo "     ./start-local.sh /你的/项目路径"
echo ""
echo "  3. 浏览器打开:"
echo "     http://localhost:3000/bridge"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
