// 发好友请求 — body: { clientId, targetUsername }
import { errResp, getRedis, jsonResp, lookupClientId, parseJson, requireUsername } from '../_shared';

export const config = { runtime: 'edge' };

type Body = { clientId?: string; targetUsername?: string };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errResp('Method not allowed', 405);
  const body = await parseJson<Body>(req);
  if (!body) return errResp('JSON 无效', 400);
  if (!body.targetUsername) return errResp('缺 targetUsername', 400);

  const redis = getRedis();
  if (!redis) return errResp('Redis 未配置', 500);

  const auth = await requireUsername(redis, body.clientId ?? '');
  if (!auth.ok) return errResp(auth.error, auth.status);
  const myClientId = body.clientId!;

  const targetUsername = body.targetUsername.trim().toLowerCase();
  if (targetUsername === auth.username) return errResp('不能加自己', 400);

  const targetClientId = await lookupClientId(redis, targetUsername);
  if (!targetClientId) return errResp('找不到这个用户', 404);

  // 已是好友？
  const alreadyFriend = await redis.sismember(`friends:${myClientId}`, targetClientId);
  if (alreadyFriend) return errResp('你们已经是好友了', 409);

  // 对方已经发过给我？→ 直接互加
  const reverseReq = await redis.zscore(`friendReq:in:${myClientId}`, targetClientId);
  if (reverseReq !== null) {
    await Promise.all([
      redis.sadd(`friends:${myClientId}`, targetClientId),
      redis.sadd(`friends:${targetClientId}`, myClientId),
      redis.zrem(`friendReq:in:${myClientId}`, targetClientId),
      redis.zrem(`friendReq:out:${targetClientId}`, myClientId),
    ]);
    return jsonResp({ ok: true, autoAccepted: true });
  }

  // 我已发过？
  const alreadyOut = await redis.zscore(`friendReq:out:${myClientId}`, targetClientId);
  if (alreadyOut !== null) return errResp('已发过请求，等对方接受', 409);

  const ts = Date.now();
  await Promise.all([
    redis.zadd(`friendReq:out:${myClientId}`, { score: ts, member: targetClientId }),
    redis.zadd(`friendReq:in:${targetClientId}`, { score: ts, member: myClientId }),
  ]);
  return jsonResp({ ok: true });
}
