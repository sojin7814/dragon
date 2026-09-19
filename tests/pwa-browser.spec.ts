import { test, expect, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import type { AddressInfo } from 'node:net';

// A local fixture serves real production files. It can publish a changed worker without
// modifying dist or any running development server, and never writes personal data.
let server: Server;
let origin: string;
let nextWorker = false;
let failAsset = false;
const fixtureBase = process.env.PWA_BASE_PATH || '/dragon/';
const contentTypes: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };

test.beforeAll(async () => {
  const root = resolve(process.env.PWA_DIST || 'dist');
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
      if (!pathname.startsWith(fixtureBase)) { response.writeHead(404).end(); return; }
      if (failAsset && pathname.startsWith(`${fixtureBase}assets/`) && pathname.endsWith('.js')) { response.writeHead(503).end('controlled download failure'); return; }
      const localPath = pathname.slice(fixtureBase.length) || 'index.html';
      const file = resolve(root, localPath);
      if (!file.startsWith(`${root}${sep}`)) { response.writeHead(404).end(); return; }
      let data: Buffer | string = await readFile(file);
      if (pathname === `${fixtureBase}sw.js` && nextWorker) {
        data = data.toString().replace(/const SETTINGS = (.+);/, (_, json: string) => {
          const settings = JSON.parse(json);
          settings.cacheName += '-test-next';
          return `const SETTINGS = ${JSON.stringify(settings)};`;
        });
      }
      response.writeHead(200, { 'Content-Type': contentTypes[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(data);
    } catch { response.writeHead(404).end(); }
  });
  // Windows can assign blocked browser ports (for example 5060) for listen(0).
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(20000 + Math.floor(Math.random() * 20000), '127.0.0.1', () => { server.off('error', reject); resolve(); });
      });
      break;
    } catch (error) { if (attempt === 4) throw error; }
  }
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}${fixtureBase}`;
});
test.afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
test.beforeEach(() => { nextWorker = false; failAsset = false; });

async function initialize(page: Page) {
  await page.goto(origin);
  await page.getByRole('button', { name: /하우스 A/ }).click();
  await page.getByRole('button', { name: '선택한 근무 유형 확인' }).click();
  await page.getByRole('button', { name: '확인했어요 · 내 달력 시작' }).click();
  await expect(page.getByRole('heading', { name: '나의 휴무 달력' })).toBeVisible();
  await expect(page.getByText('오프라인 사용 준비됨', { exact: false })).toBeVisible();
}

async function waitForNextWorker(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) throw new Error('missing service worker');
    const state = new Promise<string>(resolve => {
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing!;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' || installing.state === 'redundant') resolve(installing.state);
        });
      }, { once: true });
    });
    await registration.update();
    return state;
  });
}

test('production PWA reopens offline and saves a memo without network', async ({ page, context }) => {
  await initialize(page);
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem('dragon_calendar_data')!).calendarId);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '나의 휴무 달력' })).toBeVisible();
  await page.getByRole('button', { name: '일정이나 메모 남기기' }).click();
  await page.getByPlaceholder('기억할 내용을 남겨주세요').fill('오프라인 기록 테스트');
  await page.getByRole('button', { name: '내용 확인' }).click();
  await page.getByRole('button', { name: '확인하고 저장' }).click();
  await page.reload();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dragon_calendar_data')!));
  expect(saved.calendarId).toBe(id);
  expect(Object.values(saved.notes)).toContain('오프라인 기록 테스트');
  await expect(page.getByText('오프라인 · 이 기기에 기록할 수 있어요.', { exact: false })).toBeVisible();
});

test('a downloaded update preserves dirty input, then applies once after closing', async ({ page }) => {
  await initialize(page);
  await page.getByRole('button', { name: '일정이나 메모 남기기' }).click();
  await page.getByPlaceholder('기억할 내용을 남겨주세요').fill('업데이트 중인 내 메모');
  const previousData = await page.evaluate(() => localStorage.getItem('dragon_calendar_data'));
  nextWorker = true;
  expect(await waitForNextWorker(page)).toBe('installed');
  await expect(page.getByPlaceholder('기억할 내용을 남겨주세요')).toHaveValue('업데이트 중인 내 메모');
  expect(await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting))).toBe(true);
  await page.getByRole('button', { name: '내용 확인' }).click();
  const navigation = page.waitForEvent('framenavigated', frame => frame === page.mainFrame());
  await page.getByRole('button', { name: '확인하고 저장' }).click();
  await navigation;
  await page.waitForLoadState('domcontentloaded');
  expect(await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting))).toBe(false);
  await expect(page.getByRole('heading', { name: '나의 휴무 달력' })).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem('dragon_calendar_data'));
  expect(saved).not.toBe(previousData);
  expect(Object.values(JSON.parse(saved!).notes)).toContain('업데이트 중인 내 메모');
});

test('a second window with a dialog blocks activation until that window closes', async ({ page, context }) => {
  await initialize(page);
  const other = await context.newPage();
  await other.goto(origin);
  await other.getByRole('button', { name: '일정이나 메모 남기기' }).click();
  await other.getByPlaceholder('기억할 내용을 남겨주세요').fill('다른 창의 미저장 메모');
  await page.bringToFront();
  nextWorker = true;
  expect(await waitForNextWorker(page)).toBe('installed');
  await expect(page.getByText('다른 창에 작성 중인 내용이 있거나 안전 여부를 확인하지 못했어요.', { exact: false })).toBeVisible();
  expect(await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting))).toBe(true);
  await expect(other.getByPlaceholder('기억할 내용을 남겨주세요')).toHaveValue('다른 창의 미저장 메모');
  await other.close();
  const navigation = page.waitForEvent('framenavigated', frame => frame === page.mainFrame());
  await page.getByRole('button', { name: '업데이트 적용' }).click();
  await navigation;
  await page.waitForLoadState('domcontentloaded');
  expect(await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting))).toBe(false);
  await expect(page.getByRole('heading', { name: '나의 휴무 달력' })).toBeVisible();
});

test('failed update download leaves the prior version usable offline', async ({ page, context }) => {
  await initialize(page);
  const prior = await page.evaluate(() => localStorage.getItem('dragon_calendar_data'));
  nextWorker = true; failAsset = true;
  expect(await waitForNextWorker(page)).toBe('redundant');
  expect(await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting))).toBe(false);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '나의 휴무 달력' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('dragon_calendar_data'))).toBe(prior);
});
