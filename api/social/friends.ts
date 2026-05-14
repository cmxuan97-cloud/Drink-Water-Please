// 我的好友 + 收到的请求 + 发出去的请求 — 一次拿全
import { errResp, getRedis, jsonResp, profileSummary, requireUsername } from './_shared';
import type { PublicProfile } from './_shared';

export const config = { runtime: 'edge' };

type Friend = PublicProfile & { clientId: string };
type FriendReq = { clientId: string; username: string; displayName: string; charId?: string; sentAt: number };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return errResp('Method not allowed', 405);
  const url = new URL(req.url);
  const clientId = url.searchParams.get('clientId') ?? '';

  const redis = getRedis();
  if (!redis) return errResp('Redis 未配置', 500);

  const auth = await requireUsername(redis, clientId);
  if (!auth.ok) return errResp(auth.error, auth.status);

  // 1. friends set
  const friendIds = (await redis.smembers(`friends:${clientId}`)) as string[];
  // 2. incoming requests (zset → with timestamps)
  const inRaw = (await redis.zrange(`friendReq:in:${clientId}`, 0, -1, { withScores: true, rev: true })) as (string | number)[];
  // 3. outgoing
  const outRaw = (await redis.zrange(`friendReq:out:${clientId}`, 0, -1, { withScores: true, rev: true })) as (string | number)[];

  // pair (id, score)
  const pairs = (raw: (string | number)[]): Array<[string, number]> => {
    const out: Array<[string, number]> = [];
    for (let i = 0; i < raw.length; i += 2) {
      out.push([String(raw[i]), Number(raw[i + 1])]);
    }
    return out;
  };
  const incomingPairs = pairs(inRaw);
  const outgoingPairs = pairs(outRaw);

  // 拉所有相关 profile
  const friends: Friend[] = [];
  for (const id of friendIds) {
    const p = await profileSummary(redis, id);
    if (p) friends.push(p);
  }

  const buildReq = async (id: string, score: number): Promise<FriendReq | null> => {
    const p = await profileSummary(redis, id);
    if (!p) return null;
    return {
      clientId: id,
      username: p.username,
      displayName: p.displayName,
      charId: p.charId,
      sentAt: score,
    };
  };

  const incoming: FriendReq[] = [];
  for (const [id, score] of incomingPairs) {
    const r = await buildReq(id, score);
    if (r) incoming.push(r);
  }
  const outgoing: FriendReq[] = [];
  for (const [id, score] of outgoingPairs) {
    const r = await buildReq(id, score);
    if (r) outgoing.push(r);
  }

  return jsonResp({ friends, incoming, outgoing });
}
