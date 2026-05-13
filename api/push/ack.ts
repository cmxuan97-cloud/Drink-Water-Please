// SW 收到 push 事件时打这里上报 — 用来跟「服务端 push 已发出」做对照诊断。
//
// 如果 send 成功但 ack 没来 → Apple/FCM 没真的把消息送到设备（或 SW 没注册）
// 如果 ack 来了但用户没看到通知 → SW 收到了，是 showNotification 没显示
//                                  （iOS 上常见原因：app 处于前台 / 系统通知被关）
import { Redis } from '@upstash/redis';

export const config = { runtime: 'edge' };

const getRedis = (): Redis | null => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  let body: { clientId?: string; visible?: boolean };
  try {
    body = (await req.json()) as { clientId?: string; visible?: boolean };
  } catch {
    return Response.json({ error: 'JSON 无效' }, { status: 400 });
  }
  const clientId = body.clientId?.trim();
  if (!clientId || clientId.length < 8) {
    return Response.json({ error: '缺/无效 clientId' }, { status: 400 });
  }
  const redis = getRedis();
  if (!redis) return Response.json({ error: 'Redis 未配置' }, { status: 500 });

  // 同时记录「最近收到」和「app 是否在前台」（前台不显示 system notification）
  // 收到 ack → failedAcks 重置为 0（彻底干净，连续失败计数清零）
  await redis.hset(`sub:${clientId}`, {
    lastAckAt: Date.now(),
    lastAckVisible: body.visible ? 1 : 0,
    failedAcks: 0,
  });
  return Response.json({ ok: true });
}
