// 进度同步 — 客户端加水/删水后调一次，写到 KV 供 smart mode 用
export const config = { runtime: 'edge' };

const todayKey = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getRedisCfg = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return { url, token };
};

const kvFetch = async (cfg: { url?: string; token?: string }, path: string): Promise<any> => {
  if (!cfg.url || !cfg.token) throw new Error('Redis 未配置');
  const r = await fetch(`${cfg.url}${path}`, { headers: { Authorization: `Bearer ${cfg.token}` } });
  const t = await r.text();
  if (!r.ok) throw new Error(`KV ${r.status}: ${t.slice(0, 100)}`);
  try { return JSON.parse(t); } catch { return null; }
};

type Body = { clientId?: string; drunkMl?: number; goalMl?: number };

export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'JSON 无效' }, { status: 400 });
    }

    const { clientId, drunkMl, goalMl } = body;
    if (!clientId || typeof drunkMl !== 'number' || typeof goalMl !== 'number') {
      return Response.json({ error: '参数缺失 (clientId / drunkMl / goalMl)' }, { status: 400 });
    }

    const cfg = getRedisCfg();
    if (!cfg.url || !cfg.token) {
      return Response.json({ error: 'Redis 未配置' }, { status: 500 });
    }

    const date = todayKey();
    const ts = Date.now();

    // Upstash REST: hset progress:<id> drunkMl <n> goalMl <n> date <s> updatedAt <n>
    // 路径形式 /hset/key/field/value/field/value...
    const path = `/hset/progress:${encodeURIComponent(clientId)}/drunkMl/${drunkMl}/goalMl/${goalMl}/date/${date}/updatedAt/${ts}`;
    await kvFetch(cfg, path);

    return Response.json({ ok: true, date, drunkMl, goalMl });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
