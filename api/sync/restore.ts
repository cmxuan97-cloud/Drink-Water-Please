// 用备份码（= clientId）拉回整个状态快照。
import { Redis } from '@upstash/redis';

export const config = { runtime: 'edge' };

const getRedis = (): Redis | null => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
};

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code')?.trim();
  if (!code || code.length < 8) {
    return Response.json({ error: '请输入有效的备份码' }, { status: 400 });
  }
  const redis = getRedis();
  if (!redis) return Response.json({ error: 'Redis 未配置' }, { status: 500 });

  // Upstash 自动 parse 看起来像 JSON 的字符串 — 我们存的是 stringify 过的，所以可能拿到 string 也可能拿到 object
  const raw = await redis.get(`state:${code}`);
  if (raw === null || raw === undefined) {
    return Response.json({ error: '找不到这个备份码' }, { status: 404 });
  }
  let state: unknown;
  if (typeof raw === 'string') {
    try {
      state = JSON.parse(raw);
    } catch {
      return Response.json({ error: '备份内容已损坏' }, { status: 500 });
    }
  } else {
    state = raw;
  }
  return Response.json({ ok: true, state });
}
