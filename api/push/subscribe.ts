import { kv } from '@vercel/kv';

type Body = {
  clientId?: string;
  subscription?: { endpoint: string; keys?: { p256dh: string; auth: string } };
  wakeHour?: number;
  sleepHour?: number;
  tz?: string;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: 'JSON 无效' }, { status: 400 });
  }

  const { clientId, subscription, wakeHour, sleepHour, tz } = body;
  if (!clientId || !subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return Response.json({ error: '订阅参数缺失' }, { status: 400 });
  }
  if (typeof wakeHour !== 'number' || typeof sleepHour !== 'number' || !tz) {
    return Response.json({ error: '设置参数缺失' }, { status: 400 });
  }

  try {
    await kv.hset(`sub:${clientId}`, {
      sub: JSON.stringify(subscription),
      wake: wakeHour,
      sleep: sleepHour,
      tz,
      updatedAt: Date.now(),
    });
    await kv.sadd('subs:all', clientId);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: `KV 写入失败：${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
}
