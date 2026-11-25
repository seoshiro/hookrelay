import type { FastifyInstance } from 'fastify';
import type { MetricsSummary } from '@hookrelay/shared';
import type { AppContext } from '../app.ts';
import { resolveScope } from '../lib/scope.ts';
import { Prisma } from '../generated/prisma/client.ts';

const WINDOW_MIN = 15;
const BUCKET_SEC = 30;
const BUCKETS = (WINDOW_MIN * 60) / BUCKET_SEC;

export async function summaryRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get('/api/metrics/summary', async (req) => {
    const wantSandbox = (req.query as { sandbox?: string }).sandbox === 'true' ? true : undefined;
    const { viewer, sandbox } = await resolveScope(req, ctx.db, wantSandbox);
    const scope = sandbox ? Prisma.sql`s."isSandbox" = true` : Prisma.sql`s."userId" = ${viewer!.userId}`;
    const since = new Date(Date.now() - WINDOW_MIN * 60_000);

    const [perBucket, pct, outcome, depth, dlq] = await Promise.all([
      ctx.db.$queryRaw<{ bucket: number; n: number; avg: number }[]>`
        SELECT floor(extract(epoch FROM (a."createdAt" - ${since}::timestamptz)) / ${BUCKET_SEC})::int AS bucket,
               count(*)::int AS n, coalesce(avg(a."latencyMs"), 0)::float AS avg
        FROM "DeliveryAttempt" a JOIN "WebhookEvent" e ON e.id = a."eventId" JOIN "Source" s ON s.id = e."sourceId"
        WHERE a."createdAt" >= ${since} AND ${scope}
        GROUP BY 1 ORDER BY 1`,
      ctx.db.$queryRaw<{ p50: number | null; p95: number | null }[]>`
        SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY a."latencyMs")::float AS p50,
               percentile_cont(0.95) WITHIN GROUP (ORDER BY a."latencyMs")::float AS p95
        FROM "DeliveryAttempt" a JOIN "WebhookEvent" e ON e.id = a."eventId" JOIN "Source" s ON s.id = e."sourceId"
        WHERE a."createdAt" >= ${since} AND ${scope}`,
      ctx.db.$queryRaw<{ status: string; n: number }[]>`
        SELECT e.status::text AS status, count(*)::int AS n
        FROM "WebhookEvent" e JOIN "Source" s ON s.id = e."sourceId"
        WHERE e."updatedAt" >= ${since} AND e.status IN ('DELIVERED', 'DLQ') AND ${scope}
        GROUP BY 1`,
      ctx.db.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM "WebhookEvent" e JOIN "Source" s ON s.id = e."sourceId"
        WHERE e.status IN ('PENDING', 'RETRYING', 'PROCESSING') AND ${scope}`,
      ctx.db.$queryRaw<{ category: string; n: number }[]>`
        SELECT CASE
                 WHEN e."lastError" LIKE 'HTTP 5%' THEN 'upstream5xx'
                 WHEN e."lastError" LIKE 'Timed out%' THEN 'timeout'
                 WHEN e."lastError" LIKE 'SSRF%' OR e."lastError" LIKE '%ENOTFOUND%' THEN 'ssrfDns'
                 ELSE 'other' END AS category,
               count(*)::int AS n
        FROM "WebhookEvent" e JOIN "Source" s ON s.id = e."sourceId"
        WHERE e.status = 'DLQ' AND ${scope}
        GROUP BY 1`,
    ]);

    const throughput = Array.from({ length: BUCKETS }, () => 0);
    const latencyBuckets = Array.from({ length: BUCKETS }, () => 0);
    for (const r of perBucket) {
      if (r.bucket >= 0 && r.bucket < BUCKETS) {
        throughput[r.bucket] = r.n;
        latencyBuckets[r.bucket] = Math.round(r.avg);
      }
    }
    const delivered = outcome.find((o) => o.status === 'DELIVERED')?.n ?? 0;
    const failed = outcome.find((o) => o.status === 'DLQ')?.n ?? 0;
    const cat = (k: string) => dlq.find((d) => d.category === k)?.n ?? 0;

    const body: MetricsSummary = {
      windowMinutes: WINDOW_MIN,
      bucketSec: BUCKET_SEC,
      throughput,
      latencyBuckets,
      p50: Math.round(pct[0]?.p50 ?? 0),
      p95: Math.round(pct[0]?.p95 ?? 0),
      successRate: delivered + failed === 0 ? 1 : delivered / (delivered + failed),
      delivered,
      failed,
      queueDepth: depth[0]?.n ?? 0,
      dlqTotal: dlq.reduce((sum, d) => sum + d.n, 0),
      dlqByCategory: { upstream5xx: cat('upstream5xx'), timeout: cat('timeout'), ssrfDns: cat('ssrfDns'), other: cat('other') },
    };
    return body;
  });
}
