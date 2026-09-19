import { test, expect, type Page } from '@playwright/test';
import type { AppData } from '../src/types';
import { parseLrc } from '../src/lyrics';
import { readFileSync } from 'node:fs';
const firstLyrics = parseLrc(readFileSync('public/assets/music/caddie-day.lrc','utf8'));
const calendarKey = 'dragon_calendar_data';
async function initialize(page:Page,theme:'light'|'dark'='light') {
  const data:AppData={schemaVersion:1,revision:8,calendarId:'music-preservation',initialGroup:'A',groupChanges:[{id:'future',date:'2027-01-01',group:'B'}],notes:{},changes:{
    '2026-09-24':{id:'first',date:'2026-09-24',state:'work',reason:'exchange',person:'동료',memo:'기존 교환',exchangeId:'exchange',partnerDate:'2026-09-26'},
    '2026-09-26':{id:'second',date:'2026-09-26',state:'off',reason:'exchange',person:'동료',memo:'기존 교환',exchangeId:'exchange',partnerDate:'2026-09-24'}},theme,updatedAt:'2026-09-01T00:00:00.000Z'};
  data.notes['2026-09-24']='기존 메모'; data.notes['2026-09-25']='기존 휴무 계획'; data.theme=theme;
  const raw=JSON.stringify(data);
  await page.addInitScript(({key,raw})=>{if(!localStorage.getItem(key)) localStorage.setItem(key,raw);},{key:calendarKey,raw});
  await page.goto('./'); await expect(page.getByRole('region',{name:'음악 플레이어'})).toBeVisible();
  return raw;
}
async function media(page:Page) {return page.locator('audio').evaluate((a:HTMLAudioElement)=>({paused:a.paused,time:a.currentTime,ended:a.ended,src:a.currentSrc||a.src}));}
async function seek(page:Page,time:number) {
  await page.getByRole('slider',{name:'음악 재생 위치'}).fill(String(time));
  await expect.poll(async()=> (await media(page)).time).toBeCloseTo(time,0);
}

test('no initial MP3 download/autoplay; real playback, pause, seek, lyrics and records survive reload',async({page})=>{
  const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
  const raw=await initialize(page);
  await expect(page.locator('.lyric-current')).toHaveText(firstLyrics[0].time===0 ? firstLyrics[0].text : '재생을 눌러 잠깐 쉬어가세요.');
  expect((await media(page)).paused).toBe(true);
  expect(requests.filter(r=>r.includes('.mp3'))).toEqual([]);
  await page.getByRole('button',{name:'음악 재생',exact:true}).click();
  await expect.poll(async()=>(await media(page)).time).toBeGreaterThan(.2);
  await page.getByRole('button',{name:'음악 일시정지'}).click();
  expect((await media(page)).paused).toBe(true);
  const target=firstLyrics[10]; await seek(page,target.time+.1);
  await expect(page.locator('.lyric-current')).toHaveText(target.text);
  await page.getByRole('button',{name:'가사 전체 보기'}).click();
  await page.locator('.music-full-lyrics button').nth(3).click();
  await expect(page.locator('.music-full-lyrics button').nth(3)).toHaveAttribute('aria-current','true');
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  expect((await media(page)).paused).toBe(true);
  await page.getByRole('button',{name:'다음 곡',exact:true}).click();
  await expect(page.getByRole('button',{name:'곡 선택: 오늘 왜 이러지'})).toBeVisible();
  expect((await media(page)).time).toBe(0);
  expect(await page.evaluate(key=>localStorage.getItem(key),calendarKey)).toBe(raw);
  await page.reload();
  await expect(page.getByRole('button',{name:'곡 선택: 오늘 왜 이러지'})).toBeVisible();
  expect((await media(page)).paused).toBe(true);expect((await media(page)).time).toBe(0);
  expect(await page.evaluate(key=>localStorage.getItem(key),calendarKey)).toBe(raw);
});

test('song choice, natural end advances and final song stops without looping',async({page})=>{
  await initialize(page);
  await page.getByRole('button',{name:/곡 선택:/}).click();
  await page.getByRole('button',{name:'오늘 왜 이러지',exact:true}).click();
  await page.getByRole('button',{name:'음악 재생',exact:true}).click();
  await expect.poll(async()=>(await media(page)).time).toBeGreaterThan(.1);
  await seek(page,176.15);
  await expect(page.getByRole('button',{name:'곡 선택: 드래곤, 마음이 쉬어 가는 곳'})).toBeVisible();
  await expect.poll(async()=>(await media(page)).time).toBeGreaterThan(.1);
  await seek(page,227.7);
  await expect(page.getByText('마지막 곡까지 들었어요.')).toBeVisible();
  expect((await media(page)).paused).toBe(true);expect((await media(page)).ended).toBe(true);
  await expect(page.getByRole('button',{name:'다음 곡',exact:true})).toBeDisabled();
});

test('missing lyrics still play audio; missing audio stays within player and other songs recover',async({page,context})=>{
  await context.route('**/*.lrc*',route=>route.fulfill({status:404,body:'missing'}));
  await context.route('**/caddie-day.mp3*',route=>route.fulfill({status:404,body:'missing'}));
  const raw=await initialize(page);
  await expect(page.locator('.lyric-current')).toHaveText('가사가 준비되지 않았어요.');
  await page.getByRole('button',{name:'음악 재생',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('이 곡을 불러오지 못했어요.');
  await expect(page.getByRole('region',{name:'월간 달력'})).toBeVisible();
  await page.getByRole('button',{name:/곡 선택:/}).click();
  await expect(page.getByText('재생 불가 · 연결 후 다시 시도')).toBeVisible();
  await page.getByRole('button',{name:'오늘 왜 이러지',exact:true}).click();
  await page.getByRole('button',{name:'음악 재생',exact:true}).click();
  await expect.poll(async()=>(await media(page)).time).toBeGreaterThan(.1);
  await expect(page.locator('.lyric-current')).toHaveText('가사가 준비되지 않았어요.');
  expect(await page.evaluate(key=>localStorage.getItem(key),calendarKey)).toBe(raw);
});

for (const theme of ['light','dark'] as const) test(`${theme} player fits 320, 390 and 1280 without changing calendar width`,async({page})=>{
  await initialize(page,theme);
  for(const width of [320,390,1280]) {
    await page.setViewportSize({width,height:950});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const calendar=(await page.locator('.calendar-card').boundingBox())!;
    const player=(await page.locator('.music-card').boundingBox())!;
    if(width===1280){expect(player.x).toBeGreaterThan(calendar.x+calendar.width);expect(calendar.width).toBeGreaterThan(700);}
    else expect(player.y).toBeGreaterThan(calendar.y+calendar.height);
    const controls=await page.locator('.music-controls button, .music-progress input').all();
    for(const control of controls) expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({path:`artifacts/music-${theme}-${width}.png`,fullPage:true});
  }
});

test('music is absent from installed shell caches',async({page})=>{
  await initialize(page);
  await expect(page.getByText('오프라인 사용 준비됨',{exact:false})).toBeVisible();
  const cached=await page.evaluate(async()=>{
    const all=await Promise.all((await caches.keys()).map(async key=>(await(await caches.open(key)).keys()).map(r=>r.url)));
    return all.flat();
  });
  expect(cached.some(url=>/\.(mp3|lrc)(\?|$)/.test(url))).toBe(false);
  expect(cached.some(url=>url.includes('icon-192'))).toBe(true);
});
