import { useState } from 'react';
import { ChevronLeft, ChevronRight, LockKeyhole } from 'lucide-react';
import type { AppData, Group } from './types';
import { GROUPS, GROUP_NAMES, GROUP_SHORT } from './config';
import { dayInfo, groupOn, isBaseOff, monthDates, todayKorea } from './domain';
import Modal from './Modal';

export default function CompareCalendar({ data, initialMonth, onClose }: { data: AppData; initialMonth: string; onClose: () => void }) {
  const [month, setMonth] = useState(initialMonth);
  const [selected, setSelected] = useState<Group[]>([]);
  const ownGroup = groupOn(data, todayKorea());
  const [year, number] = month.split('-').map(Number);
  const dates = monthDates(year, number);
  const cells: (string | null)[] = [...Array(new Date(`${dates[0]}T00:00:00Z`).getUTCDay()).fill(null), ...dates];
  while (cells.length % 7) cells.push(null);
  function move(delta: number) {
    const next = new Date(Date.UTC(year, number - 1 + delta, 1));
    if (next.getUTCFullYear() >= 1900 && next.getUTCFullYear() <= 2199) setMonth(next.toISOString().slice(0, 7));
  }
  return <Modal title="다른 근무조 보기" wide onClose={onClose}>
    <div className="stack comparison">
      <p>내 휴무는 항상 녹색으로 표시해요. 함께 보고 싶은 근무 유형을 여러 개 선택하세요.</p>
      <div className="compare-options" aria-label="비교할 근무 유형">
        <button className="compare-choice own" aria-pressed="true" disabled><LockKeyhole size={15} />내 일정 · {GROUP_NAMES[ownGroup]} · 항상 표시</button>
        {GROUPS.filter(g => g !== ownGroup).map(g => { const index = selected.indexOf(g); return <button key={g} className={`compare-choice ${index >= 0 ? `comparison-color-${index}` : ''}`} aria-pressed={index >= 0} onClick={() => setSelected(current => current.includes(g) ? current.filter(v => v !== g) : [...current, g])}>{GROUP_NAMES[g]}</button>; })}
      </div>
      <p className="muted">내 일정은 유형 변경 이력과 개인 변경을 반영해요. 다른 유형은 기본 휴무일만 보여주며, 선택해도 내 설정이나 기록은 바뀌지 않아요.</p>
      <div className="compare-month"><button className="icon-button" aria-label="비교 이전 달" disabled={month === '1900-01'} onClick={() => move(-1)}><ChevronLeft /></button><label>비교할 달<input type="month" min="1900-01" max="2199-12" value={month} onChange={e => { if (/^(19\d{2}|20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/.test(e.target.value)) setMonth(e.target.value); }} /></label><button className="icon-button" aria-label="비교 다음 달" disabled={month === '2199-12'} onClick={() => move(1)}><ChevronRight /></button></div>
      <div className="compare-grid" role="group" aria-label={`${year}년 ${number}월 휴무 비교`}>
        {['일','월','화','수','목','금','토'].map(w => <div className="weekday" key={w}>{w}</div>)}
        {cells.map((date, i) => { if (!date) return <div className="compare-day empty" key={`empty-${i}`} />; const own = dayInfo(data, date); return <div className={`compare-day ${own.state === 'off' ? 'own-off' : ''}`} key={date} aria-label={`${date} 휴무 비교`}><b>{Number(date.slice(8))}</b>{own.state === 'off' && <span className="compare-tag own" title={`내 휴무 · ${GROUP_NAMES[own.group]}`}>나 · {GROUP_SHORT[own.group]}</span>}{selected.map((g,index) => isBaseOff(date,g) ? <span key={g} className={`compare-tag comparison-color-${index}`} title={`${GROUP_NAMES[g]} 휴무`}>{GROUP_SHORT[g]}</span> : null)}</div>; })}
      </div>
      <button className="button" onClick={onClose}>내 달력으로 돌아가기</button>
    </div>
  </Modal>;
}
