'use client';
import styles from './ToolBanner.module.css';
import type { PendingTool } from '../hooks/useBridge';

interface Props {
  tool: PendingTool;
  onDeny: () => void;
  onAllow: () => void;
  onAllowAlways: () => void;
  onAnswer: (answer: string) => void;
}

interface AskQuestion {
  question?: string;
  header?: string;
  options?: Array<{ label: string; description?: string } | string>;
}

function parseQuestions(input: unknown): AskQuestion[] | null {
  if (!input || typeof input !== 'object') return null;
  const q = (input as Record<string, unknown>).questions;
  if (!Array.isArray(q) || q.length === 0) return null;
  return q as AskQuestion[];
}

export default function ToolBanner({ tool, onDeny, onAllow, onAllowAlways, onAnswer }: Props) {
  const questions = parseQuestions(tool.input);
  const isQuestion = questions !== null;

  if (isQuestion) {
    const q = questions![0];
    return (
      <div className={styles.banner}>
        <div className={styles.questionRow}>
          <span className={styles.qIcon}>?</span>
          <span className={styles.questionText}>{q.header ?? q.question ?? tool.toolName}</span>
        </div>
        {q.question && q.header && (
          <div className={styles.questionSub}>{q.question}</div>
        )}
        <div className={styles.optionRow}>
          {(q.options ?? []).map((opt, i) => {
            const label = typeof opt === 'string' ? opt : opt.label;
            return (
              <button key={i} className={styles.optionBtn} onClick={() => onAnswer(label)}>
                {label}
              </button>
            );
          })}
          <button className={styles.dismissBtn} onClick={onDeny}>Dismiss</button>
        </div>
      </div>
    );
  }

  const inputPreview = (() => {
    try {
      const s = JSON.stringify(tool.input);
      return s.length > 80 ? s.slice(0, 80) + '…' : s;
    } catch { return ''; }
  })();

  return (
    <div className={styles.banner}>
      <div className={styles.toolRow}>
        <span className={styles.toolIcon}>⚡</span>
        <span className={styles.toolName}>{tool.toolName}</span>
        {inputPreview && <span className={styles.toolPreview}>{inputPreview}</span>}
        <div className={styles.btnGroup}>
          <button className={styles.denyBtn} onClick={onDeny}>Deny</button>
          <button className={styles.alwaysBtn} onClick={onAllowAlways}>Always</button>
          <button className={styles.allowBtn} onClick={onAllow}>Allow</button>
        </div>
      </div>
    </div>
  );
}
