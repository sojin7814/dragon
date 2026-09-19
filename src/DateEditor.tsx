import { useState } from 'react';
import { ArrowRight, Check, CalendarDays } from 'lucide-react';
import type { AppData, DayChange, Reason, WorkState } from './types';
import { dayInfo, addDays, saveChange, saveExchange, cancelChange } from './domain';
import Modal from './Modal';

export const REASONS: Record<Reason, string> = { transfer: '휴무 양도', exchange: '휴무 교환', cover: '대바', manual: '직접 변경' };
export const stateLabel = (state: WorkState) => state === 'off' ? '휴무' : '근무';
export const readableDate = (date: string) => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일`;
type Props = { data: AppData; date: string; onSave: (data: AppData) => Promise<void>; onClose: () => void };
export default function DateEditor({ data, date, onSave, onClose }: Props) {
  const info = dayInfo(data, date), existing = info.change;
  const [reason, setReason] = useState<Reason | 'note'>(existing?.reason || 'note');
  const [actual, setActual] = useState<WorkState | ''>(existing?.state || '');
  const [person, setPerson] = useState(existing?.person || '');
  const [memo, setMemo] = useState([info.note, existing?.memo && !info.note.includes(existing.memo) ? existing.memo : ''].filter(Boolean).join('\n'));
  const [partner, setPartner] = useState(existing?.partnerDate || addDays(date, 1));
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<AppData | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const close = () => { if (!busy && (!dirty || window.confirm('저장하지 않은 입력이 있어요. 닫을까요?'))) onClose(); };
  function plan(cancel = false) {
    setError('');
    try {
      let next = structuredClone(data);
      if (memo.trim()) next.notes[date] = memo.trim(); else delete next.notes[date];
      if (next.changes[date]) next.changes[date].memo = '';
      if (cancel) { next = cancelChange(next, date); setPreview(next); return; }
      if (reason !== 'note') {
        if (!actual && reason !== 'cover') throw new Error('그날 실제로 근무하는지, 쉬는지 골라주세요.');
        const change: DayChange = { id: existing?.id || crypto.randomUUID(), date, reason, state: reason === 'cover' ? 'work' : actual as WorkState, person: person.trim(), memo: '' };
        if (reason === 'exchange') {
          if (!partner || partner === date) throw new Error('교환할 다른 날짜를 선택해주세요.');
          const exchangeId = existing?.exchangeId || crypto.randomUUID();
          const previousPartner = existing?.partnerDate ? data.changes[existing.partnerDate] : undefined;
          const other: DayChange = { id: previousPartner?.date === partner ? previousPartner.id : crypto.randomUUID(), date: partner, reason: 'exchange', state: change.state === 'off' ? 'work' : 'off', person: change.person, memo: previousPartner?.date === partner ? previousPartner.memo : '', exchangeId, partnerDate: date };
          next = saveExchange(next, { ...change, exchangeId, partnerDate: partner }, other);
        } else next = saveChange(next, change);
      }
      setPreview(next);
    } catch (e) { setError((e as Error).message); }
  }
  async function commit() {
    if (!preview) return;
    setBusy(true); setError('');
    try { await onSave(preview); onClose(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const summary = preview ? dayInfo(preview, date) : null;
  return <Modal title={`${date.slice(0, 4)}년 ${readableDate(date)}`} onClose={close}>
    <div className="stack">
      <div className="day-origin"><CalendarDays size={21} /><div><span className="eyebrow">원래 일정 · {info.group} 휴무조</span><strong>{info.baseState === 'off' ? '기본 휴무일' : '기본 근무일'}</strong></div><span className="muted">실제 배정과 별개</span></div>
      {preview && summary ? <>
        <h3>저장할 내용을 확인해주세요</h3>
        <div className="confirmation"><strong>{readableDate(date)} · {stateLabel(summary.state)}</strong><p>{summary.change ? REASONS[summary.change.reason] : '기본 일정'}{summary.change?.person && ` · ${summary.change.person}`}</p>{summary.note && <p className="preserve">{summary.note}</p>}</div>
        {summary.change?.partnerDate && <div className="confirmation"><strong>{readableDate(summary.change.partnerDate)} · {stateLabel(dayInfo(preview, summary.change.partnerDate).state)}</strong><p>두 날짜를 함께 저장합니다.</p></div>}
        {existing?.exchangeId && (!summary.change?.exchangeId || summary.change.partnerDate !== existing.partnerDate) && <p className="notice">기존 교환일 {existing.partnerDate}도 원래 일정으로 돌아갑니다. 각 날짜의 메모는 유지됩니다.</p>}
        <p className="muted">내 개인 기록에만 적용됩니다. 상대방의 일정은 바뀌지 않습니다.</p>
        {error && <p role="alert" className="error">{error}</p>}
        <div className="row"><button className="button" disabled={busy} onClick={() => setPreview(null)}>다시 수정</button><button className="button primary" disabled={busy} onClick={commit}><Check size={19} />{busy ? '저장 중…' : '확인하고 저장'}</button></div>
      </> : <form className="stack" onSubmit={e => { e.preventDefault(); plan(); }} onChange={() => setDirty(true)}>
        <fieldset><legend>어떤 기록을 남길까요?</legend><div className="reason-grid">{(['note', 'transfer', 'exchange', 'cover', 'manual'] as const).map(r => <button type="button" key={r} className={`choice ${reason === r ? 'active' : ''}`} aria-pressed={reason === r} disabled={Boolean(existing?.exchangeId && r !== 'exchange' && r !== 'note')} onClick={() => { setReason(r); setDirty(true); if (r === 'cover') setActual('work'); }}>{r === 'note' ? '메모만' : REASONS[r]}</button>)}</div></fieldset>
        {existing?.exchangeId && <p className="notice">연결된 교환을 다른 종류로 바꾸려면 아래 ‘변경 취소’를 먼저 해주세요.</p>}
        {reason !== 'note' && <>
          <fieldset><legend>그날 나는</legend>{reason === 'cover' ? <div className="notice">대바 · 다른 사람 대신 근무합니다.</div> : <div className="row">{(['work', 'off'] as const).map(s => <button type="button" key={s} className={`choice flex ${actual === s ? 'active' : ''}`} aria-pressed={actual === s} onClick={() => { setActual(s); setDirty(true); }}>{stateLabel(s)}{actual === s && <Check size={17} />}</button>)}</div>}</fieldset>
          {reason === 'transfer' && <p className="muted">양도라는 이유와 실제 일정을 구분해서 기록해요.</p>}
          {reason === 'exchange' && <><label>교환할 날짜<input type="date" min="1900-01-01" max="2199-12-31" required value={partner} onChange={e => setPartner(e.target.value)} /></label>{actual && partner && <div className="exchange-preview"><span>{readableDate(date)}<b>{stateLabel(actual)}</b></span><ArrowRight size={20} /><span>{readableDate(partner)}<b>{actual === 'off' ? '근무' : '휴무'}</b></span></div>}{data.changes[partner] && data.changes[partner].exchangeId !== existing?.exchangeId && <p className="error">상대 날짜에 기존 변경이 있어요. 해당 기록을 먼저 확인해주세요.</p>}</>}
          <label>{reason === 'cover' ? '누구의 대바인가요?' : '상대방 이름'} <span className="muted">선택</span><input maxLength={80} placeholder="이름을 입력해주세요" value={person} onChange={e => setPerson(e.target.value)} /></label>
        </>}
        <label>메모 <span className="muted">선택</span><textarea rows={3} maxLength={4000} placeholder="기억할 내용을 남겨주세요" value={memo} onChange={e => setMemo(e.target.value)} /></label>
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" className="button primary">내용 확인 <ArrowRight size={18} /></button>
        {existing && <button type="button" className="button danger subtle" onClick={() => plan(true)}>변경 취소 · {existing.exchangeId ? '연결된 두 날짜를 원래대로' : '원래 일정으로'}</button>}
      </form>}
    </div>
  </Modal>;
}
