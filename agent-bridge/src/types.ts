// Shared protocol types — keep in sync with cloud-relay/src/lib/types.ts

export type BridgeMessage =
  | { type: 'register'; projectPath: string; sessionId?: string; pid?: number; agentType?: 'claude' | 'codex' }
  | { type: 'output'; text: string; sessionId: string }
  | { type: 'tool_request'; requestId: string; toolName: string; input: unknown; autoApproved?: boolean }
  | { type: 'turn_complete' }
  | { type: 'error'; message: string };

export type RelayToBridge =
  | { type: 'prompt'; text: string }
  | { type: 'tool_decision'; requestId: string; allow: boolean };
