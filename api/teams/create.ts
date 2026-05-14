// 创建一个小队。body: { clientId, name }
// 返回 { teamId, joinCode } — 把 joinCode 给朋友就能加入。
import { errResp, getRedis, jsonResp, parseJson, requireUsername } from '../social/_shared';

export const config = { runtime: 'edge' };

const TTL = 60 * 60 * 24 * 180; // 半年

type Body = { clientId?: string; name?: string };

type Team = {
  id: string;
  name: string;
  createdBy: string;
  members: string[];
  joinCode: string;
  createdAt: number;
};

const genCode = (): string => {
  // 6 字符大写字母数字（排除易混淆 0/O/1/I）
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errResp('Method not allowed', 405);
  const body = await parseJson<Body>(req);
  if (!body) return errResp('JSON 无效', 400);

  const name = String(body.name ?? '').trim().slice(0, 20);
  if (!name) return errResp('请取个队名', 400);

  const redis = getRedis();
  if (!redis) return errResp('Redis 未配置', 500);
  const auth = await requireUsername(redis, body.clientId ?? '');
  if (!auth.ok) return errResp(auth.error, auth.status);
  const myClientId = body.clientId!;

  // 限制每人最多 5 个小队
  const myCount = await redis.scard(`teams:${myClientId}`);
  if (myCount >= 5) return errResp('你已经加入 5 个小队了', 409);

  // 生成不重复的 joinCode（最多尝试 8 次）
  let joinCode = '';
  for (let i = 0; i < 8; i++) {
    const candidate = genCode();
    const exists = await redis.exists(`code:${candidate}`);
    if (!exists) { joinCode = candidate; break; }
  }
  if (!joinCode) return errResp('生成 join code 失败，再试一次', 500);

  const teamId = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const team: Team = {
    id: teamId,
    name,
    createdBy: myClientId,
    members: [myClientId],
    joinCode,
    createdAt: Date.now(),
  };

  await Promise.all([
    redis.set(`team:${teamId}`, JSON.stringify(team), { ex: TTL }),
    redis.set(`code:${joinCode}`, teamId, { ex: TTL }),
    redis.sadd(`teams:${myClientId}`, teamId),
  ]);

  return jsonResp({ ok: true, teamId, joinCode, name });
}
