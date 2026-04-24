import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn } from 'node:child_process';

const STATE_FILE = path.join(
  os.homedir(),
  '.agent-bridge',
  `local-state-${process.env.PORT ?? '3000'}.json`
);

function bridgeDir(): string {
  return process.env.AGENT_BRIDGE_DIR ?? path.resolve(process.cwd(), '..', 'agent-bridge');
}

export type SandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access';

interface ManagedProject { pid?: number; agentType?: 'claude' | 'codex'; sandboxMode?: SandboxMode }
interface LocalState { managed: Record<string, ManagedProject> }

function readState(): LocalState {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as LocalState; }
  catch { return { managed: {} }; }
}

function writeState(state: LocalState): void {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function isPidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch { return false; }
}

export interface ManagedInfo {
  projectPath: string;
  running: boolean;
  agentType: 'claude' | 'codex';
  sandboxMode: SandboxMode;
}

export function getManagedProjects(): ManagedInfo[] {
  const state = readState();
  return Object.entries(state.managed).map(([p, v]) => ({
    projectPath: p,
    running: !!v.pid && isPidAlive(v.pid),
    agentType: v.agentType ?? 'claude',
    sandboxMode: v.sandboxMode ?? 'workspace-write',
  }));
}

export function addProject(
  projectPath: string,
  agentType: 'claude' | 'codex' = 'claude',
  sandboxMode: SandboxMode = 'workspace-write',
): void {
  const state = readState();
  if (!(projectPath in state.managed)) {
    state.managed[projectPath] = { agentType, sandboxMode };
    writeState(state);
  }
}

export function updateProject(projectPath: string, updates: { sandboxMode?: SandboxMode }): 'ok' | 'not_found' {
  const state = readState();
  if (!(projectPath in state.managed)) return 'not_found';
  state.managed[projectPath] = { ...state.managed[projectPath], ...updates };
  writeState(state);
  return 'ok';
}

export function removeProject(projectPath: string): 'ok' | 'running' | 'not_found' {
  const state = readState();
  if (!(projectPath in state.managed)) return 'not_found';
  const { pid } = state.managed[projectPath];
  if (pid && isPidAlive(pid)) return 'running';
  delete state.managed[projectPath];
  writeState(state);
  return 'ok';
}

export function startProject(projectPath: string): 'ok' | 'already_running' | 'not_found' {
  const state = readState();
  if (!(projectPath in state.managed)) return 'not_found';
  const { pid } = state.managed[projectPath];
  if (pid && isPidAlive(pid)) return 'already_running';

  const dir = bridgeDir();
  const { agentType = 'claude', sandboxMode = 'workspace-write' } = state.managed[projectPath];
  const bridgeScript = path.join(dir, 'src', agentType === 'codex' ? 'bridge-ws-codex.ts' : 'bridge-ws.ts');
  const port = process.env.PORT ?? '3000';

  let extraEnv: Record<string, string> = {};
  try {
    const configFile = path.join(path.dirname(dir), 'configs', 'config');
    const lines = fs.readFileSync(configFile, 'utf8').split('\n');
    for (const line of lines) {
      const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
      if (m) extraEnv[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch {}

  const child = spawn(
    'node',
    ['--import', 'tsx/esm', bridgeScript, '--cloud', projectPath],
    {
      cwd: dir,
      env: {
        ...process.env,
        ...extraEnv,
        RELAY_URL: `ws://localhost:${port}/ws/bridge`,
        CODEX_SANDBOX_MODE: sandboxMode,
      },
      detached: true,
      stdio: 'ignore',
    }
  );
  child.unref();

  state.managed[projectPath] = { ...state.managed[projectPath], pid: child.pid };
  writeState(state);
  return 'ok';
}

export function stopProject(projectPath: string): 'ok' | 'not_running' | 'not_found' {
  const state = readState();
  if (!(projectPath in state.managed)) return 'not_found';
  const { pid } = state.managed[projectPath];

  if (!pid || !isPidAlive(pid)) {
    state.managed[projectPath] = { ...state.managed[projectPath], pid: undefined };
    writeState(state);
    return 'not_running';
  }

  try { process.kill(-pid, 'SIGTERM'); } catch {}
  state.managed[projectPath] = { ...state.managed[projectPath], pid: undefined };
  writeState(state);
  return 'ok';
}

export function updatePid(projectPath: string, pid: number): void {
  const state = readState();
  if (!(projectPath in state.managed)) return;
  state.managed[projectPath] = { ...state.managed[projectPath], pid };
  writeState(state);
}

export function resetAllPids(): void {
  const state = readState();
  for (const key of Object.keys(state.managed)) {
    const { pid } = state.managed[key];
    if (pid && isPidAlive(pid)) {
      try { process.kill(-pid, 'SIGTERM'); } catch {}
    }
    state.managed[key] = { ...state.managed[key], pid: undefined };
  }
  writeState(state);
}
