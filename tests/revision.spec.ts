import { test, expect, type Page } from '@playwright/test';
import type { AppData, Group } from '../src/types';
const key = 'dragon_calendar_data';
const footer = '황소진 캐디의 명령으로 제작하게 되었습니다. 오류 및 불편사항은 황소진 캐디에게 요청 하시기 바랍니다.';
const sample = (group: Group = 'A'): AppData => ({ schemaVersion: 1, revision: 8, calendarId: 'legacy-calendar', initialGroup: group, groupChanges: [], changes: {}, notes: {}, theme: 'light', updatedAt: '2026-09-01T00:00:00.000Z' });
async function seed(page: Page, data: AppData) {
  await page.goto('./');
  await page.evaluate(({key,data}) => localStorage.setItem(key,JSON.stringify(data)), {key,data});
  await page.reload();
  await expect(page.getByRole('heading',{name:'나의 휴무 달력'})).toBeVisible();
}
async function read(page: Page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key); }
async function openDate(page: Page, date: string) { await page.getByRole('button',{name:new RegExp(`^${date},`)}).click(); }
async function saveEditor(page: Page) { await page.getByRole('button',{name:'내용 확인',exact:true}).click(); await page.getByRole('button',{name:'확인하고 저장',exact:true}).click(); }
test.beforeEach(async ({page}) => { await page.clock.setFixedTime(new Date('2026-09-23T03:00:00.000Z')); });

test('first-use theme is remembered and both selection sections fit a small phone',async({page})=>{
  await page.goto('./');
  await page.getByRole('button',{name:'다크모드로 전환'}).click();
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.setViewportSize({width:320,height:720});
  await expect(page.locator('.group-card')).toHaveCount(7);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'artifacts/revision-onboarding-dark.png',fullPage:true});
  await page.getByRole('button',{name:'라이트모드로 전환'}).click();
  await page.setViewportSize({width:1280,height:900});
  await page.screenshot({path:'artifacts/revision-onboarding-light.png',fullPage:true});
  await page.locator('.group-card').filter({has:page.getByText('하우스 A',{exact:true})}).click();
  await page.getByRole('button',{name:'선택한 근무 유형 확인'}).click();
  await page.getByRole('button',{name:'확인했어요 · 내 달력 시작'}).click();
  expect((await read(page)).theme).toBe('light');
  await page.getByRole('button',{name:'설정 열기'}).click();
  await page.emulateMedia({colorScheme:'dark'});
  await page.getByRole('button',{name:'기기 설정',exact:true}).click();
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.getByRole('button',{name:'라이트모드로 전환'}).click();
  expect((await read(page)).theme).toBe('light');
});

test('existing A B C D records and history load unchanged; legacy cover remains editable',async({page})=>{
  for(const group of ['A','B','C','D'] as const) {
    const data=sample(group);
    data.groupChanges=[{id:'future',date:'2027-01-01',group:'B'}];
    data.changes['2026-09-24']={id:'cover-old',date:'2026-09-24',state:'work',reason:'cover',person:'기존 캐디',memo:'기존 대바 메모'};
    data.notes['2026-09-24']='기존 날짜 메모';
    await seed(page,data);
    await page.getByRole('button',{name:'설정 열기'}).click();
    await expect(page.locator('.group-current')).toContainText(`하우스 ${group}`);
    await expect(page.locator('.history-row')).toContainText('2027-01-01');
    await page.getByRole('button',{name:'닫기',exact:true}).click();
    expect(await read(page)).toEqual(data);
  }
  await openDate(page,'2026-09-24');
  await expect(page.getByRole('button',{name:'대바',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'직접 변경',exact:true})).toHaveCount(0);
  await expect(page.getByPlaceholder('이름을 입력해주세요')).toHaveValue('기존 캐디');
  await expect(page.getByPlaceholder('기억할 내용을 남겨주세요')).toHaveValue('기존 날짜 메모\n기존 대바 메모');
  await page.getByPlaceholder('기억할 내용을 남겨주세요').fill('기존 날짜 메모\n기존 대바 메모\n추가 메모');
  await saveEditor(page);
  const saved=await read(page);
  expect(saved.changes['2026-09-24']).toMatchObject({reason:'cover',person:'기존 캐디',state:'work'});
  expect(saved.notes['2026-09-24']).toContain('기존 대바 메모');
  expect(saved.groupChanges).toEqual([{id:'future',date:'2027-01-01',group:'B'}]);
});

for (const [name,id,offDays] of [
  ['주중반 (월~금)','WEEKDAY_MON_FRI',[26,27]],
  ['주말반 (금~일)','WEEKEND_FRI_SUN',[21,22,23,24]],
  ['주말반 (토~일)','WEEKEND_SAT_SUN',[21,22,23,24,25]],
] as const) test(`onboarding ${name} calculates its weekday schedule`,async({page})=>{
  await page.goto('./');
  await expect(page.locator('.group-card')).toHaveCount(7);
  await expect(page.getByRole('heading',{name:'하우스 캐디',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'고정 근무반',exact:true})).toBeVisible();
  await page.locator('.group-card').filter({has:page.getByText(name,{exact:true})}).click();
  await page.getByRole('button',{name:'선택한 근무 유형 확인'}).click();
  await page.getByRole('button',{name:'확인했어요 · 내 달력 시작'}).click();
  expect((await read(page)).initialGroup).toBe(id);
  for(let d=21;d<=27;d++) await expect(page.getByRole('button',{name:new RegExp(`^2026-09-${d},`)})).toHaveClass((offDays as readonly number[]).includes(d) ? /off-day/ : /work-day/);
});

test('date switching reloads original records and protects unsaved text; plus always starts today',async({page})=>{
  const data=sample(); data.notes['2026-09-25']='25일 기존 계획';
  data.changes['2026-09-25']={id:'transfer-old',date:'2026-09-25',state:'work',reason:'transfer',person:'양도 상대',memo:''};
  await seed(page,data);
  await page.getByRole('button',{name:'이전 달',exact:true}).click();
  await page.getByRole('button',{name:'일정이나 메모 남기기'}).click();
  await expect(page.getByLabel('기록 날짜',{exact:true})).toHaveValue('2026-09-23');
  await page.getByLabel('기록 날짜',{exact:true}).fill('2026-09-24');
  await expect(page.getByRole('dialog')).toHaveAccessibleName('2026년 9월 24일');
  await expect(page.getByText('기본 휴무일',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'휴무',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByPlaceholder('기억할 내용을 남겨주세요').fill('버리면 안 되는 입력');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByLabel('기록 날짜',{exact:true}).fill('2026-09-25');
  await expect(page.getByLabel('기록 날짜',{exact:true})).toHaveValue('2026-09-24');
  await expect(page.getByPlaceholder('기억할 내용을 남겨주세요')).toHaveValue('버리면 안 되는 입력');
  page.once('dialog',dialog=>dialog.accept());
  await page.getByLabel('기록 날짜',{exact:true}).fill('2026-09-25');
  await expect(page.getByPlaceholder('기억할 내용을 남겨주세요')).toHaveValue('25일 기존 계획');
  await expect(page.getByPlaceholder('이름을 입력해주세요')).toHaveValue('양도 상대');
  await expect(page.getByRole('button',{name:'휴무 양도',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button',{name:'근무',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  expect(await read(page)).toEqual(data);
});

test('comparison keeps my actual rest days visible and multiple selections never write settings',async({page})=>{
  const data=sample('WEEKDAY_MON_FRI');
  data.changes['2026-09-24']={id:'extra-off',date:'2026-09-24',state:'off',reason:'manual',person:'',memo:''};
  await seed(page,data);
  await page.getByRole('button',{name:'다른 근무조 보기',exact:true}).click();
  await expect(page.getByRole('button',{name:/내 일정 · 주중반/})).toBeDisabled();
  await expect(page.getByLabel('2026-09-26 휴무 비교',{exact:true})).toContainText('나 · 주중');
  await expect(page.getByLabel('2026-09-24 휴무 비교',{exact:true})).toContainText('나 · 주중');
  await page.getByRole('button',{name:'하우스 B',exact:true}).click();
  await page.getByRole('button',{name:'하우스 C',exact:true}).click();
  await page.getByRole('button',{name:'주말반 (금~일)',exact:true}).click();
  await expect(page.getByLabel('2026-09-26 휴무 비교',{exact:true})).toContainText('하B');
  await expect(page.getByLabel('2026-09-24 휴무 비교',{exact:true})).toContainText('금~일');
  await page.getByRole('button',{name:'하우스 B',exact:true}).click();
  await expect(page.getByLabel('2026-09-26 휴무 비교',{exact:true})).not.toContainText('하B');
  await expect(page.getByRole('button',{name:'하우스 C',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.setViewportSize({width:320,height:720});
  await page.screenshot({path:'artifacts/revision-compare-mobile.png',fullPage:true});
  expect(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.getByRole('button',{name:'내 달력으로 돌아가기'}).click();
  expect(await read(page)).toEqual(data);
  await expect(page.locator('.month-summary')).toHaveCount(0);
  await expect(page.locator('.group-pill')).toHaveCount(0);
});

test('two holiday plans are independent, shown on calendar, editable, deletable and backed up',async({page})=>{
  await seed(page,sample());
  await page.getByRole('button',{name:'다가오는 나의 휴무 · 계획 남기기'}).click();
  await expect(page.getByRole('heading',{name:'이 날 휴무 계획은 무엇인가요?'})).toBeVisible();
  await page.getByPlaceholder('병원, 부모님댁, 골프, 서울 약속, 푹 쉬기…').fill('병원 방문 후 부모님댁에서 점심을 먹고 집으로 돌아오기');
  await page.getByRole('button',{name:'이 날짜 계획 저장',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('저장했어요');
  await page.getByRole('button',{name:'다음 휴무일',exact:true}).click();
  await page.getByPlaceholder('병원, 부모님댁, 골프, 서울 약속, 푹 쉬기…').fill('서울 약속');
  await page.getByRole('button',{name:'이 날짜 계획 저장',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('저장했어요');
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await expect(page.getByRole('button',{name:/^2026-09-24,/}).locator('.cell-note')).toHaveCSS('text-overflow','ellipsis');
  await expect(page.getByRole('button',{name:/^2026-09-25,/})).toContainText('서울 약속');
  await openDate(page,'2026-09-24');
  await expect(page.getByPlaceholder('기억할 내용을 남겨주세요')).toHaveValue('병원 방문 후 부모님댁에서 점심을 먹고 집으로 돌아오기');
  await page.getByPlaceholder('기억할 내용을 남겨주세요').fill('병원'); await saveEditor(page);
  await page.getByRole('button',{name:'설정 열기'}).click();
  const downloading=page.waitForEvent('download'); await page.getByRole('button',{name:'백업하기',exact:true}).click();
  const backupPath=await (await downloading).path(); expect(backupPath).toBeTruthy();
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.getByRole('button',{name:'다가오는 나의 휴무 · 계획 남기기'}).click();
  page.once('dialog',dialog=>dialog.accept()); await page.getByRole('button',{name:'이 날짜 계획 삭제',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('삭제했어요');
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  expect((await read(page)).notes).toEqual({'2026-09-25':'서울 약속'});
  await page.getByRole('button',{name:'설정 열기'}).click();
  await page.locator('input[type=file]').setInputFiles(backupPath!);
  await page.getByRole('button',{name:'현재 기록 대체'}).click();
  await expect(page.getByRole('status')).toContainText('복원했습니다');
  expect((await read(page)).notes).toEqual({'2026-09-24':'병원','2026-09-25':'서울 약속'});
});

test('house to fixed type and back keep dated history and existing notes',async({page})=>{
  const data=sample(); data.notes['2026-10-03']='이미 있던 계획'; await seed(page,data);
  await page.getByRole('button',{name:'설정 열기'}).click();
  for(const [group,date] of [['WEEKDAY_MON_FRI','2026-10-01'],['C','2026-10-20']]){
    await page.getByRole('button',{name:'근무 유형 변경',exact:true}).click();
    await page.getByLabel('새 근무 유형',{exact:true}).selectOption(group);
    await page.getByLabel('적용 시작일',{exact:true}).fill(date);
    await page.getByRole('button',{name:'변경 내용 확인',exact:true}).click();
    await page.getByRole('button',{name:'확인하고 저장',exact:true}).click();
    await expect(page.getByRole('button',{name:'근무 유형 변경',exact:true})).toBeVisible();
  }
  expect((await read(page)).groupChanges.map((c:any)=>[c.group,c.date])).toEqual([['WEEKDAY_MON_FRI','2026-10-01'],['C','2026-10-20']]);
  expect((await read(page)).notes['2026-10-03']).toBe('이미 있던 계획');
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.getByRole('button',{name:'다음 달',exact:true}).click();
  await openDate(page,'2026-10-03');
  await expect(page.getByText('원래 일정 · 주중반 (월~금)')).toBeVisible();
  await expect(page.getByText('기본 휴무일',{exact:true})).toBeVisible();
  await page.getByLabel('기록 날짜',{exact:true}).fill('2026-10-20');
  await expect(page.getByText('원래 일정 · 하우스 C')).toBeVisible();
});

test('work-state colours match across reasons and footer/theme stay readable without overlap',async({page})=>{
  const data=sample();
  for(const [date,reason,state] of [['2026-09-24','transfer','work'],['2026-09-25','transfer','off'],['2026-09-26','exchange','work'],['2026-09-27','exchange','off']] as const) data.changes[date]={id:date,date,state,reason,person:'',memo:'',...(reason==='exchange'?{exchangeId:'pair',partnerDate:date==='2026-09-26'?'2026-09-27':'2026-09-26'}:{})};
  await seed(page,data);
  for(const [width,height] of [[1280,900],[390,844],[320,720]]){
    await page.setViewportSize({width,height});
    for(const theme of ['light','dark']){
      const button=page.getByRole('button',{name:theme==='dark'?'다크모드로 전환':'라이트모드로 전환',exact:true});
      if(await button.count()) await button.click();
      await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
      await expect(page.locator('.creator-note')).toHaveText(footer);
      await expect(page.locator('.creator-note')).toHaveCSS('font-size','11px');
      const footerRect=await page.locator('.creator-note').boundingBox();
      const installRect=await page.locator('.app-footer>span').boundingBox();
      expect(footerRect!.y).toBeGreaterThanOrEqual(installRect!.y+installRect!.height);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      for(const [date,state] of [['2026-09-24','work'],['2026-09-25','off'],['2026-09-26','work'],['2026-09-27','off']]) await expect(page.getByRole('button',{name:new RegExp(`^${date},`)}).locator('.event-label')).toHaveClass(`event-label ${state}`);
      const transfer=await page.getByRole('button',{name:/^2026-09-24,/}).locator('.event-label').evaluate(el=>getComputedStyle(el).backgroundColor);
      const exchange=await page.getByRole('button',{name:/^2026-09-26,/}).locator('.event-label').evaluate(el=>getComputedStyle(el).backgroundColor);
      expect(transfer).toBe(exchange);
      await page.screenshot({path:`artifacts/revision-${width}-${theme}.png`,fullPage:true});
    }
  }
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.getByRole('button',{name:'설정 열기'}).click();
  await page.getByRole('button',{name:'밝게',exact:true}).click();
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await expect(page.getByRole('button',{name:'다크모드로 전환'})).toBeVisible();
  expect((await read(page)).theme).toBe('light');
});
