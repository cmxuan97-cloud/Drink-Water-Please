// 给好友递杯水。body: { clientId, targetClientId, text? }
import { errResp, getRedis, jsonResp, parseJson, profileSummary, requireUsername } from './_shared';

export const config = { runtime: 'edge' };

const INBOX_MAX = 50;
const INBOX_TTL = 60 * 60 * 24 * 30; // 30 天

type Body = { clientId?: string; targetClientId?: string; text?: string };

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

  // 必须是好友
  const isFriend = await redis.sismember(`friends:${myClientId}`, targetClientId);
  if (!isFriend) return errResp('对方不是你的好友', 403);

  const me = await profileSummary(redis, myClientId);

  const event = {
    uid: `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'water' as const,
    fromClientId: myClientId,
    fromUsername: auth.username,
    fromDisplayName: me?.displayName ?? auth.username,
    fromCharId: me?.charId,
    text: typeof body.text === 'string' ? body.text.slice(0, 80) : undefined,
    createdAt: Date.now(),
  };

  await redis.lpush(`inbox:${targetClientId}`, JSON.stringify(event));
  await redis.ltrim(`inbox:${targetClientId}`, 0, INBOX_MAX - 1);
  await redis.expire(`inbox:${targetClientId}`, INBOX_TTL);

  return jsonResp({ ok: true });
}
