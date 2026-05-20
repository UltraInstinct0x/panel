// hand-rolled JSON-line access logger. writes to ~/panel/logs/access.log.
// logrotate config documented in docs/ops.md.
import fs from 'fs';
import path from 'path';

const LOG_DIR = process.env.PANEL_LOG_DIR || path.join(process.cwd(), 'logs');
const LOG_PATH = path.join(LOG_DIR, 'access.log');

let _stream: fs.WriteStream | null = null;
function getStream(): fs.WriteStream {
  if (_stream) return _stream;
  try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}
  _stream = fs.createWriteStream(LOG_PATH, { flags: 'a' });
  _stream.on('error', () => { /* swallow — never crash app on log fail */ });
  return _stream;
}

export interface AccessRec {
  ts: number;
  method: string;
  path: string;
  status: number;
  ms: number;
  site_key?: string | null;
  rl?: { scope: string; remaining: number; limit: number; ok: boolean };
  ip?: string;
  err?: string;
}

export function logAccess(r: AccessRec) {
  try {
    getStream().write(JSON.stringify(r) + '\n');
  } catch {}
}

// wrap a route handler to auto-log timing + status.
export function withAccessLog<T extends (...args: any[]) => Promise<Response>>(
  name: string,
  fn: T,
): T {
  return (async (...args: any[]) => {
    const req = args[0] as Request;
    const started = Date.now();
    let status = 500;
    let res: Response;
    try {
      res = await fn(...args);
      status = res.status;
      return res;
    } finally {
      const u = new URL(req.url);
      logAccess({
        ts: started,
        method: req.method,
        path: u.pathname,
        status,
        ms: Date.now() - started,
        site_key: req.headers.get('x-panel-site-key') || null,
        ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || undefined,
      });
    }
  }) as T;
}
