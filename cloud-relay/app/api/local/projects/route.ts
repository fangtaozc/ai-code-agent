import { NextRequest } from 'next/server';
import * as localManager from '../../../../src/lib/local-manager';
import type { SandboxMode } from '../../../../src/lib/local-manager';

function notLocal() {
  return Response.json({ error: 'Not available' }, { status: 403 });
}

export function GET() {
  if (process.env.IS_LOCAL !== 'true') return notLocal();
  return Response.json({ projects: localManager.getManagedProjects() });
}

export async function POST(req: NextRequest) {
  if (process.env.IS_LOCAL !== 'true') return notLocal();

  const body = await req.json() as {
    action: string;
    projectPath: string;
    agentType?: 'claude' | 'codex';
    sandboxMode?: SandboxMode;
  };
  const { action, projectPath, agentType, sandboxMode } = body;

  switch (action) {
    case 'add':
      localManager.addProject(projectPath, agentType ?? 'claude', sandboxMode ?? 'workspace-write');
      return Response.json({ ok: true });

    case 'update': {
      const r = localManager.updateProject(projectPath, { sandboxMode });
      if (r === 'not_found') return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ ok: true });
    }

    case 'remove': {
      const r = localManager.removeProject(projectPath);
      if (r === 'running') return Response.json({ error: 'Stop the project first' }, { status: 400 });
      if (r === 'not_found') return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ ok: true });
    }

    case 'start': {
      const r = localManager.startProject(projectPath);
      return Response.json({ ok: r === 'ok', result: r });
    }

    case 'stop': {
      const r = localManager.stopProject(projectPath);
      return Response.json({ ok: r === 'ok', result: r });
    }

    default:
      return Response.json({ error: 'Unknown action' }, { status: 400 });
  }
}
