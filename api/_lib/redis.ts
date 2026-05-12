import { Redis } from '@upstash/redis';

// 支持 Upstash 原生 + Vercel KV 集成两种 env 命名
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export const isRedisConfigured = (): boolean => !!url && !!token;

export const redis = isRedisConfigured()
  ? new Redis({ url: url!, token: token! })
  : null;

export const requireRedis = (): Redis => {
  if (!redis) {
    throw new Error('Redis 未配置（缺 UPSTASH_REDIS_REST_URL / TOKEN 或 KV_REST_API_URL / TOKEN）');
  }
  return redis;
};
