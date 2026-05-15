// 一键清空收件箱 — body: { clientId }
import { errResp, getRedis, jsonResp, parseJson, requireUsername } from '../_shared';

export const config = { runtime: 'edge' };

type Body = { clientId?: string };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errResp('Method not allowed', 405);
  const body = await parseJson<Body>(req);
  if (!body) return errResp('JSON 无效', 400);

  const redis = getRedis();
  if (!redis) return errResp('Redis 未配置', 500);
  const auth = await requireUsername(redis, body.clientId ?? '');
  if (!auth.ok) return errResp(auth.error, auth.status);

  await redis.del(`inbox:${body.clientId}`);
  await redis.set(`inbox:readAt:${body.clientId}`, String(Date.now()), { ex: 60 * 60 * 24 * 60 });
  return jsonResp({ ok: true });
}
