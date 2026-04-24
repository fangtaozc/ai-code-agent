# AI Code Agent

在浏览器里操控 Claude / Codex 帮你写代码，实时看到 AI 的每一步操作，并可以随时批准或拒绝它的工具调用。

---

## 它能做什么

- 打开网页，就能让 AI 在你指定的项目文件夹里写代码、运行命令
- 实时看到 AI 的输出，像聊天一样流式显示
- 每次 AI 要执行命令或修改文件前，你可以选择**批准**或**拒绝**（也可以开启自动批准）
- 同时管理多个项目，侧边栏一键切换
- 支持 Claude（Anthropic）和 Codex（OpenAI）两种 AI

---

## 第一步：安装 Node.js

Node.js 是运行这个工具必须的环境，如果你已经装过可以跳过。

**怎么检查有没有安装：** 打开终端，输入：
```
node --version
```
如果看到 `v22.x.x` 或更高版本，说明已经安装，可以跳过。

**没有安装或版本太低的话：**
1. 打开 https://nodejs.org
2. 点击 **"LTS"** 版本下载（不要下 Current）
3. 双击安装包，一路点"继续"完成安装
4. 重新打开终端，再次运行 `node --version` 确认安装成功

---

## 第二步：获取 API Key

AI 需要通过 API Key 才能运行，根据你想用哪种 AI 来获取对应的 Key。

**Claude（推荐）：**
1. 打开 https://console.anthropic.com
2. 注册或登录
3. 进入 **API Keys** 页面，点击 **Create Key**
4. 复制这个 Key（以 `sk-ant-` 开头），保存好，页面关掉就看不到了

**Codex（OpenAI）：**
1. 打开 https://platform.openai.com
2. 注册或登录
3. 进入 **API Keys** 页面，点击 **Create new secret key**
4. 复制这个 Key（以 `sk-` 开头）

> 如果你的公司或团队有自己的 API 代理地址，用那个地址和对应的 Key 也可以，后面配置里会说明怎么填。

---

## 第三步：下载项目

打开终端，运行：

```bash
git clone https://github.com/YOUR_USERNAME/ai-code-agent.git
cd ai-code-agent
```

> 没有安装 git？去 https://git-scm.com 下载安装，或者直接在 GitHub 页面点 **Code → Download ZIP**，解压后进入文件夹。

---

## 第四步：一键安装依赖

在项目根目录运行：

```bash
./setup.sh
```

这个脚本会自动：
1. 检查 Node.js 版本
2. 安装所有依赖包
3. 生成配置文件（`agent-bridge/.env` 和 `cloud-relay/.env`）

运行完会看到提示，告诉你下一步要做什么。

---

## 第五步：填写 API Key

打开文件 `agent-bridge/.env`，用任意文本编辑器编辑（记事本、VS Code 都行）。

文件内容长这样：

```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_BASE_URL=
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=
RELAY_URL=ws://localhost:3000/ws/bridge
```

**怎么填：**

- 用 Claude：把 `sk-ant-...` 换成你的 Anthropic API Key，其余行不用动
- 用 Codex：把 `sk-...` 换成你的 OpenAI API Key，其余行不用动
- 用代理/Azure：`BASE_URL` 那行填上你的代理地址，否则留空
- `RELAY_URL` 这行**不要动**，本地使用保持默认即可

**示例（只用 Claude）：**
```
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxx
ANTHROPIC_BASE_URL=
OPENAI_API_KEY=
OPENAI_BASE_URL=
RELAY_URL=ws://localhost:3000/ws/bridge
```

保存文件。

---

## 第六步：启动

在项目根目录，运行：

```bash
./start-local.sh /你的/项目路径
```

把 `/你的/项目路径` 换成你想让 AI 操作的项目文件夹的路径，比如：

```bash
./start-local.sh /Users/yourname/my-project
```

> **不知道路径怎么写？**
> 在终端里进入你的项目文件夹，然后输入 `pwd`，把输出的路径复制过来就行。

脚本会自动构建并启动所有服务（大约需要 30 秒）。看到这个就说明成功了：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ 所有服务已在后台启动
  Web UI → http://localhost:3000/bridge
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 第七步：打开网页

浏览器打开：**http://localhost:3000/bridge**

你会看到：
- 左侧侧边栏：你添加的项目列表
- 右侧：对话框，直接输入问题或任务发给 AI

---

## 停止服务

不想用了，在项目根目录运行：

```bash
./stop-local.sh
```

---

## 同时启动多个项目

```bash
./start-local.sh /项目A路径 /项目B路径 /项目C路径
```

启动后在网页侧边栏点击不同项目就能切换。

---

## 在网页里直接添加项目

不需要重启服务。启动后，在网页左下角点击 **"管理项目"** → **"添加项目"**，填入项目路径，选择 AI 类型（Claude 或 Codex），点确认即可。

---

## 常见问题

**问：运行 `./start-local.sh` 提示"Permission denied"**
```bash
chmod +x start-local.sh stop-local.sh setup.sh
```
然后再运行。

**问：网页打开后显示空白或报错**
查看日志文件：
```bash
cat /tmp/ai-code-agent-relay.log
```

**问：AI 一直不回复**
检查 `agent-bridge/.env` 里的 API Key 是否填写正确，确认没有多余的空格或引号。

**问：端口 3000 被占用**
修改 `cloud-relay/.env`，把 `PORT=3000` 改成其他端口，比如 `PORT=3001`，然后重新启动。

**问：想换一个项目文件夹**
先停止 `./stop-local.sh`，然后重新运行 `./start-local.sh /新的/路径`。

---

## 配置说明（`agent-bridge/.env`）

| 配置项 | 说明 |
|---|---|
| `ANTHROPIC_API_KEY` | Claude 的 API Key，用 Claude 时必填 |
| `ANTHROPIC_BASE_URL` | Claude API 代理地址，用官方 API 时留空 |
| `OPENAI_API_KEY` | Codex 的 API Key，用 Codex 时必填 |
| `OPENAI_BASE_URL` | OpenAI/Azure API 代理地址，用官方 API 时留空 |
| `RELAY_URL` | 本地使用固定填 `ws://localhost:3000/ws/bridge`，不用改 |
