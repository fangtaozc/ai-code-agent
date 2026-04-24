import { NextRequest } from 'next/server';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export function GET(req: NextRequest) {
  if (process.env.IS_LOCAL !== 'true') {
    return Response.json({ error: 'Not available' }, { status: 403 });
  }

  const raw = req.nextUrl.searchParams.get('path') ?? os.homedir();
  const resolved = raw.startsWith('~') ? raw.replace(/^~/, os.homedir()) : raw;

  let dirs: string[] = [];
  try {
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => path.join(resolved, e.name))
      .sort();
  } catch {}

  return Response.json({ path: resolved, parent: path.dirname(resolved), dirs });
}
