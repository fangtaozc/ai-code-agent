import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

type SessionRecord = { sessionId: string; updatedAt: string };
type Store = Record<string, SessionRecord>;

const storePath = path.join(os.homedir(), '.agent-bridge', 'sessions.json');

function load(): Store {
  try {
    return JSON.parse(fs.readFileSync(storePath, 'utf8')) as Store;
  } catch {
    return {};
  }
}

function save(store: Store): void {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

export function getSession(cwd: string): string | undefined {
  return load()[cwd]?.sessionId;
}

export function setSession(cwd: string, sessionId: string): void {
  const store = load();
  store[cwd] = { sessionId, updatedAt: new Date().toISOString() };
  save(store);
}

export function clearSession(cwd: string): void {
  const store = load();
  delete store[cwd];
  save(store);
}
