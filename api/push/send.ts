/* eslint-disable @typescript-eslint/no-explicit-any */
// Edge runtime + 手写 Web Push（绕过 web-push CJS 包，避免 Node 冷启动超时）
export const config = { runtime: 'edge' };

const MESSAGES: Array<{ title: string; body: string }> = [
  { title: '💧 喝水时间到', body: '奇异鸟在等你呢～' },
  { title: '🚰 别忘了补水', body: '一杯水的事，加油' },
  { title: '🥤 来一口吧', body: '小爪子等了好久了' },
  { title: '💦 喝水提醒', body: '保持节奏，今天会达标的' },
  { title: '🌊 该补水啦', body: '咕嘟咕嘟，喝起来' },
  { title: '🐦 奇异鸟看着你', body: '它说嘴巴干干的，要陪它喝水' },
];

const localHour = (tz: string): number => {
  try {
    const h = new Date().toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false });
    return parseInt(h, 10);
  } catch {
    return new Date().getHours();
  }
};

// === Base64URL 工具 ===
const b64urlEncode = (data: ArrayBuffer | Uint8Array): string => {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64urlDecode = (s: string): Uint8Array => {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice(0, (4 - s.length % 4) % 4);
  const bin = atob(padded);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
};

// === VAPID JWT 签名（ES256） ===
const importVapidPrivateKey = async (privB64url: string, pubB64url: string): Promise<CryptoKey> => {
  // VAPID private key is 32 bytes raw d. Public key is 65 bytes uncompressed (0x04 || x || y).
  const dBytes = b64urlDecode(privB64url);
  const pubBytes = b64urlDecode(pubB64url);
  if (pubBytes.length !== 65 || pubBytes[0] !== 0x04) {
    throw new Error(`VAPID public key 应是 65 字节 uncompressed (0x04|x|y), 实际 ${pubBytes.length} 字节`);
  }
  const xBytes = pubBytes.slice(1, 33);
  const yBytes = pubBytes.slice(33, 65);
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    d: b64urlEncode(dBytes),
    x: b64urlEncode(xBytes),
    y: b64urlEncode(yBytes),
    ext: true,
  };
  return await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
};

const signVapidJwt = async (audience: string, subject: string, privKey: CryptoKey): Promise<string> => {
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12h
    sub: subject,
  };
  const enc = new TextEncoder();
  const headerB64 = b64urlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const sigBuf = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privKey,
    enc.encode(signingInput),
  );
  return `${signingInput}.${b64urlEncode(sigBuf)}`;
};

// === Web Push 发送（不带 payload — 简化实现，依赖前端 SW 显示默认文案） ===
const sendPushNoPayload = async (
  subscription: { endpoint: string },
  vapidJwt: string,
  vapidPublicKey: string,
): Promise<{ status: number; body?: string }> => {
  const resp = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${vapidJwt}, k=${vapidPublicKey}`,
      'TTL': '60',
    },
  });
  if (resp.ok || resp.status === 201) return { status: resp.status };
  return { status: resp.status, body: (await resp.text()).slice(0, 200) };
};

// === 带 payload 的 push（aes128gcm 加密） ===
const HKDF = async (salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> => {
  const key = await crypto.subtle.importKey('raw', salt as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', key, ikm as BufferSource));
  const prkKey = await crypto.subtle.importKey('raw', prk as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const infoWithCounter = new Uint8Array(info.length + 1);
  infoWithCounter.set(info);
  infoWithCounter[info.length] = 1;
  const t = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, infoWithCounter as BufferSource));
  return t.slice(0, length);
};

const concat = (...arrays: Uint8Array[]): Uint8Array => {
  const len = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
};

const encryptPayload = async (
  payload: string,
  p256dhB64: string,
  authB64: string,
): Promise<{ ciphertext: Uint8Array; serverPublicKey: Uint8Array; salt: Uint8Array }> => {
  const enc = new TextEncoder();
  const plaintext = enc.encode(payload);
  const clientPub = b64urlDecode(p256dhB64);
  const auth = b64urlDecode(authB64);

  // Generate ephemeral ECDH key pair
  const serverKp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverKp.publicKey));

  // Import client public key
  const clientPubKey = await crypto.subtle.importKey(
    'raw', clientPub as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: clientPubKey }, serverKp.privateKey, 256),
  );

  // Salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // PRK_key = HKDF(auth, sharedSecret, "WebPush: info\0" || clientPub || serverPub, 32)
  const keyInfo = concat(
    enc.encode('WebPush: info\0'),
    clientPub,
    serverPubRaw,
  );
  const prkKey = await HKDF(auth, sharedSecret, keyInfo, 32);

  // CEK = HKDF(salt, PRK_key, "Content-Encoding: aes128gcm\0", 16)
  const cek = await HKDF(salt, prkKey, enc.encode('Content-Encoding: aes128gcm\0'), 16);

  // Nonce = HKDF(salt, PRK_key, "Content-Encoding: nonce\0", 12)
  const nonce = await HKDF(salt, prkKey, enc.encode('Content-Encoding: nonce\0'), 12);

  // Encrypt: plaintext || 0x02 (single record padding delimiter)
  const padded = concat(plaintext, new Uint8Array([0x02]));
  const aesKey = await crypto.subtle.importKey('raw', cek as BufferSource, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource }, aesKey, padded as BufferSource),
  );

  // Build aes128gcm record: salt(16) || rs(4) || idlen(1) || keyid || ciphertext
  // keyid = serverPubRaw (uncompressed P-256 = 65 bytes)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  const idlen = new Uint8Array([serverPubRaw.length]);
  const body = concat(salt, rs, idlen, serverPubRaw, ciphertext);
  return { ciphertext: body, serverPublicKey: serverPubRaw, salt };
};

const sendPushWithPayload = async (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapidJwt: string,
  vapidPublicKey: string,
): Promise<{ status: number; body?: string }> => {
  const { ciphertext } = await encryptPayload(payload, subscription.keys.p256dh, subscription.keys.auth);

  const resp = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${vapidJwt}, k=${vapidPublicKey}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '60',
    },
    body: ciphertext,
  });
  if (resp.ok || resp.status === 201) return { status: resp.status };
  return { status: resp.status, body: (await resp.text()).slice(0, 200) };
};

// === Redis ===
const getRedisCfg = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return { url, token };
};

const kvFetch = async (
  cfg: { url?: string; token?: string },
  path: string,
): Promise<any> => {
  if (!cfg.url || !cfg.token) throw new Error('Redis 未配置');
  const r = await fetch(`${cfg.url}${path}`, { headers: { Authorization: `Bearer ${cfg.token}` } });
  const t = await r.text();
  if (!r.ok) throw new Error(`KV ${r.status}: ${t.slice(0, 100)}`);
  try { return JSON.parse(t); } catch { return null; }
};

const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

type Mode = 'easy' | 'standard' | 'frequent' | 'smart';

const STATIC_INTERVAL: Record<Exclude<Mode, 'smart'>, number> = {
  easy: 90,
  standard: 60,
  frequent: 30,
};

const computeSmartInterval = (
  drunkMl: number,
  goalMl: number,
  wakeHour: number,
  sleepHour: number,
  tz: string,
): { interval: number; skip: boolean } => {
  if (goalMl <= 0) return { interval: 60, skip: false };
  if (drunkMl >= goalMl) return { interval: 0, skip: true };  // 已达标 → 不发

  const nowHour = (() => {
    try {
      const h = new Date().toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false });
      return parseInt(h, 10);
    } catch { return new Date().getHours(); }
  })();
  const awakeHours = Math.max(1, sleepHour - wakeHour);
  const elapsed = Math.max(0, Math.min(awakeHours, nowHour - wakeHour));
  const idealPct = elapsed / awakeHours;
  const actualPct = drunkMl / goalMl;
  const lag = idealPct - actualPct;

  if (lag > 0.25) return { interval: 30, skip: false };       // 落后多 → 30 min
  if (lag < -0.05) return { interval: 90, skip: false };      // 超前 → 90 min
  return { interval: 60, skip: false };                       // 持平
};

export default async function handler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const isTest = url.searchParams.get('test') === '1';
    const targetClient = url.searchParams.get('clientId');
    const dry = url.searchParams.get('dry') === '1';
    const delaySec = Math.max(0, Math.min(25, parseInt(url.searchParams.get('delay') || '0', 10) || 0));

    // 服务端 sleep — 即使客户端关闭 app，函数仍在 Vercel 上跑
    if (delaySec > 0) {
      await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));
    }

    if (!isTest) {
      const secret = url.searchParams.get('secret');
      if (!secret || secret !== process.env.CRON_SECRET) {
        return Response.json({ error: 'forbidden' }, { status: 403 });
      }
    }

    const subject = process.env.VAPID_SUBJECT?.trim();
    const pub = process.env.VAPID_PUBLIC_KEY?.trim();
    const priv = process.env.VAPID_PRIVATE_KEY?.trim();
    if (!subject || !pub || !priv) {
      return Response.json({ error: '服务端未配置 VAPID keys' }, { status: 500 });
    }
    if (!subject.startsWith('mailto:') && !subject.startsWith('https:')) {
      return Response.json({ error: 'VAPID_SUBJECT 必须 mailto: 或 https:' }, { status: 500 });
    }

    let privKey: CryptoKey;
    try {
      privKey = await importVapidPrivateKey(priv, pub);
    } catch (e) {
      return Response.json({ error: `VAPID key 导入失败: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
    }

    const cfg = getRedisCfg();
    if (!cfg.url || !cfg.token) {
      return Response.json({ error: 'Redis 未配置' }, { status: 500 });
    }

    let allIds: string[];
    if (isTest && targetClient) {
      allIds = [targetClient];
    } else {
      try {
        const r = await kvFetch(cfg, '/smembers/subs:all');
        allIds = Array.isArray(r?.result) ? r.result : [];
      } catch (e) {
        return Response.json({ error: `KV 读取失败: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
      }
    }

    if (!allIds.length) {
      return Response.json({ ok: true, sent: 0, total: 0, note: '无订阅' });
    }

    let sent = 0;
    let skipped = 0;
    const failed: any[] = [];

    for (const id of allIds) {
      let raw: any;
      try {
        raw = await kvFetch(cfg, `/hgetall/sub:${id}`);
      } catch (e) {
        skipped++;
        continue;
      }
      const arr = raw?.result;
      const obj: Record<string, any> = {};
      if (Array.isArray(arr)) {
        for (let i = 0; i < arr.length; i += 2) obj[arr[i]] = arr[i + 1];
      } else if (arr && typeof arr === 'object') {
        Object.assign(obj, arr);
      }

      let subObj: { endpoint: string; keys: { p256dh: string; auth: string } };
      try {
        subObj = typeof obj.sub === 'string' ? JSON.parse(obj.sub) : obj.sub;
        if (!subObj?.endpoint || !subObj.keys?.p256dh || !subObj.keys?.auth) {
          throw new Error('订阅缺字段');
        }
      } catch (e) {
        skipped++;
        failed.push(`${id.slice(0, 8)}:parse-${e instanceof Error ? e.message : 'err'}`);
        continue;
      }

      if (!isTest) {
        const tz = obj.tz || 'Asia/Shanghai';
        const h = localHour(tz);
        const wake = Number(obj.wake);
        const sleep = Number(obj.sleep);
        if (h < wake || h >= sleep) { skipped++; continue; }

        // 按 mode 计算间隔
        const mode = (obj.mode as Mode) || 'standard';
        let intervalMin: number;
        if (mode === 'smart') {
          // 读 progress
          let prog: { drunkMl?: number; goalMl?: number; date?: string } | null = null;
          try {
            const pr = await kvFetch(cfg, `/hgetall/progress:${encodeURIComponent(id)}`);
            const arr2 = pr?.result;
            const o: Record<string, any> = {};
            if (Array.isArray(arr2)) {
              for (let i = 0; i < arr2.length; i += 2) o[arr2[i]] = arr2[i + 1];
            } else if (arr2 && typeof arr2 === 'object') {
              Object.assign(o, arr2);
            }
            if (o.date === todayKey()) {
              prog = { drunkMl: Number(o.drunkMl), goalMl: Number(o.goalMl), date: o.date };
            }
          } catch { /* ignore */ }

          if (prog && typeof prog.drunkMl === 'number' && typeof prog.goalMl === 'number') {
            const sm = computeSmartInterval(prog.drunkMl, prog.goalMl, wake, sleep, tz);
            if (sm.skip) { skipped++; continue; }
            intervalMin = sm.interval;
          } else {
            intervalMin = 60;  // 首次没数据 → 兜底 60 min
          }
        } else {
          intervalMin = STATIC_INTERVAL[mode];
        }

        if (obj.lastSentAt && Date.now() - Number(obj.lastSentAt) < intervalMin * 60 * 1000) {
          skipped++; continue;
        }
      }

      if (dry) { sent++; continue; }

      const msg = isTest
        ? { title: '🧪 测试推送', body: '看到这条说明 push 通了！' }
        : MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
      const payload = JSON.stringify({ ...msg, url: '/' });

      try {
        const audience = new URL(subObj.endpoint).origin;
        const jwt = await signVapidJwt(audience, subject, privKey);
        const result = await sendPushWithPayload(subObj, payload, jwt, pub);
        if (result.status >= 200 && result.status < 300) {
          sent++;
          // update lastSentAt
          await kvFetch(cfg, `/hset/sub:${id}/lastSentAt/${Date.now()}`).catch(() => {});
        } else {
          failed.push(`${id.slice(0, 8)}:${result.status}:${result.body || ''}`);
          if (result.status === 404 || result.status === 410) {
            await kvFetch(cfg, `/del/sub:${id}`).catch(() => {});
            await kvFetch(cfg, `/srem/subs:all/${id}`).catch(() => {});
          }
        }
      } catch (e) {
        failed.push(`${id.slice(0, 8)}:exception:${e instanceof Error ? e.message : 'err'}`);
      }
    }

    return Response.json({ ok: true, total: allIds.length, sent, skipped, failed: failed.slice(0, 5) });
  } catch (e) {
    return Response.json(
      {
        crash: true,
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack?.split('\n').slice(0, 8) : undefined,
      },
      { status: 500 },
    );
  }
}
