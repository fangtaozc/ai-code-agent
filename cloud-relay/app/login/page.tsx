'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function LoginPage() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError('Invalid token');
      setLoading(false);
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.icon}>⌥</div>
        <h1 className={styles.title}>agent-bridge</h1>
        <p className={styles.subtitle}>Enter your access token to continue</p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="password"
            className={styles.input}
            placeholder="Access token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoFocus
          />
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.btn} disabled={!token || loading}>
            {loading ? 'Verifying…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}
