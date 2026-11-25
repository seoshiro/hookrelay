import type { FastifyRequest } from 'fastify';
import type { Db } from '../db/client.ts';
import { HttpError, resolveViewer } from '../security/auth.ts';
import type { Prisma } from '../generated/prisma/client.ts';

/**
 * Who can see what: anonymous visitors see only the public sandbox; signed-in users see their own
 * sources, or the sandbox when they ask for it explicitly.
 */
export async function resolveScope(req: FastifyRequest, db: Db, wantSandbox: boolean | undefined) {
  const viewer = await resolveViewer(req, db);
  const sandbox = wantSandbox ?? !viewer;
  if (!sandbox && !viewer) throw new HttpError(401, 'Sign in required', 'unauthorized');
  const sourceWhere: Prisma.SourceWhereInput = sandbox ? { isSandbox: true } : { userId: viewer!.userId };
  return { viewer, sandbox, sourceWhere };
}

/** Whether the caller may act on (replay, inspect) an event of this source. */
export function canAccess(source: { isSandbox: boolean; userId: string | null }, viewerId: string | undefined): boolean {
  return source.isSandbox || (!!viewerId && source.userId === viewerId);
}
