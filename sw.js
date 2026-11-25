/**
 * sw.js — Epic Toyz Service Worker for Admin Web Push Notifications
 */

'use strict';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: 'New Order — Epic Toyz', body: event.data.text() };
  }

  const title = payload.title || 'New Paid Order — Epic Toyz';
  const options = {
    body: payload.body || 'A new order has been confirmed.',
    icon: '/assets/images/logo-transparent.png',
    badge: '/favicon.png',
    tag: payload.tag || (payload.orderId ? `order-${payload.orderId}` : 'epictoyz-order'),
    renotify: false,
    data: {
      url: payload.url || '/admin/dashboard.html?section=orders',
      orderId: payload.orderId || null
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/admin/dashboard.html?section=orders';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/admin/dashboard.html') && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
