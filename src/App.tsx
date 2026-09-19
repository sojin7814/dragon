import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, ChevronDown, Settings as SettingsIcon, ArrowUpRight, ArrowDownToLine, Check, Plus, Sprout, Smartphone, ArrowRight, CircleHelp, CloudOff, RefreshCw } from 'lucide-react';
import { APP_NAME, GROUPS, GROUP_LABELS, STORAGE_KEY } from './config';
import type { AppData, Group } from './types';
import { newData, todayKorea, monthDates, dayInfo, groupOn, nextOff } from './domain';
import { loadData, persistData, restoreData, parseBackup, readSafetyCopy, makeBackup } from './storage';
import { createICS, exportEvents } from './ics';
import { downloadFile, shareFile } from './files';
import { startPwa, setPwaBusy, requestInstall, applyUpdate, type PwaState } from './pwa';
import Modal from './Modal';
import DateEditor, { readableDate, REASONS } from './DateEditor';
import Settings from './Settings';
import Help from './Help';
import Share from './Share';

type Page = 'settings' | 'help' | 'install' | 'share' | 'month' | 'export' | null;
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
  const [chosen, setChosen] = useState<Group | null>(null);
  const [onboardingConfirm, setOnboardingConfirm] = useState(false);
  const [notice, setNotice] = useState('');
  const [installNotice, setInstallNotice] = useState('');
  const [error, setError] = useState('');
  const [external, setExternal] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [pwa, setPwa] = useState<PwaState>({ install: 'manual', update: 'none', offlineReady: false, message: '' });
  const [pickerYear, setPickerYear] = useState(Number(month.slice(0, 4)));
  const busy = Boolean(page || editing || fileBusy || (!data && onboardingConfirm) || loadError || error || external);
  const busyRef = useRef(busy); busyRef.current = busy;
  useEffect(() => startPwa(setPwa), []);
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
    const apply = () => document.documentElement.dataset.theme = data?.theme === 'dark' || (data?.theme === 'system' && media.matches) ? 'dark' : 'light';
    apply(); media.addEventListener('change', apply); return () => media.removeEventListener('change', apply);
  }, [data?.theme]);
  async function save(next: AppData) {
    const text = await persistData(next, raw.current);
    raw.current = text; setData(JSON.parse(text)); setExternal(false); setLoadError(null); setError('');
  }
  async function restore(next: AppData) {
    const text = await restoreData(next, raw.current);
    raw.current = text; setData(JSON.parse(text)); setExternal(false); setLoadError(null);
  }
  async function install() { try { const result = await requestInstall(); if (result === 'unavailable') setPage('install'); else setInstallNotice(result === 'dismissed' ? '설치를 취소했어요. 그대로 사용할 수 있어요.' : '설치를 요청했어요. 브라우저의 완료 안내를 확인해주세요.'); } catch { setPage('install'); } }
  function reloadLatest() {
    const next = loadData(); setData(next.data); raw.current = next.raw; setLoadError(next.error); setExternal(false); setError('');
  }
  const year = Number(month.slice(0, 4)), monthNum = Number(month.slice(5));
  function moveMonth(delta: number) { const current = new Date(Date.UTC(year, monthNum - 1 + delta, 1)); if (current.getUTCFullYear() < 1900 || current.getUTCFullYear() > 2199) return; setMonth(`${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}`); }
  async function calendarFile(share: boolean) {
    if (!data) return;
    setFileBusy(true); setError('');
    try {
      const blob = new Blob([createICS(data, year, monthNum)], { type: 'text/calendar;charset=utf-8' });
      const name = `드래곤휴무-${month}.ics`;
      if (share) { const result = await shareFile(blob, name); if (result === 'unsupported') setNotice('이 환경에서는 파일 공유를 지원하지 않습니다. 파일 저장을 이용해주세요.'); else if (result === 'shared') setNotice('공유 요청을 보냈습니다. 캘린더에 추가됐는지 확인해주세요.'); else setNotice('공유를 취소했거나 공유할 앱을 선택하지 않았어요.'); }
      else { downloadFile(blob, name); setNotice('일정 파일을 만들었습니다. 캘린더 앱에서 가져오기를 진행해주세요.'); }
    } catch (e) { setError(`일정 파일을 만들지 못했어요. ${(e as Error).message}`); } finally { setFileBusy(false); }
  }
  const header = <header className="app-header"><a className="brand" href={import.meta.env.BASE_URL} onClick={e => e.preventDefault()}><span className="brand-mark"><img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} width="44" height="44" alt="" /></span><span>{APP_NAME}<small>나의 쉼을 기록하는 달력</small></span></a><div className="header-actions"><span className="personal-label">캐디를 위한 개인 캘린더</span><button className="icon-button" aria-label="사용설명서" onClick={() => setPage('help')}><CircleHelp size={22} /></button>{data && <button className="icon-button" aria-label="설정 열기" onClick={() => setPage('settings')}><SettingsIcon size={22} /></button>}</div></header>;
  if (loadError) return <div className="app-shell">{header}<main className="recovery stack"><CloudOff size={40} /><h1>기록을 안전하게 확인해야 해요</h1><p>{loadError}</p><p>기존 원본을 보존하고 있습니다. 먼저 원본 파일을 저장하거나 정상 백업을 불러와주세요.</p><button className="button" onClick={() => { if (raw.current) downloadFile(raw.current, `드래곤휴무-복구원본-${today}.json`, 'application/json'); }}>현재 원본 파일 저장</button><label className="button primary file-button">정상 백업으로 복원<input type="file" accept=".json" onChange={async e => { try { const f = e.target.files?.[0]; if (!f) return; if (f.size > 5_000_000) throw new Error('5MB 이하 백업 파일을 선택해주세요.'); const value = parseBackup(await f.text()); if (window.confirm(`${value.initialGroup}조, 변경 ${Object.keys(value.changes).length}개의 백업으로 대체할까요? 현재 원본은 안전 복사합니다.`)) await restore(value); } catch (e) { setError((e as Error).message); } }} /></label><button className="button" onClick={() => { const copy = readSafetyCopy(); if (copy) { let output = copy; try { output = makeBackup(JSON.parse(copy)); } catch { /* Corrupt originals stay available for manual recovery. */ } downloadFile(output, `드래곤휴무-안전복사본-${today}.json`, 'application/json'); } else setError('저장된 안전 복사본이 없습니다.'); }}>이전 안전 복사본 저장</button>{error && <p role="alert" className="error">{error}</p>}</main></div>;
  const currentGroup = data ? groupOn(data, today) : null;
  const dates = monthDates(year, monthNum);
  const firstWeekday = new Date(`${dates[0]}T00:00:00Z`).getUTCDay();
  const cells: (string | null)[] = [...Array(firstWeekday).fill(null), ...dates];
  while (cells.length % 7) cells.push(null);
  const days = data ? dates.map(d => dayInfo(data, d)) : [];
  const offCount = days.filter(d => d.state === 'off').length;
  const changedCount = days.filter(d => d.change).length;
  let upcoming: {start: string; end: string} | null = null;
  if (data) { try { upcoming = nextOff(data, today); } catch { /* No remaining rest day in the supported date range. */ } }
  const marked = days.filter(d => d.state === 'off' || d.change || d.note);
  const events = data && page === 'export' ? exportEvents(data, year, monthNum) : [];
  return <div className="app-shell">
    {header}
    <main>
      {installNotice && <p className="notice" role="status">{installNotice}</p>}
      {!online && <div className="status-strip"><CloudOff size={17} />오프라인 · 이 기기에 기록할 수 있어요.{!pwa.offlineReady && ' 재실행 준비 여부는 아직 확인되지 않았어요.'}</div>}
      {external && <div role="alert" className="error">다른 창에서 기록이 바뀌었습니다. 입력을 보관하고 창을 닫은 후 최신 기록을 불러와주세요.{!page && !editing && <button className="button" onClick={reloadLatest}>최신 기록 불러오기</button>}</div>}
      {pwa.update !== 'none' && <div className="status-strip"><RefreshCw size={17} /><span>{pwa.message || '새 버전이 준비됐어요. 입력을 마친 뒤 적용할게요.'}</span><button className="text-button" disabled={busy} onClick={() => { void applyUpdate().catch(e => setError((e as Error).message)); }}>업데이트 적용</button></div>}
      {!data ? <div className="onboarding"><div className="welcome-art"><Sprout size={52} strokeWidth={1.3} /></div><span className="eyebrow">A LITTLE REST, JUST FOR YOU</span><h1>기다려지는 휴무,<br />이제 한눈에.</h1><p className="intro">내 휴무조를 선택해주세요.<br />복잡한 계산 없이 나의 일정을 확인할 수 있어요.</p><div className="group-grid">{GROUPS.map(g => { const next = nextOff(newData(g), today); return <button key={g} className={`group-card group-${g} ${chosen === g ? 'selected' : ''}`} aria-pressed={chosen === g} onClick={() => { setChosen(g); setOnboardingConfirm(false); }}><div><b>{g}</b>{chosen === g && <Check size={21} />}</div><strong>{g} 휴무조</strong><span>{GROUP_LABELS[g]}</span><small>{next.start <= today ? '현재 휴무' : '다음 휴무'} · {readableDate(next.start)}~{readableDate(next.end)}</small></button>; })}</div>
        {onboardingConfirm && chosen && <div className="notice">{chosen} 휴무조({GROUP_LABELS[chosen]})를 선택했어요. 표시된 휴무일이 맞는지 확인해주세요.</div>}
        {error && <p role="alert" className="error">{error}</p>}
        <button className="button primary onboarding-go" disabled={!chosen} onClick={async () => { if (!onboardingConfirm) { setOnboardingConfirm(true); return; } try { await save(newData(chosen!)); } catch (e) { setError((e as Error).message); } }}>{onboardingConfirm ? '확인했어요 · 내 달력 시작' : '선택한 휴무조 확인'}<ArrowRight size={19} /></button>
        <div className="install-welcome"><Smartphone size={21} /><div><strong>설치 후 사용하면 편해요</strong><p>홈 화면에서 바로 열어보세요.</p></div><button className="text-button" onClick={install}>{pwa.install === 'available' ? '설치하기' : '설치 방법 보기'}</button></div><button className="text-button" onClick={() => document.querySelector<HTMLButtonElement>('.onboarding-go')?.focus()}>그냥 사용하기</button><p className="onboarding-foot">로그인 없이, 이 기기에만 저장해요.<br />휴대폰을 바꾸거나 사이트 데이터를 지우기 전 백업해주세요.</p>
      </div> : <>
        <div className="page-intro"><div><span className="eyebrow">MY DAY, MY CALENDAR</span><h1>나의 휴무 달력</h1><p>쉬는 날도, 바뀐 일정도 한곳에서.</p></div><button className={`group-pill group-${currentGroup}`} onClick={() => setPage('settings')}><span>{currentGroup}</span><div><b>{currentGroup} 휴무조</b><small>{GROUP_LABELS[currentGroup!]}</small></div><ChevronDown size={18} /></button></div>
        <div className="calendar-layout"><section className="calendar-card" aria-label="월간 달력"><div className="calendar-toolbar"><div className="month-navigation"><button className="icon-button" aria-label="이전 달" disabled={month === '1900-01'} onClick={() => moveMonth(-1)}><ChevronLeft /></button><button className="month-title" onClick={() => { setPickerYear(year); setPage('month'); }}>{year}년 {monthNum}월<ChevronDown size={18} /></button><button className="icon-button" aria-label="다음 달" disabled={month === '2199-12'} onClick={() => moveMonth(1)}><ChevronRight /></button></div><button className="today-button" onClick={() => setMonth(today.slice(0, 7))}>오늘</button></div>
          <div className="calendar-legend"><span><i className="dot off-dot" />휴무</span><span><i className="dot change-dot" />변경 일정</span><span className="legend-instruction">날짜를 눌러 기록하세요</span></div>
          <div className="calendar-grid" role="group" aria-label={`${year}년 ${monthNum}월`}>{weekdays.map((w, i) => <div key={w} className={`weekday ${i === 0 ? 'sunday' : i === 6 ? 'saturday' : ''}`}>{w}</div>)}{cells.map((date, index) => { if (!date) return <div key={`blank-${index}`} className="day empty" aria-hidden="true" />; const d = dayInfo(data, date); return <button key={date} className={`day ${d.state === 'off' ? 'off-day' : ''} ${d.change ? 'changed-day' : ''} ${date === today ? 'is-today' : ''}`} aria-label={`${date}, ${d.state === 'off' ? '휴무' : d.change ? '근무' : '기본 근무'}${d.change ? `, ${REASONS[d.change.reason]}` : ''}${d.note ? ', 메모 있음' : ''}`} onClick={() => setEditing(date)}><span className={`day-number ${index % 7 === 0 ? 'sunday' : index % 7 === 6 ? 'saturday' : ''}`}>{Number(date.slice(8))}{date === today && <small>오늘</small>}</span><span className="day-labels">{d.change ? <><span className={`event-label ${d.change.reason}`}>{d.change.reason === 'cover' ? '대바' : d.change.reason === 'transfer' ? '양도' : d.change.reason === 'exchange' ? '교환' : '변경'}{d.change.reason !== 'cover' && ` · ${d.state === 'off' ? '휴무' : '근무'}`}</span>{d.change.person && <span className="cell-person">{d.change.person}</span>}</> : d.state === 'off' ? <span className="event-label off">휴무</span> : null}{d.note && <span className="cell-note">· {d.note}</span>}</span></button>; })}</div>
          <div className="calendar-bottom"><span><b>{offCount}일</b>의 휴무가 있어요</span><span>일반 근무일은 비워두었어요</span></div>
        </section>
        <aside className="calendar-aside"><section className="next-rest"><div className="rest-header"><span className="eyebrow">YOUR NEXT BREAK</span><Sprout size={28} strokeWidth={1.4} /></div><p>{upcoming && upcoming.start <= today ? '지금은 쉬어가는 시간' : '다가오는 나의 휴무'}</p><h2>{upcoming ? <>{readableDate(upcoming.start)}<span>— {readableDate(upcoming.end)}</span></> : '휴무를 확인해주세요'}</h2><div className="rest-foot"><span>{currentGroup} 휴무조 · 변경 일정 반영</span><CalendarDays size={19} /></div></section>
          {data.groupChanges.some(c => c.date > today) && <button className="notice upcoming-group" onClick={() => setPage('settings')}>{[...data.groupChanges].filter(c => c.date > today).sort((a,b) => a.date.localeCompare(b.date)).slice(0, 1).map(c => <span key={c.id}>{readableDate(c.date)}부터 {c.group} 휴무조로 변경 예정</span>)}<ChevronRight size={18} /></button>}
          <section className="month-summary"><div className="section-heading"><h3>{monthNum}월의 기록</h3><span>{changedCount}개 변경</span></div><div className="agenda-list">{marked.length ? marked.slice(0, 5).map(d => <button key={d.date} className="agenda-item" onClick={() => setEditing(d.date)}><span className="agenda-date"><b>{Number(d.date.slice(8))}</b><small>{weekdays[new Date(`${d.date}T00:00:00Z`).getUTCDay()]}</small></span><span className="agenda-description"><strong>{d.change ? `${d.change.person ? d.change.person + ' ' : ''}${REASONS[d.change.reason]}${d.change.reason !== 'cover' ? ` · ${d.state === 'off' ? '휴무' : '근무'}` : ''}` : d.state === 'off' ? `${d.group} 휴무조 휴무` : '나의 메모'}</strong><small>{d.note || (d.change ? '변경한 나의 일정' : '편안한 하루 보내세요')}</small></span><ChevronRight size={16} /></button>) : <p className="muted">아직 기록이 없어요. 날짜를 눌러 추가하세요.</p>}</div>{marked.length > 5 && <p className="agenda-more">전체 {marked.length}일 · 달력에서 모두 확인할 수 있어요</p>}</section>
          <button className="quick-add" onClick={() => setEditing(month === today.slice(0, 7) ? today : dates[0])}><Plus size={19} />일정이나 메모 남기기<ArrowUpRight size={19} /></button>
        </aside></div>
        <section className="export-banner"><span className="export-icon"><ArrowDownToLine size={25} /></span><div><h3>익숙한 캘린더에서도 확인하세요</h3><p>지금 보고 있는 {year}년 {monthNum}월 일정을 파일로 복사해요.</p></div><button className="button primary" onClick={() => { setNotice(''); setError(''); setPage('export'); }}>이번 달 일정을 내 캘린더에 추가<ArrowUpRight size={18} /></button></section>
        <footer className="app-footer"><span><i className="dot off-dot" />{pwa.offlineReady ? '오프라인 사용 준비됨' : '이 기기에 기록 저장'} · 로그인 없이 나만의 달력</span><button className="text-button" onClick={() => setPage('install')}>{pwa.install === 'installed' ? '설치형 앱으로 사용 중' : '홈 화면에 설치하는 방법'}<ArrowUpRight size={15} /></button></footer>
      </>}
    </main>
    {editing && data && <DateEditor key={editing} data={data} date={editing} onSave={save} onClose={() => setEditing(null)} />}
    {page === 'settings' && data && <Settings data={data} onSave={save} onRestore={restore} onClose={() => setPage(null)} onPage={p => setPage(p)} />}
    {(page === 'help' || page === 'install' || page === 'share') && <Modal title={page === 'help' ? '사용설명서' : page === 'install' ? '홈 화면에서 바로 열기' : '앱 공유 / QR코드'} onClose={() => setPage(null)}>{page === 'share' ? <Share /> : <><Help section={page === 'install' ? 'install' : 'usage'} />{page === 'install' && pwa.install === 'available' && <button className="button primary full" onClick={install}><Smartphone size={20} />설치하기</button>}</>}</Modal>}
    {page === 'month' && <Modal title="원하는 달로 이동" onClose={() => setPage(null)}><div className="stack"><label>연도<input type="number" min="1900" max="2199" value={pickerYear} onChange={e => setPickerYear(Number(e.target.value))} /></label><div className="month-picker">{Array.from({ length: 12 }, (_, i) => <button key={i} className={`choice ${pickerYear === year && i + 1 === monthNum ? 'active' : ''}`} disabled={!Number.isInteger(pickerYear) || pickerYear < 1900 || pickerYear > 2199} onClick={() => { setMonth(`${pickerYear}-${String(i + 1).padStart(2, '0')}`); setPage(null); }}>{i + 1}월</button>)}</div><p className="muted">1900년부터 2199년까지 확인할 수 있어요.</p></div></Modal>}
    {page === 'export' && data && <Modal title={`${year}년 ${monthNum}월 캘린더에 추가`} onClose={() => { if (!fileBusy) { setPage(null); setError(''); } }}><div className="stack"><p>현재 보이는 달의 <b>{events.length}개 일정</b>을 복사합니다. 이름과 메모가 파일에 포함됩니다.</p><p className="notice">이후 변경사항은 자동 반영되지 않으며, 다시 추가하면 중복될 수 있습니다.</p><div className="export-preview">{events.map(e => <div key={e.date}><span>{readableDate(e.date)}</span><strong>{e.title}</strong></div>)}</div>{error && <p role="alert" className="error">{error}</p>}{notice && <p role="status" className="notice">{notice}</p>}{!events.length && <p>이 달에는 내보낼 일정이 없어요.</p>}<button className="button primary" disabled={fileBusy || !events.length} onClick={() => calendarFile(false)}><ArrowDownToLine size={19} />일정 파일 저장 (.ics)</button>{typeof navigator.share === 'function' && <button className="button" disabled={fileBusy || !events.length} onClick={() => calendarFile(true)}>일정 파일 공유</button>}<Help section="calendar" /></div></Modal>}
  </div>;
}
