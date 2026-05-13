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
                  // 拉一下 progress 看是否同步过
                  let progress: any = null;
                  try {
                    const pr = await fetch(`${redisUrl}/hgetall/progress:${id}`, {
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    const prText = await pr.text();
                    const prJson = JSON.parse(prText);
                    const prArr = prJson.result;
                    const pObj: Record<string, any> = {};
                    if (Array.isArray(prArr)) {
                      for (let i = 0; i < prArr.length; i += 2) pObj[prArr[i]] = prArr[i + 1];
                    } else if (prArr && typeof prArr === 'object') {
                      Object.assign(pObj, prArr);
                    }
                    if (Object.keys(pObj).length) {
                      progress = {
                        drunkMl: Number(pObj.drunkMl),
                        goalMl: Number(pObj.goalMl),
                        date: pObj.date,
                        ageMin: pObj.updatedAt
                          ? Math.round((Date.now() - Number(pObj.updatedAt)) / 60000)
                          : null,
                      };
                    }
                  } catch { /* ignore */ }

                  // 「SW 收到 push 后回调」的最新时间 + 当时 app 是否在前台
                  // sent 但没 ack → Apple/FCM 没把推送送到设备
                  // ack 来了但用户没看到 → 通常是 app 在前台 / 系统通知被关
                  const lastAckAt = obj.lastAckAt ? Number(obj.lastAckAt) : null;
                  const lastAckMinAgo = lastAckAt
                    ? Math.round((Date.now() - lastAckAt) / 60000)
                    : null;
                  const lastSentAt = obj.lastSentAt ? Number(obj.lastSentAt) : null;
                  // 「最近发了但没 ack」= 推送丢了（5 min 内 sent 但还没 ack）
                  const lostInFlight = lastSentAt && (!lastAckAt || lastAckAt < lastSentAt)
                    && (Date.now() - lastSentAt) > 60_000;

                  subs.push({
                    clientId: id.slice(0, 12) + '…',
                    subType,
                    subParsable,
                    endpointHost,
                    keysOk,
                    wake: obj.wake,
                    sleep: obj.sleep,
                    tz: obj.tz,
                    mode: obj.mode || 'standard',
                    companion: obj.companion || '(none → fallback a-kiwi)',
                    hasLastSentAt: !!obj.lastSentAt,
                    lastSentMinAgo: lastSentAt
                      ? Math.round((Date.now() - lastSentAt) / 60000)
                      : null,
                    lastAckMinAgo,
                    lastAckVisible: obj.lastAckVisible === '1' || obj.lastAckVisible === 1,
                    failedAcks: Number(obj.failedAcks) || 0,
                    deliveryStatus: !lastSentAt
                      ? 'never_sent'
                      : !lastAckAt
                        ? '⚠️ sent_but_never_ack (Apple/FCM 把推送吞了 OR SW 没注册)'
                        : lostInFlight
                          ? '⚠️ recent_send_no_ack (最近一次推送可能丢了)'
                          : obj.lastAckVisible === '1' || obj.lastAckVisible === 1
                            ? 'ack_in_foreground (收到了但 app 在前台 → 不显示系统通知)'
                            : 'ok (✅ SW 已收到推送)',
                    progress,
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
