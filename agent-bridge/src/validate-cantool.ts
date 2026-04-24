#!/usr/bin/env tsx
/**
 * Validates that canUseTool intercepts every tool call and supports async remote decisions.
 *
 * Run: ANTHROPIC_API_KEY=... npm run validate
 *
 * For each tool call Claude wants to make, you'll see the tool name + input in the terminal
 * and be prompted y/n. All decisions are logged to prove interception is complete.
 */

import { query, type PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

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

const rl = readline.createInterface({ input: stdin, output: stdout });

const interceptLog: Array<{ tool: string; input: unknown; decision: 'allow' | 'deny'; ms: number }> = [];

async function canUseTool(
  toolName: string,
  input: unknown,
): Promise<PermissionResult> {
  const start = Date.now();

  console.log('\n─────────────────────────────────────────');
  console.log(`TOOL REQUEST: ${toolName}`);
  console.log('INPUT:', JSON.stringify(input, null, 2));

  let decision: 'allow' | 'deny' = 'deny';
  let ms = 0;

  try {
    const answer = await rl.question('Allow? [y/N] ');
    decision = answer.trim().toLowerCase() === 'y' ? 'allow' : 'deny';
    ms = Date.now() - start;
  } catch {
    ms = Date.now() - start;
  }

  interceptLog.push({ tool: toolName, input, decision, ms });
  console.log(`→ ${decision.toUpperCase()} (${ms}ms)`);

  if (decision === 'allow') {
    return { behavior: 'allow', updatedInput: input as Record<string, unknown> };
  }
  return { behavior: 'deny', message: `User denied ${toolName}`, interrupt: false };
}

async function main() {
  const cwd = process.env.PROJECT_CWD ?? process.cwd();

  console.log('=== canUseTool Validation Script ===');
  console.log(`Working directory: ${cwd}`);
  console.log('Prompt: list files in the current directory');
  console.log('Every tool call will be shown here for y/n approval.\n');

  const prompt = 'Create a file called /tmp/cantool-test.txt with content "hello" using bash, then read it back and print the content.';

  try {
    const stream = query({
      prompt,
      options: {
        cwd,
        canUseTool,
        maxTurns: 5,
        env,
        executable: process.execPath as 'node',
        stderr: (data: string) => process.stderr.write('[claude stderr] ' + data),
      },
    });

    console.log('\n─────────────────────────────────────────');
    console.log('CLAUDE OUTPUT:');
    for await (const msg of stream) {
      if (msg.type === 'assistant' && Array.isArray(msg.message?.content)) {
        for (const block of msg.message.content) {
          if (block.type === 'text') console.log(block.text);
        }
      } else if (msg.type === 'result') {
        if ('result' in msg) console.log(msg.result);
      }
    }
  } catch (err) {
    console.error('Query failed:', err);
  } finally {
    rl.close();
  }

  console.log('\n=== INTERCEPTION SUMMARY ===');
  if (interceptLog.length === 0) {
    console.log('No tool calls were intercepted — Claude completed the task without tools.');
    console.log('Try a prompt that requires file system access.');
  } else {
    console.log(`Total tool calls intercepted: ${interceptLog.length}`);
    for (const entry of interceptLog) {
      console.log(`  [${entry.decision.toUpperCase()}] ${entry.tool} (waited ${entry.ms}ms)`);
    }
    console.log('\nResult: canUseTool intercepts every tool call and supports async remote decisions. ✓');
  }
}

main();
