/**
 * WebSocket client that connects the local bridge to the cloud relay.
 * Tool approvals are handled entirely from the Web UI.
 *
 * Usage:
 *   RELAY_URL=ws://your-server/ws/bridge npm start -- --cloud /path/to/project
 */

import { WebSocket } from 'ws';
import { query, type PermissionResult, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { getSession, setSession, clearSession } from './session-store.js';
import type { RelayToBridge, BridgeMessage } from './types.js';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';

const relayUrl = process.env.RELAY_URL;
if (!relayUrl) throw new Error('RELAY_URL is not set');

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

const cwd = path.resolve(process.argv[3] ?? process.cwd());

const env: Record<string, string> = {
  ...(process.env as Record<string, string>),
  ANTHROPIC_API_KEY: apiKey,
};
if (process.env.ANTHROPIC_BASE_URL) env.ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL;

let sessionId: string | undefined = getSession(cwd);
let ws: WebSocket;

function send(msg: BridgeMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

// ── Tool approval via Web UI ──────────────────────────────────────────────────
const pendingDecisions = new Map<string, (allow: boolean) => void>();

async function canUseTool(toolName: string, input: unknown): Promise<PermissionResult> {
  const requestId = randomUUID();
  send({ type: 'tool_request', requestId, toolName, input });
  console.log(`[bridge-ws] tool request: ${toolName} (waiting for Web UI decision...)`);
  const allow = await new Promise<boolean>((resolve) => pendingDecisions.set(requestId, resolve));
  console.log(`[bridge-ws] tool ${toolName}: ${allow ? 'allowed' : 'denied'}`);
  if (allow) return { behavior: 'allow', updatedInput: input as Record<string, unknown> };
  const isQuestion = toolName === 'AskUserQuestion' || toolName === 'ask_followup_question';
  return { behavior: 'deny', message: 'Denied via Web UI', interrupt: isQuestion };
}

// ── SDK runner ────────────────────────────────────────────────────────────────
async function executeQuery(prompt: string, resumeId: string | undefined): Promise<void> {
  let sessionCaptured = false;

  const stream = query({
    prompt,
    options: {
      cwd,
      resume: resumeId,
      maxTurns: 50,
      env,
      executable: process.execPath as 'node',
      canUseTool,
      includePartialMessages: true,
    },
  });

  for await (const msg of stream as AsyncIterable<SDKMessage & { session_id?: string }>) {
    if (!sessionCaptured && msg.session_id) {
      sessionId = msg.session_id;
      setSession(cwd, sessionId);
      sessionCaptured = true;
    }

    if (msg.type === 'stream_event') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ev = (msg as any).event as any;
      if (ev?.type === 'content_block_delta' && ev?.delta?.type === 'text_delta' && ev?.delta?.text) {
        send({ type: 'output', text: ev.delta.text as string, sessionId: sessionId ?? '' });
      }
      continue;
    }
  }
}

async function runTurn(prompt: string): Promise<void> {
  try {
    await executeQuery(prompt, sessionId);
  } catch (err) {
    const errStr = String(err);
    if (errStr.includes('No conversation found') && sessionId) {
      console.log('[bridge-ws] stale session, retrying fresh...');
      sessionId = undefined;
      clearSession(cwd);
      try {
        await executeQuery(prompt, undefined);
      } catch (e2) {
        send({ type: 'error', message: String(e2) });
        return;
      }
    } else {
      send({ type: 'error', message: errStr });
      return;
    }
  }
  send({ type: 'turn_complete' });
}

// ── WebSocket connection ──────────────────────────────────────────────────────
function connect(): void {
  ws = new WebSocket(relayUrl!);

  ws.on('open', () => {
    console.log(`[bridge-ws] connected → ${relayUrl}`);
    console.log(`[bridge-ws] project  → ${cwd}`);
    console.log(`[bridge-ws] tool approvals via Web UI (or enable Auto-approve)`);
    send({ type: 'register', projectPath: cwd, sessionId, pid: process.pid, agentType: 'claude' });
  });

  ws.on('message', (raw: Buffer) => {
    let msg: RelayToBridge;
    try { msg = JSON.parse(raw.toString()) as RelayToBridge; }
    catch { return; }

    switch (msg.type) {
      case 'prompt':
        runTurn(msg.text).catch((err) =>
          send({ type: 'error', message: String(err) })
        );
        break;

      case 'tool_decision': {
        const resolve = pendingDecisions.get(msg.requestId);
        if (resolve) {
          pendingDecisions.delete(msg.requestId);
          resolve(msg.allow);
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    console.log('[bridge-ws] disconnected, reconnecting in 3s...');
    // Deny all pending tool requests on disconnect
    for (const resolve of pendingDecisions.values()) resolve(false);
    pendingDecisions.clear();
    setTimeout(connect, 3000);
  });

  ws.on('error', (err: Error) => {
    console.error('[bridge-ws] error:', err.message);
  });
}

connect();
