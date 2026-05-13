/* eslint-disable @typescript-eslint/no-explicit-any */
// Edge runtime + 手写 Web Push（绕过 web-push CJS 包，避免 Node 冷启动超时）
export const config = { runtime: 'edge' };

import { buildMessageFor } from './_messages';

// （Legacy 文案池 — 已不用，buildMessageFor 用每个用户的 companion 生成）
// 留着是因为测试推送（test=1）和兜底分支偶尔还要用。
const _LEGACY_MESSAGES: Array<{ title: string; body: string }> = [
  // —— 动物小伙伴们渴了 ——
  { title: '🐦 奇异鸟咕咕', body: '嘴巴干干的，可以陪我喝一口吗～' },
  { title: '🐟 太阳鱼曼波', body: '我泡在水里都觉得渴，你也来一口' },
  { title: '🐉 小龙找你', body: '喷火前要先冷却引擎，来一杯水' },
  { title: '🐿️ 跳跳跑过来', body: '抱橡果跑累了，先一起喝水歇歇' },
  { title: '🐨 抱抱嘟囔', body: '困到睁不开眼…帮我递一杯水嘛' },
  { title: '🧟 丧丧出现了', body: '喝...水...不要...脑子...' },
  { title: '🦋 飞飞落在杯沿', body: '翅膀有点重了，我们一起补水' },
  { title: '🐙 小八招手', body: '八只爪子举着八杯水等你呢' },
  { title: '🦀 横横赶来', body: '横着跑去拿水，你直走更快啦' },
  { title: '🦄 彩虹眨眼', body: '喝水会变彩虹哦，要不要试试' },
  { title: '🐝 嗡嗡停下来', body: '采蜜累死了，先来口水歇一下' },
  { title: '🦊 小红偷偷说', body: '我藏了一杯水给你，快来取' },
  { title: '👻 噗噗飘过', body: '我喝水都漏掉了，你帮我喝吧' },
  { title: '🐼 圆圆抱杯', body: '竹叶咬干了，需要补水' },
  { title: '🪦 裹裹来电', body: '包成粽子也照样口渴，喝吧' },
  { title: '🐬 跳跳跃出水面', body: '看到你了，记得喝水哟' },
  { title: '🦁 凯撒发话', body: '草原之王令你：现在，喝水' },
  { title: '🦖 阿雷探头', body: '远古恐龙都喝水，你也不能少' },
  { title: '🦩 粉粉单腿站', body: '我等你呢，先去喝口水吧' },
  { title: '🦧 橙橙挠头', body: '丛林里走累了，喝水不？' },
  { title: '🦔 球球翻过来', body: '圆滚滚地等你来喝水' },
  { title: '🦈 利齿张嘴', body: '我牙利只咬水杯，你快举杯' },
  { title: '🦚 蓝蓝开屏', body: '炫给你看，看完该喝水了' },
  { title: '🐻 大帅来访', body: '蜂蜜罐换成水照样喝，你也是' },
  { title: '🐇 白白蹦过来', body: '啃萝卜噎到了，要喝水' },
  { title: '🐤 黄黄叫你', body: '啾啾啾…我口渴啦' },
  { title: '🦝 小偷得逞', body: '我把你的水偷走了，再倒一杯吧' },
  { title: '🐍 丝丝盘起来', body: '醒了一下提醒你：喝水' },
  { title: '🦉 智者夜话', body: '夜里也别忘了喝水' },
  { title: '🐢 大爷招手', body: '慢慢喝，我陪你' },
  { title: '🦙 毛毛发呆', body: '...？...哦对，要喝水' },
  { title: '🦜 七彩学舌', body: '喝水！喝水！喝水！' },
  { title: '🪼 飘飘漂过', body: '我浮在水里想到你了，喝水吧' },
  { title: '👣 毛球路过', body: '山林深处都不忘补水，你也别忘' },
  { title: '🐞 点点降落', body: '幸运小红点提醒你：来杯水' },
  { title: '🦇 德古飞来', body: '我改喝果汁了，你呢？' },
  { title: '🦍 老大敲胸', body: '帝国大厦顶上都喝水，你快喝' },
  { title: '🦥 慢慢慢慢', body: '慢慢…来…一口…水…' },
  { title: '🐹 胖胖鼓腮', body: '葵花子吃完了，该喝水了' },
  { title: '🤖 R-2 报告', body: '我的水箱需要补充，你也是' },
  { title: '👽 ZZ 外传', body: '地球的水好喝，你试试' },
  { title: '🦦 奇奇浮上来', body: '抱着石头想你了，记得喝水' },
  { title: '🐧 波波蹒跚', body: '冰天雪地的小绅士也要补水' },

  // —— 鼓励语录 ——
  { title: '💧 喝水小提醒', body: '一杯水，一份温柔。' },
  { title: '💪 现在喝一口', body: '是送给晚上自己的礼物' },
  { title: '🌱 身体悄悄说', body: '你照顾它，它就照顾你' },
  { title: '✨ 喝水的小秘密', body: '不渴的时候喝，才是真的会喝水' },
  { title: '🌊 离目标更近了', body: '喝完这杯，今天就更稳一点' },
  { title: '🧘 深呼吸一下', body: '举起杯子，咕嘟咕嘟' },
  { title: '💖 对自己好一点', body: '从一杯水开始' },
  { title: '⏰ 30 秒就够了', body: '开始喝，立刻就完事' },
  { title: '🎯 小步快跑', body: '今天一定达标' },
  { title: '🌈 喝水的人', body: '气色都比别人好一点' },
  { title: '☀️ 给细胞充电', body: '它们等水等很久了' },
  { title: '🧠 大脑 70% 是水', body: '给它加点燃料嘛' },
  { title: '😌 累的时候', body: '可能不是累，是渴' },
  { title: '🍃 一杯水的距离', body: '就能让你重新精神起来' },
  { title: '🌟 简单的好习惯', body: '一天就这几口，做得到' },
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

      // 用这个用户当前主页伙伴说话 — companion 没存就回退到 a-kiwi（每个用户的起始角色）
      const companionId = typeof obj.companion === 'string' ? obj.companion : undefined;
      const msg = isTest
        ? { title: '🧪 测试推送', body: '看到这条说明 push 通了！' }
        : buildMessageFor(companionId);
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
