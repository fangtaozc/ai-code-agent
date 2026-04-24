'use client';
import { useEffect, useLayoutEffect, useRef } from 'react';
import styles from './ChatFeed.module.css';
import ToolCard from './ToolCard';
import MarkdownContent from './MarkdownContent';
import type { ChatEntry } from '../../src/lib/types';

interface Props {
  history: ChatEntry[];
  projectPath: string | null;
  onToolDecision: (requestId: string, allow: boolean, opts?: { alwaysAllow?: boolean; answer?: string }) => void;
  hasMoreHistory: boolean;
  onLoadMore: () => void;
  isRunning: boolean;
}

export default function ChatFeed({ history, projectPath, onToolDecision, hasMoreHistory, onLoadMore, isRunning }: Props) {
  const feedRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const firstTsRef = useRef<number | undefined>(undefined);
  const lastTsRef = useRef<number | undefined>(undefined);
  const scrollSaveRef = useRef<{ top: number; height: number } | null>(null);

  useLayoutEffect(() => {
    if (scrollSaveRef.current && feedRef.current) {
      const { top, height } = scrollSaveRef.current;
      feedRef.current.scrollTop = top + (feedRef.current.scrollHeight - height);
      scrollSaveRef.current = null;
    }
  }, [history]);

  useEffect(() => {
    const firstTs = history[0]?.ts;
    const lastTs = history[history.length - 1]?.ts;
    const wasEmpty = firstTsRef.current === undefined && lastTsRef.current === undefined;
    const newFirst = firstTs !== firstTsRef.current;
    const newLast = lastTs !== lastTsRef.current;
    firstTsRef.current = firstTs;
    lastTsRef.current = lastTs;

    if (wasEmpty && history.length > 0) {
      if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
    } else if (newLast && !newFirst) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history]);

  // Auto-scroll when running indicator appears
  useEffect(() => {
    if (isRunning) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isRunning]);

  function handleLoadMore() {
    if (feedRef.current) {
      scrollSaveRef.current = { top: feedRef.current.scrollTop, height: feedRef.current.scrollHeight };
    }
    onLoadMore();
  }

  if (!projectPath) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>⌥</span>
        <p className={styles.emptyTitle}>No project selected</p>
        <p className={styles.emptyHint}>Connect a bridge and select a project from the sidebar</p>
      </div>
    );
  }

  return (
    <div className={styles.feed} ref={feedRef}>
      {hasMoreHistory && (
        <button className={styles.loadMore} onClick={handleLoadMore}>
          Load earlier messages
        </button>
      )}

      {history.map((entry, i) => {
        if (entry.kind === 'user_message') {
          return (
            <div key={i} className={styles.userRow}>
              <div className={styles.userBubble}>
                <div className={styles.userLabel}>you</div>
                <div className={styles.userText}>{entry.text}</div>
              </div>
            </div>
          );
        }

        if (entry.kind === 'output') {
          return (
            <div key={i} className={styles.outputRow}>
              <div className={styles.claudeAvatar}>⌥</div>
              <div className={styles.outputBody}>
                <MarkdownContent content={entry.text} />
              </div>
            </div>
          );
        }

        if (entry.kind === 'tool_request') {
          return (
            <ToolCard
              key={entry.requestId}
              entry={entry}
              onDeny={() => onToolDecision(entry.requestId, false)}
              onAllow={() => onToolDecision(entry.requestId, true)}
              onAllowAlways={() => onToolDecision(entry.requestId, true, { alwaysAllow: true })}
              onAnswer={(answer) => onToolDecision(entry.requestId, false, { answer })}
            />
          );
        }

        if (entry.kind === 'turn_complete') {
          return (
            <div key={i} className={styles.turnComplete}>
              <span className={styles.turnLine} />
              <span className={styles.turnLabel}>done</span>
              <span className={styles.turnLine} />
            </div>
          );
        }

        return null;
      })}

      {/* Running indicator — shown while Claude is processing */}
      {isRunning && (
        <div className={styles.runningRow}>
          <div className={styles.claudeAvatar}>⌥</div>
          <div className={styles.runningBubble}>
            <div className={styles.runningDots}>
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </div>
            <span className={styles.runningLabel}>后台运行中</span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
