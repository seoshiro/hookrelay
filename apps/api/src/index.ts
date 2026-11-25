import { loadEnv } from './config/env.ts';
import { createDb } from './db/client.ts';
import { buildApp } from './app.ts';

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const { app, ctx } = await buildApp(env, db);

if (env.WORKER_ENABLED) ctx.worker.start();

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await ctx.worker.stop();
  await app.close();
  await db.$disconnect();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ port: env.PORT, host: '0.0.0.0' });
