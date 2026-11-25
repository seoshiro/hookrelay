import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { credentialsSchema } from '@hookrelay/shared';
import type { AppContext } from '../app.ts';
import { HttpError, resolveViewer, SESSION_COOKIE, setSession } from '../security/auth.ts';

// a real hash so unknown emails cost the same time as wrong passwords
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 10);

export async function authRoutes(app: FastifyInstance, ctx: AppContext) {
  const secure = ctx.env.NODE_ENV === 'production';

  app.post('/api/auth/register', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const { email, password } = credentialsSchema.parse(req.body);
    if (await ctx.db.user.findUnique({ where: { email } })) throw new HttpError(409, 'An account with this email already exists', 'email_taken');
    const user = await ctx.db.user.create({ data: { email, passwordHash: await bcrypt.hash(password, 12) } });
    setSession(reply, app.jwt.sign({ sub: user.id }), secure);
    return reply.status(201).send({ user: { id: user.id, email: user.email, role: user.role } });
  });

  app.post('/api/auth/login', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const { email, password } = credentialsSchema.parse(req.body);
    const user = await ctx.db.user.findUnique({ where: { email } });
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new HttpError(401, 'Email or password is incorrect', 'invalid_credentials');
    setSession(reply, app.jwt.sign({ sub: user.id }), secure);
    return { user: { id: user.id, email: user.email, role: user.role } };
  });

  app.post('/api/auth/logout', async (_req, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/', secure, sameSite: secure ? 'none' : 'lax' });
    return reply.status(204).send();
  });

  // anonymous is a normal state for this app (public sandbox), so it is 200 with user: null, not 401
  app.get('/api/auth/me', async (req) => {
    const viewer = await resolveViewer(req, ctx.db);
    const user = viewer ? await ctx.db.user.findUnique({ where: { id: viewer.userId }, select: { id: true, email: true, role: true } }) : null;
    return { user };
  });
}
