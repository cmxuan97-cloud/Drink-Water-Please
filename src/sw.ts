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
};

const FALLBACK: PushPayload = {
  title: '💧 喝水时间',
  body: '该喝水啦',
  icon: '/icon.svg',
  badge: '/icon.svg',
  tag: 'drink-water',
  url: '/',
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
    self.registration.showNotification(payload.title || FALLBACK.title!, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      tag: payload.tag,
      data: { url: payload.url || '/' },
    } as any),
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
