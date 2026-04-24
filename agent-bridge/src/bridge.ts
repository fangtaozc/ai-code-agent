#!/usr/bin/env tsx
/**
 * Local bridge daemon — runs Claude in a loop for a project, persists session across restarts.
 *
 * Usage:
 *   npm start [project-cwd]
 *
 * Commands (type at the > prompt):
 *   /auto on|off   — toggle auto-approve for tool calls
 *   /session       — show current session ID
 *   /quit          — exit
 */

import { query, type PermissionResult, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import * as path from 'node:path';
import { getSession, setSession } from './session-store.js';

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('Error: ANTHROPIC_API_KEY is not set');
  process.exit(1);
}

const env: Record<string, string> = {
  ...(process.env as Record<string, string>),
  ANTHROPIC_API_KEY: apiKey,
};
if (process.env.ANTHROPIC_BASE_URL) env.ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL;

const cwd = path.resolve(process.argv[2] ?? process.cwd());

let autoApprove = false;
let sessionId: string | undefined = getSession(cwd);

const rl = readline.createInterface({ input: stdin, output: stdout, terminal: true });

rl.on('close', () => process.exit(0));
process.on('SIGINT', () => {
  console.log('\nExiting.');
  process.exit(0);
});

async function canUseTool(toolName: string, input: unknown): Promise<PermissionResult> {
  if (autoApprove) {
    console.log(`  [AUTO] ${toolName}`);
    return { behavior: 'allow', updatedInput: input as Record<string, unknown> };
  }

  console.log(`\n┌─ TOOL: ${toolName}`);
  console.log('│  INPUT:', JSON.stringify(input, null, 2).replace(/\n/g, '\n│  '));
  const answer = await rl.question('└─ Allow? [y/N] ').catch(() => '');
  const allow = answer.trim().toLowerCase() === 'y';
  console.log(allow ? '  → ALLOWED' : '  → DENIED');

  if (allow) return { behavior: 'allow', updatedInput: input as Record<string, unknown> };
  return { behavior: 'deny', message: `Denied by user`, interrupt: false };
}

async function runTurn(prompt: string): Promise<void> {
  const stream = query({
    prompt,
    options: {
      cwd,
      resume: sessionId,
      canUseTool,
      maxTurns: 50,
      env,
      executable: process.execPath as 'node',
    },
  });

  let sessionCaptured = false;

  for await (const msg of stream as AsyncIterable<SDKMessage & { session_id?: string }>) {
    if (!sessionCaptured && msg.session_id) {
      sessionId = msg.session_id;
      setSession(cwd, sessionId);
      sessionCaptured = true;
    }

    if (msg.type === 'assistant' && Array.isArray(msg.message?.content)) {
      for (const block of msg.message.content) {
        if (block.type === 'text' && block.text) process.stdout.write(block.text);
      }
    }
  }
  process.stdout.write('\n');
}

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════╗');
  console.log('║         agent-bridge  local            ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`Project : ${cwd}`);
  console.log(`Session : ${sessionId ?? '(new)'}`);
  console.log(`Auto    : ${autoApprove ? 'ON' : 'OFF'}`);
  console.log('Commands: /auto on|off  /session  /quit\n');

  while (true) {
    const input = await rl.question('> ').catch(() => null);
    if (input === null) break;

    const line = input.trim();
    if (!line) continue;

    if (line === '/quit') break;

    if (line === '/session') {
      console.log(`Session: ${sessionId ?? '(none yet)'}`);
      continue;
    }

    if (line === '/auto on') {
      autoApprove = true;
      console.log('Auto-approve: ON');
      continue;
    }

    if (line === '/auto off') {
      autoApprove = false;
      console.log('Auto-approve: OFF');
      continue;
    }

    if (line.startsWith('/')) {
      console.log('Unknown command. Try /auto on|off, /session, /quit');
      continue;
    }

    try {
      await runTurn(line);
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : err);
    }
  }

  rl.close();
}

main();
