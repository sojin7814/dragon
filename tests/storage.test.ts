import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY } from '../src/config';
import { newData, saveExchange } from '../src/domain';
import { loadData, makeBackup, parseBackup, persistData, readSafetyCopy, restoreData, SAFETY_COPY_KEY } from '../src/storage';
import type { DayChange } from '../src/types';

class MemoryStorage implements Storage {
  items = new Map<string, string>();
  get length() { return this.items.size; }
  clear() { throw new Error('Clearing shared storage is forbidden'); }
  getItem(key: string) { return this.items.get(key) ?? null; }
  key(index: number) { return [...this.items.keys()][index] ?? null; }
  removeItem(key: string) { this.items.delete(key); }
  setItem(key: string, value: string) { this.items.set(key, String(value)); }
}
let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
  storage.setItem('caddy_income_records', 'protected income');
  storage.setItem('aion2_tracker_v8', 'protected game');
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('navigator', {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('local persistence safety', () => {
  it('saves only the app key, preserves protected applications and reloads theme', async () => {
    const data = newData('D'); data.theme = 'dark';
    const raw = await persistData(data, null);
    expect(loadData()).toEqual({ data: JSON.parse(raw), raw, error: null });
    expect(loadData().data).toMatchObject({ initialGroup: 'D', theme: 'dark', revision: 1 });
    expect(storage.getItem('caddy_income_records')).toBe('protected income');
    expect(storage.getItem('aion2_tracker_v8')).toBe('protected game');
    expect(storage.length).toBe(3);
  });
  it('rejects stale tab saves, including after data was removed elsewhere', async () => {
    const data = newData('A');
    const first = await persistData(data, null);
    const second = await persistData({ ...JSON.parse(first), theme: 'dark' }, first);
    await expect(persistData({ ...data, theme: 'light' }, first)).rejects.toThrow('다른 창');
    expect(storage.getItem(STORAGE_KEY)).toBe(second);
    storage.removeItem(STORAGE_KEY);
    await expect(persistData(data, second)).rejects.toThrow('다른 창');
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });
  it('serializes concurrent writers and does not silently lose either update', async () => {
    const data = newData('A');
    const results = await Promise.allSettled([persistData({ ...data, theme: 'light' }, null), persistData({ ...data, theme: 'dark' }, null)]);
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
    expect(loadData().data?.theme).toBe('light');
  });
  it('uses an app-specific Web Lock where available', async () => {
    const request = vi.fn(async (_name: string, _options: object, callback: () => string) => callback());
    vi.stubGlobal('navigator', { locks: { request } });
    await persistData(newData('A'), null);
    expect(request).toHaveBeenCalledWith(`${STORAGE_KEY}_write`, { mode: 'exclusive' }, expect.any(Function));
  });
  it('retains unreadable JSON and unsupported schemas instead of initializing empty data', async () => {
    for (const broken of ['{bad JSON', JSON.stringify({ ...newData('A'), schemaVersion: 99 })]) {
      storage.setItem(STORAGE_KEY, broken);
      expect(loadData()).toMatchObject({ data: null, raw: broken, error: expect.any(String) });
      await expect(persistData(newData('A'), broken)).rejects.toThrow('덮어쓰지');
      expect(storage.getItem(STORAGE_KEY)).toBe(broken);
    }
  });
  it('does not overwrite on quota failure and leaves the caller input untouched', async () => {
    const data = newData('C');
    const raw = await persistData(data, null);
    const changed = { ...JSON.parse(raw), theme: 'dark' };
    const before = JSON.stringify(changed);
    vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    await expect(persistData(changed, raw)).rejects.toThrow('저장하지 못했습니다');
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(JSON.stringify(changed)).toBe(before);
  });
  it('returns a clear unavailable-storage state instead of new user state', () => {
    vi.spyOn(storage, 'getItem').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    expect(loadData()).toEqual({ data: null, raw: null, error: expect.stringContaining('읽지 못했습니다') });
  });
});

describe('backup and replacement restore', () => {
  it('roundtrips every identity, relation, name, note, history, and theme', () => {
    const base = newData('A');
    base.theme = 'dark'; base.notes['2026-03-02'] = '여러 줄\n메모';
    base.groupChanges = [{ id: 'group-a', date: '2026-10-01', group: 'D' }];
    const common = { reason: 'exchange', exchangeId: 'pair-a', person: '김민수', memo: '변경 이유' } as const;
    const first: DayChange = { ...common, id: 'first', date: '2026-02-28', state: 'work', partnerDate: '2026-03-02' };
    const second: DayChange = { ...common, id: 'second', date: '2026-03-02', state: 'off', partnerDate: '2026-02-28' };
    const data = saveExchange(base, first, second);
    const file = makeBackup(data);
    expect(JSON.parse(file)).toMatchObject({ app: 'dragon-calendar', formatVersion: 1, createdAt: expect.any(String) });
    expect(parseBackup(file)).toEqual(data);
  });
  it.each(['not JSON', '{}', '[]', '{"app":"another-app","formatVersion":1}', '{"app":"dragon-calendar","formatVersion":2}'])('rejects the wrong backup %s without touching storage', file => {
    storage.setItem(STORAGE_KEY, 'original raw');
    expect(() => parseBackup(file)).toThrow();
    expect(storage.getItem(STORAGE_KEY)).toBe('original raw');
  });
  it('keeps a safety copy before replacing the whole current dataset', async () => {
    const raw = await persistData(newData('A'), null);
    const replacement = newData('B'); replacement.notes['2026-02-28'] = '복원된 메모';
    const restored = await restoreData(parseBackup(makeBackup(replacement)), raw);
    expect(readSafetyCopy()).toBe(raw);
    expect(storage.getItem(SAFETY_COPY_KEY)).toBe(raw);
    expect(loadData().data?.calendarId).toBe(replacement.calendarId);
    expect(loadData().data?.notes).toEqual(replacement.notes);
    expect(loadData().raw).toBe(restored);
  });
  it('permits explicit recovery from corrupted current data and preserves that raw data', async () => {
    storage.setItem(STORAGE_KEY, 'damaged original');
    const data = newData('C');
    await restoreData(data, 'damaged original');
    expect(readSafetyCopy()).toBe('damaged original');
    expect(loadData().data?.initialGroup).toBe('C');
  });
  it('aborts restore if safety copy fails, or another tab changed data', async () => {
    const raw = await persistData(newData('A'), null);
    const realSet = storage.setItem.bind(storage);
    vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
      if (key === SAFETY_COPY_KEY) throw new DOMException('Full', 'QuotaExceededError');
      realSet(key, value);
    });
    await expect(restoreData(newData('B'), raw)).rejects.toThrow('저장하지 못했습니다');
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    await expect(restoreData(newData('B'), null)).rejects.toThrow('다른 창');
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });
  it('invalid replacement cannot change the existing safety copy or data', async () => {
    const raw = await persistData(newData('A'), null);
    storage.setItem(SAFETY_COPY_KEY, 'older copy');
    await expect(restoreData({ ...newData('B'), initialGroup: 'X' as 'B' }, raw)).rejects.toThrow();
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(readSafetyCopy()).toBe('older copy');
  });
});
