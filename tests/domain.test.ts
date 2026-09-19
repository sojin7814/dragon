import { afterEach, describe, expect, it, vi } from 'vitest';
import { addDays, cancelChange, dayInfo, groupOn, isBaseOff, monthDates, newData, nextOff, removeGroupChange, saveChange, saveExchange, saveGroupChange, todayKorea, validateData } from '../src/domain';
import type { AppData, DayChange } from '../src/types';

const change = (date: string, overrides: Partial<DayChange> = {}): DayChange => ({ id: `day-${date}`, date, state: 'work', reason: 'manual', person: '', memo: '', ...overrides });
const pair = (a = '2026-02-28', b = '2026-03-02'): [DayChange, DayChange] => [
  change(a, { reason: 'exchange', state: 'work', exchangeId: 'pair-one', partnerDate: b, person: '홍길동' }),
  change(b, { reason: 'exchange', state: 'off', exchangeId: 'pair-one', partnerDate: a, person: '홍길동' }),
];
afterEach(() => vi.useRealTimers());

describe('captured A calendar expectations, independently enumerated', () => {
  it.each([
    [2025, 12, [2, 3, 10, 11, 18, 19, 26, 27]],
    [2026, 1, [3, 4, 11, 12, 19, 20, 27, 28]],
    [2026, 2, [4, 5, 12, 13, 20, 21, 28]],
    [2026, 3, [1, 8, 9, 16, 17, 24, 25]],
    [2026, 4, [1, 2, 9, 10, 17, 18, 25, 26]],
  ] as const)('%s-%s matches every day', (year, month, expected) => {
    expect(monthDates(year, month).filter(date => isBaseOff(date, 'A')).map(date => Number(date.slice(-2)))).toEqual(expected);
  });
  it.each([
    ['B', [4, 5, 12, 13, 20, 21, 28, 29]],
    ['C', [6, 7, 14, 15, 22, 23, 30, 31]],
    ['D', [1, 8, 9, 16, 17, 24, 25]],
  ] as const)('%s starts two days after the previous group', (selected, expected) => {
    expect(monthDates(2025, 12).filter(date => isBaseOff(date, selected)).map(date => Number(date.slice(-2)))).toEqual(expected);
  });
  it('calculates before the anchor without negative-modulo errors', () => {
    expect(isBaseOff('2025-11-24', 'A')).toBe(true);
    expect(isBaseOff('2025-11-25', 'A')).toBe(true);
    expect(isBaseOff('2025-11-26', 'A')).toBe(false);
    expect(isBaseOff('2025-11-30', 'D')).toBe(true);
  });
});

describe('civil dates and next actual rest period', () => {
  it('handles leap days, year boundaries and exclusive end dates', () => {
    expect(monthDates(2024, 2)).toHaveLength(29);
    expect(monthDates(2100, 2)).toHaveLength(28);
    expect(monthDates(2000, 2)).toHaveLength(29);
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2025-03-09', 1)).toBe('2025-03-10');
    expect(addDays('2199-12-31', 1)).toBe('2200-01-01');
  });
  it.each(['2026-02-29', '2025-04-31', '2025-13-01', '2025-00-02', '2025-1-01', '1899-12-31', '2200-01-01'])('rejects invalid or unsupported input %s', value => {
    expect(() => dayInfo(newData('A'), value)).toThrow();
  });
  it('uses Korean today across UTC midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-19T14:59:59Z'));
    expect(todayKorea()).toBe('2026-09-19');
    vi.setSystemTime(new Date('2026-09-19T15:00:00Z'));
    expect(todayKorea()).toBe('2026-09-20');
  });
  it('shows both days while resting on the second day, across months', () => {
    expect(nextOff(newData('A'), '2026-03-01')).toEqual({ start: '2026-02-28', end: '2026-03-01' });
  });
  it('incorporates an overridden day without shifting the repeating cycle', () => {
    const data = saveChange(newData('A'), change('2026-02-28'));
    expect(nextOff(data, '2026-02-28')).toEqual({ start: '2026-03-01', end: '2026-03-01' });
    expect(dayInfo(data, '2026-03-08').state).toBe('off');
    expect(dayInfo(data, '2026-03-09').state).toBe('off');
  });
});

describe('changes, exchange integrity, and cancellation', () => {
  it('separates the original day, actual state and transfer reason', () => {
    const base = newData('A');
    const work = saveChange(base, change('2026-02-28', { reason: 'transfer', state: 'work' }));
    const off = saveChange(base, change('2026-02-28', { reason: 'transfer', state: 'off' }));
    expect(dayInfo(work, '2026-02-28')).toMatchObject({ baseState: 'off', state: 'work', change: { reason: 'transfer' } });
    expect(dayInfo(off, '2026-02-28').state).toBe('off');
    expect(base.changes).toEqual({});
  });
  it('rejects cover as a rest day and malformed actual states', () => {
    expect(() => saveChange(newData('A'), change('2026-02-28', { reason: 'cover', state: 'off' }))).toThrow('대바');
    expect(() => saveChange(newData('A'), change('2026-02-28', { state: '' as DayChange['state'] }))).toThrow('실제로');
  });
  it('requires an existing identifier for editing and preserves it', () => {
    const first = saveChange(newData('A'), change('2026-02-28'));
    expect(() => saveChange(first, change('2026-02-28', { id: 'unrelated' }))).toThrow('이미');
    const updated = saveChange(first, change('2026-02-28', { person: '길고 긴 이름' }));
    expect(updated.changes['2026-02-28'].id).toBe(first.changes['2026-02-28'].id);
    expect(first.changes['2026-02-28'].person).toBe('');
  });
  it('saves a cross-month pair atomically and cancels both sides while preserving notes', () => {
    const base = newData('A');
    base.notes = { '2026-02-28': '독립 메모', '2026-03-02': '다음 달 메모', '2026-03-06': '관계없는 날' };
    const [first, second] = pair();
    first.memo = '가져온 예전 메모'; second.memo = '둘째 날 예전 메모';
    const exchanged = saveExchange(base, first, second);
    expect(dayInfo(exchanged, first.date).state).toBe('work');
    expect(dayInfo(exchanged, second.date).state).toBe('off');
    const canceled = cancelChange(exchanged, second.date);
    expect(canceled.changes).toEqual({});
    expect(canceled.notes[first.date]).toBe('독립 메모\n가져온 예전 메모');
    expect(canceled.notes[second.date]).toBe('다음 달 메모\n둘째 날 예전 메모');
    expect(canceled.notes['2026-03-06']).toBe('관계없는 날');
    expect(dayInfo(canceled, first.date).state).toBe('off');
    expect(dayInfo(canceled, second.date).state).toBe('work');
  });
  it('can move an existing exchange partner, removing the old side and retaining notes', () => {
    const base = saveExchange(newData('A'), ...pair());
    base.notes['2026-03-02'] = '이 날짜에 남겨야 할 메모';
    base.changes['2026-03-02'].memo = '이 날짜의 가져온 메모';
    const updated = saveExchange(base, ...pair('2026-02-28', '2026-03-03'));
    expect(updated.changes['2026-03-02']).toBeUndefined();
    expect(updated.changes['2026-03-03'].partnerDate).toBe('2026-02-28');
    expect(updated.changes['2026-02-28'].exchangeId).toBe('pair-one');
    expect(updated.notes['2026-03-02']).toBe('이 날짜에 남겨야 할 메모\n이 날짜의 가져온 메모');
    expect(Object.keys(base.changes)).toHaveLength(2);
  });
  it('prevents clobbering a partner change, including an unrelated exchange', () => {
    const base = saveChange(newData('A'), change('2026-03-02', { reason: 'cover' }));
    expect(() => saveExchange(base, ...pair())).toThrow('이미');
    expect(Object.keys(base.changes)).toEqual(['2026-03-02']);
    const unrelatedPair = pair('2026-03-04', '2026-03-05').map(item => ({ ...item, exchangeId: 'pair-two' })) as [DayChange, DayChange];
    const exchanged = saveExchange(saveExchange(newData('A'), ...pair()), ...unrelatedPair);
    expect(() => saveExchange(exchanged, ...pair('2026-02-28', '2026-03-04'))).toThrow('이미');
    expect(Object.keys(exchanged.changes)).toHaveLength(4);
  });
  it('rejects half-pairs, same-day pairs, same-state pairs, and exchange replacement by a single change', () => {
    const [first, second] = pair();
    expect(() => saveChange(newData('A'), first)).toThrow('함께');
    expect(() => saveExchange(newData('A'), first, { ...second, state: 'work' })).toThrow();
    expect(() => saveExchange(newData('A'), first, { ...second, date: first.date })).toThrow();
    const exchanged = saveExchange(newData('A'), first, second);
    expect(() => saveChange(exchanged, change(first.date))).toThrow('먼저 취소');
    expect(Object.keys(exchanged.changes)).toHaveLength(2);
  });
});

describe('group history and hostile / broken import validation', () => {
  it('uses each dated group inclusively without restarting its cycle', () => {
    let data = newData('C');
    data = saveGroupChange(data, { id: 'future', date: '2026-12-01', group: 'D' });
    data = saveGroupChange(data, { id: 'first', date: '2026-10-01', group: 'A' });
    data = saveGroupChange(data, { id: 'middle', date: '2026-11-01', group: 'B' });
    expect(groupOn(data, '2026-09-30')).toBe('C');
    expect(groupOn(data, '2026-10-01')).toBe('A');
    expect(groupOn(data, '2026-11-30')).toBe('B');
    expect(groupOn(data, '2026-12-01')).toBe('D');
    expect(dayInfo(data, '2026-10-01').baseState).toBe(isBaseOff('2026-10-01', 'A') ? 'off' : 'work');
  });
  it('preserves manual overrides, counterpart names, notes and the initial group', () => {
    let data = saveChange(newData('C'), change('2026-10-01', { reason: 'cover', person: '김현정' }));
    data.notes['2026-10-01'] = '기록 보존';
    data = saveGroupChange(data, { id: 'move', date: '2026-10-01', group: 'A' });
    expect(data.initialGroup).toBe('C');
    expect(data.changes['2026-10-01'].person).toBe('김현정');
    const removed = removeGroupChange(data, 'move');
    expect(removed.changes).toEqual(data.changes);
    expect(removed.notes).toEqual(data.notes);
    expect(groupOn(removed, '2026-10-01')).toBe('C');
  });
  it('edits dates by identity and rejects duplicate effective dates', () => {
    const data = saveGroupChange(newData('A'), { id: 'move', date: '2026-10-01', group: 'B' });
    expect(() => saveGroupChange(data, { id: 'other', date: '2026-10-01', group: 'C' })).toThrow('이미');
    const edited = saveGroupChange(data, { id: 'move', date: '2026-10-02', group: 'C' });
    expect(edited.groupChanges).toHaveLength(1);
    expect(groupOn(edited, '2026-10-01')).toBe('A');
  });
  it.each([
    (data: AppData) => ({ ...data, schemaVersion: 2 }),
    (data: AppData) => ({ ...data, calendarId: 'bad\r\nBEGIN:VEVENT' }),
    (data: AppData) => ({ ...data, revision: -1 }),
    (data: AppData) => ({ ...data, theme: 'invalid' }),
    (data: AppData) => ({ ...data, updatedAt: '2026-02-30T00:00:00.000Z' }),
    (data: AppData) => ({ ...data, changes: { '2026-02-28': pair()[0] } }),
    (data: AppData) => ({ ...data, changes: { '2026-03-01': change('2026-02-28') } }),
    (data: AppData) => ({ ...data, notes: { '__proto__': null, 'not-a-date': '<script>bad</script>' } }),
  ])('rejects unsupported or malformed data without mutating input', transform => {
    const input = transform(newData('A'));
    const before = JSON.stringify(input);
    expect(() => validateData(input)).toThrow();
    expect(JSON.stringify(input)).toBe(before);
  });
  it('retains text literally and returns a deep independent copy', () => {
    const input = saveChange(newData('A'), change('2026-02-28', { person: '<b>홍길동</b>', memo: '줄1\n줄2;쉼표,역슬래시\\' }));
    const parsed = validateData(input);
    expect(parsed).toEqual(input);
    parsed.changes['2026-02-28'].person = 'different';
    expect(input.changes['2026-02-28'].person).toBe('<b>홍길동</b>');
  });
  it('rejects JSON prototype keys in maps and never pollutes returned objects', () => {
    const base = newData('A');
    const maliciousMap = JSON.parse('{"__proto__":{"polluted":true}}');
    expect(() => validateData({ ...base, notes: maliciousMap })).toThrow();
    expect(() => validateData({ ...base, changes: maliciousMap })).toThrow();
    const withExtra = JSON.parse(JSON.stringify(base).replace(/}$/, ',"__proto__":{"polluted":true}}'));
    expect(validateData(withExtra)).toEqual(base);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.hasOwn(validateData(withExtra), '__proto__')).toBe(false);
  });
  it('rejects duplicate identities and an exchange ID reused across multiple pairs', () => {
    const data = saveExchange(newData('A'), ...pair());
    const duplicateIdentity = structuredClone(data);
    duplicateIdentity.changes['2026-03-02'].id = duplicateIdentity.changes['2026-02-28'].id;
    expect(() => validateData(duplicateIdentity)).toThrow('중복');
    const [a, b] = pair('2026-03-04', '2026-03-05');
    const duplicatePair = { ...data, changes: { ...data.changes, [a.date]: a, [b.date]: b } };
    expect(() => validateData(duplicatePair)).toThrow('연결');
  });
  it('preserves long legacy and daily memos on cancellation in a valid saveable record', () => {
    const data = saveChange(newData('A'), change('2026-02-28', { memo: '가'.repeat(10000) }));
    data.notes['2026-02-28'] = '나'.repeat(10000);
    const canceled = cancelChange(data, '2026-02-28');
    expect(canceled.notes['2026-02-28']).toHaveLength(20001);
    expect(() => validateData(canceled)).not.toThrow();
  });
});
