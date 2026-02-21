import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';

const logsDir = path.resolve(process.cwd(), 'logs');
const TZ = 'Asia/Shanghai';

function getBeijingDateKey(date: Date) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getBeijingTimestamp(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second} +08:00`;
}

function getLogFileName(prefix: 'access' | 'client-event') {
  const date = getBeijingDateKey(new Date());
  return `${prefix}-${date}.log`;
}

async function appendLine(fileName: string, line: string) {
  await fs.mkdir(logsDir, { recursive: true });
  await fs.appendFile(path.join(logsDir, fileName), `${line}\n`, 'utf8');
}

export async function writeClientEventLog(event: string, payload: Record<string, unknown>) {
  const now = new Date();
  const line = JSON.stringify({
    ts: getBeijingTimestamp(now),
    event,
    ...payload,
  });
  await appendLine(getLogFileName('client-event'), line);
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const now = new Date();
    const durationMs = Date.now() - start;
    const line = JSON.stringify({
      ts: getBeijingTimestamp(now),
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
