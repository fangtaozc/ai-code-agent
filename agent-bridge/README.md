# agent-bridge

Local bridge skeleton for the AI code agent system.

## Architecture

```
Local machine                        Cloud (future)
─────────────────────                ─────────────────
agent-bridge (this)  ←── WebSocket ──  relay server
  └─ Claude SDK                          └─ Web UI
     └─ canUseTool callback
```

The key assumption validated here: `canUseTool` intercepts **every** tool call and supports
async remote decisions (Promise-based), which means the cloud relay can hold each decision
until the user approves or denies from the browser UI.

## Setup

```bash
cd agent-bridge
cp .env.example .env
# Edit .env — add your ANTHROPIC_API_KEY

npm install
```

## Validate the Core Assumption

Run the validation script to confirm `canUseTool` works as expected:

```bash
npm run validate
```

You should see each tool call Claude wants to make printed to the terminal.
Type `y` to allow or `n`/Enter to deny. At the end, a summary shows all
intercepted calls and their latency — proving async remote decisions are supported.

### Expected output

```
=== canUseTool Validation Script ===
Working directory: /your/cwd
Prompt: list files in the current directory

─────────────────────────────────────────
TOOL REQUEST: bash
INPUT: { "command": "ls -la" }
Allow? [y/N] y

CLAUDE OUTPUT:
total 32
drwxr-xr-x  ...

=== INTERCEPTION SUMMARY ===
Total tool calls intercepted: 1
  [ALLOW] bash (waited 1243ms)

Result: canUseTool intercepts every tool call and supports async remote decisions. ✓
```

## Project structure

```
agent-bridge/
├── src/
│   ├── validate-cantool.ts   # Core assumption validation (run first)
│   └── bridge.ts             # Full bridge (to be built after validation)
├── .env.example
├── package.json
└── tsconfig.json
```

## Next steps (after validation passes)

1. `src/bridge.ts` — outbound WebSocket to cloud relay, re-route `canUseTool` decisions through WS
2. Cloud relay — Next.js 15 server with WS upgrade, SQLite for session persistence
3. Web UI — real-time log stream, approve/deny buttons, auto-approve toggle
