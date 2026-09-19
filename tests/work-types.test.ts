import { describe, it, expect } from 'vitest';
import { GROUP_NAMES, HOUSE_GROUPS } from '../src/config';
import { newData, isBaseOff, dayInfo, saveChange, saveExchange, saveGroupChange, validateData, addDays } from '../src/domain';
import { makeBackup, parseBackup } from '../src/storage';
import type { Group } from '../src/types';

describe('seven work types with legacy-compatible records', () => {
  it.each(HOUSE_GROUPS)('reads old %s data, history and backup without rewriting IDs or losing records', group => {
    const old = newData(group);
    old.groupChanges = [{ id: 'old-history', date: '2027-01-01', group: 'D' }];
    old.changes['2026-09-24'] = { id: 'old-cover', date: '2026-09-24', state: 'work', reason: 'cover', person: '기존 상대방', memo: '기존 대바 메모' };
    old.notes['2026-09-24'] = '기존 날짜 메모'; old.theme = 'dark';
    const raw = JSON.stringify(old);
    const parsed = validateData(JSON.parse(raw));
    expect(parsed).toEqual(old);
    expect(GROUP_NAMES[parsed.initialGroup]).toBe(`하우스 ${group}`);
    expect(parseBackup(JSON.stringify({ app: 'dragon-calendar', formatVersion: 1, createdAt: old.updatedAt, data: old }))).toEqual(old);
    expect(JSON.stringify(old)).toBe(raw);
  });

  it.each([
    ['WEEKDAY_MON_FRI', [false,false,false,false,false,true,true]],
    ['WEEKEND_FRI_SUN', [true,true,true,true,false,false,false]],
    ['WEEKEND_SAT_SUN', [true,true,true,true,true,false,false]],
  ] as [Group, boolean[]][])('%s uses weekdays independently of house cycles', (group, expected) => {
    for (let week = -5; week <= 55; week++) {
      expect(expected.map((_, day) => isBaseOff(addDays('2026-09-21', week * 7 + day), group))).toEqual(expected);
    }
  });

  it('keeps historical rules, overrides, linked exchanges and plans across mixed changes and backup', () => {
    let data = newData('A');
    data = saveGroupChange(data, { id: 'weekday', date: '2026-10-01', group: 'WEEKDAY_MON_FRI' });
    data = saveGroupChange(data, { id: 'weekend', date: '2026-10-10', group: 'WEEKEND_SAT_SUN' });
    data = saveGroupChange(data, { id: 'house', date: '2026-10-20', group: 'C' });
    expect(dayInfo(data,'2026-09-30').baseState).toBe(isBaseOff('2026-09-30','A') ? 'off' : 'work');
    expect(dayInfo(data,'2026-10-01').baseState).toBe('work');
    expect(dayInfo(data,'2026-10-03').baseState).toBe('off');
    expect(dayInfo(data,'2026-10-10').baseState).toBe('work');
    expect(dayInfo(data,'2026-10-12').baseState).toBe('off');
    expect(dayInfo(data,'2026-10-20').group).toBe('C');
    data = saveChange(data, { id: 'cover', date: '2026-10-03', reason: 'cover', state: 'work', person: '대바 이름', memo: '유지할 메모' });
    data = saveChange(data, { id: 'transfer', date: '2026-10-04', reason: 'transfer', state: 'off', person: '양도 이름', memo: '' });
    data = saveExchange(data, { id: 'first', date: '2026-10-09', state: 'off', reason: 'exchange', exchangeId: 'pair', partnerDate: '2026-10-12', person: '교환 이름', memo: '' }, { id: 'second', date: '2026-10-12', state: 'work', reason: 'exchange', exchangeId: 'pair', partnerDate: '2026-10-09', person: '교환 이름', memo: '' });
    data.notes['2026-10-03'] = '병원'; data.notes['2026-10-04'] = '서울 약속'; data.theme = 'light';
    expect(parseBackup(makeBackup(data))).toEqual(data);
    expect(dayInfo(data,'2026-10-03').change?.reason).toBe('cover');
    expect(dayInfo(data,'2026-10-12').state).toBe('work');
  });
});
