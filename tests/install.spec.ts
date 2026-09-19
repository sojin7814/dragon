import { test, expect, type Page } from '@playwright/test';
import type { AppData } from '../src/types';

const key = 'dragon_calendar_data';
const androidChrome = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
test.use({ userAgent: androidChrome, viewport: { width: 390, height: 844 } });

function records() {
  const data: AppData = { schemaVersion: 1, revision: 8, calendarId: 'install-test', initialGroup: 'WEEKDAY_MON_FRI', groupChanges: [], changes: {}, notes: {}, theme: 'dark', updatedAt: '2026-09-01T00:00:00.000Z' };
  data.theme = 'dark';
  data.groupChanges = [{ id: 'history', date: '2027-01-01', group: 'C' }];
  data.notes = { '2026-09-24': '휴무 계획과 메모', '2026-09-25': '다음 날 계획' };
  data.changes['2026-09-24'] = { id: 'transfer', date: '2026-09-24', state: 'off', reason: 'transfer', person: '테스트 캐디', memo: '기존 양도' };
  data.changes['2026-09-26'] = { id: 'one', date: '2026-09-26', state: 'work', reason: 'exchange', exchangeId: 'pair', partnerDate: '2026-09-28', person: '교환 테스트', memo: '기존 교환' };
  data.changes['2026-09-28'] = { id: 'two', date: '2026-09-28', state: 'off', reason: 'exchange', exchangeId: 'pair', partnerDate: '2026-09-26', person: '교환 테스트', memo: '기존 교환' };
  return data;
}
async function seed(page: Page) {
  const raw = JSON.stringify(records());
  await page.addInitScript(({ key, raw }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, raw); }, { key, raw });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '나의 휴무 달력' })).toBeVisible();
  return raw;
}
async function offer(page: Page, outcome: 'accepted' | 'dismissed' | 'error' | 'pending' = 'dismissed') {
  await page.evaluate(outcome => {
    const w = window as any;
    w.promptCount = 0; w.promptHadActivation = false;
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      prompt: () => { w.promptCount++; w.promptHadActivation = navigator.userActivation.isActive; return outcome === 'error' ? Promise.reject(new Error('test failure')) : Promise.resolve(); },
      userChoice: outcome === 'pending' ? new Promise(resolve => { w.resolveInstall = resolve; }) : Promise.resolve({ outcome }),
    });
    window.dispatchEvent(event);
  }, outcome);
}
test.beforeEach(async ({ page }) => {
  // These are controlled event-contract tests, not Android hardware installation tests.
  await page.addInitScript(() => window.addEventListener('beforeinstallprompt', e => { if (e.isTrusted) e.stopImmediatePropagation(); }));
});

test('no inactive install button before event; real prompt method runs once on user click', async ({ page }) => {
  const raw = await seed(page);
  await expect(page.getByRole('button', { name: '홈 화면에 설치', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '설정 열기' }).click();
  await expect(page.getByText('브라우저가 설치를 준비하면 여기에 설치 버튼이 나타나요.')).toBeVisible();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await offer(page);
  await page.getByRole('button', { name: '홈 화면에 설치', exact: true }).click();
  await expect(page.getByText('설치를 취소했어요. 그대로 사용할 수 있어요.')).toBeVisible();
  expect(await page.evaluate(() => [(window as any).promptCount, (window as any).promptHadActivation])).toEqual([1, true]);
  await expect(page.getByRole('button', { name: '홈 화면에 설치', exact: true })).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(raw);
  await offer(page); // A new browser event is required before retrying.
  await expect(page.getByRole('button', { name: '홈 화면에 설치', exact: true })).toBeVisible();
});

test('accepted is not falsely reported installed; appinstalled hides card and settings button', async ({ page }) => {
  const raw = await seed(page); await offer(page, 'accepted');
  await page.getByRole('button', { name: '홈 화면에 설치', exact: true }).click();
  await expect(page.getByText('설치 요청을 보냈어요. 브라우저의 설치 완료 안내를 확인해주세요.')).toBeVisible();
  await expect(page.locator('.install-promotion')).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await page.getByRole('button', { name: '설정 열기' }).click();
  await expect(page.getByText('홈 화면 앱이 설치되어 있어요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '홈 화면에 설치', exact: true })).toHaveCount(0);
  await offer(page); // Late events must not advertise an already installed app.
  await expect(page.getByRole('button', { name: '홈 화면에 설치', exact: true })).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(raw);
});

test('pending prompt blocks double submit; late choice cannot undo appinstalled', async ({ page }) => {
  await seed(page); await offer(page, 'pending');
  await page.getByRole('button', { name: '홈 화면에 설치', exact: true }).click();
  await expect(page.getByText('브라우저의 설치 확인창을 확인해주세요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '홈 화면에 설치', exact: true })).toHaveCount(0);
  await page.evaluate(() => { window.dispatchEvent(new Event('appinstalled')); (window as any).resolveInstall({ outcome: 'accepted' }); });
  await expect(page.locator('.install-promotion')).toHaveCount(0);
  await expect(page.getByText('설치 요청을 보냈어요.', { exact: false })).toHaveCount(0);
});

test('failed browser prompt gives feedback without reusing consumed event', async ({ page }) => {
  const raw = await seed(page); await offer(page, 'error');
  await page.getByRole('button', { name: '홈 화면에 설치', exact: true }).click();
  await expect(page.getByText('설치창을 열지 못했어요.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: '홈 화면에 설치', exact: true })).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(raw);
});

test('dismissal lasts the Korean day including reload; settings still offers prepared prompt', async ({ page }) => {
  const raw = await seed(page); await offer(page);
  await page.getByRole('button', { name: '설치 안내 오늘 닫기' }).click();
  await expect(page.locator('.install-promotion')).toHaveCount(0);
  await page.reload(); await offer(page);
  await expect(page.locator('.install-promotion')).toHaveCount(0);
  await page.getByRole('button', { name: '설정 열기' }).click();
  await page.getByRole('button', { name: '홈 화면에 설치', exact: true }).click();
  await expect(page.getByText('설치를 취소했어요. 그대로 사용할 수 있어요.')).toBeVisible();
  await page.evaluate(key => localStorage.setItem(`${key}_install_dismissed_on`, '2020-01-01'), key);
  await page.reload(); await offer(page);
  await expect(page.locator('.install-promotion')).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(raw);
});

for (const mode of ['standalone', 'fullscreen']) test(`${mode} launch hides install promotion and keeps pre-install records (emulated)`, async ({ page, context }) => {
  const raw = await seed(page);
  const installedPage = await context.newPage();
  await installedPage.addInitScript(mode => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = query => { const result = original(query); if (query === `(display-mode: ${mode})`) Object.defineProperty(result, 'matches', { value: true }); return result; };
  }, mode);
  await installedPage.goto('./');
  await expect(installedPage.getByRole('heading', { name: '나의 휴무 달력' })).toBeVisible();
  await expect(installedPage.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(installedPage.locator('.install-promotion')).toHaveCount(0);
  await offer(installedPage);
  await expect(installedPage.getByRole('button', { name: '홈 화면에 설치', exact: true })).toHaveCount(0);
  expect(await installedPage.evaluate(key => localStorage.getItem(key), key)).toBe(raw);
  await installedPage.close();
});

test('Kakao suppresses install event and provides working copy flow instead of guessed browser links', async ({ page, context }) => {
  await page.addInitScript(ua => Object.defineProperty(navigator, 'userAgent', { value: `${ua} KAKAOTALK/26.0` }), androidChrome);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const raw = await seed(page); await offer(page);
  await expect(page.getByText('홈 화면에 설치하려면 Chrome 또는 Samsung Internet으로 열어주세요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '홈 화면에 설치', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '앱 주소 복사' }).click();
  await expect(page.getByText('주소를 복사했어요.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('https://sojin7814.github.io/dragon/');
  expect(await page.evaluate(() => (window as any).promptCount)).toBe(0);
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(raw);
});

test('unsupported Android has concise guidance and no dead install button', async ({ page }) => {
  await page.addInitScript(() => {
    let object: any = window;
    while (object) { if (Object.prototype.hasOwnProperty.call(object, 'onbeforeinstallprompt')) delete object.onbeforeinstallprompt; object = Object.getPrototypeOf(object); }
  });
  await seed(page);
  await expect(page.getByText('이 브라우저에서는 바로 설치가 지원되지 않습니다.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: '홈 화면에 설치', exact: true })).toHaveCount(0);
});

test('Samsung UA follows same event contract and first-use install card fits 320px (emulated)', async ({ page }) => {
  await page.addInitScript(ua => Object.defineProperty(navigator, 'userAgent', { value: `${ua} SamsungBrowser/27.0` }), androidChrome);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('./'); await offer(page);
  await expect(page.getByRole('button', { name: '홈 화면에 설치', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/install-onboarding-320.png', fullPage: true });
  await page.getByRole('button', { name: '홈 화면에 설치', exact: true }).click();
  expect(await page.evaluate(() => (window as any).promptCount)).toBe(1);
});

test('export UI absent across main, settings, help and QR; internal calendar still usable', async ({ page }) => {
  await seed(page);
  const forbidden = /이번 달 일정을 내 캘린더|\.ics|삼성 캘린더|Google 캘린더|아이폰 캘린더|일정 파일|캘린더.*가져오기|캘린더.*내보내기/;
  await expect(page.locator('body')).not.toContainText(forbidden);
  await expect(page.locator('.calendar-card')).toBeVisible();
  await page.getByRole('button', { name: '다른 근무조 보기' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '설정 열기' }).click();
  await expect(page.getByRole('dialog')).not.toContainText(forbidden);
  await page.getByRole('button', { name: '사용설명서', exact: true }).last().click();
  for (const details of await page.locator('dialog details').all()) await details.locator('summary').click();
  await expect(page.getByRole('dialog')).not.toContainText(forbidden);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '설정 열기' }).click();
  await page.getByRole('button', { name: '앱 공유 / QR코드' }).click();
  await expect(page.getByRole('dialog')).not.toContainText(forbidden);
  await expect(page.getByText('QR 촬영 → 드래곤 휴무 열기 → 홈 화면에 설치 → 설치.', { exact: false })).toBeVisible();
});

test('install promotion fits main and keeps footer clear in mobile and desktop themes', async ({ page }) => {
  await seed(page); await offer(page);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ['light', 'dark']) {
      const toggle = page.getByRole('button', { name: theme === 'dark' ? '다크모드로 전환' : '라이트모드로 전환' });
      if (await toggle.count()) await toggle.click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const promotion = await page.locator('.install-promotion').boundingBox();
      const calendar = await page.locator('.calendar-card').boundingBox();
      const footer = await page.locator('.creator-note').boundingBox();
      expect(promotion!.y + promotion!.height).toBeLessThan(calendar!.y);
      expect(footer!.y).toBeGreaterThan(calendar!.y + calendar!.height);
      await page.screenshot({ path: `artifacts/install-main-${width}-${theme}.png`, fullPage: true });
    }
  }
});
