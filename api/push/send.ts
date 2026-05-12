/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireRedis } from '../_lib/redis';

// 显式声明 Node runtime（web-push 依赖 Node crypto/https，不能跑在 Edge）
export const config = {
  runtime: 'nodejs20.x',
  maxDuration: 30,
};

// web-push 是 CJS，动态 import 让加载错误能被 catch
const loadWebPush = async () => {
  const mod = await import('web-push');
  return (mod.default ?? mod) as typeof import('web-push');
};

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

const MIN_INTERVAL_MIN = 55;

const initVapid = async (): Promise<{ ok: boolean; webpush?: typeof import('web-push'); error?: string }> => {
  const subject = process.env.VAPID_SUBJECT;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !pub || !priv) {
    return { ok: false, error: '服务端未配置 VAPID keys (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT)' };
  }
  try {
    const webpush = await loadWebPush();
    webpush.setVapidDetails(subject, pub, priv);
    return { ok: true, webpush };
  } catch (e) {
    return { ok: false, error: `web-push 加载失败：${e instanceof Error ? e.message : String(e)}` };
  }
};

export default async function handler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const isTest = url.searchParams.get('test') === '1';
    const targetClient = url.searchParams.get('clientId');
    const dry = url.searchParams.get('dry') === '1';

    if (!isTest) {
      const secret = url.searchParams.get('secret');
      if (!secret || secret !== process.env.CRON_SECRET) {
        return Response.json({ error: 'forbidden' }, { status: 403 });
      }
    }

    const vapid = await initVapid();
    if (!vapid.ok || !vapid.webpush) {
      return Response.json({ error: vapid.error || 'VAPID init failed' }, { status: 500 });
    }
    const webpush = vapid.webpush;

    let redis: ReturnType<typeof requireRedis>;
    try {
      redis = requireRedis();
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : 'Redis 初始化失败' },
        { status: 500 },
      );
    }

    let allIds: string[];
    if (isTest && targetClient) {
      allIds = [targetClient];
    } else {
      try {
        allIds = (await redis.smembers('subs:all')) as string[];
      } catch (e) {
        return Response.json(
          { error: `KV 读取失败：${e instanceof Error ? e.message : String(e)}` },
          { status: 500 },
        );
      }
    }

    if (!allIds || allIds.length === 0) {
      return Response.json({ ok: true, sent: 0, total: 0, note: '无订阅' });
    }

    let sent = 0;
    let skipped = 0;
    const failed: string[] = [];

    for (const id of allIds) {
      let data: SubData | null = null;
      try {
        data = (await redis.hgetall(`sub:${id}`)) as SubData | null;
      } catch {
        // ignore
      }
      if (!data || !data.sub) {
        skipped++;
        continue;
      }

      if (!isTest) {
        const h = localHour(data.tz);
        if (h < Number(data.wake) || h >= Number(data.sleep)) {
          skipped++;
          continue;
        }
        if (data.lastSentAt && Date.now() - Number(data.lastSentAt) < MIN_INTERVAL_MIN * 60 * 1000) {
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
        const subObj = typeof data.sub === 'string' ? JSON.parse(data.sub) : data.sub;
        await webpush.sendNotification(subObj, JSON.stringify({ ...msg, url: '/' }));
        sent++;
        await redis.hset(`sub:${id}`, { lastSentAt: Date.now() });
      } catch (e: any) {
        const code = e?.statusCode;
        if (code === 404 || code === 410) {
          await redis.del(`sub:${id}`);
          await redis.srem('subs:all', id);
        }
        failed.push(`${id}:${code || (e?.message?.slice(0, 50)) || 'err'}`);
      }
    }

    return Response.json({
      ok: true,
      total: allIds.length,
      sent,
      skipped,
      failed: failed.slice(0, 5),
    });
  } catch (e) {
    // 兜底 — 任何 uncaught 都返回 JSON，避免 Vercel 默认 HTML 错误页
    return Response.json(
      {
        error: '服务端崩溃',
        detail: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack?.split('\n').slice(0, 5) : undefined,
      },
      { status: 500 },
    );
  }
}
