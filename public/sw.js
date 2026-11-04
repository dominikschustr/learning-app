// Service Worker von Lernwerk: zeigt die Erinnerung ans Tagesziel (Web Push) und öffnet beim Tippen die App.
// Er cacht nichts – die App lädt wie bisher direkt aus dem Netz.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const scope = self.registration.scope;
  event.waitUntil(
    self.registration.showNotification(data.title || "Lernwerk", {
      body: data.body || "Dein Tagesziel wartet noch.",
      icon: scope + "apple-icon.png",
      badge: scope + "apple-icon.png",
      tag: data.tag || "daily-goal",
      data: { url: data.url || "" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const scope = self.registration.scope;
  const url = new URL((event.notification.data && event.notification.data.url) || "", scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(scope) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
