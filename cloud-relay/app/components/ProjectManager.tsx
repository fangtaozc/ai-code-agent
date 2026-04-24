'use client';
import { useState, useEffect, useCallback } from 'react';
import styles from './ProjectManager.module.css';
import DirPicker from './DirPicker';
import type { ProjectInfo } from '../../src/lib/types';

type SandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access';

export interface ManagedInfo {
  projectPath: string;
  running: boolean;
  agentType: 'claude' | 'codex';
  sandboxMode: SandboxMode;
}

const SANDBOX_LABELS: Record<SandboxMode, string> = {
  'read-only': 'read-only',
  'workspace-write': 'workspace',
  'danger-full-access': 'full access',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  wsProjects: ProjectInfo[];
}

function shortPath(p: string) {
  return p.replace(/^\/(?:Users|home)\/[^/]+/, '~');
}

function useLocalProjects() {
  const [managed, setManaged] = useState<ManagedInfo[]>([]);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/bridge/api/local/projects');
      if (!r.ok) return;
      const d = await r.json() as { projects: ManagedInfo[] };
      setManaged(d.projects);
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [refresh]);

  async function call(action: string, projectPath: string, extra?: Record<string, unknown>) {
    const r = await fetch('/bridge/api/local/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, projectPath, ...extra }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
      alert(body.error ?? `Action "${action}" failed`);
    }
    refresh();
  }

  return {
    managed,
    addProject: (p: string, agentType: 'claude' | 'codex', sandboxMode: SandboxMode) =>
      call('add', p, { agentType, sandboxMode }),
    updateProject: (p: string, sandboxMode: SandboxMode) => call('update', p, { sandboxMode }),
    removeProject: (p: string) => call('remove', p),
    startProject: (p: string) => call('start', p),
    stopProject: (p: string) => call('stop', p),
  };
}

export default function ProjectManager({ isOpen, onClose, wsProjects }: Props) {
  const { managed, addProject, updateProject, removeProject, startProject, stopProject } = useLocalProjects();
  const [showPicker, setShowPicker] = useState(false);
  const [pendingAgentType, setPendingAgentType] = useState<'claude' | 'codex'>('claude');
  const [pendingSandbox, setPendingSandbox] = useState<SandboxMode>('workspace-write');

  const managedPaths = new Set(managed.map((m) => m.projectPath));

  const entries = [
    ...managed.map((m) => {
      const ws = wsProjects.find((p) => p.projectPath === m.projectPath);
      return {
        path: m.projectPath,
        managed: true,
        running: m.running,
        connected: ws?.connected ?? false,
        sessionId: ws?.sessionId,
        agentType: m.agentType,
        sandboxMode: m.sandboxMode,
      };
    }),
    ...wsProjects
      .filter((p) => !managedPaths.has(p.projectPath))
      .map((p) => ({
        path: p.projectPath,
        managed: false,
        running: p.connected,
        connected: p.connected,
        sessionId: p.sessionId,
        agentType: p.agentType ?? 'claude' as const,
        sandboxMode: 'workspace-write' as SandboxMode,
      })),
  ];

  function statusLabel(e: typeof entries[0]) {
    if (e.connected) return { text: 'connected', color: 'var(--green)' };
    if (e.running) return { text: 'starting…', color: 'var(--yellow)' };
    return { text: 'stopped', color: 'var(--text-muted)' };
  }

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>Manage Projects</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          {entries.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>📭</span>
              <p>No projects yet. Add one below.</p>
            </div>
          ) : (
            <div className={styles.list}>
              {entries.map((e) => {
                const status = statusLabel(e);
                return (
                  <div key={e.path} className={styles.entry}>
                    <span className={styles.entryDot} style={{ background: status.color }} />
                    <div className={styles.entryInfo}>
                      <div className={styles.entryPathRow}>
                        <span className={styles.entryPath}>{shortPath(e.path)}</span>
                        <span className={`${styles.agentBadge} ${e.agentType === 'codex' ? styles.codexBadge : styles.claudeBadge}`}>
                          {e.agentType === 'codex' ? 'codex' : 'claude'}
                        </span>
                      </div>
                      <div className={styles.entryMeta}>
                        <span className={styles.entryStatus} style={{ color: status.color }}>{status.text}</span>
                        {e.managed && e.agentType === 'codex' && (
                          <select
                            className={styles.sandboxSelect}
                            value={e.sandboxMode}
                            disabled={e.running || e.connected}
                            onChange={(ev) => updateProject(e.path, ev.target.value as SandboxMode)}
                          >
                            <option value="read-only">read-only</option>
                            <option value="workspace-write">workspace</option>
                            <option value="danger-full-access">full access</option>
                          </select>
                        )}
                      </div>
                    </div>
                    {e.managed && (
                      <div className={styles.entryActions}>
                        {(e.running || e.connected) ? (
                          <button className={`${styles.actionBtn} ${styles.stopBtn}`} onClick={() => stopProject(e.path)}>
                            ■ Stop
                          </button>
                        ) : (
                          <button className={`${styles.actionBtn} ${styles.startBtn}`} onClick={() => startProject(e.path)}>
                            ▶ Start
                          </button>
                        )}
                        {!e.running && (
                          <button
                            className={`${styles.actionBtn} ${styles.deleteBtn}`}
                            onClick={() => removeProject(e.path)}
                            title="Remove project"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className={styles.addSection}>
            {!showPicker ? (
              <button className={styles.addBtn} onClick={() => setShowPicker(true)}>
                <span className={styles.addIcon}>+</span>
                Add Project
              </button>
            ) : (
              <div className={styles.pickerWrapper}>
                <div className={styles.pickerHeader}>
                  <span className={styles.pickerTitle}>Select Project Folder</span>
                  <div className={styles.agentTypeSelect}>
                    <button
                      className={`${styles.agentTypeBtn} ${pendingAgentType === 'claude' ? styles.agentTypeBtnActive : ''}`}
                      onClick={() => setPendingAgentType('claude')}
                    >
                      claude
                    </button>
                    <button
                      className={`${styles.agentTypeBtn} ${pendingAgentType === 'codex' ? styles.agentTypeBtnActive : ''}`}
                      onClick={() => setPendingAgentType('codex')}
                    >
                      codex
                    </button>
                  </div>
                </div>
                {pendingAgentType === 'codex' && (
                  <div className={styles.sandboxRow}>
                    <span className={styles.sandboxLabel}>Sandbox</span>
                    <div className={styles.sandboxBtnGroup}>
                      {(['read-only', 'workspace-write', 'danger-full-access'] as SandboxMode[]).map((mode) => (
                        <button
                          key={mode}
                          className={`${styles.sandboxBtn} ${pendingSandbox === mode ? styles.sandboxBtnActive : ''}`}
                          onClick={() => setPendingSandbox(mode)}
                        >
                          {SANDBOX_LABELS[mode]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <DirPicker
                  onConfirm={async (p) => {
                    await addProject(p, pendingAgentType, pendingAgentType === 'codex' ? pendingSandbox : 'workspace-write');
                    setShowPicker(false);
                  }}
                  onCancel={() => setShowPicker(false)}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
