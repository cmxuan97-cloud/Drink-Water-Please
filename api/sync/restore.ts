// 用备份码拉回整个状态快照。
// 接受两种格式：
//   - 长 UUID（旧的 clientId 直接当备份码用）
//   - 短码（K3M7-P2AS 格式，需要先反查 clientId）
// 短码大小写无关、可以省连字符
import { Redis } from '@upstash/redis';

export const config = { runtime: 'edge' };

const getRedis = (): Redis | null => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
};

const normalizeShortCode = (raw: string): string => {
  const cleaned = raw.replace(/[\s-]/g, '').toUpperCase();
  if (cleaned.length !== 8) return raw;  // 不是短码格式，原样返回
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
};

const looksLikeShortCode = (raw: string): boolean => {
  const cleaned = raw.replace(/[\s-]/g, '');
  return cleaned.length === 8 && /^[A-Z2-9]+$/i.test(cleaned);
};

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const codeRaw = url.searchParams.get('code')?.trim();
  if (!codeRaw || codeRaw.length < 8) {
    return Response.json({ error: '请输入有效的备份码' }, { status: 400 });
  }
  const redis = getRedis();
  if (!redis) return Response.json({ error: 'Redis 未配置' }, { status: 500 });

  // 决定要查的 clientId
  let actualClientId = codeRaw;
  if (looksLikeShortCode(codeRaw)) {
    const normalized = normalizeShortCode(codeRaw);
    const aliased = await redis.get<string>(`alias:${normalized}`);
    if (aliased) actualClientId = aliased;
    else return Response.json({ error: '找不到这个备份码 — 看看有没打错' }, { status: 404 });
  }

  const raw = await redis.get(`state:${actualClientId}`);
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
  // 把真正的 clientId 也返回 — 客户端可以拿来覆盖自己的，让未来的同步打到同一条记录
  return Response.json({ ok: true, state, clientId: actualClientId });
}
