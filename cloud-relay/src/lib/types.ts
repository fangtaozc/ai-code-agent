// ── Message types shared by bridge, relay, and UI ─────────────────────────

/** Bridge → Relay */
export type BridgeMessage =
  | { type: 'register'; projectPath: string; sessionId?: string; pid?: number; agentType?: 'claude' | 'codex' }
  | { type: 'output'; text: string; sessionId: string }
  | { type: 'tool_request'; requestId: string; toolName: string; input: unknown; autoApproved?: boolean }
  | { type: 'turn_complete' }
  | { type: 'error'; message: string };

/** Relay → Bridge */
export type RelayToBridge =
  | { type: 'prompt'; text: string }
  | { type: 'tool_decision'; requestId: string; allow: boolean };

/** Browser UI → Relay */
export type UIMessage =
  | { type: 'subscribe'; projectPath: string }
  | { type: 'send_prompt'; projectPath: string; text: string }
  | { type: 'tool_decision'; projectPath: string; requestId: string; allow: boolean; answer?: string }
  | { type: 'set_auto_approve'; projectPath: string; enabled: boolean }
  | { type: 'load_more'; projectPath: string; before: number };

/** Relay → Browser UI */
export type RelayToUI =
  | { type: 'project_list'; projects: ProjectInfo[] }
  | { type: 'subscribed'; projectPath: string; history: ChatEntry[]; hasMore: boolean }
  | { type: 'user_message'; text: string }
  | { type: 'output'; text: string }
  | { type: 'tool_request'; requestId: string; toolName: string; input: unknown; preApproved?: boolean }
  | { type: 'turn_complete' }
  | { type: 'error'; message: string }
  | { type: 'bridge_connected'; projectPath: string }
  | { type: 'bridge_disconnected'; projectPath: string }
  | { type: 'history_chunk'; entries: ChatEntry[]; hasMore: boolean };

export interface ProjectInfo {
  projectPath: string;
  sessionId?: string;
  connected: boolean;
  autoApprove: boolean;
  hasPendingTool?: boolean;
  agentType?: 'claude' | 'codex';
}

export type ChatEntry =
  | { kind: 'user_message'; text: string; ts: number }
  | { kind: 'output'; text: string; ts: number }
  | { kind: 'tool_request'; requestId: string; toolName: string; input: unknown; decision?: 'allowed' | 'denied'; ts: number }
  | { kind: 'turn_complete'; ts: number };
