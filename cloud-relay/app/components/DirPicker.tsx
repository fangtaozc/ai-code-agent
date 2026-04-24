'use client';
import { useState, useEffect, useCallback } from 'react';
import styles from './DirPicker.module.css';
import * as os from 'os';

interface DirData { path: string; parent: string; dirs: string[] }

const BOOKMARKS = [
  { label: 'Home',       icon: '⌂', path: '~' },
  { label: 'Desktop',    icon: '🖥', path: '~/Desktop' },
  { label: 'Documents',  icon: '📄', path: '~/Documents' },
  { label: 'Downloads',  icon: '⬇', path: '~/Downloads' },
  { label: 'code',       icon: '⌨', path: '~/code' },
  { label: 'codes',      icon: '⌨', path: '~/codes' },
  { label: 'Projects',   icon: '📦', path: '~/Projects' },
  { label: 'workspace',  icon: '📦', path: '~/workspace' },
];

function pathBasename(p: string) { return p.split('/').pop() || p; }
function buildCrumbs(p: string): Array<{ label: string; path: string }> {
  const parts = p.replace(/^\//, '').split('/');
  return parts.map((_, i) => ({
    label: parts[i],
    path: '/' + parts.slice(0, i + 1).join('/'),
  }));
}

interface Props {
  initialPath?: string;
  onConfirm: (path: string) => void;
  onCancel: () => void;
}

export default function DirPicker({ initialPath = '~', onConfirm, onCancel }: Props) {
  const [data, setData] = useState<DirData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const navigate = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/bridge/api/local/dirs?path=${encodeURIComponent(p)}`);
      if (!res.ok) return;
      const d = await res.json() as DirData;
      setData(d);
      setSelected(null);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { navigate(initialPath); }, [initialPath]); // eslint-disable-line

  const activePath = selected ?? data?.path ?? '';
  const crumbs = data ? buildCrumbs(data.path) : [];

  function handleSelect(path: string) {
    setSelected((prev) => (prev === path ? null : path));
  }

  function handleFolderDoubleClick(path: string) {
    navigate(path);
  }

  return (
    <div className={styles.root}>
      {/* Left: bookmarks */}
      <aside className={styles.bookmarks}>
        <div className={styles.bookmarkTitle}>FAVORITES</div>
        {BOOKMARKS.map((b) => (
          <button
            key={b.path}
            className={`${styles.bookmark} ${data?.path === b.path ? styles.bookmarkActive : ''}`}
            onClick={() => navigate(b.path)}
          >
            <span className={styles.bookmarkIcon}>{b.icon}</span>
            <span className={styles.bookmarkLabel}>{b.label}</span>
          </button>
        ))}
      </aside>

      {/* Right: browser */}
      <div className={styles.browser}>
        {/* Breadcrumb */}
        <div className={styles.breadcrumb}>
          {crumbs.map((c, i) => (
            <span key={c.path} className={styles.crumbPart}>
              {i > 0 && <span className={styles.crumbSep}>›</span>}
              <button className={styles.crumbBtn} onClick={() => navigate(c.path)}>
                {c.label || '/'}
              </button>
            </span>
          ))}
        </div>

        {/* Folder grid */}
        <div className={styles.grid}>
          {loading && (
            <div className={styles.placeholder}>Loading…</div>
          )}
          {!loading && data && data.dirs.length === 0 && (
            <div className={styles.placeholder}>No folders here</div>
          )}
          {!loading && data?.dirs.map((dir) => (
            <button
              key={dir}
              className={`${styles.folderCard} ${selected === dir ? styles.folderSelected : ''}`}
              onClick={() => handleSelect(dir)}
              onDoubleClick={() => handleFolderDoubleClick(dir)}
              title={`Double-click to open\nClick to select`}
            >
              <span className={styles.folderIcon}>📁</span>
              <span className={styles.folderName}>{pathBasename(dir)}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerPath}>
            <span className={styles.footerPathLabel}>Selected:</span>
            <span className={styles.footerPathValue}>{activePath || '—'}</span>
          </div>
          <div className={styles.footerActions}>
            <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
            <button
              className={styles.confirmBtn}
              onClick={() => activePath && onConfirm(activePath)}
              disabled={!activePath}
            >
              Use This Folder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
