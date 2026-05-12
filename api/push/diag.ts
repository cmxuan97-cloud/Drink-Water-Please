// 诊断 endpoint — 看哪些 env / KV 配齐了。GET /api/push/diag
export const config = { runtime: 'edge' };

const validateVapidSubject = (s?: string): string | null => {
  if (!s) return '未设置';
  const trimmed = s.trim();
  if (trimmed !== s) return '前后有空格';
  if (!trimmed.startsWith('mailto:') && !trimmed.startsWith('https:')) {
    return '必须以 mailto: 或 https: 开头';
  }
  if (trimmed.startsWith('mailto:') && !trimmed.includes('@')) {
    return 'mailto: 后面必须是邮箱';
  }
  return null;
};

const validateVapidKey = (s: string | undefined, kind: 'public' | 'private'): string | null => {
  if (!s) return '未设置';
  const trimmed = s.trim();
  if (trimmed !== s) return '前后有空格';
  if (/[^A-Za-z0-9_\-=]/.test(trimmed)) return '包含非 base64url 字符（可能复制时混入了引号）';
  // VAPID public key: ~88 chars base64url. Private key: ~43 chars.
  const expectedLen = kind === 'public' ? 87 : 43;
  if (Math.abs(trimmed.length - expectedLen) > 5) {
    return `长度异常（${trimmed.length}，应约 ${expectedLen}）`;
  }
  return null;
};

export default async function handler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const inspect = url.searchParams.get('inspect') === '1';
    const env = {
      VAPID_PUBLIC_KEY: !!process.env.VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY: !!process.env.VAPID_PRIVATE_KEY,
      VAPID_SUBJECT: !!process.env.VAPID_SUBJECT,
      CRON_SECRET: !!process.env.CRON_SECRET,
      UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
      KV_REST_API_URL: !!process.env.KV_REST_API_URL,
      KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
    };

    const vapidIssues: Record<string, string> = {};
    const subErr = validateVapidSubject(process.env.VAPID_SUBJECT);
    if (subErr) vapidIssues.VAPID_SUBJECT = subErr;
    const pubErr = validateVapidKey(process.env.VAPID_PUBLIC_KEY, 'public');
    if (pubErr) vapidIssues.VAPID_PUBLIC_KEY = pubErr;
    const privErr = validateVapidKey(process.env.VAPID_PRIVATE_KEY, 'private');
    if (privErr) vapidIssues.VAPID_PRIVATE_KEY = privErr;

    const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

    let kvPing: { ok: boolean; error?: string; subCount?: number; raw?: string; subs?: any[] } = { ok: false };
    if (!redisUrl || !token) {
      kvPing = { ok: false, error: 'Redis env vars 未配置' };
    } else {
      try {
        const resp = await fetch(`${redisUrl}/smembers/subs:all`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const text = await resp.text();
        if (resp.ok) {
          try {
            const data = JSON.parse(text);
            const ids: string[] = Array.isArray(data?.result) ? data.result : [];
            kvPing = { ok: true, subCount: ids.length };

            // inspect 模式：拉每个订阅的元信息（脱敏）
            if (inspect && ids.length > 0) {
              const subs: any[] = [];
              for (const id of ids.slice(0, 5)) {
                const r = await fetch(`${redisUrl}/hgetall/sub:${id}`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                const raw = await r.text();
                try {
                  const parsed = JSON.parse(raw);
                  // result 是 array of alternating [key, value, key, value, ...]
                  const arr = parsed.result;
                  const obj: Record<string, any> = {};
                  if (Array.isArray(arr)) {
                    for (let i = 0; i < arr.length; i += 2) obj[arr[i]] = arr[i + 1];
                  } else if (arr && typeof arr === 'object') {
                    Object.assign(obj, arr);
                  }
                  // 脱敏：只显示 endpoint domain + sub 字段是否能解析
                  let endpointHost = '?';
                  let subParsable = false;
                  let subType = typeof obj.sub;
                  let keysOk = false;
                  try {
                    const subObj = typeof obj.sub === 'string' ? JSON.parse(obj.sub) : obj.sub;
                    subParsable = true;
                    endpointHost = new URL(subObj.endpoint).host;
                    keysOk = !!(subObj.keys?.p256dh && subObj.keys?.auth);
                  } catch (e) {
                    endpointHost = `parse-error: ${e instanceof Error ? e.message : 'unknown'}`;
                  }
                  subs.push({
                    clientId: id.slice(0, 12) + '…',
                    subType,
                    subParsable,
                    endpointHost,
                    keysOk,
                    wake: obj.wake,
                    sleep: obj.sleep,
                    tz: obj.tz,
                    hasLastSentAt: !!obj.lastSentAt,
                  });
                } catch (e) {
                  subs.push({ clientId: id.slice(0, 12) + '…', error: String(e), raw: raw.slice(0, 100) });
                }
              }
              kvPing.subs = subs;
            }
          } catch {
            kvPing = { ok: false, error: 'KV 返回非 JSON', raw: text.slice(0, 200) };
          }
        } else {
          kvPing = { ok: false, error: `KV HTTP ${resp.status}`, raw: text.slice(0, 200) };
        }
      } catch (e) {
        kvPing = { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }

    const vapidOk = Object.keys(vapidIssues).length === 0;
    const allConfigured =
      env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT &&
      env.CRON_SECRET && !!redisUrl && !!token && kvPing.ok && vapidOk;

    return new Response(
      JSON.stringify({
        ok: allConfigured,
        env,
        vapidValidation: vapidOk ? 'OK' : vapidIssues,
        kv: kvPing,
        nextSteps: allConfigured ? '全部就绪 ✅' : [
          !env.VAPID_PUBLIC_KEY && '在 Vercel env 加 VAPID_PUBLIC_KEY',
          !env.VAPID_PRIVATE_KEY && '在 Vercel env 加 VAPID_PRIVATE_KEY',
          !env.VAPID_SUBJECT && '在 Vercel env 加 VAPID_SUBJECT',
          !env.CRON_SECRET && '在 Vercel env 加 CRON_SECRET',
          (!redisUrl || !token) && '安装 Upstash Redis 集成',
          redisUrl && token && !kvPing.ok && `KV 连接失败: ${kvPing.error}`,
          !vapidOk && `VAPID 格式问题: ${JSON.stringify(vapidIssues)}`,
        ].filter(Boolean),
      }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        crash: true,
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack?.split('\n').slice(0, 8) : undefined,
      }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
