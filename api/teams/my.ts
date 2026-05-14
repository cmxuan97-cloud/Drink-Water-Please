// GET 我的小队 + 每个小队的成员 profile
import { errResp, getRedis, jsonResp, profileSummary, requireUsername } from '../social/_shared';
import type { PublicProfile } from '../social/_shared';

export const config = { runtime: 'edge' };

type Team = {
  id: string;
  name: string;
  createdBy: string;
  members: string[];
  joinCode: string;
  createdAt: number;
};

type Member = PublicProfile & { clientId: string };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return errResp('Method not allowed', 405);
  const url = new URL(req.url);
  const clientId = url.searchParams.get('clientId') ?? '';

  const redis = getRedis();
  if (!redis) return errResp('Redis 未配置', 500);
  const auth = await requireUsername(redis, clientId);
  if (!auth.ok) return errResp(auth.error, auth.status);

  const teamIds = (await redis.smembers(`teams:${clientId}`)) as string[];

  const teams: Array<Team & { memberProfiles: Member[] }> = [];
  for (const tid of teamIds) {
    const team = await redis.get<Team>(`team:${tid}`);
    if (!team) {
      // 孤儿引用 — 清掉
      await redis.srem(`teams:${clientId}`, tid);
      continue;
    }
    const memberProfiles: Member[] = [];
    for (const mid of team.members) {
      const p = await profileSummary(redis, mid);
      if (p) memberProfiles.push(p);
    }
    // 按今日 % 倒序
    memberProfiles.sort((a, b) => b.todayPctGoal - a.todayPctGoal);
    teams.push({ ...team, memberProfiles });
  }

  // 按创建时间倒序
  teams.sort((a, b) => b.createdAt - a.createdAt);

  return jsonResp({ teams });
}
