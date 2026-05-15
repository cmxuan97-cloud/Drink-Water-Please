import { errResp, getRedis, jsonResp, parseJson, requireUsername } from '../_shared';

export const config = { runtime: 'edge' };

type CheckinBody = { clientId?: string; lat?: unknown; lng?: unknown };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errResp('Method not allowed', 405);

  const body = await parseJson<CheckinBody>(req);
  if (!body) return errResp('JSON 无效', 400);

  const { clientId = '', lat, lng } = body;

  if (
    typeof lat !== 'number' || typeof lng !== 'number' ||
    !Number.isFinite(lat) || !Number.isFinite(lng) ||
    lat < -90 || lat > 90 || lng < -180 || lng > 180
  ) {
    return errResp('经纬度无效', 400);
  }

  const redis = getRedis();
  if (!redis) return errResp('Redis 未配置', 500);

  const auth = await requireUsername(redis, clientId);
  if (!auth.ok) return errResp(auth.error, auth.status);

  await Promise.all([
    redis.geoadd('geo:nearby', { longitude: lng, latitude: lat, member: clientId }),
    redis.set(`nearby:active:${clientId}`, 1, { ex: 1800 }),
  ]);

  return jsonResp({ ok: true, expiresIn: 1800 });
}
