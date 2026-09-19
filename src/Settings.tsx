import { useState } from 'react';
import { ArrowRight, Download, Upload, BookOpen, Smartphone, Share2, Moon, Sun, Monitor, Pencil, Trash2 } from 'lucide-react';
import type { AppData, Group, GroupChange, Theme } from './types';
import { GROUPS, GROUP_LABELS, BUILD_ID, ANCHOR, ANCHOR_CONFIRMED_ON } from './config';
import { groupOn, todayKorea, saveGroupChange, removeGroupChange, dayInfo } from './domain';
import { makeBackup, parseBackup, readSafetyCopy } from './storage';
import { downloadFile } from './files';
import Modal from './Modal';
import { readableDate } from './DateEditor';

type Props = { data: AppData; onSave: (data: AppData) => Promise<void>; onRestore: (data: AppData) => Promise<void>; onClose: () => void; onPage: (page: 'help' | 'install' | 'share') => void };
export default function Settings({ data, onSave, onRestore, onClose, onPage }: Props) {
  const [draft, setDraft] = useState<GroupChange | null>(null);
  const [preview, setPreview] = useState<AppData | null>(null);
  const [restore, setRestore] = useState<AppData | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [group, setGroup] = useState<Group>(groupOn(data, todayKorea()));
  const [date, setDate] = useState(todayKorea());
  const close = () => { if (!busy && (!draft || window.confirm('휴무조 변경 입력을 닫을까요?'))) onClose(); };
  async function save(next: AppData) {
    setError(''); setBusy(true);
    try { await onSave(next); setDraft(null); setPreview(null); setNotice('저장했습니다.'); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function previewGroup() {
    setError('');
    try { setPreview(saveGroupChange(data, { id: draft!.id, date, group })); } catch (e) { setError((e as Error).message); }
  }
  function startGroup(change?: GroupChange) {
    const value = change || { id: crypto.randomUUID(), date: todayKorea(), group: groupOn(data, todayKorea()) };
    setDraft(value); setDate(value.date); setGroup(value.group); setPreview(null); setError('');
  }
  function goPage(page: 'help' | 'install' | 'share') { if (!busy && (!draft || window.confirm('저장하지 않은 조 변경 입력이 있어요. 안내로 이동할까요?'))) onPage(page); }
  const affected = preview ? Object.keys(data.changes).filter(d => dayInfo(data, d).baseState !== dayInfo(preview, d).baseState) : [];
  return <Modal title="설정" onClose={close}>
    <div className="stack settings">
      {error && <p role="alert" className="error">{error}</p>}{notice && <p role="status" className="notice">{notice}</p>}
      <section><span className="eyebrow">MY GROUP</span><h3>내 휴무조</h3><div className="group-current"><strong>{groupOn(data, todayKorea())} 휴무조</strong><span>{GROUP_LABELS[groupOn(data, todayKorea())]}</span></div><p className="muted">처음 선택한 {data.initialGroup}조를 기본으로, 적용일마다 조가 바뀝니다. 초기 선택 이전의 실제 소속을 뜻하지 않습니다.</p>
        {!draft && <button className="button full" onClick={() => startGroup()}>휴무조 변경 예약 <ArrowRight size={18} /></button>}
        {draft && <div className="stack inset"><h4>{data.groupChanges.some(c => c.id === draft.id) ? '조 변경 이력 수정' : '새 휴무조와 시작일'}</h4><label>새 휴무조<select aria-label="새 휴무조" value={group} onChange={e => { setGroup(e.target.value as Group); setPreview(null); }}>{GROUPS.map(g => <option key={g} value={g}>{g} 휴무조 · {GROUP_LABELS[g]}</option>)}</select></label><label>적용 시작일<input type="date" min="1900-01-01" max="2199-12-31" value={date} onChange={e => { setDate(e.target.value); setPreview(null); }} /></label>
          {!preview ? <div className="row"><button className="button" onClick={() => setDraft(null)}>취소</button><button className="button primary" onClick={previewGroup}>변경 내용 확인</button></div> : <><p className="notice">{date}부터 {group} 휴무조의 공통 순환을 적용합니다. 다음 조 변경일까지 영향을 주며, 대바·교환·메모는 그대로 남습니다.</p>{affected.length > 0 && <div className="notice"><b>기존 기록 {affected.length}일의 원래 일정이 달라집니다.</b><ul>{affected.map(d => <li key={d}>{d} · 실제 {dayInfo(preview, d).state === 'off' ? '휴무' : '근무'} 기록 유지</li>)}</ul></div>}<button className="button primary" disabled={busy} onClick={() => save(preview)}>확인하고 저장</button></>}
        </div>}
        {data.groupChanges.length > 0 && <div className="history"><h4>휴무조 변경 이력</h4>{[...data.groupChanges].sort((a, b) => a.date.localeCompare(b.date)).map(c => <div className="history-row" key={c.id}><div><strong>{c.group} 휴무조</strong><span>{c.date}부터 {c.date > todayKorea() ? '· 예정' : '· 적용'}</span></div><button className="icon-button" aria-label={`${c.date} 조 변경 수정`} onClick={() => startGroup(c)}><Pencil size={18} /></button><button className="icon-button danger" aria-label={`${c.date} 조 변경 취소`} onClick={() => { if (window.confirm(`${c.date}부터 다음 변경일 전까지 이전 조의 순환으로 돌아갑니다. 개별 변경과 메모는 유지됩니다. 취소할까요?`)) { try { const next = removeGroupChange(data, c.id); const impacted = Object.keys(data.changes).filter(d => dayInfo(data, d).baseState !== dayInfo(next, d).baseState); if (impacted.length && !window.confirm(`원래 일정이 바뀌는 기존 기록: ${impacted.join(', ')}. 실제 변경 기록은 유지됩니다. 계속할까요?`)) return; void save(next); } catch (e) { setError((e as Error).message); } } }}><Trash2 size={18} /></button></div>)}</div>}
      </section>
      <section><h3>화면 모드</h3><div className="theme-options">{([['light', '밝게', Sun], ['dark', '어둡게', Moon], ['system', '기기 설정', Monitor]] as const).map(([value, label, Icon]) => <button key={value} className={`choice ${data.theme === value ? 'active' : ''}`} disabled={busy} aria-pressed={data.theme === value} onClick={() => save({ ...data, theme: value as Theme })}><Icon size={19} />{label}</button>)}</div></section>
      <section className="stack small-gap"><button className="menu-button" onClick={() => goPage('install')}><Smartphone size={21} /><span>설치 방법</span><ArrowRight size={18} /></button><button className="menu-button" onClick={() => goPage('share')}><Share2 size={21} /><span>앱 공유 / QR코드</span><ArrowRight size={18} /></button><button className="menu-button" onClick={() => goPage('help')}><BookOpen size={21} /><span>사용설명서</span><ArrowRight size={18} /></button></section>
      <section className="data-management"><h3>데이터 관리</h3><p>설정과 기록은 이 기기의 브라우저에 저장됩니다. 휴대폰을 바꾸거나 사이트 데이터를 지우기 전 백업해주세요.</p><div className="row"><button className="button flex" onClick={() => { try { downloadFile(makeBackup(data), `드래곤휴무-${todayKorea()}.backup.json`, 'application/json'); setNotice('백업 파일을 만들었습니다. 파일이 저장됐는지 확인해주세요.'); } catch (e) { setError((e as Error).message); } }}><Download size={19} />백업하기</button><label className="button flex file-button"><Upload size={19} />백업 불러오기<input type="file" accept=".json,application/json" onChange={async e => { setError(''); const file = e.target.files?.[0]; if (!file) return; setBusy(true); try { if (file.size > 5_000_000) throw new Error('백업 파일이 너무 큽니다. 5MB 이하 파일을 선택해주세요.'); setRestore(parseBackup(await file.text())); } catch (error) { setError((error as Error).message); } finally { e.target.value = ''; setBusy(false); } }} /></label></div>
        {restore && <div className="stack inset"><h4>백업을 확인했습니다</h4><p>{restore.initialGroup} 기본조 · 변경 일정 {Object.keys(restore.changes).length}개 · 메모 {Object.keys(restore.notes).length}개 · 조 이동 {restore.groupChanges.length}개</p><p className="notice">이 기기의 현재 기록을 백업 내용으로 대체합니다. 복원 직전 기록은 기기에 안전 복사본으로 남깁니다. 외부 백업도 보관해주세요.</p><div className="row"><button className="button" onClick={() => setRestore(null)}>취소</button><button className="button primary" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await onRestore(restore); setRestore(null); setNotice('복원했습니다. 달력에서 내용을 확인해주세요.'); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>현재 기록 대체</button></div></div>}
        {readSafetyCopy() && <button className="button full" onClick={() => { const copy = readSafetyCopy(); if (!copy) return; try { downloadFile(makeBackup(JSON.parse(copy)), `드래곤휴무-복원전-${todayKorea()}.backup.json`, 'application/json'); setNotice('복원 전 기록 파일을 만들었습니다. 파일 저장을 확인해주세요.'); } catch { downloadFile(copy, `드래곤휴무-복구원본-${todayKorea()}.json`, 'application/json'); setNotice('복원 전 원본 파일을 저장했습니다. 손상된 원본은 수동 복구가 필요합니다.'); } }}>복원 전 기록 파일 저장</button>}
        <p className="muted">휴대폰과 PC의 기록은 자동으로 동기화되지 않습니다. 캘린더 일정 파일(.ics)은 백업 파일이 아닙니다.</p>
      </section>
      <p className="version">드래곤 휴무 · 최종 아이콘<br />버전 {BUILD_ID}<br />순환 기준 A 첫 휴무 {ANCHOR} · {ANCHOR_CONFIRMED_ON} 현행 확인<br />개인용 도구 · 회사 공식 서비스가 아닙니다.</p>
    </div>
  </Modal>;
}
