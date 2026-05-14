// 看好友的公园 — 拿他的 public profile + 最近 30 条 notes
// GET ?clientId=mine&targetUsername=...
import { errResp, getRedis, jsonResp, lookupClientId, profileSummary, requireUsername } from '../_shared';

export const config = { runtime: 'edge' };

type Note = {
  uid: string;
  fromClientId: string;
  fromUsername: string;
  fromDisplayName: string;
  fromCharId?: string;
  message: string;
  createdAt: number;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return errResp('Method not allowed', 405);
  const url = new URL(req.url);
  const clientId = url.searchParams.get('clientId') ?? '';
  const targetUsername = (url.searchParams.get('targetUsername') ?? '').toLowerCase();

  const redis = getRedis();
  if (!redis) return errResp('Redis 未配置', 500);
  const auth = await requireUsername(redis, clientId);
  if (!auth.ok) return errResp(auth.error, auth.status);

  if (!targetUsername) return errResp('缺 targetUsername', 400);
  const targetClientId = await lookupClientId(redis, targetUsername);
  if (!targetClientId) return errResp('找不到这个用户', 404);

  // 自己进自己的公园也行
  const isSelf = targetClientId === clientId;
  if (!isSelf) {
    const isFriend = await redis.sismember(`friends:${clientId}`, targetClientId);
    if (!isFriend) return errResp('只有好友才能看公园', 403);
  }

  const profile = await profileSummary(redis, targetClientId);
  if (!profile) return errResp('对方还没有 profile', 404);

  const raw = (await redis.lrange(`parkNotes:${targetClientId}`, 0, 29)) as string[];
  const notes: Note[] = raw
    .map((s) => {
      if (typeof s === 'object') return s as Note;
      try { return JSON.parse(s) as Note; }
      catch { return null; }
    })
    .filter((x): x is Note => x !== null);

  // 访客看不到具体解锁了哪些动物（避免剧透）— 只保留 count，把 ids 抹掉
  const profileOut = isSelf ? profile : { ...profile, unlockedIds: undefined };

  return jsonResp({ profile: profileOut, notes, isSelf });
}
