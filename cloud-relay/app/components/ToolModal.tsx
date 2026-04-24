'use client';
import styles from './ToolModal.module.css';
import type { PendingTool } from '../hooks/useBridge';

interface Props {
  tool: PendingTool;
  onDecision: (requestId: string, allow: boolean) => void;
}

export default function ToolModal({ tool, onDecision }: Props) {
  const inputStr = JSON.stringify(tool.input, null, 2);

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <span className={styles.icon}>⚡</span>
          <div className={styles.meta}>
            <span className={styles.label}>TOOL REQUEST</span>
            <span className={styles.toolName}>{tool.toolName}</span>
          </div>
        </div>

        <div className={styles.body}>
          <pre className={styles.input}>{inputStr}</pre>
        </div>

        <div className={styles.actions}>
          <button
            className={styles.denyBtn}
            onClick={() => onDecision(tool.requestId, false)}
          >
            Deny
          </button>
          <button
            className={styles.allowBtn}
            onClick={() => onDecision(tool.requestId, true)}
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}
