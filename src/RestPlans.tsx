import { useState } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import type { AppData } from './types';
import { addDays, validateData } from './domain';
import { readableDate } from './DateEditor';
import Modal from './Modal';

type Props = { data: AppData; start: string; end: string; onSave: (data: AppData) => Promise<void>; onClose: () => void };
export default function RestPlans({ data, start, end, onSave, onClose }: Props) {
  const [date, setDate] = useState(start);
  const [memo, setMemo] = useState(data.notes[start] || '');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dates: string[] = [];
  for (let day = start; day <= end && dates.length < 14; day = addDays(day, 1)) dates.push(day);
  function selectDate(value: string) {
    if (value === date || busy || value < start || value > end || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    if (dirty && !window.confirm('저장하지 않은 계획이 있어요. 입력을 버리고 다른 날짜를 열까요?')) return;
    setDate(value); setMemo(data.notes[value] || ''); setDirty(false); setNotice(''); setError('');
  }
  async function save(remove = false) {
    setBusy(true); setError(''); setNotice('');
    try {
      const next = validateData(data);
      if (remove || !memo.trim()) delete next.notes[date]; else next.notes[date] = memo.trim();
      await onSave(next);
      setMemo(remove ? '' : memo.trim()); setDirty(false);
      setNotice(remove ? '이 날짜의 메모·휴무 계획을 삭제했어요.' : '저장했어요. 다른 휴무일도 선택해 계획을 남겨보세요.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <Modal title="휴무 계획" onClose={() => { if (!busy && (!dirty || window.confirm('저장하지 않은 계획이 있어요. 닫을까요?'))) onClose(); }}>
    <div className="stack">
      <h3>이 날 휴무 계획은 무엇인가요?</h3>
      <p className="muted">날짜마다 따로 남길 수 있어요. 기존 날짜 메모와 같은 기록이며, 백업에도 함께 담겨요.</p>
      <div className="rest-date-list" aria-label="계획을 적을 휴무일">{dates.map(d => <button key={d} className={`choice ${d === date ? 'active' : ''}`} aria-pressed={d === date} disabled={busy} onClick={() => selectDate(d)}>{readableDate(d)}{data.notes[d] && <Check size={14} aria-label="메모 있음" />}</button>)}</div>
      <div className="plan-date-navigation"><button className="icon-button" aria-label="이전 휴무일" disabled={busy || date === start} onClick={() => selectDate(addDays(date, -1))}><ChevronLeft /></button><label>계획 날짜<input type="date" min={start} max={end} value={date} disabled={busy} onChange={e => selectDate(e.target.value)} /></label><button className="icon-button" aria-label="다음 휴무일" disabled={busy || date === end} onClick={() => selectDate(addDays(date, 1))}><ChevronRight /></button></div>
      <label>{readableDate(date)}의 메모 · 휴무 계획<textarea rows={5} maxLength={100000} disabled={busy} placeholder="병원, 부모님댁, 골프, 서울 약속, 푹 쉬기…" value={memo} onChange={e => { setMemo(e.target.value); setDirty(true); setNotice(''); }} /></label>
      {error && <p className="error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
      <button className="button primary" disabled={busy} onClick={() => save()}>이 날짜 계획 저장</button>
      {data.notes[date] && <button className="button subtle danger" disabled={busy} onClick={() => { if (window.confirm('이 날짜의 메모·휴무 계획을 삭제할까요? 근무 상태와 다른 날짜의 기록은 유지돼요.')) void save(true); }}>이 날짜 계획 삭제</button>}
    </div>
  </Modal>;
}
