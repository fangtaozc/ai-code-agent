import { WebSocket } from 'ws';
import { Codex } from '@openai/codex-sdk';
import { getSession, setSession } from './session-store.js';
import type { RelayToBridge, BridgeMessage } from './types.js';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';

const relayUrl = process.env.RELAY_URL;
if (!relayUrl) throw new Error('RELAY_URL is not set');

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

const cwd = path.resolve(process.argv[3] ?? process.cwd());

// Use "codex:" prefix so keys don't collide with claude session keys
const storeKey = `codex:${cwd}`;
let sessionId: string | undefined = getSession(storeKey) ?? undefined;
let ws: WebSocket;

const codex = new Codex({
  apiKey,
  baseUrl: process.env.OPENAI_BASE_URL,
  env: process.env as Record<string, string>,
});

function send(msg: BridgeMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

async function runTurn(prompt: string): Promise<void> {
  const sandboxMode = (process.env.CODEX_SANDBOX_MODE ?? 'workspace-write') as
    'read-only' | 'workspace-write' | 'danger-full-access';

  const threadOptions = {
    workingDirectory: cwd,
    approvalPolicy: 'never' as const,
    sandboxMode,
    skipGitRepoCheck: true,
  };

  const thread = sessionId
    ? codex.resumeThread(sessionId!, threadOptions)
    : codex.startThread(threadOptions);

  const { events } = await thread.runStreamed(prompt);
  const lastLenById = new Map<string, number>();

  try {
    for await (const event of events) {
      switch (event.type) {
        case 'thread.started':
          sessionId = event.thread_id;
          setSession(storeKey, sessionId);
          break;

        case 'item.updated': {
          const item = event.item;
          if (item.type === 'agent_message') {
            const last = lastLenById.get(item.id) ?? 0;
            const delta = item.text.slice(last);
            if (delta) {
              send({ type: 'output', text: delta, sessionId: sessionId ?? '' });
              lastLenById.set(item.id, item.text.length);
            }
          }
          break;
        }

        case 'item.completed': {
          const item = event.item;
          if (item.type === 'agent_message') {
            const last = lastLenById.get(item.id) ?? 0;
            const delta = item.text.slice(last);
            if (delta) send({ type: 'output', text: delta, sessionId: sessionId ?? '' });
            lastLenById.delete(item.id);
          } else if (item.type === 'command_execution') {
            send({
              type: 'tool_request',
              requestId: randomUUID(),
              toolName: 'CommandExecution',
              input: { command: item.command, exit_code: item.exit_code, status: item.status, output: item.aggregated_output },
              autoApproved: true,
            });
          } else if (item.type === 'file_change') {
            send({
              type: 'tool_request',
              requestId: randomUUID(),
              toolName: 'FileChange',
              input: { changes: item.changes, status: item.status },
              autoApproved: true,
            });
          }
          break;
        }

        case 'turn.failed':
          send({ type: 'error', message: event.error.message });
          return;

        case 'error':
          send({ type: 'error', message: event.message });
          return;
      }
    }
  } catch (err) {
    send({ type: 'error', message: String(err) });
    return;
  }

  send({ type: 'turn_complete' });
}

function connect(): void {
  ws = new WebSocket(relayUrl!);

  ws.on('open', () => {
    console.log(`[bridge-codex] connected → ${relayUrl}`);
    console.log(`[bridge-codex] project   → ${cwd}`);
    send({ type: 'register', projectPath: cwd, sessionId, pid: process.pid, agentType: 'codex' });
  });

  ws.on('message', (raw: Buffer) => {
    let msg: RelayToBridge;
    try { msg = JSON.parse(raw.toString()) as RelayToBridge; }
    catch { return; }

    switch (msg.type) {
      case 'prompt':
        runTurn(msg.text).catch((err) => send({ type: 'error', message: String(err) }));
        break;

      case 'tool_decision':
        // Codex auto-approves all tools; UI tool_decisions are informational only
        break;
    }
  });

  ws.on('close', () => {
    console.log('[bridge-codex] disconnected, reconnecting in 3s...');
    setTimeout(connect, 3000);
  });

  ws.on('error', (err: Error) => {
    console.error('[bridge-codex] error:', err.message);
  });
}

connect();
