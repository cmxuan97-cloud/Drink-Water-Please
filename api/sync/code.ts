// 给 clientId 生成（或返回已有的）短备份码。
// 用 base32-no-confusable 字母表，8 位 + 中间一个连字符，例如 K3M7-P2AS
// 同时存两条记录：alias:<code> → clientId  和  code:<clientId> → code
// 这样既能从短码反查 clientId（restore 用），也能避免给同一用户重复发新码
import { Redis } from '@upstash/redis';

export const config = { runtime: 'edge' };

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars，去掉容易混淆的 0/O/1/I/L
const CODE_LEN = 8;
const MAX_RETRIES = 6;
const ALIAS_TTL = 60 * 60 * 24 * 365 * 5; // 5 年

const getRedis = (): Redis | null => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
};

const generateCode = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LEN));
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
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

  const redis = getRedis();
  if (!redis) return Response.json({ error: 'Redis 未配置' }, { status: 500 });

  // 已经有码就直接返回（幂等）
  const existing = await redis.get<string>(`code:${clientId}`);
  if (existing) {
    // 顺手续期 TTL
    await redis.expire(`code:${clientId}`, ALIAS_TTL).catch(() => {});
    await redis.expire(`alias:${existing}`, ALIAS_TTL).catch(() => {});
    return Response.json({ ok: true, code: existing, reused: true });
  }

  // 新生成，碰撞重试（32^8 = 1.1 × 10^12，几乎不可能撞）
  for (let i = 0; i < MAX_RETRIES; i++) {
    const code = generateCode();
    // SETNX：只在不存在时才写，原子操作避免竞态
    const stored = await redis.set(`alias:${code}`, clientId, { nx: true, ex: ALIAS_TTL });
    if (stored === 'OK') {
      await redis.set(`code:${clientId}`, code, { ex: ALIAS_TTL });
      return Response.json({ ok: true, code, reused: false });
    }
  }
  return Response.json({ error: '生成备份码失败，请重试' }, { status: 500 });
}
