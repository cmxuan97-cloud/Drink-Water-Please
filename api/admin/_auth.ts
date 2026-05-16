// 共用：admin endpoint 的密钥校验。
// 必须设 ADMIN_SECRET 环境变量；未设 → endpoint 一律拒绝（不开后门）。
export const checkAdminAuth = (req: Request): { ok: boolean; reason?: string } => {
  const expected = process.env.ADMIN_SECRET?.trim();
  if (!expected || expected.length < 8) {
    return { ok: false, reason: '服务端未配置 ADMIN_SECRET（请在 Vercel env vars 加上，≥8 位）' };
  }
  // 只接受 header，不接受 URL 参数（防止密钥进入服务器日志 / 浏览器历史）
  const provided = req.headers.get('x-admin-secret') ?? '';
  if (!provided || provided !== expected) {
    return { ok: false, reason: '密钥错误' };
  }
  return { ok: true };
};

// 共用：拿 Upstash Redis client
import { Redis } from '@upstash/redis';
export const getRedis = (): Redis | null => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
};

// SCAN 全部匹配 pattern 的 keys（防止 KEYS 命令在大库上卡顿）
export const scanAll = async (redis: Redis, pattern: string, max = 5000): Promise<string[]> => {
  const out: string[] = [];
  let cursor: string | number = 0;
  do {
    const [next, batch] = await redis.scan(cursor, { match: pattern, count: 500 }) as [string, string[]];
    out.push(...batch);
    cursor = next;
    if (out.length >= max) break;
  } while (cursor !== '0' && cursor !== 0);
  return out;
};

// 今天的 YYYY-MM-DD（按服务端 UTC 算 — 跟客户端的本地日期可能差 1 天，admin 看大致够了）
export const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
