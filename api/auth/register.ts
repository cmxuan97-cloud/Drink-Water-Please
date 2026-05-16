// 注册：username + password → 创建账号，绑定 clientId
// 老用户也能注册：传 bindClientId 把已有数据绑定到新账号
import { Redis } from '@upstash/redis';
import {
  b64encode,
  hashPassword,
  normalizeUsername,
  validatePassword,
  validateUsername,
} from './_crypto';
import { clientIp, rateLimit } from '../_ratelimit';

export const config = { runtime: 'edge' };

const getRedis = (): Redis | null => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
};

type Body = {
  username?: string;
  password?: string;
  displayName?: string;
  bindClientId?: string;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: 'JSON 无效' }, { status: 400 });
  }

  const usernameRaw = body.username?.trim() ?? '';
  const username = normalizeUsername(usernameRaw);
  const userErr = validateUsername(username);
  if (userErr) return Response.json({ error: userErr }, { status: 400 });

  const password = body.password ?? '';
  const pwErr = validatePassword(password);
  if (pwErr) return Response.json({ error: pwErr }, { status: 400 });

  const displayName = (body.displayName ?? usernameRaw).trim().slice(0, 30);

  const redis = getRedis();
  if (!redis) return Response.json({ error: 'Redis 未配置' }, { status: 500 });

  // 限流：每个 IP 每小时最多 5 次注册（防垃圾账号）
  const { ok: rlOk } = await rateLimit(redis, 'reg', clientIp(req), 5, 3600);
  if (!rlOk) return Response.json({ error: '注册太频繁，请稍后再试' }, { status: 429 });

  // 用户名占用？
  const existing = await redis.get(`user:${username}`);
  if (existing) {
    return Response.json({ error: '这个用户名已经有人用了' }, { status: 409 });
  }

  // 绑定到已有数据 OR 生成新 clientId
  let clientId = body.bindClientId?.trim();
  if (!clientId || clientId.length < 8) {
    clientId = crypto.randomUUID();
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await hashPassword(password, salt);

  const userRecord = {
    v: 1,
    clientId,
    displayName,
    passwordHash,
    salt: b64encode(salt),
    createdAt: Date.now(),
  };

  await redis.set(`user:${username}`, JSON.stringify(userRecord));
  // 反向 index：clientId → username（让 UI 显示「已登录: xxx」）
  await redis.set(`username:${clientId}`, username);

  return Response.json({ ok: true, clientId, username, displayName });
}
