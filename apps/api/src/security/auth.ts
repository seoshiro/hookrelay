import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from '../db/client.ts';
import { hashKey } from './apiKey.ts';

export const SESSION_COOKIE = 'hr_session';

export class HttpError extends Error {
  constructor(readonly statusCode: number, message: string, readonly code = 'error') {
    super(message);
  }
}

export interface Viewer {
  userId: string;
  via: 'session' | 'apiKey';
  scopes: string[];
}

/** Resolves the caller from the session cookie or an `Authorization: Bearer hr_live_…` key. Null when anonymous. */
export async function resolveViewer(req: FastifyRequest, db: Db): Promise<Viewer | null> {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer hr_live_')) {
    const key = await db.apiKey.findUnique({ where: { keyHash: hashKey(auth.slice(7)) } });
    if (!key || key.revokedAt) throw new HttpError(401, 'API key is invalid or revoked', 'invalid_api_key');
    void db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    return { userId: key.userId, via: 'apiKey', scopes: key.scopes };
  }
  if (!req.cookies[SESSION_COOKIE]) return null;
  try {
    const payload = await req.jwtVerify<{ sub: string }>({ onlyCookie: true });
    return { userId: payload.sub, via: 'session', scopes: ['read', 'replay', 'ingest', 'admin'] };
  } catch {
    return null;
  }
}

export async function requireViewer(req: FastifyRequest, db: Db, scope?: string): Promise<Viewer> {
  const viewer = await resolveViewer(req, db);
  if (!viewer) throw new HttpError(401, 'Sign in required', 'unauthorized');
  if (scope && !viewer.scopes.includes(scope)) throw new HttpError(403, `Missing scope: ${scope}`, 'forbidden');
  return viewer;
}

export function setSession(reply: FastifyReply, token: string, secure: boolean): void {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    // cross-site (Vercel → Render) needs SameSite=None; same-site local dev keeps Lax
    sameSite: secure ? 'none' : 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}
