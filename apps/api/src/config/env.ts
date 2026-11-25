import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(8080),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  METRICS_TOKEN: z.string().min(8),
  // comma-separated: a Vercel project answers on several hostnames
  FRONTEND_URL: z.string().transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)).pipe(z.array(z.url()).min(1)),
  ALLOW_LOCALHOST_ORIGINS: z.stringbool().default(false),
  PUBLIC_API_URL: z.url().default('http://localhost:8080'),
  WORKER_ENABLED: z.stringbool().default(true),
  INGEST_RATE_LIMIT_PER_MIN: z.coerce.number().int().min(1).default(120),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data;
}
