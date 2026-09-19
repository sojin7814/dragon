import { describe, expect, it } from 'vitest';
import ICAL from 'ical.js';
import { newData, saveChange, saveExchange, saveGroupChange } from '../src/domain';
import { createICS, exportEvents } from '../src/ics';
import { makeBackup, parseBackup } from '../src/storage';
import type { DayChange } from '../src/types';

const change = (date: string, extra: Partial<DayChange> = {}): DayChange => ({ id: `day-${date}`, date, state: 'work', reason: 'manual', person: '', memo: '', ...extra });
const unfold = (ics: string) => ics.replace(/\r\n[ \t]/g, '');

describe('monthly export reflects actual personal schedule', () => {
  it('exports precisely the displayed month, including only the in-month half of boundary rest', () => {
    const data = newData('A');
    expect(exportEvents(data, 2026, 2).map(event => event.date)).toEqual(['2026-02-04', '2026-02-05', '2026-02-12', '2026-02-13', '2026-02-20', '2026-02-21', '2026-02-28']);
    const march = exportEvents(data, 2026, 3);
    expect(march[0].date).toBe('2026-03-01');
    expect(march.every(event => event.date.startsWith('2026-03-'))).toBe(true);
    expect(exportEvents(data, 2028, 5).every(event => event.date.startsWith('2028-05-'))).toBe(true);
  });
  it('does not call a transferred rest day a holiday when actual state is work', () => {
    const data = saveChange(newData('A'), change('2026-02-28', { reason: 'transfer', person: '강하늘', memo: '서로 확인했어요' }));
    const event = exportEvents(data, 2026, 2).find(event => event.date === '2026-02-28')!;
    expect(event.title).toBe('근무 · 강하늘 양도');
    expect(event.description).toContain('원래 일정: 휴무');
    expect(event.description).toContain('실제 일정: 근무');
    expect(event.description).toContain('서로 확인했어요');
    expect(event.title).not.toContain('휴무');
  });
  it('includes the counterpart name for cover and omits ordinary work days', () => {
    const data = saveChange(newData('A'), change('2026-02-02', { reason: 'cover', person: '김민수' }));
    const events = exportEvents(data, 2026, 2);
    expect(events.find(event => event.date === '2026-02-02')?.title).toBe('김민수 대바 · 근무');
    expect(events.find(event => event.date === '2026-02-03')).toBeUndefined();
  });
  it('retains a note-only work day and both actual states of a cross-month exchange', () => {
    const original = newData('A');
    original.notes['2026-03-03'] = '병원 방문';
    const data = saveExchange(original,
      change('2026-02-28', { reason: 'exchange', exchangeId: 'exchange-a', partnerDate: '2026-03-02', state: 'work' }),
      change('2026-03-02', { reason: 'exchange', exchangeId: 'exchange-a', partnerDate: '2026-02-28', state: 'off' }),
    );
    expect(exportEvents(data, 2026, 2).find(event => event.date === '2026-02-28')?.title).toBe('근무 · 교환');
    expect(exportEvents(data, 2026, 3).find(event => event.date === '2026-03-02')?.title).toBe('휴무 · 교환');
    expect(exportEvents(data, 2026, 3).find(event => event.date === '2026-03-03')).toMatchObject({ title: '메모 · 기본 근무', description: expect.stringContaining('병원 방문') });
  });
  it('keeps UIDs across edits, group history, and backup restore; other personal calendars differ', () => {
    const data = newData('A');
    const original = exportEvents(data, 2026, 2).find(event => event.date === '2026-02-28')!;
    const updated = saveGroupChange(saveChange(data, change('2026-02-28', { person: '편집한 이름' })), { id: 'group-a', date: '2026-02-01', group: 'D' });
    const restored = parseBackup(makeBackup(updated));
    expect(exportEvents(restored, 2026, 2).find(event => event.date === '2026-02-28')?.uid).toBe(original.uid);
    expect(exportEvents(newData('A'), 2026, 2).find(event => event.date === '2026-02-28')?.uid).not.toBe(original.uid);
  });
});

describe('RFC 5545 all-day file invariants', () => {
  it('roundtrips through the independent ical.js parser with Korean and multiline text intact', () => {
    const person = '김,이;박\\님';
    const memo = '첫 줄;쉼표,역슬래시\\\n' + '긴 한글 메모와 이모지🌿'.repeat(60);
    const data = saveChange(newData('A'), change('2026-12-31', { reason: 'cover', person, memo }));
    const calendar = new ICAL.Component(ICAL.parse(createICS(data, 2026, 12)));
    expect(calendar.name).toBe('vcalendar');
    expect(calendar.getFirstPropertyValue('version')).toBe('2.0');
    const parsed = calendar.getAllSubcomponents('vevent').map(component => new ICAL.Event(component));
    expect(parsed).toHaveLength(exportEvents(data, 2026, 12).length);
    const event = parsed.find(item => item.startDate.toString() === '2026-12-31')!;
    expect(event.startDate.isDate).toBe(true);
    expect(event.endDate.isDate).toBe(true);
    expect(event.endDate.toString()).toBe('2027-01-01');
    expect(event.summary).toBe(`${person} 대바 · 근무`);
    expect(event.description).toContain(memo);
    expect(event.uid).toBe(exportEvents(data, 2026, 12).find(item => item.date === '2026-12-31')?.uid);
    expect(event.duration.toSeconds()).toBe(86_400);
  });
  it('uses required headers, stamps and exclusive next-day ends at month and year boundaries', () => {
    let data = newData('A');
    data = saveChange(data, change('2026-12-31', { state: 'off' }));
    const ics = unfold(createICS(data, 2026, 12));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z\r\n/);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101\r\n');
    const february = unfold(createICS(newData('A'), 2026, 2));
    expect(february).toContain('DTSTART;VALUE=DATE:20260228\r\nDTEND;VALUE=DATE:20260301\r\n');
    expect(february).not.toContain('DTSTART;VALUE=DATE:20260301');
    const boundary = saveChange(newData('A'), change('2199-12-31', { state: 'off' }));
    expect(unfold(createICS(boundary, 2199, 12))).toContain('DTEND;VALUE=DATE:22000101');
  });
  it('escapes Korean names, delimiters, backslashes, multiline notes, and injected property lines', () => {
    const data = saveChange(newData('A'), change('2026-02-28', { person: '김,이;박\\님', memo: '한글 첫줄\r\n둘째줄\r셋째줄\nBEGIN:VEVENT\nSUMMARY:가짜' }));
    const ics = unfold(createICS(data, 2026, 2));
    expect(ics).toContain('SUMMARY:근무 · 김\\,이\\;박\\\\님 직접 수정\r\n');
    expect(ics).toContain('한글 첫줄\\n둘째줄\\n셋째줄\\nBEGIN:VEVENT\\nSUMMARY:가짜');
    expect(ics.split('\r\n').filter(line => line === 'BEGIN:VEVENT')).toHaveLength(7);
    expect(ics.split('\r\n').filter(line => line === 'SUMMARY:가짜')).toHaveLength(0);
  });
  it('folds every physical line to at most 75 UTF-8 bytes without corrupting Korean or emoji', () => {
    const long = '한글이름과메모🌿'.repeat(150);
    const data = newData('A'); data.notes['2026-02-28'] = long;
    const ics = createICS(data, 2026, 2);
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics).toContain('\r\n ');
    expect(unfold(ics)).toContain(long);
    expect(ics).not.toContain('\uFFFD');
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });
  it('produces a valid empty calendar when the month has no rest or recorded changes', () => {
    // All daily changes are still meaningful events, so verify a no-event month by a group history
    // that selects a working group each day without recording a daily exception.
    let data = newData('A');
    for (let day = 1; day <= 28; day++) {
      const date = `2026-02-${String(day).padStart(2, '0')}`;
      const baseline = exportEvents(newData('A'), 2026, 2).some(event => event.date === date);
      data = saveGroupChange(data, { id: `group-${day}`, date, group: baseline ? 'B' : 'A' });
    }
    expect(exportEvents(data, 2026, 2)).toEqual([]);
    expect(createICS(data, 2026, 2)).not.toContain('BEGIN:VEVENT');
    expect(createICS(data, 2026, 2)).toContain('END:VCALENDAR\r\n');
  });
});
