/* eslint-disable @typescript-eslint/no-explicit-any */
import webpush from 'web-push';

type SubData = {
  sub: string;
  wake: number;
  sleep: number;
  tz: string;
  updatedAt: number;
  lastSentAt?: number;
};

const MESSAGES: Array<{ title: string; body: string }> = [
  { title: '💧 喝水时间到', body: '奇异鸟在等你呢～' },
  { title: '🚰 别忘了补水', body: '一杯水的事，加油' },
  { title: '🥤 来一口吧', body: '小爪子等了好久了' },
  { title: '💦 喝水提醒', body: '保持节奏，今天会达标的' },
  { title: '🌊 该补水啦', body: '咕嘟咕嘟，喝起来' },
  { title: '🐦 奇异鸟看着你', body: '它说嘴巴干干的，要陪它喝水' },
  { title: '✨ 喝水小提醒', body: '现在喝一杯，会记一笔' },
  { title: '☁️ 别忘了水', body: '专注间隙喝一杯，状态更好' },
];

const localHour = (tz: string): number => {
  try {
    const h = new Date().toLocaleString('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    });
    return parseInt(h, 10);
  } catch {
    return new Date().getHours();
  }
};

// 同一用户两次推送至少间隔（防 cron 跑得勤+多个 cron 同时炸）
const MIN_INTERVAL_MIN = 55;

const initVapid = (): boolean => {
  const subject = process.env.VAPID_SUBJECT;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  return true;
};

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url, 'http://localhost');
  const isTest = url.searchParams.get('test') === '1';
  const targetClient = url.searchParams.get('clientId');
  const dry = url.searchParams.get('dry') === '1';

  // 鉴权：cron 走 secret，test 模式只对调用者发自己
  if (!isTest) {
    const secret = url.searchParams.get('secret');
    if (!secret || secret !== process.env.CRON_SECRET) {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  if (!initVapid()) {
    return Response.json({ error: '服务端未配置 VAPID keys' }, { status: 500 });
  }

  // @vercel/kv throws at module-init time when env vars are missing, so import lazily
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return Response.json({ error: '服务端未配置 KV 环境变量' }, { status: 500 });
  }
  const { kv } = await import('@vercel/kv');

  const allIds = isTest && targetClient
    ? [targetClient]
    : await kv.smembers<string[]>('subs:all').catch(() => []);

  if (!allIds || allIds.length === 0) {
    return Response.json({ ok: true, sent: 0, total: 0, note: '无订阅' });
  }

  let sent = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (const id of allIds) {
    let data: SubData | null = null;
    try {
      data = (await kv.hgetall<SubData>(`sub:${id}`)) as SubData | null;
    } catch {
      // ignore
    }
    if (!data || !data.sub) {
      skipped++;
      continue;
    }

    if (!isTest) {
      // 时间窗：当地时间 [wake, sleep)
      const h = localHour(data.tz);
      if (h < data.wake || h >= data.sleep) {
        skipped++;
        continue;
      }
      // 间隔
      if (data.lastSentAt && Date.now() - data.lastSentAt < MIN_INTERVAL_MIN * 60 * 1000) {
        skipped++;
        continue;
      }
    }

    if (dry) {
      sent++;
      continue;
    }

    const msg = isTest
      ? { title: '🧪 测试推送', body: '看到这条说明 push 通了！' }
      : MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

    try {
      await webpush.sendNotification(
        JSON.parse(data.sub),
        JSON.stringify({ ...msg, url: '/' }),
      );
      sent++;
      await kv.hset(`sub:${id}`, { lastSentAt: Date.now() });
    } catch (e: any) {
      const code = e?.statusCode;
      if (code === 404 || code === 410) {
        // 订阅失效，删掉
        await kv.del(`sub:${id}`);
        await kv.srem('subs:all', id);
      }
      failed.push(`${id}:${code || 'err'}`);
    }
  }

  return Response.json({
    ok: true,
    total: allIds.length,
    sent,
    skipped,
    failed: failed.slice(0, 5),
  });
}
