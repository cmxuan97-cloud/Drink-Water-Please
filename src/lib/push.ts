import { NotifyMode } from '../types';
import { getOrCreateClientId, getSettings, saveSettings } from './storage';

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
};

export const isPushSupported = (): boolean =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const getCurrentSubscription = async (): Promise<PushSubscription | null> => {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return await reg.pushManager.getSubscription();
};

const buildSubscribePayload = (sub: PushSubscription, mode?: NotifyMode) => {
  const settings = getSettings();
  return {
    clientId: getOrCreateClientId(),
    subscription: sub.toJSON(),
    wakeHour: settings.wakeHour,
    sleepHour: settings.sleepHour,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
    mode: mode ?? settings.notifyMode ?? 'standard',
  };
};

/**
 * 完整订阅流程：请求权限 → 注册 push → POST 给服务端
 */
export const enablePush = async (): Promise<void> => {
  if (!isPushSupported()) throw new Error('当前浏览器不支持推送通知');
  if (!VAPID_PUBLIC) throw new Error('未配置 VITE_VAPID_PUBLIC_KEY');

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    throw new Error(perm === 'denied' ? '已被拒绝，请到系统设置开启' : '未授予通知权限');
  }

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
    });
  }

  const resp = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildSubscribePayload(sub)),
  });
  if (!resp.ok) {
    const parsed = await safeJson(resp);
    throw new Error(parsed.error || `订阅服务端失败 (${resp.status})`);
  }
};

export const disablePush = async (): Promise<void> => {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
  await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: getOrCreateClientId() }),
  }).catch(() => {});
};

/** 安全 parse */
const safeJson = async (resp: Response): Promise<any> => {
  const ct = resp.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try {
      return await resp.json();
    } catch (e) {
      return { ok: false, error: `JSON 解析失败: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  const text = await resp.text().catch(() => '');
  return { ok: false, error: `服务端返回 ${resp.status} 非 JSON: ${text.slice(0, 200)}` };
};

export const sendTestPush = async (): Promise<{ ok: boolean; sent?: number; error?: string }> => {
  const clientId = getOrCreateClientId();
  const resp = await fetch(`/api/push/send?clientId=${encodeURIComponent(clientId)}&test=1`, {
    method: 'POST',
  });
  return await safeJson(resp);
};

/** 延迟 seconds 秒后发推送 — 服务端 sleep 后再推。
 *  关闭 app 也能收：Vercel function 在云端继续 hold 那段时间。
 *  返回 promise，但客户端 fire-and-forget 即可。 */
export const schedulePushIn = async (
  seconds: number,
): Promise<{ ok: boolean; sent?: number; error?: string }> => {
  const clientId = getOrCreateClientId();
  const resp = await fetch(
    `/api/push/send?clientId=${encodeURIComponent(clientId)}&test=1&delay=${seconds}`,
    { method: 'POST' },
  );
  return await safeJson(resp);
};

/** 设置（作息时间）改了之后同步给服务端 */
export const syncSettingsToServer = async (): Promise<void> => {
  const sub = await getCurrentSubscription();
  if (!sub) return;
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildSubscribePayload(sub)),
  }).catch(() => {});
};

/** 选了新的通知模式 — 立刻同步到服务端 */
export const setNotifyMode = async (mode: NotifyMode): Promise<void> => {
  // 写本地，UI 立即响应
  const settings = getSettings();
  saveSettings({ ...settings, notifyMode: mode });

  // 推到服务端（只有已订阅才有意义）
  const sub = await getCurrentSubscription();
  if (!sub) return;
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildSubscribePayload(sub, mode)),
  }).catch(() => {});
};

/** 进度同步 — 节流 5 秒，避免短时间内多次加水触发多次 fetch */
let lastProgressSync = 0;
let pendingProgress: { drunkMl: number; goalMl: number } | null = null;
let progressTimer: number | null = null;

const flushProgress = async () => {
  if (!pendingProgress) return;
  const sub = await getCurrentSubscription();
  if (!sub) {
    pendingProgress = null;
    return;
  }
  const payload = pendingProgress;
  pendingProgress = null;
  lastProgressSync = Date.now();
  await fetch('/api/push/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: getOrCreateClientId(),
      drunkMl: payload.drunkMl,
      goalMl: payload.goalMl,
    }),
  }).catch(() => {});
};

export const syncProgress = (drunkMl: number, goalMl: number): void => {
  pendingProgress = { drunkMl, goalMl };
  const now = Date.now();
  const elapsed = now - lastProgressSync;
  if (elapsed >= 5000) {
    // 立即发
    void flushProgress();
  } else {
    // 等够 5 秒
    if (progressTimer) clearTimeout(progressTimer);
    progressTimer = window.setTimeout(() => {
      progressTimer = null;
      void flushProgress();
    }, 5000 - elapsed);
  }
};
