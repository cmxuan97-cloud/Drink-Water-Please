// 登录：username + password → 返回 clientId（客户端拿到后 restore state）
import { Redis } from '@upstash/redis';
import {
  b64decode,
  hashPassword,
  normalizeUsername,
  timingSafeEq,
} from './_crypto';

export const config = { runtime: 'edge' };

const getRedis = (): Redis | null => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
};

type StoredUser = {
  v: number;
  clientId: string;
  displayName: string;
  passwordHash: string;
  salt: string;
  createdAt: number;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  let body: { username?: string; password?: string };
  try {
    body = (await req.json()) as { username?: string; password?: string };
  } catch {
    return Response.json({ error: 'JSON 无效' }, { status: 400 });
  }

  const username = normalizeUsername(body.username ?? '');
  const password = body.password ?? '';
  if (!username || !password) {
    return Response.json({ error: '用户名/密码不能为空' }, { status: 400 });
  }

  const redis = getRedis();
  if (!redis) return Response.json({ error: 'Redis 未配置' }, { status: 500 });

  const raw = await redis.get(`user:${username}`);
  if (!raw) {
    // 不告诉用户「用户不存在」 vs 「密码错」，统一回这一条
    return Response.json({ error: '用户名或密码不对' }, { status: 401 });
  }
  let user: StoredUser;
  try {
    user = (typeof raw === 'string' ? JSON.parse(raw) : raw) as StoredUser;
  } catch {
    return Response.json({ error: '账号数据已损坏' }, { status: 500 });
  }

  const salt = b64decode(user.salt);
  const inputHash = await hashPassword(password, salt);
  if (!timingSafeEq(inputHash, user.passwordHash)) {
    return Response.json({ error: '用户名或密码不对' }, { status: 401 });
  }

  return Response.json({
    ok: true,
    clientId: user.clientId,
    username,
    displayName: user.displayName,
  });
}
