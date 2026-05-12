import { getOrCreateClientId, getSettings } from './storage';

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

/**
 * 完整订阅流程：请求权限 → 注册 push → POST 给服务端
 * 失败时抛错（Settings 页捕获显示给用户）
 */
export const enablePush = async (): Promise<void> => {
  if (!isPushSupported()) {
    throw new Error('当前浏览器不支持推送通知');
  }
  if (!VAPID_PUBLIC) {
    throw new Error('未配置 VITE_VAPID_PUBLIC_KEY');
  }

  // 1. 通知权限
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    throw new Error(perm === 'denied' ? '已被拒绝，请到系统设置开启' : '未授予通知权限');
  }

  // 2. 等 Service Worker ready
  const reg = await navigator.serviceWorker.ready;

  // 3. 订阅 push（如果已订阅则复用）
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
    });
  }

  // 4. 提交给服务端
  const settings = getSettings();
  const clientId = getOrCreateClientId();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';

  const resp = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId,
      subscription: sub.toJSON(),
      wakeHour: settings.wakeHour,
      sleepHour: settings.sleepHour,
      tz,
    }),
  });
  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    throw new Error(`订阅服务端失败 (${resp.status}): ${err.slice(0, 100)}`);
  }
};

export const disablePush = async (): Promise<void> => {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await sub.unsubscribe();
  }
  const clientId = getOrCreateClientId();
  await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId }),
  }).catch(() => {});
};

/** 调一次 send 端点，给当前 client 发一条测试推送 */
export const sendTestPush = async (): Promise<{ ok: boolean; sent?: number; error?: string }> => {
  const clientId = getOrCreateClientId();
  const resp = await fetch(`/api/push/send?clientId=${encodeURIComponent(clientId)}&test=1`, {
    method: 'POST',
  });
  return await resp.json();
};

/** 设置改了之后同步给服务端（不重新订阅） */
export const syncSettingsToServer = async (): Promise<void> => {
  const sub = await getCurrentSubscription();
  if (!sub) return;
  const settings = getSettings();
  const clientId = getOrCreateClientId();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId,
      subscription: sub.toJSON(),
      wakeHour: settings.wakeHour,
      sleepHour: settings.sleepHour,
      tz,
    }),
  }).catch(() => {});
};
