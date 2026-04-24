'use client';
import { useState, useRef, type KeyboardEvent } from 'react';
import styles from './InputBar.module.css';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function InputBar({ onSend, disabled }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function onInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  }

  return (
    <div className={styles.bar}>
      <div className={styles.inner}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={value}
          onChange={onInput}
          onKeyDown={onKey}
          placeholder="Send a message to Claude... (Enter to send, Shift+Enter for newline)"
          rows={1}
          disabled={disabled}
        />
        <button
          className={styles.sendBtn}
          onClick={submit}
          disabled={!value.trim() || disabled}
          aria-label="Send"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
