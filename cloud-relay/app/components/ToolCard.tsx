'use client';
import styles from './ToolCard.module.css';
import type { ChatEntry } from '../../src/lib/types';

type ToolEntry = Extract<ChatEntry, { kind: 'tool_request' }>;

interface Props {
  entry: ToolEntry;
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

export default function ToolCard({ entry, onDeny, onAllow, onAllowAlways, onAnswer }: Props) {
  const decided = !!entry.decision;
  const allowed = entry.decision === 'allowed';
  const questions = parseQuestions(entry.input);
  const isQuestion = questions !== null;

  return (
    <div className={`${styles.card} ${decided ? (allowed ? styles.allowed : styles.denied) : ''}`}>
      <div className={styles.header}>
        <span className={styles.headerIcon}>⚡</span>
        <span className={styles.toolLabel}>{isQuestion ? 'QUESTION' : 'TOOL REQUEST'}</span>
        <span className={styles.toolName}>{entry.toolName}</span>
        {decided && (
          <span className={`${styles.badge} ${allowed ? styles.badgeGreen : styles.badgeRed}`}>
            {allowed ? 'ALLOWED' : 'DENIED'}
          </span>
        )}
      </div>

      {isQuestion ? (
        <div className={styles.body}>
          {questions!.map((q, qi) => (
            <div key={qi} className={styles.questionBlock}>
              {q.header && <div className={styles.questionHeader}>{q.header}</div>}
              {q.question && <div className={styles.questionText}>{q.question}</div>}
              {!decided && q.options && q.options.length > 0 && (
                <div className={styles.optionList}>
                  {q.options.map((opt, oi) => {
                    const label = typeof opt === 'string' ? opt : opt.label;
                    const desc = typeof opt === 'object' ? opt.description : undefined;
                    return (
                      <button
                        key={oi}
                        className={styles.optionBtn}
                        onClick={() => onAnswer(label)}
                      >
                        <span className={styles.optionLabel}>{label}</span>
                        {desc && <span className={styles.optionDesc}>{desc}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          {!decided && (
            <button className={styles.denySmall} onClick={onDeny}>Dismiss</button>
          )}
        </div>
      ) : (
        <>
          <div className={styles.body}>
            <pre className={styles.input}>{JSON.stringify(entry.input, null, 2)}</pre>
          </div>
          {!decided && (
            <div className={styles.actions}>
              <button className={styles.denyBtn} onClick={onDeny}>Deny</button>
              <button className={styles.allowAlwaysBtn} onClick={onAllowAlways}>Allow Always</button>
              <button className={styles.allowBtn} onClick={onAllow}>Allow</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
