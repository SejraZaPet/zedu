// ZEdu Service Worker — push notifications only (no offline cache)
// Intentionally NO fetch handler / no caching of HTML or JS to prevent stale builds.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    try {
      data = { title: "ZEdu", body: event.data ? event.data.text() : "" };
    } catch (_) {
      data = { title: "ZEdu", body: "" };
    }
  }

  const title = data.title || "ZEdu";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-512.png",
    badge: "/icons/icon-512.png",
    tag: data.tag || data.notification_id || undefined,
    data: {
      link: data.link || "/",
      notification_id: data.notification_id || null,
    },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin && "focus" in client) {
            client.navigate(link);
            return client.focus();
          }
        } catch (_) {}
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(link);
      }
    })
  );
});
