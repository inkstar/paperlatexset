import cron from 'node-cron';
import { prisma } from '../db/prisma';

function toDayStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function runDailyMetrics(forDate = new Date()) {
  const dayStart = toDayStart(forDate);
  const nextDay = new Date(dayStart);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const logs = await prisma.recognitionLog.findMany({
    where: {
      createdAt: {
        gte: dayStart,
        lt: nextDay,
      },
    },
  });

  const quality = await prisma.qualityLog.findMany({
    where: {
      createdAt: {
        gte: dayStart,
        lt: nextDay,
      },
    },
  });

  const grouped = new Map<string, typeof logs>();
  for (const row of logs) {
    const key = `${row.provider}:${row.model}`;
    const arr = grouped.get(key) || [];
    arr.push(row);
    grouped.set(key, arr);
  }

  for (const [key, rows] of grouped) {
    const [provider, model] = key.split(':');
    const totalRequests = rows.length;
    const totalInputTokens = rows.reduce((sum, x) => sum + x.inputTokens, 0);
    const totalOutputTokens = rows.reduce((sum, x) => sum + x.outputTokens, 0);
    const totalEstimatedCost = rows.reduce((sum, x) => sum + Number(x.estimatedCost), 0);
    const avgLatencyMs = Math.round(rows.reduce((sum, x) => sum + x.latencyMs, 0) / Math.max(totalRequests, 1));
    const successRate = rows.filter((x) => x.success).length / Math.max(totalRequests, 1);

    const changedFieldCount = quality.reduce((sum, row) => {
      const fields = row.changedFields as Record<string, boolean>;
      return sum + Object.values(fields).filter(Boolean).length;
    }, 0);
    const fieldRevisionRate = changedFieldCount / Math.max(rows.length * 5, 1);

    const knowledgeRevisionCount = quality.reduce((sum, row) => {
      const fields = row.changedFields as Record<string, boolean>;
      return sum + (fields.knowledgePoints ? 1 : 0);
    }, 0);
    const knowledgeRevisionRate = knowledgeRevisionCount / Math.max(rows.length, 1);

    await prisma.dailyMetric.upsert({
      where: {
        date_provider_model: {
          date: dayStart,
          provider,
          model,
        },
      },
      update: {
        provider,
        model,
        totalRequests,
        totalPages: totalRequests,
        totalInputTokens,
        totalOutputTokens,
        totalEstimatedCost,
        avgLatencyMs,
        successRate,
        fieldRevisionRate,
        knowledgeRevisionRate,
      },
      create: {
        date: dayStart,
        provider,
        model,
        totalRequests,
        totalPages: totalRequests,
        totalInputTokens,
        totalOutputTokens,
        totalEstimatedCost,
        avgLatencyMs,
        successRate,
        fieldRevisionRate,
        knowledgeRevisionRate,
      },
    });
  }
}

export function scheduleDailyMetrics() {
  cron.schedule('10 0 * * *', () => {
    runDailyMetrics().catch((error) => {
      console.error('[daily-metrics] failed', error);
    });
  });
}
