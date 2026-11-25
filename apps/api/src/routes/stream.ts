import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../app.ts';
import { resolveScope } from '../lib/scope.ts';

const HEARTBEAT_MS = 25_000; // under Render's idle-connection cutoff
const MAX_STREAMS = 200;
let open = 0;

export async function streamRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get('/api/events/stream', async (req, reply) => {
    const wantSandbox = (req.query as { sandbox?: string }).sandbox === 'true' ? true : undefined;
    const { viewer, sandbox } = await resolveScope(req, ctx.db, wantSandbox);
    if (open >= MAX_STREAMS) return reply.status(503).send({ error: 'busy', message: 'Too many live streams, retry shortly' });

    // keep CORS and security headers that hooks already set on the reply
    reply.raw.writeHead(200, {
      ...(reply.getHeaders() as Record<string, string>),
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    reply.hijack();
    open++;

    const send = (data: unknown, event?: string) => reply.raw.write(`${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(data)}\n\n`);
    send({ type: 'hello', at: new Date().toISOString() });

    const unsubscribe = ctx.bus.subscribe(({ sandbox: isSandbox, ownerId, ...msg }) => {
      const visible = sandbox ? isSandbox : !!viewer && ownerId === viewer.userId;
      if (visible) send(msg);
    });
    const heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), HEARTBEAT_MS);

    req.raw.on('close', () => {
      open--;
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}
