// 社交 endpoint 共用工具
// 文件名以 _ 开头 → Vercel 不会把它当路由部署。
import { Redis } from '@upstash/redis';

export const getRedis = (): Redis | null => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
};

/** clientId 必须已注册过账号（有 username）才能调社交 API */
export const requireUsername = async (
  redis: Redis,
  clientId: string,
): Promise<{ ok: true; username: string } | { ok: false; error: string; status: number }> => {
  if (!clientId || typeof clientId !== 'string' || clientId.length < 8) {
    return { ok: false, error: '缺/无效 clientId', status: 400 };
  }
  const username = await redis.get<string>(`username:${clientId}`);
  if (!username) return { ok: false, error: '请先注册账号才能用社交功能', status: 401 };
  return { ok: true, username };
};

/** 从 username 找 clientId（兼容大小写） */
export const lookupClientId = async (redis: Redis, username: string): Promise<string | null> => {
  const u = username.trim().toLowerCase();
  if (!u) return null;
  const rec = await redis.get<{ clientId?: string }>(`user:${u}`);
  return rec?.clientId ?? null;
};

/** 公开 profile 类型（服务端 + 客户端共用） */
export type PublicProfile = {
  username: string;
  displayName: string;
  companionId?: string;
  charId?: string;
  todayPctGoal: number;       // 0..100
  unlockedCount: number;
  totalCompletedDays: number;
  currentStreak: number;
  updatedAt: number;
};

export const getProfile = async (
  redis: Redis,
  clientId: string,
): Promise<PublicProfile | null> => {
  return (await redis.get<PublicProfile>(`profile:${clientId}`)) ?? null;
};

/** clientId → public-facing summary (with username from index) */
export const profileSummary = async (
  redis: Redis,
  clientId: string,
): Promise<(PublicProfile & { clientId: string }) | null> => {
  const profile = await getProfile(redis, clientId);
  if (!profile) {
    // 没 profile 也至少返回 username
    const username = await redis.get<string>(`username:${clientId}`);
    if (!username) return null;
    return {
      clientId,
      username,
      displayName: username,
      todayPctGoal: 0,
      unlockedCount: 1,
      totalCompletedDays: 0,
      currentStreak: 0,
      updatedAt: 0,
    };
  }
  return { ...profile, clientId };
};

export const parseJson = async <T>(req: Request): Promise<T | null> => {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
};

export const jsonResp = (data: unknown, status = 200): Response =>
  Response.json(data, { status });

export const errResp = (msg: string, status = 400): Response =>
  Response.json({ error: msg }, { status });
