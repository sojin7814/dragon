import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const settings = {
  base: '/dragon/', buildId: 'new-version', cachePrefix: 'dragon-calendar-shell:%2Fdragon%2F:',
  cacheName: 'dragon-calendar-shell:%2Fdragon%2F:new', files: ['/dragon/index.html', '/dragon/assets/app-new.js'],
};
const template = readFileSync(new URL('../assets/service-worker.js', import.meta.url), 'utf8');
type Message = { type: string; id?: string; [key: string]: unknown };
type Client = { id: string; url: string; postMessage(message: Message): void };

function worker(options: { failDownload?: boolean; clients?: Array<{ id: string; url?: string; safe: boolean }> } = {}) {
  const handlers: Record<string, (event: any) => void> = {};
  const stores = new Map<string, Map<string, Response>>();
  const messages: Array<{ client: string; data: Message }> = [];
  let skipCount = 0;
  let claimCount = 0;
  const key = (request: string | { url: string }) => new URL(typeof request === 'string' ? request : request.url, 'https://example.test').href;
  const cache = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return {
      addAll: async (requests: Array<{ url: string }>) => {
        if (options.failDownload) throw new Error('offline');
        for (const request of requests) stores.get(name)!.set(key(request), new Response('cached shell'));
      },
      match: async (request: string | { url: string }) => stores.get(name)!.get(key(request)),
    };
  };
  const clients: Client[] = (options.clients || []).map(item => ({
    id: item.id, url: item.url || `https://example.test/dragon/?window=${item.id}`,
    postMessage(data) {
      messages.push({ client: item.id, data });
      if (data.type === 'UPDATE_PREPARE' || data.type === 'UPDATE_COMMIT') {
        queueMicrotask(() => handlers.message({
          source: clients.find(client => client.id === item.id),
          data: { channel: 'dragon-calendar-pwa', type: 'UPDATE_ANSWER', id: data.id, safe: item.safe }, waitUntil() {},
        }));
      }
    },
  }));
  vm.runInNewContext(template.replace('__PWA_SETTINGS__', JSON.stringify(settings)), {
    self: {
      location: { origin: 'https://example.test' },
      addEventListener: (type: string, handler: (event: any) => void) => { handlers[type] = handler; },
      clients: { matchAll: async () => clients, claim: async () => { claimCount++; } },
      skipWaiting: async () => { skipCount++; },
    },
    caches: { open: async (name: string) => cache(name), keys: async () => [...stores.keys()], delete: async (name: string) => stores.delete(name) },
    Request: class { url: string; constructor(url: string) { this.url = key(url); } },
    Response, URL, Map, Set, Promise, Date, Math, setTimeout, clearTimeout,
    fetch: async () => { throw new Error('offline'); },
  });
  const dispatch = async (type: string, event: Record<string, unknown> = {}) => {
    let pending: Promise<unknown> | undefined;
    handlers[type]({ ...event, waitUntil(promise: Promise<unknown>) { pending = promise; } });
    await pending;
  };
  return { stores, cache, messages, clients, dispatch, handlers, skips: () => skipCount, claims: () => claimCount };
}

describe('scoped offline shell and safe updates', () => {
  it('downloads a complete new shell before activation; never skips waiting during install', async () => {
    const app = worker();
    await app.dispatch('install');
    expect(app.stores.get(settings.cacheName)?.size).toBe(2);
    expect(app.skips()).toBe(0);
    await app.dispatch('activate');
    expect(app.claims()).toBe(1);
  });

  it('keeps the old working cache if any new file fails to download', async () => {
    const app = worker({ failDownload: true });
    await app.cache(`${settings.cachePrefix}old`).addAll([]).catch(() => {});
    await expect(app.dispatch('install')).rejects.toThrow('offline');
    expect(app.stores.has(`${settings.cachePrefix}old`)).toBe(true);
    expect(app.stores.has(settings.cacheName)).toBe(false);
    expect(app.skips()).toBe(0);
  });

  it('does not activate when even one app window is busy or cannot approve', async () => {
    const app = worker({ clients: [{ id: 'one', safe: true }, { id: 'two', safe: false }] });
    await app.dispatch('message', { source: app.clients[0], data: { channel: 'dragon-calendar-pwa', type: 'REQUEST_UPDATE' } });
    expect(app.skips()).toBe(0);
    expect(app.messages.filter(message => message.data.type === 'UPDATE_RELEASE')).toHaveLength(2);
  });

  it('requires prepare and commit approval from every app window', async () => {
    const app = worker({ clients: [{ id: 'one', safe: true }, { id: 'two', safe: true }, { id: 'other', url: 'https://example.test/ledger/', safe: false }] });
    await app.dispatch('message', { source: app.clients[0], data: { channel: 'dragon-calendar-pwa', type: 'REQUEST_UPDATE' } });
    expect(app.skips()).toBe(1);
    expect(app.messages.filter(message => message.data.type === 'UPDATE_PREPARE')).toHaveLength(2);
    expect(app.messages.filter(message => message.data.type === 'UPDATE_COMMIT')).toHaveLength(2);
    expect(app.messages.some(message => message.client === 'other')).toBe(false);
  });

  it('rejects update messages from a different app path', async () => {
    const app = worker({ clients: [{ id: 'other', url: 'https://example.test/ledger/', safe: true }] });
    await app.dispatch('message', { source: app.clients[0], data: { channel: 'dragon-calendar-pwa', type: 'REQUEST_UPDATE' } });
    expect(app.skips()).toBe(0);
  });

  it('serves the offline shell and does not intercept another app or external navigation', async () => {
    const app = worker();
    await app.dispatch('install');
    let response: Promise<Response> | undefined;
    const respondWith = (value: Promise<Response>) => { response = value; };
    app.handlers.fetch({ request: { url: 'https://example.test/dragon/', method: 'GET', mode: 'navigate' }, respondWith });
    expect(await (await response)!.text()).toBe('cached shell');
    response = undefined;
    app.handlers.fetch({ request: { url: 'https://example.test/ledger/', method: 'GET', mode: 'navigate' }, respondWith });
    expect(response).toBeUndefined();
    app.handlers.fetch({ request: { url: 'https://other.test/dragon/', method: 'GET', mode: 'navigate' }, respondWith });
    expect(response).toBeUndefined();
  });

  it('keeps a fallback and deletes only this app’s older healthy caches', async () => {
    const app = worker({ clients: [{ id: 'one', safe: true }] });
    const names = ['unrelated-cache', 'dragon-calendar-shell:%2Fledger%2F:one', `${settings.cachePrefix}older`, `${settings.cachePrefix}previous`, settings.cacheName];
    names.forEach(name => app.cache(name));
    await app.dispatch('activate');
    expect([...app.stores.keys()]).toEqual(names);
    await app.dispatch('message', { source: app.clients[0], data: { channel: 'dragon-calendar-pwa', type: 'CLIENT_READY', buildId: settings.buildId } });
    expect(app.stores.has(`${settings.cachePrefix}older`)).toBe(false);
    expect(app.stores.has(`${settings.cachePrefix}previous`)).toBe(true);
    expect(app.stores.has('unrelated-cache')).toBe(true);
    expect(app.stores.has('dragon-calendar-shell:%2Fledger%2F:one')).toBe(true);
  });
});
