import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';

const logsDir = path.resolve(process.cwd(), 'logs');

function getLogFileName(prefix: 'access' | 'client-event') {
  const date = new Date().toISOString().slice(0, 10);
  return `${prefix}-${date}.log`;
}

async function appendLine(fileName: string, line: string) {
  await fs.mkdir(logsDir, { recursive: true });
  await fs.appendFile(path.join(logsDir, fileName), `${line}\n`, 'utf8');
}

export async function writeClientEventLog(event: string, payload: Record<string, unknown>) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    event,
    ...payload,
  });
  await appendLine(getLogFileName('client-event'), line);
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
      userId: req.user?.id || null,
      role: req.user?.role || null,
    });

    void appendLine(getLogFileName('access'), line).catch((error) => {
      console.error('Failed to write access log', error);
    });
  });

  next();
}
