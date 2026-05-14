// 处理好友请求 — body: { clientId, fromClientId, accept }
import { errResp, getRedis, jsonResp, parseJson, requireUsername } from '../_shared';

export const config = { runtime: 'edge' };

type Body = { clientId?: string; fromClientId?: string; accept?: boolean };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errResp('Method not allowed', 405);
  const body = await parseJson<Body>(req);
  if (!body) return errResp('JSON 无效', 400);
  if (!body.fromClientId) return errResp('缺 fromClientId', 400);

  const redis = getRedis();
  if (!redis) return errResp('Redis 未配置', 500);

  const auth = await requireUsername(redis, body.clientId ?? '');
  if (!auth.ok) return errResp(auth.error, auth.status);
  const myClientId = body.clientId!;
  const fromClientId = body.fromClientId;

  // 是否真的有这个 incoming request
  const hasReq = await redis.zscore(`friendReq:in:${myClientId}`, fromClientId);
  if (hasReq === null) return errResp('没有这个请求', 404);

  // 先移除请求记录
  await Promise.all([
    redis.zrem(`friendReq:in:${myClientId}`, fromClientId),
    redis.zrem(`friendReq:out:${fromClientId}`, myClientId),
  ]);

  if (body.accept) {
    await Promise.all([
      redis.sadd(`friends:${myClientId}`, fromClientId),
      redis.sadd(`friends:${fromClientId}`, myClientId),
    ]);
    return jsonResp({ ok: true, accepted: true });
  }
  return jsonResp({ ok: true, accepted: false });
}
