import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, ChevronDown, Settings as SettingsIcon, ArrowUpRight, Check, Plus, Sprout, ArrowRight, CircleHelp, CloudOff, RefreshCw, Moon, Sun, Layers } from 'lucide-react';
import { APP_NAME, HOUSE_GROUPS, FIXED_GROUPS, GROUP_NAMES, GROUP_SHORT, GROUP_LABELS, STORAGE_KEY } from './config';
import type { AppData, Group, Theme } from './types';
import { newData, todayKorea, monthDates, dayInfo, groupOn, nextOff } from './domain';
import { loadData, persistData, restoreData, parseBackup, readSafetyCopy, makeBackup } from './storage';
import { downloadFile } from './files';
import { startPwa, setPwaBusy, applyUpdate, type PwaState } from './pwa';
import Modal from './Modal';
import DateEditor, { readableDate, REASONS } from './DateEditor';
import Settings from './Settings';
import Help from './Help';
import Share from './Share';
import RestPlans from './RestPlans';
import InstallPanel from './InstallPanel';
import { getInstallState, subscribeInstall, requestInstall } from './install';
import CompareCalendar from './CompareCalendar';
import MusicPlayer from './MusicPlayer';

type Page = 'settings' | 'help' | 'share' | 'month' | 'compare' | null;
const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
export default function App() {
  const initial = useRef(loadData());
  const [data, setData] = useState<AppData | null>(initial.current.data);
  const raw = useRef(initial.current.raw);
  const [loadError, setLoadError] = useState(initial.current.error);
  const [today, setToday] = useState(todayKorea());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [page, setPage] = useState<Page>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [planning, setPlanning] = useState<{ start: string; end: string } | null>(null);
  const [welcomeTheme, setWelcomeTheme] = useState<Theme>(() => { try { const value = localStorage.getItem(`${STORAGE_KEY}_theme`); return value === 'dark' || value === 'light' ? value : 'system'; } catch { return 'system'; } });
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('light');
  const [themeBusy, setThemeBusy] = useState(false);
  const [musicBusy, setMusicBusy] = useState(false);
  const [chosen, setChosen] = useState<Group | null>(null);
  const [onboardingConfirm, setOnboardingConfirm] = useState(false);
  const [installState, setInstallState] = useState(getInstallState);
  const [error, setError] = useState('');
  const [external, setExternal] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [pwa, setPwa] = useState<PwaState>({ update: 'none', offlineReady: false, message: '' });
  const [pickerYear, setPickerYear] = useState(Number(month.slice(0, 4)));
  const busy = Boolean(page || editing || planning || themeBusy || musicBusy || installState.status === 'prompting' || (!data && onboardingConfirm) || loadError || error || external);
  const busyRef = useRef(busy); busyRef.current = busy;
  useEffect(() => startPwa(setPwa), []);
  useEffect(() => subscribeInstall(setInstallState), []);
  useEffect(() => { setPwaBusy(busy); }, [busy]);
  useEffect(() => {
    const onlineChange = () => setOnline(navigator.onLine);
    const tick = () => setToday(todayKorea());
    const timer = window.setInterval(tick, 60_000);
    window.addEventListener('online', onlineChange); window.addEventListener('offline', onlineChange);
    const storage = (e: StorageEvent) => { if (e.key !== STORAGE_KEY) return; if (busyRef.current) setExternal(true); else { const next = loadData(); setData(next.data); raw.current = next.raw; setLoadError(next.error); } };
    window.addEventListener('storage', storage);
    return () => { clearInterval(timer); window.removeEventListener('storage', storage); window.removeEventListener('online', onlineChange); window.removeEventListener('offline', onlineChange); };
  }, []);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const theme = data?.theme || welcomeTheme;
    const apply = () => { const resolved = theme === 'dark' || (theme === 'system' && media.matches) ? 'dark' : 'light'; document.documentElement.dataset.theme = resolved; setResolvedTheme(resolved); };
    apply(); media.addEventListener('change', apply); return () => media.removeEventListener('change', apply);
  }, [data?.theme, welcomeTheme]);
  async function toggleTheme() {
    const theme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setThemeBusy(true);
    try { if (data) await save({ ...data, theme }); else { localStorage.setItem(`${STORAGE_KEY}_theme`, theme); setWelcomeTheme(theme); } }
    catch (e) { setError((e as Error).message); } finally { setThemeBusy(false); }
  }
  async function save(next: AppData) {
    const text = await persistData(next, raw.current);
    raw.current = text; setData(JSON.parse(text)); setExternal(false); setLoadError(null); setError('');
  }
  async function restore(next: AppData) {
    const text = await restoreData(next, raw.current);
    raw.current = text; setData(JSON.parse(text)); setExternal(false); setLoadError(null);
  }
  function install() { setPwaBusy(true); void requestInstall().finally(() => setPwaBusy(busyRef.current)); }
  function reloadLatest() {
    const next = loadData(); setData(next.data); raw.current = next.raw; setLoadError(next.error); setExternal(false); setError('');
  }
  const year = Number(month.slice(0, 4)), monthNum = Number(month.slice(5));
  function moveMonth(delta: number) { const current = new Date(Date.UTC(year, monthNum - 1 + delta, 1)); if (current.getUTCFullYear() < 1900 || current.getUTCFullYear() > 2199) return; setMonth(`${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}`); }
  const header = <header className="app-header"><a className="brand" href={import.meta.env.BASE_URL} onClick={e => e.preventDefault()}><span className="brand-mark"><img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} width="44" height="44" alt="" /></span><span>{APP_NAME}<small>나의 쉼을 기록하는 달력</small></span></a><div className="header-actions"><span className="personal-label">캐디를 위한 개인 캘린더</span><button className="icon-button theme-toggle" disabled={themeBusy || Boolean(loadError)} aria-label={resolvedTheme === 'dark' ? '라이트모드로 전환' : '다크모드로 전환'} onClick={() => void toggleTheme()}>{resolvedTheme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}</button><button className="icon-button" aria-label="사용설명서" onClick={() => setPage('help')}><CircleHelp size={22} /></button>{data && <button className="icon-button" aria-label="설정 열기" onClick={() => setPage('settings')}><SettingsIcon size={22} /></button>}</div></header>;
  if (loadError) return <div className="app-shell">{header}<main className="recovery stack"><CloudOff size={40} /><h1>기록을 안전하게 확인해야 해요</h1><p>{loadError}</p><p>기존 원본을 보존하고 있습니다. 먼저 원본 파일을 저장하거나 정상 백업을 불러와주세요.</p><button className="button" onClick={() => { if (raw.current) downloadFile(raw.current, `드래곤휴무-복구원본-${today}.json`, 'application/json'); }}>현재 원본 파일 저장</button><label className="button primary file-button">정상 백업으로 복원<input type="file" accept=".json" onChange={async e => { try { const f = e.target.files?.[0]; if (!f) return; if (f.size > 5_000_000) throw new Error('5MB 이하 백업 파일을 선택해주세요.'); const value = parseBackup(await f.text()); if (window.confirm(`${GROUP_NAMES[value.initialGroup]}, 변경 ${Object.keys(value.changes).length}개의 백업으로 대체할까요? 현재 원본은 안전 복사합니다.`)) await restore(value); } catch (e) { setError((e as Error).message); } }} /></label><button className="button" onClick={() => { const copy = readSafetyCopy(); if (copy) { let output = copy; try { output = makeBackup(JSON.parse(copy)); } catch { /* Corrupt originals stay available for manual recovery. */ } downloadFile(output, `드래곤휴무-안전복사본-${today}.json`, 'application/json'); } else setError('저장된 안전 복사본이 없습니다.'); }}>이전 안전 복사본 저장</button>{error && <p role="alert" className="error">{error}</p>}</main></div>;
  const currentGroup = data ? groupOn(data, today) : null;
  const dates = monthDates(year, monthNum);
  const firstWeekday = new Date(`${dates[0]}T00:00:00Z`).getUTCDay();
  const cells: (string | null)[] = [...Array(firstWeekday).fill(null), ...dates];
  while (cells.length % 7) cells.push(null);
  const days = data ? dates.map(d => dayInfo(data, d)) : [];
  const offCount = days.filter(d => d.state === 'off').length;
  let upcoming: {start: string; end: string} | null = null;
  if (data) { try { upcoming = nextOff(data, today); } catch { /* No remaining rest day in the supported date range. */ } }
  return <div className="app-shell">
    {header}
    <main>
      {error && data && !page && <p role="alert" className="error">{error}</p>}
      {installState.message && !page && <p className="notice" role="status">{installState.message}</p>}
      {!online && <div className="status-strip"><CloudOff size={17} />오프라인 · 이 기기에 기록할 수 있어요.{!pwa.offlineReady && ' 재실행 준비 여부는 아직 확인되지 않았어요.'}</div>}
      {external && <div role="alert" className="error">다른 창에서 기록이 바뀌었습니다. 입력을 보관하고 창을 닫은 후 최신 기록을 불러와주세요.{!page && !editing && <button className="button" onClick={reloadLatest}>최신 기록 불러오기</button>}</div>}
      {pwa.update !== 'none' && <div className="status-strip"><RefreshCw size={17} /><span>{pwa.message || '새 버전이 준비됐어요. 입력을 마친 뒤 적용할게요.'}</span><button className="text-button" disabled={busy} onClick={() => { void applyUpdate().catch(e => setError((e as Error).message)); }}>업데이트 적용</button></div>}
      <InstallPanel state={installState} today={today} onInstall={install} promotion />
      {!data ? <div className="onboarding"><div className="welcome-art"><Sprout size={52} strokeWidth={1.3} /></div><span className="eyebrow">A LITTLE REST, JUST FOR YOU</span><h1>기다려지는 휴무,<br />이제 한눈에.</h1><p className="intro">내 근무 유형을 선택해주세요.<br />복잡한 계산 없이 나의 일정을 확인할 수 있어요.</p>{([['하우스 캐디', HOUSE_GROUPS], ['고정 근무반', FIXED_GROUPS]] as const).map(([title, groups]) => <section className="onboarding-section" key={title}><h2>{title}</h2><div className="group-grid">{groups.map(g => { const next = nextOff(newData(g), today); return <button key={g} className={`group-card group-${g} ${chosen === g ? 'selected' : ''}`} aria-label={`${GROUP_NAMES[g]} · ${GROUP_LABELS[g]}`} aria-pressed={chosen === g} onClick={() => { setChosen(g); setOnboardingConfirm(false); }}><div><b>{GROUP_SHORT[g]}</b>{chosen === g && <Check size={21} />}</div><strong>{GROUP_NAMES[g]}</strong><span>{GROUP_LABELS[g]}</span><small>{next.start <= today ? '현재 휴무' : '다음 휴무'} · {readableDate(next.start)}~{readableDate(next.end)}</small></button>; })}</div></section>)}
        {onboardingConfirm && chosen && <div className="notice">{GROUP_NAMES[chosen]}({GROUP_LABELS[chosen]})를 선택했어요. 표시된 휴무일이 맞는지 확인해주세요.</div>}
        {error && <p role="alert" className="error">{error}</p>}
        <button className="button primary onboarding-go" disabled={!chosen} onClick={async () => { if (!onboardingConfirm) { setOnboardingConfirm(true); return; } try { await save({ ...newData(chosen!), theme: welcomeTheme }); } catch (e) { setError((e as Error).message); } }}>{onboardingConfirm ? '확인했어요 · 내 달력 시작' : '선택한 근무 유형 확인'}<ArrowRight size={19} /></button>
        <p className="onboarding-foot">로그인 없이, 이 기기에만 저장해요.<br />휴대폰을 바꾸거나 사이트 데이터를 지우기 전 백업해주세요.</p>
      </div> : <>
        <div className="page-intro"><div><span className="eyebrow">MY DAY, MY CALENDAR</span><h1>나의 휴무 달력</h1><p>쉬는 날도, 바뀐 일정도 한곳에서.</p></div><button className="button compare-open" onClick={() => setPage('compare')}><Layers size={18} />다른 근무조 보기</button></div>
        <div className="calendar-layout"><section className="calendar-card" aria-label="월간 달력"><div className="calendar-toolbar"><div className="month-navigation"><button className="icon-button" aria-label="이전 달" disabled={month === '1900-01'} onClick={() => moveMonth(-1)}><ChevronLeft /></button><button className="month-title" onClick={() => { setPickerYear(year); setPage('month'); }}>{year}년 {monthNum}월<ChevronDown size={18} /></button><button className="icon-button" aria-label="다음 달" disabled={month === '2199-12'} onClick={() => moveMonth(1)}><ChevronRight /></button></div><button className="today-button" onClick={() => setMonth(today.slice(0, 7))}>오늘</button></div>
          <div className="calendar-legend"><span><i className="dot off-dot" />휴무</span><span><i className="dot work-dot" />근무</span><span className="legend-instruction">날짜를 눌러 기록하세요</span></div>
          <div className="calendar-grid" role="group" aria-label={`${year}년 ${monthNum}월`}>{weekdays.map((w, i) => <div key={w} className={`weekday ${i === 0 ? 'sunday' : i === 6 ? 'saturday' : ''}`}>{w}</div>)}{cells.map((date, index) => { if (!date) return <div key={`blank-${index}`} className="day empty" aria-hidden="true" />; const d = dayInfo(data, date); return <button key={date} className={`day ${d.state === 'off' ? 'off-day' : 'work-day'} ${d.change ? 'changed-day' : ''} ${date === today ? 'is-today' : ''}`} aria-label={`${date}, ${d.state === 'off' ? '휴무' : d.change ? '근무' : '기본 근무'}${d.change ? `, ${REASONS[d.change.reason]}` : ''}${d.note ? ', 메모 있음' : ''}`} onClick={() => setEditing(date)}><span className={`day-number ${index % 7 === 0 ? 'sunday' : index % 7 === 6 ? 'saturday' : ''}`}>{Number(date.slice(8))}{date === today && <small>오늘</small>}</span><span className="day-labels">{d.change ? <><span className={`event-label ${d.state === 'off' ? 'off' : 'work'}`}><span>{d.change.reason === 'cover' ? '대바' : d.change.reason === 'transfer' ? '양도' : d.change.reason === 'exchange' ? '교환' : '변경'}</span><span className="state-suffix">{` · ${d.state === 'off' ? '휴무' : '근무'}`}</span></span>{d.change.person && <span className="cell-person">{d.change.person}</span>}</> : d.state === 'off' ? <span className="event-label off">휴무</span> : null}{d.note && <span className="cell-note">· {d.note}</span>}</span></button>; })}</div>
          <div className="calendar-bottom"><span><b>{offCount}일</b>의 휴무가 있어요</span><span>색은 실제 근무·휴무 기준이에요</span></div>
        </section>
        <aside className="calendar-aside"><button type="button" className="next-rest" aria-label="다가오는 나의 휴무 · 계획 남기기" disabled={!upcoming} onClick={() => upcoming && setPlanning(upcoming)}><div className="rest-header"><span className="eyebrow">YOUR NEXT BREAK</span><Sprout size={28} strokeWidth={1.4} /></div><p>{upcoming && upcoming.start <= today ? '지금은 쉬어가는 시간' : '다가오는 나의 휴무'}</p><h2>{upcoming ? <>{readableDate(upcoming.start)}{upcoming.end !== upcoming.start && <span>— {readableDate(upcoming.end)}</span>}</> : '휴무를 확인해주세요'}</h2><div className="rest-foot"><span>{GROUP_NAMES[currentGroup!]} · 계획 남기기</span><CalendarDays size={19} /></div></button>
          {data.groupChanges.some(c => c.date > today) && <button className="notice upcoming-group" onClick={() => setPage('settings')}>{[...data.groupChanges].filter(c => c.date > today).sort((a,b) => a.date.localeCompare(b.date)).slice(0, 1).map(c => <span key={c.id}>{readableDate(c.date)}부터 {GROUP_NAMES[c.group]}으로 변경 예정</span>)}<ChevronRight size={18} /></button>}
          <button className="quick-add" onClick={() => setEditing(today)}><Plus size={19} />일정이나 메모 남기기<ArrowUpRight size={19} /></button>
          <MusicPlayer onBusyChange={setMusicBusy} />
        </aside></div>
        <footer className="app-footer"><span><i className="dot off-dot" />{pwa.offlineReady ? '오프라인 사용 준비됨' : '이 기기에 기록 저장'} · 로그인 없이 나만의 달력</span><p className="creator-note">황소진 캐디의 명령으로 제작하게 되었습니다. 오류 및 불편사항은 황소진 캐디에게 요청 하시기 바랍니다.</p></footer>
      </>}
    </main>
    {editing && data && <DateEditor key={editing} data={data} date={editing} onDateChange={setEditing} onSave={save} onClose={() => setEditing(null)} />}
    {planning && data && <RestPlans data={data} start={planning.start} end={planning.end} onSave={save} onClose={() => setPlanning(null)} />}
    {page === 'compare' && data && <CompareCalendar data={data} initialMonth={month} onClose={() => setPage(null)} />}
    {page === 'settings' && data && <Settings data={data} onSave={save} onRestore={restore} onClose={() => setPage(null)} onPage={p => setPage(p)} installState={installState} onInstall={install} />}
    {(page === 'help' || page === 'share') && <Modal title={page === 'help' ? '사용설명서' : '앱 공유 / QR코드'} onClose={() => setPage(null)}>{page === 'share' ? <Share /> : <Help />}</Modal>}
    {page === 'month' && <Modal title="원하는 달로 이동" onClose={() => setPage(null)}><div className="stack"><label>연도<input type="number" min="1900" max="2199" value={pickerYear} onChange={e => setPickerYear(Number(e.target.value))} /></label><div className="month-picker">{Array.from({ length: 12 }, (_, i) => <button key={i} className={`choice ${pickerYear === year && i + 1 === monthNum ? 'active' : ''}`} disabled={!Number.isInteger(pickerYear) || pickerYear < 1900 || pickerYear > 2199} onClick={() => { setMonth(`${pickerYear}-${String(i + 1).padStart(2, '0')}`); setPage(null); }}>{i + 1}월</button>)}</div><p className="muted">1900년부터 2199년까지 확인할 수 있어요.</p></div></Modal>}
  </div>;
}
