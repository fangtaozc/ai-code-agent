'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import type { RelayToUI, UIMessage, ProjectInfo, ChatEntry } from '../../src/lib/types';

export interface PendingTool {
  requestId: string;
  toolName: string;
  input: unknown;
}

export interface BridgeState {
  projects: ProjectInfo[];
  activeProject: string | null;
  history: ChatEntry[];
  connected: boolean;
  hasMoreHistory: boolean;
  pendingTool: PendingTool | null;
  isRunning: boolean;
  send: (msg: UIMessage) => void;
  setActiveProject: (path: string) => void;
  loadMore: () => void;
  decideTool: (requestId: string, allow: boolean, opts?: { alwaysAllow?: boolean; answer?: string }) => void;
}

export function useBridge(): BridgeState {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [activeProject, setActiveProjectState] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [pendingTool, setPendingTool] = useState<PendingTool | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const activeRef = useRef<string | null>(null);

  // Output buffering — batch small chunks into ~30ms windows for smooth rendering
  const outputBufferRef = useRef('');
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flushOutputBuffer() {
    const buffered = outputBufferRef.current;
    outputBufferRef.current = '';
    flushTimerRef.current = null;
    if (buffered) {
      setHistory((h) => mergeOutput(h, buffered));
    }
  }

  function scheduleFlush() {
    if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(flushOutputBuffer, 30);
    }
  }

  const send = useCallback((msg: UIMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const setActiveProject = useCallback((path: string) => {
    activeRef.current = path;
    setActiveProjectState(path);
    setHistory([]);
    setHasMoreHistory(false);
    setPendingTool(null);
    setIsRunning(false);
    // Flush any buffered output from the previous project
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
      outputBufferRef.current = '';
    }
    send({ type: 'subscribe', projectPath: path });
  }, [send]);

  const loadMore = useCallback(() => {
    if (!activeRef.current) return;
    setHistory((h) => {
      const before = h[0]?.ts;
      if (before !== undefined) {
        send({ type: 'load_more', projectPath: activeRef.current!, before });
      }
      return h;
    });
  }, [send]);

  const decideTool = useCallback((requestId: string, allow: boolean, opts?: { alwaysAllow?: boolean; answer?: string }) => {
    if (!activeRef.current) return;
    if (opts?.alwaysAllow) {
      send({ type: 'set_auto_approve', projectPath: activeRef.current, enabled: true });
    } else {
      send({ type: 'tool_decision', projectPath: activeRef.current, requestId, allow, answer: opts?.answer });
    }
    const decided = opts?.alwaysAllow ? 'allowed' : (allow ? 'allowed' : 'denied');
    setHistory((h) => h.map((e) =>
      e.kind === 'tool_request' && e.requestId === requestId
        ? { ...e, decision: decided }
        : e
    ));
    setPendingTool((t) => t?.requestId === requestId ? null : t);
  }, [send]);

  useEffect(() => {
    function connect() {
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/ui`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 3000);
      };

      ws.onmessage = (event) => {
        let msg: RelayToUI;
        try { msg = JSON.parse(event.data as string) as RelayToUI; }
        catch { return; }

        switch (msg.type) {
          case 'project_list':
            setProjects(msg.projects);
            if (!activeRef.current) {
              const first = msg.projects.find((p) => p.connected) ?? msg.projects[0];
              if (first) {
                activeRef.current = first.projectPath;
                setActiveProjectState(first.projectPath);
                ws.send(JSON.stringify({ type: 'subscribe', projectPath: first.projectPath }));
              }
            }
            break;

          case 'subscribed':
            if (msg.projectPath === activeRef.current) {
              setHistory(msg.history);
              setHasMoreHistory(msg.hasMore);
              // Restore pending tool request from history
              const lastTool = [...msg.history].reverse().find(
                (e) => e.kind === 'tool_request' && !e.decision
              ) as Extract<ChatEntry, { kind: 'tool_request' }> | undefined;
              setPendingTool(lastTool
                ? { requestId: lastTool.requestId, toolName: lastTool.toolName, input: lastTool.input }
                : null
              );
              // Determine running state from history
              const lastEntry = msg.history[msg.history.length - 1];
              const running = !!lastEntry && lastEntry.kind !== 'turn_complete' && !lastTool;
              setIsRunning(running);
            }
            break;

          case 'history_chunk':
            setHistory((h) => [...msg.entries, ...h]);
            setHasMoreHistory(msg.hasMore);
            break;

          case 'user_message':
            if (activeRef.current) {
              setHistory((h) => [...h, { kind: 'user_message', text: msg.text, ts: Date.now() }]);
              setIsRunning(true);
            }
            break;

          case 'output':
            if (activeRef.current) {
              outputBufferRef.current += msg.text;
              scheduleFlush();
              setIsRunning(true);
            }
            break;

          case 'tool_request':
            if (activeRef.current) {
              // Flush any pending output before showing tool request
              if (flushTimerRef.current) {
                clearTimeout(flushTimerRef.current);
                flushOutputBuffer();
              }
              const entry: Extract<ChatEntry, { kind: 'tool_request' }> = {
                kind: 'tool_request', requestId: msg.requestId,
                toolName: msg.toolName, input: msg.input,
                decision: msg.preApproved ? 'allowed' : undefined,
                ts: Date.now(),
              };
              setHistory((h) => [...h, entry]);
              if (!msg.preApproved) {
                setPendingTool({ requestId: msg.requestId, toolName: msg.toolName, input: msg.input });
                setIsRunning(false);
              }
            }
            break;

          case 'turn_complete':
            if (activeRef.current) {
              // Flush any remaining buffered output
              if (flushTimerRef.current) {
                clearTimeout(flushTimerRef.current);
                flushOutputBuffer();
              }
              setHistory((h) => [...h, { kind: 'turn_complete', ts: Date.now() }]);
              setPendingTool(null);
              setIsRunning(false);
            }
            break;

          case 'bridge_connected':
          case 'bridge_disconnected':
            break;
        }
      };
    }

    connect();
    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      wsRef.current?.close();
    };
  }, []);

  return { projects, activeProject, history, connected, hasMoreHistory, pendingTool, isRunning, send, setActiveProject, loadMore, decideTool };
}

function mergeOutput(history: ChatEntry[], text: string): ChatEntry[] {
  const last = history[history.length - 1];
  if (last?.kind === 'output') {
    return [...history.slice(0, -1), { ...last, text: last.text + text }];
  }
  return [...history, { kind: 'output', text, ts: Date.now() }];
}
