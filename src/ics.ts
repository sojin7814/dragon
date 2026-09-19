import { APP_NAME, GROUP_NAMES } from './config';
import { addDays, dayInfo, monthDates, validateData } from './domain';
import type { AppData } from './types';

export interface CalendarEvent { date: string; title: string; description: string; uid: string }
const REASONS = { transfer: '양도', exchange: '교환', cover: '대바', manual: '직접 수정' };
export function exportEvents(data: AppData, year: number, month1: number): CalendarEvent[] {
  const checked = validateData(data);
  return monthDates(year, month1).flatMap(date => {
    const info = dayInfo(checked, date);
    if (info.state !== 'off' && !info.change && !info.note) return [];
    const actual = info.state === 'off' ? '휴무' : '근무';
    let title = `${GROUP_NAMES[info.group]} · ${actual}`;
    if (info.change) {
      const who = info.change.person ? `${info.change.person} ` : '';
      title = info.change.reason === 'cover' ? `${who}대바 · 근무` : `${actual} · ${who}${REASONS[info.change.reason]}`;
    } else if (info.note && info.state === 'work') title = '메모 · 기본 근무';
    const description = [
      `${APP_NAME}에서 복사한 일정`,
      `근무 유형: ${GROUP_NAMES[info.group]}`,
      `원래 일정: ${info.baseState === 'off' ? '휴무' : '기본 근무'}`,
      `실제 일정: ${actual}`,
      info.change ? `변경 이유: ${REASONS[info.change.reason]}` : '',
      info.change?.person ? `상대방: ${info.change.person}` : '',
      info.change?.partnerDate ? `교환 날짜: ${info.change.partnerDate}` : '',
      info.change?.memo ? `변경 메모: ${info.change.memo}` : '',
      info.note ? `날짜 메모: ${info.note}` : '',
      '이후 앱의 변경사항은 자동 반영되지 않습니다.',
    ].filter(Boolean).join('\n');
    return [{ date, title, description, uid: `${checked.calendarId}-${date}@dragon-calendar.local` }];
  });
}
function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}
/** RFC 5545 section 3.1: fold at 75 UTF-8 octets without splitting code points. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  let result = ''; let bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).byteLength;
    if (bytes + size > 75) { result += '\r\n '; bytes = 1; }
    result += character; bytes += size;
  }
  return result;
}
export function createICS(data: AppData, year: number, month1: number): string {
  const events = exportEvents(data, year, month1);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dragon Calendar//Personal Calendar 1.0//KO', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${escapeText(`${APP_NAME} ${year}년 ${month1}월`)}`];
  for (const event of events) lines.push(
    'BEGIN:VEVENT', `UID:${event.uid}`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${event.date.replace(/-/g, '')}`,
    `DTEND;VALUE=DATE:${addDays(event.date, 1).replace(/-/g, '')}`,
    `SUMMARY:${escapeText(event.title)}`, `DESCRIPTION:${escapeText(event.description)}`,
    `SEQUENCE:${data.revision}`, 'TRANSP:TRANSPARENT', 'END:VEVENT',
  );
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
