import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { prisma } from './db/prisma';
import { scheduleDailyMetrics } from './jobs/dailyMetricsJob';
import { authMiddleware } from './middleware/auth';
import { requestLogger } from './middleware/requestLogger';
import { authRouter } from './routes/auth';
import { authInfoRouter } from './routes/authInfo';
import { clientEventsRouter } from './routes/clientEvents';
import { paperSetsRouter } from './routes/paperSets';
import { papersRouter } from './routes/papers';
import { providersRouter } from './routes/providers';
import { questionsRouter } from './routes/questions';
import { recognitionRouter } from './routes/recognition';
import { reportsRouter } from './routes/reports';
import { statsRouter } from './routes/stats';
import { ensureBucket } from './services/storageService';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ data: { ok: true, now: new Date().toISOString() }, error: null });
});
app.get('/api/v1/health', (_req, res) => {
  res.json({ data: { ok: true, now: new Date().toISOString(), version: 'v1' }, error: null });
});

app.use(authMiddleware);
app.use(requestLogger);

app.use('/api/providers', providersRouter);
app.use('/api/auth', authRouter);
app.use('/api/papers', papersRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/papersets', paperSetsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/client-events', clientEventsRouter);
app.use('/api', recognitionRouter);

app.use('/api/v1/papers', papersRouter);
app.use('/api/v1/questions', questionsRouter);
app.use('/api/v1/stats', statsRouter);
app.use('/api/v1', authInfoRouter);
app.use('/api/v1/auth', authRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const msg = err?.message || 'Internal server error';
  res.status(500).json({ data: null, error: msg });
});

const server = app.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
  ensureBucket().catch((error) => {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(
      `MinIO is not reachable (${env.MINIO_ENDPOINT}:${env.MINIO_PORT}). Upload/recognize routes may fail until storage is available. Reason: ${reason}`,
    );
  });
  scheduleDailyMetrics();
});

server.on('error', (error: any) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`Port ${env.PORT} is already in use. Stop the existing process or change PORT in .env.server.`);
    process.exit(1);
  }
  console.error('Server startup failed', error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});
