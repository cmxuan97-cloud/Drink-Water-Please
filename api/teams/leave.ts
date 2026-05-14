// 离开小队（如果是最后一个就解散）。body: { clientId, teamId }
import { errResp, getRedis, jsonResp, parseJson, requireUsername } from '../social/_shared';

export const config = { runtime: 'edge' };

const TTL = 60 * 60 * 24 * 180;

type Body = { clientId?: string; teamId?: string };

type Team = {
  id: string;
  name: string;
  createdBy: string;
  members: string[];
  joinCode: string;
  createdAt: number;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errResp('Method not allowed', 405);
  const body = await parseJson<Body>(req);
  if (!body) return errResp('JSON 无效', 400);
  if (!body.teamId) return errResp('缺 teamId', 400);

  const redis = getRedis();
  if (!redis) return errResp('Redis 未配置', 500);
  const auth = await requireUsername(redis, body.clientId ?? '');
  if (!auth.ok) return errResp(auth.error, auth.status);
  const myClientId = body.clientId!;

  const team = await redis.get<Team>(`team:${body.teamId}`);
  if (!team) {
    // 已经不存在 — 清掉我本地的关联
    await redis.srem(`teams:${myClientId}`, body.teamId);
    return jsonResp({ ok: true });
  }
  team.members = team.members.filter((m) => m !== myClientId);

  await redis.srem(`teams:${myClientId}`, body.teamId);

  if (team.members.length === 0) {
    // 解散
    await Promise.all([
      redis.del(`team:${body.teamId}`),
      redis.del(`code:${team.joinCode}`),
    ]);
    return jsonResp({ ok: true, dissolved: true });
  }
  await redis.set(`team:${body.teamId}`, JSON.stringify(team), { ex: TTL });
  return jsonResp({ ok: true });
}
