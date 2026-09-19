/* Generated with versioned URLs by scripts/build-pwa.mjs. Personal records never enter CacheStorage. */
const SETTINGS = __PWA_SETTINGS__;
const CHANNEL = 'dragon-calendar-pwa';
const pending = new Map();
const builds = new Map();
let transaction = null;
const appURL = new URL(SETTINGS.base, self.location.origin);
const sameApp = client => {
  const url = new URL(client.url);
  return url.origin === appURL.origin && url.pathname.startsWith(appURL.pathname);
};
const windows = async () => (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).filter(sameApp);
const send = (client, data) => client.postMessage({ channel: CHANNEL, ...data });
const precached = new Set(SETTINGS.files.map(file => new URL(file, self.location.origin).href));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SETTINGS.cacheName);
    try {
      await cache.addAll(SETTINGS.files.map(url => new Request(url, { cache: 'reload' })));
    } catch (error) {
      // A failed new version cannot replace or remove the last usable shell.
      await caches.delete(SETTINGS.cacheName);
      throw error;
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Preserve old shells until the new app has actually booted; keep one fallback afterward.
    await self.clients.claim();
    for (const client of await windows()) send(client, { type: 'ACTIVE', buildId: SETTINGS.buildId });
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== appURL.origin || !url.pathname.startsWith(appURL.pathname)) return;
  const navigation = request.mode === 'navigate' && (url.pathname === appURL.pathname || url.pathname === `${appURL.pathname}index.html`);
  if (!navigation && !precached.has(url.href) && !url.pathname.startsWith(`${appURL.pathname}assets/`)) return;
  event.respondWith((async () => {
    const cache = await caches.open(SETTINGS.cacheName);
    const target = navigation ? `${SETTINGS.base}index.html` : request;
    const response = await cache.match(target);
    if (response) return response;
    // An older open window can still request its own hashed bundle after an activation.
    if (!navigation) {
      for (const name of await caches.keys()) {
        if (name.startsWith(SETTINGS.cachePrefix) && name !== SETTINGS.cacheName) {
          const old = await (await caches.open(name)).match(request);
          if (old) return old;
        }
      }
    }
    try { return await fetch(request); }
    catch {
      return new Response(navigation
        ? '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>인터넷 연결 확인</title><body style="font:18px system-ui;line-height:1.8;padding:32px"><h1>인터넷에 연결해주세요</h1><p>아직 오프라인 준비가 끝나지 않았어요. 연결 후 앱을 다시 열어주세요. 저장된 기록은 지우지 마세요.</p><a href="">다시 열기</a></body></html>'
        : '오프라인 준비가 끝나지 않았어요.',
      { status: 503, headers: { 'Content-Type': navigation ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8' } });
    }
  })());
});

async function ask(client, type, id) {
  return new Promise(resolve => {
    const key = `${id}:${client.id}`;
    const timer = setTimeout(() => { pending.delete(key); resolve(false); }, 2500);
    pending.set(key, answer => { clearTimeout(timer); pending.delete(key); resolve(answer); });
    send(client, { type, id, buildId: SETTINGS.buildId });
  });
}

async function release(clients, id, reason) {
  for (const client of clients) send(client, { type: 'UPDATE_RELEASE', id, reason });
}

async function coordinateUpdate(requester) {
  if (transaction) return;
  const id = `${SETTINGS.buildId}-${Date.now()}-${Math.random()}`;
  const clients = await windows();
  transaction = { id, cancelled: false };
  try {
    if (!clients.length || !clients.some(client => client.id === requester.id)) return;
    const answers = await Promise.all(clients.map(client => ask(client, 'UPDATE_PREPARE', id)));
    const latest = await windows();
    const unchanged = latest.length === clients.length && latest.every(client => clients.some(previous => previous.id === client.id));
    if (answers.some(answer => !answer) || !unchanged || transaction.cancelled) {
      await release(clients, id, '다른 창에 작성 중인 내용이 있거나 안전 여부를 확인하지 못했어요. 저장하고 다른 창을 닫은 뒤 적용해주세요.');
      return;
    }
    // Every current app window has paused new input. A last ACK detects a changed/closed page.
    const commit = await Promise.all(clients.map(client => ask(client, 'UPDATE_COMMIT', id)));
    const finalClients = await windows();
    const stillSame = finalClients.length === clients.length && finalClients.every(client => clients.some(previous => previous.id === client.id));
    if (commit.some(answer => !answer) || !stillSame || transaction.cancelled) {
      await release(clients, id, '작성 중인 내용을 먼저 저장한 뒤 업데이트를 적용해주세요.');
      return;
    }
    await self.skipWaiting();
  } catch {
    await release(clients, id, '업데이트를 적용하지 못했어요. 현재 버전은 계속 사용할 수 있어요.');
  } finally { transaction = null; }
}

async function pruneHealthyCaches() {
  const clients = await windows();
  if (!clients.length || clients.some(client => builds.get(client.id) !== SETTINGS.buildId)) {
    return;
  }
  const names = (await caches.keys()).filter(name => name.startsWith(SETTINGS.cachePrefix) && name !== SETTINGS.cacheName);
  // Keep the previous working version even after healthy startup for initialization recovery.
  for (const name of names.slice(0, -1)) await caches.delete(name);
}

self.addEventListener('message', event => {
  const data = event.data;
  const source = event.source;
  if (!data || data.channel !== CHANNEL || !source || !source.url || !sameApp(source)) return;
  if (data.type === 'UPDATE_ANSWER') pending.get(`${data.id}:${source.id}`)?.(data.safe === true);
  if (data.type === 'UPDATE_CANCEL' && transaction?.id === data.id) transaction.cancelled = true;
  if (data.type === 'REQUEST_UPDATE') event.waitUntil(coordinateUpdate(source));
  if (data.type === 'CLIENT_READY') {
    builds.set(source.id, data.buildId);
    send(source, { type: 'OFFLINE_READY', buildId: SETTINGS.buildId });
    event.waitUntil(pruneHealthyCaches());
  }
  if (data.type === 'CHECK_READY') send(source, { type: 'OFFLINE_READY', buildId: SETTINGS.buildId });
});
