// 在好友的公园留言 — body: { clientId, targetUsername, message }
import { errResp, getRedis, jsonResp, lookupClientId, parseJson, profileSummary, requireUsername } from '../_shared';

export const config = { runtime: 'edge' };

const MAX_NOTES = 30;
const TTL = 60 * 60 * 24 * 90; // 90 天
const INBOX_TTL = 60 * 60 * 24 * 30;
const INBOX_MAX = 50;

type Body = { clientId?: string; targetUsername?: string; message?: string };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errResp('Method not allowed', 405);
  const body = await parseJson<Body>(req);
  if (!body) return errResp('JSON 无效', 400);

  const message = String(body.message ?? '').trim().slice(0, 120);
  if (!message) return errResp('留言不能为空', 400);

  const redis = getRedis();
  if (!redis) return errResp('Redis 未配置', 500);
  const auth = await requireUsername(redis, body.clientId ?? '');
  if (!auth.ok) return errResp(auth.error, auth.status);
  const myClientId = body.clientId!;

  const targetUsername = (body.targetUsername ?? '').toLowerCase();
  const targetClientId = await lookupClientId(redis, targetUsername);
  if (!targetClientId) return errResp('找不到这个用户', 404);

  // 必须是好友
  if (targetClientId !== myClientId) {
    const isFriend = await redis.sismember(`friends:${myClientId}`, targetClientId);
    if (!isFriend) return errResp('只有好友才能留言', 403);
  }

  const me = await profileSummary(redis, myClientId);

  const note = {
    uid: `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fromClientId: myClientId,
    fromUsername: auth.username,
    fromDisplayName: me?.displayName ?? auth.username,
    fromCompanionId: me?.companionId,
    fromCharId: me?.charId,
    message,
    createdAt: Date.now(),
  };

  await Promise.all([
    redis.lpush(`parkNotes:${targetClientId}`, JSON.stringify(note)),
    redis.ltrim(`parkNotes:${targetClientId}`, 0, MAX_NOTES - 1),
    redis.expire(`parkNotes:${targetClientId}`, TTL),
  ]);

  // 同时也推到 inbox，让对方有提示
  if (targetClientId !== myClientId) {
    const inboxEvent = {
      uid: `nb-${note.uid}`,
      type: 'note' as const,
      fromClientId: myClientId,
      fromUsername: auth.username,
      fromDisplayName: me?.displayName ?? auth.username,
      fromCompanionId: me?.companionId,
      fromCharId: me?.charId,
      text: message,
      createdAt: Date.now(),
    };
    await Promise.all([
      redis.lpush(`inbox:${targetClientId}`, JSON.stringify(inboxEvent)),
      redis.ltrim(`inbox:${targetClientId}`, 0, INBOX_MAX - 1),
      redis.expire(`inbox:${targetClientId}`, INBOX_TTL),
    ]);
  }

  return jsonResp({ ok: true, note });
}
