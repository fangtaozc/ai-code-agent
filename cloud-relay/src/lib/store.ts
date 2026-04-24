import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type WebSocket from 'ws';
import type {
  ProjectInfo,
  ChatEntry,
  RelayToBridge,
  RelayToUI,
} from './types.js';

const MAX_HISTORY = 500;
const INITIAL_LIMIT = 100;
const PAGE_SIZE = 50;
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
const HISTORY_DIR = path.join(os.homedir(), '.agent-bridge', 'relay-history');

interface ProjectState {
  info: ProjectInfo;
  bridgeWs: WebSocket | null;
  uiSubscribers: Set<WebSocket>;
  history: ChatEntry[];
  pendingToolRequests: Map<string, { resolve: (allow: boolean) => void }>;
  queuedAnswer?: string;
}

const projects = new Map<string, ProjectState>();

function historyFile(projectPath: string): string {
  const hash = createHash('sha256').update(projectPath).digest('hex').slice(0, 12);
  return path.join(HISTORY_DIR, `${hash}.json`);
}

function loadFromDisk(projectPath: string): ChatEntry[] {
  try {
    return JSON.parse(fs.readFileSync(historyFile(projectPath), 'utf8')) as ChatEntry[];
  } catch {
    return [];
  }
}

function saveToDisk(projectPath: string, history: ChatEntry[]): void {
  try {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
    fs.writeFileSync(historyFile(projectPath), JSON.stringify(history));
  } catch (err) {
    console.error('[store] failed to save history:', err);
  }
}

function getOrCreate(projectPath: string): ProjectState {
  if (!projects.has(projectPath)) {
    const diskHistory = loadFromDisk(projectPath).slice(-MAX_HISTORY);
    projects.set(projectPath, {
      info: { projectPath, connected: false, autoApprove: false },
      bridgeWs: null,
      uiSubscribers: new Set(),
      history: diskHistory,
      pendingToolRequests: new Map(),
    });
  }
  return projects.get(projectPath)!;
}

export function registerBridge(projectPath: string, sessionId: string | undefined, ws: WebSocket, agentType?: 'claude' | 'codex'): void {
  const state = getOrCreate(projectPath);
  state.bridgeWs = ws;
  state.info.connected = true;
  if (sessionId) state.info.sessionId = sessionId;
  if (agentType) state.info.agentType = agentType;
  broadcastToUI(projectPath, { type: 'bridge_connected', projectPath });
  broadcastProjectList();
}

export function unregisterBridge(projectPath: string): void {
  const state = projects.get(projectPath);
  if (!state) return;
  state.bridgeWs = null;
  state.info.connected = false;
  for (const [, pending] of state.pendingToolRequests) pending.resolve(false);
  state.pendingToolRequests.clear();
  broadcastToUI(projectPath, { type: 'bridge_disconnected', projectPath });
  broadcastProjectList();
}

export function subscribeUI(projectPath: string, ws: WebSocket): void {
  const state = getOrCreate(projectPath);
  state.uiSubscribers.add(ws);

  const fiveDaysAgo = Date.now() - FIVE_DAYS_MS;
  const recent = state.history.filter((e) => e.ts >= fiveDaysAgo);
  const toSend = recent.slice(-INITIAL_LIMIT);
  const firstSentTs = toSend[0]?.ts ?? Infinity;
  const hasMore = toSend.length > 0 && state.history[0]!.ts < firstSentTs;

  send(ws, { type: 'subscribed', projectPath, history: toSend, hasMore });
}

export function unsubscribeUI(ws: WebSocket): void {
  for (const state of projects.values()) state.uiSubscribers.delete(ws);
}

export function loadHistory(projectPath: string, before: number): { entries: ChatEntry[]; hasMore: boolean } {
  const state = projects.get(projectPath);
  if (!state) return { entries: [], hasMore: false };
  const older = state.history.filter((e) => e.ts < before);
  const page = older.slice(-PAGE_SIZE);
  return { entries: page, hasMore: older.length > PAGE_SIZE };
}

export function sendPromptToBridge(projectPath: string, text: string): boolean {
  const state = projects.get(projectPath);
  if (!state?.bridgeWs) return false;
  const entry: ChatEntry = { kind: 'user_message', text, ts: Date.now() };
  pushHistory(state, entry);
  broadcastToUI(projectPath, { type: 'user_message', text });
  send(state.bridgeWs, { type: 'prompt', text } satisfies RelayToBridge);
  return true;
}

export function resolveToolRequest(projectPath: string, requestId: string, allow: boolean, answer?: string): void {
  const state = projects.get(projectPath);
  if (!state) return;
  const pending = state.pendingToolRequests.get(requestId);
  if (pending) {
    pending.resolve(allow);
    state.pendingToolRequests.delete(requestId);
    const entry = state.history.findLast(
      (e: ChatEntry) => e.kind === 'tool_request' && e.requestId === requestId
    ) as Extract<ChatEntry, { kind: 'tool_request' }> | undefined;
    if (entry) entry.decision = allow ? 'allowed' : 'denied';
    if (answer) state.queuedAnswer = answer;
    if (state.pendingToolRequests.size === 0) {
      state.info.hasPendingTool = false;
      broadcastProjectList();
    }
  }
}

export function handleAutoApprovedToolRequest(
  projectPath: string,
  requestId: string,
  toolName: string,
  input: unknown
): void {
  const state = getOrCreate(projectPath);
  const entry: ChatEntry = { kind: 'tool_request', requestId, toolName, input, decision: 'allowed', ts: Date.now() };
  pushHistory(state, entry);
  broadcastToUI(projectPath, { type: 'tool_request', requestId, toolName, input, preApproved: true });
}

export function handleToolRequest(
  projectPath: string,
  requestId: string,
  toolName: string,
  input: unknown
): Promise<boolean> {
  const state = getOrCreate(projectPath);
  const entry: ChatEntry = { kind: 'tool_request', requestId, toolName, input, ts: Date.now() };
  pushHistory(state, entry);

  if (state.info.autoApprove) {
    entry.decision = 'allowed';
    return Promise.resolve(true);
  }

  broadcastToUI(projectPath, { type: 'tool_request', requestId, toolName, input });
  state.info.hasPendingTool = true;
  broadcastProjectList();

  return new Promise<boolean>((resolve) => {
    state.pendingToolRequests.set(requestId, { resolve });
  });
}

export function handleOutput(projectPath: string, text: string, sessionId: string): void {
  const state = getOrCreate(projectPath);
  state.info.sessionId = sessionId;
  pushHistory(state, { kind: 'output', text, ts: Date.now() });
  broadcastToUI(projectPath, { type: 'output', text });
}

export function handleTurnComplete(projectPath: string): void {
  const state = projects.get(projectPath);
  if (!state) return;
  const entry: ChatEntry = { kind: 'turn_complete', ts: Date.now() };
  pushHistory(state, entry);
  broadcastToUI(projectPath, { type: 'turn_complete' });
  state.info.hasPendingTool = false;
  broadcastProjectList();
  saveToDisk(projectPath, state.history);

  const queued = state.queuedAnswer;
  state.queuedAnswer = undefined;
  if (queued && state.bridgeWs?.readyState === 1) {
    const promptEntry: ChatEntry = { kind: 'user_message', text: queued, ts: Date.now() };
    pushHistory(state, promptEntry);
    broadcastToUI(projectPath, { type: 'user_message', text: queued });
    send(state.bridgeWs, { type: 'prompt', text: queued } satisfies RelayToBridge);
  }
}

export function setAutoApprove(projectPath: string, enabled: boolean): void {
  const state = projects.get(projectPath);
  if (!state) return;
  state.info.autoApprove = enabled;
  if (enabled) {
    for (const [id, pending] of state.pendingToolRequests) {
      pending.resolve(true);
      const entry = state.history.findLast(
        (e: ChatEntry) => e.kind === 'tool_request' && e.requestId === id
      ) as Extract<ChatEntry, { kind: 'tool_request' }> | undefined;
      if (entry) entry.decision = 'allowed';
    }
    state.pendingToolRequests.clear();
    state.info.hasPendingTool = false;
  }
  broadcastProjectList();
}

export function getProjectList(): ProjectInfo[] {
  return Array.from(projects.values()).map((s) => s.info);
}

function broadcastProjectList(): void {
  const projects_list = getProjectList();
  for (const state of projects.values()) {
    for (const ws of state.uiSubscribers) {
      send(ws, { type: 'project_list', projects: projects_list } satisfies RelayToUI);
    }
  }
}

function broadcastToUI(projectPath: string, msg: RelayToUI): void {
  const state = projects.get(projectPath);
  if (!state) return;
  for (const ws of state.uiSubscribers) send(ws, msg);
}

function pushHistory(state: ProjectState, entry: ChatEntry): void {
  // Merge consecutive output entries to keep history compact during streaming
  if (entry.kind === 'output') {
    const last = state.history[state.history.length - 1];
    if (last?.kind === 'output') {
      state.history[state.history.length - 1] = { ...last, text: last.text + entry.text };
      return;
    }
  }
  state.history.push(entry);
  if (state.history.length > MAX_HISTORY) state.history.splice(0, state.history.length - MAX_HISTORY);
}

function send(ws: WebSocket, msg: unknown): void {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}
