'use client';
import styles from './Sidebar.module.css';
import type { ProjectInfo } from '../../src/lib/types';

interface Props {
  projects: ProjectInfo[];
  activeProject: string | null;
  open: boolean;
  collapsed: boolean;
  width: number;
  onClose: () => void;
  onToggleCollapse: () => void;
  onSelect: (path: string) => void;
  onAutoApprove: (projectPath: string, enabled: boolean) => void;
  onManageProjects?: () => void;
  isLocal: boolean;
}

const COMPACT_THRESHOLD = 180;

function shortPath(p: string): string {
  return p.replace(/^\/(?:Users|home)\/[^/]+/, '~');
}

function dotColor(p: ProjectInfo): string {
  if (p.connected) return 'var(--green)';
  return 'var(--text-muted)';
}

export default function Sidebar({
  projects, activeProject, open, collapsed, width,
  onClose, onToggleCollapse, onSelect, onAutoApprove, onManageProjects, isLocal,
}: Props) {
  const active = projects.find((p) => p.projectPath === activeProject);
  const compact = !collapsed && width < COMPACT_THRESHOLD;

  return (
    <aside
      className={`${styles.sidebar} ${open ? styles.open : ''}`}
      style={{ width: collapsed ? 0 : width }}
    >
      <div className={`${styles.inner} ${compact ? styles.compact : ''}`}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.termIcon}>⌥</span>
          {!compact && <span className={styles.title}>agent code</span>}
          <button className={styles.collapseBtn} onClick={onToggleCollapse} title="Collapse sidebar">‹</button>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Project list */}
        <div className={styles.section}>
          {!compact && <div className={styles.sectionLabel}>PROJECTS</div>}

          {projects.length === 0 && !compact && (
            <div className={styles.empty}>No bridges connected</div>
          )}

          {projects.map((p) => (
            <button
              key={p.projectPath}
              className={`${styles.projectItem} ${p.projectPath === activeProject ? styles.active : ''}`}
              onClick={() => onSelect(p.projectPath)}
              title={shortPath(p.projectPath)}
            >
              <span className={styles.dot} style={{ background: dotColor(p) }} />
              {!compact && (
                <>
                  <span className={styles.projectName}>{shortPath(p.projectPath)}</span>
                  {p.agentType && (
                    <span className={`${styles.agentBadge} ${p.agentType === 'codex' ? styles.codexBadge : styles.claudeBadge}`}>
                      {p.agentType === 'codex' ? 'cdx' : 'cld'}
                    </span>
                  )}
                </>
              )}
              {p.hasPendingTool && <span className={styles.alertDot} />}
            </button>
          ))}
        </div>

        <div className={styles.spacer} />

        {/* Manage Projects (local only) */}
        {isLocal && onManageProjects && (
          <div className={styles.manageSection}>
            <button
              className={styles.manageBtn}
              onClick={onManageProjects}
              title="Manage Projects"
            >
              <span className={styles.manageIcon}>⚙</span>
              {!compact && <span>Manage Projects</span>}
            </button>
          </div>
        )}

        {/* Auto-approve footer */}
        {active && (
          <div className={styles.footer}>
            {!compact && <span className={styles.autoLabel}>Auto-approve</span>}
            <button
              className={`${styles.toggle} ${active.autoApprove ? styles.toggleOn : ''}`}
              onClick={() => onAutoApprove(active.projectPath, !active.autoApprove)}
              aria-label="Toggle auto-approve"
              title={compact ? (active.autoApprove ? 'Auto-approve: ON' : 'Auto-approve: OFF') : undefined}
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
