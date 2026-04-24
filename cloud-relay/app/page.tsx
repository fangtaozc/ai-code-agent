'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './page.module.css';
import { useBridge } from './hooks/useBridge';
import Sidebar from './components/Sidebar';
import ChatFeed from './components/ChatFeed';
import InputBar from './components/InputBar';
import ToolBanner from './components/ToolBanner';
import ProjectManager from './components/ProjectManager';

const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 160;
const MAX_WIDTH = 500;

export default function Home() {
  const {
    projects, activeProject, history, connected,
    hasMoreHistory, pendingTool, isRunning,
    send, setActiveProject, loadMore, decideTool,
  } = useBridge();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [isLocal, setIsLocal] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showProjectManager, setShowProjectManager] = useState(false);
  const isResizing = useRef(false);

  useEffect(() => {
    const saved = (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
    setTheme(saved);
    const savedWidth = localStorage.getItem('sidebar-width');
    if (savedWidth) setSidebarWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parseInt(savedWidth, 10))));
    if (localStorage.getItem('sidebar-collapsed') === 'true') setSidebarCollapsed(true);
  }, []);

  useEffect(() => {
    fetch('/bridge/api/local/projects')
      .then((r) => { if (r.ok) setIsLocal(true); })
      .catch(() => {});
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const w = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + ev.clientX - startX));
      setSidebarWidth(w);
    };

    const onUp = () => {
      isResizing.current = false;
      setSidebarWidth((w) => { localStorage.setItem('sidebar-width', String(w)); return w; });
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  function toggleCollapse() {
    setSidebarCollapsed((c) => {
      localStorage.setItem('sidebar-collapsed', String(!c));
      return !c;
    });
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }

  const activeInfo = projects.find((p) => p.projectPath === activeProject);

  function handleSend(text: string) {
    if (!activeProject) return;
    send({ type: 'send_prompt', projectPath: activeProject, text });
  }

  function handleAutoApprove(projectPath: string, enabled: boolean) {
    send({ type: 'set_auto_approve', projectPath, enabled });
  }

  function handleSelectProject(path: string) {
    setActiveProject(path);
    setSidebarOpen(false);
  }

  return (
    <div className={styles.root}>
      {sidebarOpen && (
        <div className={styles.backdrop} onClick={() => setSidebarOpen(false)} />
      )}

      <ProjectManager
        isOpen={showProjectManager}
        onClose={() => setShowProjectManager(false)}
        wsProjects={projects}
      />

      <Sidebar
        projects={projects}
        activeProject={activeProject}
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        width={sidebarWidth}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={toggleCollapse}
        onSelect={handleSelectProject}
        onAutoApprove={handleAutoApprove}
        onManageProjects={isLocal ? () => setShowProjectManager(true) : undefined}
        isLocal={isLocal}
      />

      {!sidebarCollapsed && (
        <div className={styles.resizeHandle} onMouseDown={handleResizeStart} />
      )}

      <div className={styles.main}>
        <div className={styles.topbar}>
          <button
            className={styles.menuBtn}
            onClick={() => sidebarCollapsed ? toggleCollapse() : setSidebarOpen(true)}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>

          <div className={styles.projectMeta}>
            <span className={styles.projectPath}>{activeProject ?? 'No project'}</span>
            {activeInfo?.sessionId && (
              <span className={styles.sessionId}>session: {activeInfo.sessionId.slice(0, 8)}…</span>
            )}
          </div>

          <div className={styles.topbarRight}>
            <span className={styles.autoChip} data-on={activeInfo?.autoApprove}>
              ⚡ Auto-approve
              <button
                className={`${styles.toggle} ${activeInfo?.autoApprove ? styles.toggleOn : ''}`}
                onClick={() => activeInfo && handleAutoApprove(activeInfo.projectPath, !activeInfo.autoApprove)}
              >
                <span className={styles.thumb} />
              </button>
            </span>

            <button
              className={styles.themeBtn}
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            <span className={styles.status} data-on={activeInfo?.connected}>
              <span className={styles.statusDot} />
              {activeInfo?.connected ? 'connected' : 'offline'}
            </span>
          </div>
        </div>

        <ChatFeed
          history={history}
          projectPath={activeProject}
          onToolDecision={decideTool}
          hasMoreHistory={hasMoreHistory}
          onLoadMore={loadMore}
          isRunning={isRunning}
        />

        {pendingTool && (
          <ToolBanner
            tool={pendingTool}
            onDeny={() => decideTool(pendingTool.requestId, false)}
            onAllow={() => decideTool(pendingTool.requestId, true)}
            onAllowAlways={() => decideTool(pendingTool.requestId, true, { alwaysAllow: true })}
            onAnswer={(answer) => decideTool(pendingTool.requestId, false, { answer })}
          />
        )}

        <InputBar
          onSend={handleSend}
          disabled={!activeProject || !connected}
        />
      </div>
    </div>
  );
}
