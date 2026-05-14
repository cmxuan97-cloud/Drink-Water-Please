// 用 joinCode 加入小队。body: { clientId, joinCode }
import { errResp, getRedis, jsonResp, parseJson, requireUsername } from '../social/_shared';

export const config = { runtime: 'edge' };

const TTL = 60 * 60 * 24 * 180;
const MAX_MEMBERS = 10;

type Body = { clientId?: string; joinCode?: string };

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

  const code = String(body.joinCode ?? '').trim().toUpperCase();
  if (code.length !== 6) return errResp('队码必须是 6 位', 400);

  const redis = getRedis();
  if (!redis) return errResp('Redis 未配置', 500);
  const auth = await requireUsername(redis, body.clientId ?? '');
  if (!auth.ok) return errResp(auth.error, auth.status);
  const myClientId = body.clientId!;

  const teamId = await redis.get<string>(`code:${code}`);
  if (!teamId) return errResp('队码无效或已过期', 404);

  const team = await redis.get<Team>(`team:${teamId}`);
  if (!team) return errResp('小队不存在', 404);

  if (team.members.includes(myClientId)) return errResp('你已经在小队里了', 409);
  if (team.members.length >= MAX_MEMBERS) return errResp('小队人数已满', 409);

  const myCount = await redis.scard(`teams:${myClientId}`);
  if (myCount >= 5) return errResp('你已经加入 5 个小队了', 409);

  team.members.push(myClientId);
  await Promise.all([
    redis.set(`team:${teamId}`, JSON.stringify(team), { ex: TTL }),
    redis.sadd(`teams:${myClientId}`, teamId),
  ]);

  return jsonResp({ ok: true, teamId, name: team.name });
}
