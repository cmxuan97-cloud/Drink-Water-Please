// Admin 删除用户 — 清理该 clientId 下所有 Redis 记录
import { checkAdminAuth, getRedis } from './_auth';

export const config = { runtime: 'edge' };

const PROTECTED_USERNAMES = new Set(['kiwi', 'mingxuan97']);

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const auth = checkAdminAuth(req);
  if (!auth.ok) return Response.json({ error: auth.reason }, { status: 401 });

  const redis = getRedis();
  if (!redis) return Response.json({ error: 'Redis 未配置' }, { status: 500 });

  let body: { clientId?: string };
  try {
    body = (await req.json()) as { clientId?: string };
  } catch {
    return Response.json({ error: 'JSON 无效' }, { status: 400 });
  }

  const clientId = body.clientId?.trim();
  if (!clientId || clientId.length < 8) {
    return Response.json({ error: '缺/无效 clientId' }, { status: 400 });
  }

  // 拿 username — 同时检查保护账号
  const username = await redis.get<string>(`username:${clientId}`).catch(() => null);
  if (username && PROTECTED_USERNAMES.has(username)) {
    return Response.json({ error: `@${username} 是受保护账号，不可删除` }, { status: 403 });
  }

  // 拿备份码（需要同时删 alias:*）
  const backupCode = await redis.get<string>(`code:${clientId}`).catch(() => null);

  // 并发删除所有关联 key
  const keysToDelete: string[] = [
    `sub:${clientId}`,
    `progress:${clientId}`,
    `state:${clientId}`,
    `code:${clientId}`,
    `username:${clientId}`,
  ];
  if (username) keysToDelete.push(`user:${username}`);
  if (backupCode) keysToDelete.push(`alias:${backupCode}`);

  await Promise.all([
    redis.del(...keysToDelete),
    redis.srem('subs:all', clientId),
  ]);

  return Response.json({ ok: true, deleted: keysToDelete, clientId });
}
