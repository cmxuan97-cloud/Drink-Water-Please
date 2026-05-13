/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// 注入 vite-plugin-pwa 生成的 precache manifest
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// 让新 SW 立即生效
self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

type PushPayload = {
  title?: string;
  body?: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  clientId?: string;  // 用来打 /api/push/ack 反馈接收成功
};

const FALLBACK: PushPayload = {
  title: '🐦 小伙伴在等你',
  body: '嘴巴干干的，陪我喝一口呗～',
  icon: '/icon.svg',
  badge: '/icon.svg',
  tag: 'drink-water',
  url: '/',
};

// 上报：「SW 真的收到了这条 push」+「当时 app 在前台没」
// 跟服务端 lastSentAt 对比就能定位问题：sent 成功但 ack 没来 = Apple/FCM 没送达
const reportAck = async (clientId: string | undefined): Promise<void> => {
  if (!clientId) return;
  try {
    // 看看是否有打开的客户端窗口（用来判断是不是「前台收到，所以不显示通知」）
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const anyVisible = allClients.some((c) => (c as { visibilityState?: string }).visibilityState === 'visible');
    await fetch('/api/push/ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, visible: anyVisible }),
    });
  } catch {
    // 静默失败 — ack 不可达不影响通知本体
  }
};

self.addEventListener('push', (event) => {
  let payload: PushPayload = FALLBACK;
  if (event.data) {
    try {
      payload = { ...FALLBACK, ...(event.data.json() as PushPayload) };
    } catch {
      payload = { ...FALLBACK, body: event.data.text() };
    }
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title || FALLBACK.title!, {
        body: payload.body,
        icon: payload.icon,
        badge: payload.badge,
        tag: payload.tag,
        data: { url: payload.url || '/' },
      } as any),
      reportAck(payload.clientId),
    ]),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url || '/';
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // 已有窗口就 focus
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) await (client as any).navigate(url);
          return;
        }
      }
      // 否则新开
      await self.clients.openWindow(url);
    })(),
  );
});
