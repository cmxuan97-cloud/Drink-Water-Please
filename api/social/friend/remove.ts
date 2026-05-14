// 删好友 — body: { clientId, targetClientId }
import { errResp, getRedis, jsonResp, parseJson, requireUsername } from '../_shared';

export const config = { runtime: 'edge' };

type Body = { clientId?: string; targetClientId?: string };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errResp('Method not allowed', 405);
  const body = await parseJson<Body>(req);
  if (!body) return errResp('JSON 无效', 400);
  if (!body.targetClientId) return errResp('缺 targetClientId', 400);

  const redis = getRedis();
  if (!redis) return errResp('Redis 未配置', 500);

  const auth = await requireUsername(redis, body.clientId ?? '');
  if (!auth.ok) return errResp(auth.error, auth.status);
  const myClientId = body.clientId!;
  const targetClientId = body.targetClientId;

  await Promise.all([
    redis.srem(`friends:${myClientId}`, targetClientId),
    redis.srem(`friends:${targetClientId}`, myClientId),
    redis.zrem(`friendReq:out:${myClientId}`, targetClientId),
    redis.zrem(`friendReq:in:${targetClientId}`, myClientId),
    redis.zrem(`friendReq:in:${myClientId}`, targetClientId),
    redis.zrem(`friendReq:out:${targetClientId}`, myClientId),
  ]);

  return jsonResp({ ok: true });
}
