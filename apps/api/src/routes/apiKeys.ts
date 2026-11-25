import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createApiKeySchema } from '@hookrelay/shared';
import type { AppContext } from '../app.ts';
import { HttpError, requireViewer } from '../security/auth.ts';
import { generateApiKey } from '../security/apiKey.ts';

export async function apiKeyRoutes(app: FastifyInstance, ctx: AppContext) {
  const view = (k: { id: string; name: string; prefix: string; scopes: string[]; lastUsedAt: Date | null; createdAt: Date }) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    scopes: k.scopes,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  });

  app.get('/api/api-keys', async (req) => {
    const viewer = await requireViewer(req, ctx.db, 'admin');
    const keys = await ctx.db.apiKey.findMany({ where: { userId: viewer.userId, revokedAt: null }, orderBy: { createdAt: 'desc' } });
    return { keys: keys.map(view) };
  });

  app.post('/api/api-keys', async (req, reply) => {
    const viewer = await requireViewer(req, ctx.db, 'admin');
    const body = createApiKeySchema.parse(req.body);
    const { key, prefix, keyHash } = generateApiKey();
    const created = await ctx.db.apiKey.create({ data: { userId: viewer.userId, name: body.name, scopes: body.scopes, prefix, keyHash } });
    // the plaintext key leaves the server exactly once, here
    return reply.status(201).send({ key: view(created), secret: key });
  });

  app.delete('/api/api-keys/:id', async (req, reply) => {
    const viewer = await requireViewer(req, ctx.db, 'admin');
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const res = await ctx.db.apiKey.updateMany({ where: { id, userId: viewer.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (res.count === 0) throw new HttpError(404, 'API key not found', 'not_found');
    return reply.status(204).send();
  });
}
