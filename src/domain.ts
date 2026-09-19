import { ANCHOR, GROUPS } from './config';
import type { AppData, DayChange, DayInfo, Group, GroupChange } from './types';

const DAY_MS = 86_400_000;
const FIRST_DATE = '1900-01-01';
const LAST_DATE = '2199-12-31';
const OFFSETS: Record<Group, number> = { A: 0, B: 2, C: 4, D: 6 };
const ID_PATTERN = /^[A-Za-z0-9_-]{1,120}$/;

function fail(message: string): never { throw new Error(message); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('기록 형식이 올바르지 않습니다. 원본은 유지됩니다.');
  return value as Record<string, unknown>;
}
function str(value: unknown, label: string, max = 10000): string {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) fail(`${label} 형식이나 길이를 확인해주세요.`);
  return value;
}
function id(value: unknown): string {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) fail('기록 식별자가 올바르지 않습니다.');
  return value;
}
function group(value: unknown): Group {
  if (!GROUPS.includes(value as Group)) fail('A, B, C, D 중 휴무조를 선택해주세요.');
  return value as Group;
}
function dayNumber(value: unknown, bounded = true): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('날짜를 YYYY-MM-DD 형식으로 입력해주세요.');
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(0);
  parsed.setUTCFullYear(year, month - 1, day);
  parsed.setUTCHours(0, 0, 0, 0);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day || (bounded && (value < FIRST_DATE || value > LAST_DATE))) fail('1900년부터 2199년 사이의 실제 날짜를 입력해주세요.');
  return parsed.getTime() / DAY_MS;
}
function date(value: unknown): string { dayNumber(value); return value as string; }
function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail('저장 시각이 올바르지 않습니다.');
  return value;
}
function parseChange(value: unknown): DayChange {
  const item = object(value);
  if (item.state !== 'off' && item.state !== 'work') fail('그날 실제로 휴무인지 근무인지 선택해주세요.');
  if (!['transfer', 'exchange', 'cover', 'manual'].includes(item.reason as string)) fail('변경 이유를 선택해주세요.');
  if (item.reason === 'cover' && item.state !== 'work') fail('대바는 다른 사람 대신 근무하는 일정입니다.');
  const result: DayChange = { id: id(item.id), date: date(item.date), state: item.state, reason: item.reason as DayChange['reason'], person: str(item.person, '상대방 이름', 120), memo: str(item.memo, '메모') };
  if (result.reason === 'exchange') {
    result.exchangeId = id(item.exchangeId);
    result.partnerDate = date(item.partnerDate);
    if (result.partnerDate === result.date) fail('교환할 두 날짜는 서로 달라야 합니다.');
  } else if (item.exchangeId !== undefined || item.partnerDate !== undefined) fail('교환이 아닌 기록에 교환 연결이 포함되어 있습니다.');
  return result;
}
function parseGroupChange(value: unknown): GroupChange {
  const item = object(value);
  return { id: id(item.id), date: date(item.date), group: group(item.group) };
}

/** Validate and reconstruct a safe, independent schema; malformed data is never repaired silently. */
export function validateData(value: unknown): AppData {
  const input = object(value);
  if (input.schemaVersion !== 1) fail('이 앱에서 읽을 수 없는 데이터 버전입니다. 앱을 업데이트하거나 올바른 백업을 선택해주세요.');
  if (!Number.isSafeInteger(input.revision) || (input.revision as number) < 0) fail('저장 기록 번호가 올바르지 않습니다.');
  if (!Array.isArray(input.groupChanges) || input.groupChanges.length > 110000) fail('휴무조 변경 이력이 올바르지 않습니다.');
  if (!['light', 'dark', 'system'].includes(input.theme as string)) fail('화면 테마 설정이 올바르지 않습니다.');
  const groupChanges = input.groupChanges.map(parseGroupChange).sort((a, b) => a.date.localeCompare(b.date));
  const groupIds = new Set<string>();
  const groupDates = new Set<string>();
  for (const item of groupChanges) {
    if (groupIds.has(item.id) || groupDates.has(item.date)) fail('같은 날짜 또는 같은 식별자의 휴무조 변경이 중복되어 있습니다.');
    groupIds.add(item.id); groupDates.add(item.date);
  }
  const changes: Record<string, DayChange> = {};
  const changeIds = new Set<string>();
  const exchangeCounts = new Map<string, number>();
  const inputChanges = Object.entries(object(input.changes));
  if (inputChanges.length > 110000) fail('날짜 변경 기록이 너무 많습니다.');
  for (const [key, value] of inputChanges) {
    date(key);
    const item = parseChange(value);
    if (key !== item.date || changeIds.has(item.id)) fail('날짜 변경 기록이 중복되거나 날짜가 일치하지 않습니다.');
    changes[key] = item;
    changeIds.add(item.id);
    if (item.exchangeId) exchangeCounts.set(item.exchangeId, (exchangeCounts.get(item.exchangeId) || 0) + 1);
  }
  for (const item of Object.values(changes)) {
    if (item.reason !== 'exchange') continue;
    const partner = changes[item.partnerDate!];
    if (!partner || partner.reason !== 'exchange' || partner.partnerDate !== item.date || partner.exchangeId !== item.exchangeId || partner.state === item.state || exchangeCounts.get(item.exchangeId!) !== 2) fail('교환한 두 날짜의 연결이 올바르지 않습니다. 원본을 확인해주세요.');
  }
  const notes: Record<string, string> = {};
  const inputNotes = Object.entries(object(input.notes));
  if (inputNotes.length > 110000) fail('날짜 메모가 너무 많습니다.');
  // A canceled imported change can merge its legacy memo into an existing daily note.
  for (const [key, value] of inputNotes) notes[date(key)] = str(value, '날짜 메모', 100000);
  return { schemaVersion: 1, revision: input.revision as number, calendarId: id(input.calendarId), initialGroup: group(input.initialGroup), groupChanges, changes, notes, theme: input.theme as AppData['theme'], updatedAt: timestamp(input.updatedAt) };
}

export function newData(initialGroup: Group): AppData {
  return { schemaVersion: 1, revision: 0, calendarId: crypto.randomUUID(), initialGroup: group(initialGroup), groupChanges: [], changes: {}, notes: {}, theme: 'system', updatedAt: new Date().toISOString() };
}
export function todayKorea(): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (type: string) => parts.find(part => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
/** Arithmetic permits adjacent out-of-range dates for grid edges and exclusive ICS end dates. */
export function addDays(value: string, count: number): string {
  if (!Number.isSafeInteger(count)) fail('날짜 이동 값이 올바르지 않습니다.');
  const result = new Date((dayNumber(value, false) + count) * DAY_MS);
  if (!Number.isFinite(result.getTime()) || result.getUTCFullYear() < 1 || result.getUTCFullYear() > 9999) fail('이동할 날짜가 지원 범위를 벗어났습니다.');
  return result.toISOString().slice(0, 10);
}
export function monthDates(year: number, month1: number): string[] {
  if (!Number.isInteger(year) || year < 1900 || year > 2199 || !Number.isInteger(month1) || month1 < 1 || month1 > 12) fail('1900년부터 2199년 사이의 연도와 1~12월을 선택해주세요.');
  const prefix = `${year}-${String(month1).padStart(2, '0')}-`;
  const length = new Date(Date.UTC(year, month1, 0)).getUTCDate();
  return Array.from({ length }, (_, index) => `${prefix}${String(index + 1).padStart(2, '0')}`);
}
export function groupOn(data: AppData, value: string): Group {
  date(value);
  let selected = data.initialGroup;
  // validateData and history mutators maintain chronological order. Binary lookup keeps
  // nextOff bounded even when an imported calendar contains many dated group changes.
  let low = 0; let high = data.groupChanges.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const change = data.groupChanges[middle];
    if (change.date <= value) { selected = change.group; low = middle + 1; }
    else high = middle - 1;
  }
  return selected;
}
export function isBaseOff(value: string, selected: Group): boolean {
  const delta = dayNumber(value) - dayNumber(ANCHOR) - OFFSETS[group(selected)];
  return ((delta % 8) + 8) % 8 < 2;
}
export function dayInfo(data: AppData, value: string): DayInfo {
  const selected = groupOn(data, value);
  const baseState = isBaseOff(value, selected) ? 'off' : 'work';
  const change = data.changes[value];
  return { date: value, group: selected, baseState, state: change?.state || baseState, change, note: data.notes[value] || '' };
}
export function nextOff(data: AppData, from: string): { start: string; end: string } {
  date(from);
  let start = from;
  while (dayInfo(data, start).state !== 'off') {
    if (start === LAST_DATE) fail('지원하는 날짜 범위 안에 다음 휴무가 없습니다.');
    start = addDays(start, 1);
  }
  // When currently resting, report the full current period, including its first day.
  while (start > FIRST_DATE && dayInfo(data, addDays(start, -1)).state === 'off') start = addDays(start, -1);
  let end = start;
  while (end < LAST_DATE && dayInfo(data, addDays(end, 1)).state === 'off') end = addDays(end, 1);
  return { start, end };
}
function ensureEdit(existing: DayChange | undefined, incoming: DayChange): void {
  if (existing && existing.id !== incoming.id) fail(`${incoming.date}에 이미 다른 변경 기록이 있습니다. 기존 기록을 먼저 확인해주세요.`);
}
function preserveMemo(data: AppData, item: DayChange | undefined): void {
  if (!item?.memo) return;
  const note = data.notes[item.date] || '';
  if (!note.includes(item.memo)) data.notes[item.date] = [note, item.memo].filter(Boolean).join('\n');
}
export function saveChange(data: AppData, change: DayChange): AppData {
  const next = validateData(data);
  const incoming = parseChange(change);
  if (incoming.reason === 'exchange') fail('교환은 두 날짜를 함께 저장해주세요.');
  ensureEdit(next.changes[incoming.date], incoming);
  if (next.changes[incoming.date]?.reason === 'exchange') fail('연결된 교환을 먼저 취소한 뒤 다른 일정으로 바꿔주세요.');
  next.changes[incoming.date] = incoming;
  return validateData(next);
}
export function saveExchange(data: AppData, first: DayChange, second: DayChange): AppData {
  const next = validateData(data);
  const a = parseChange(first); const b = parseChange(second);
  if (a.reason !== 'exchange' || b.reason !== 'exchange' || a.exchangeId !== b.exchangeId || a.partnerDate !== b.date || b.partnerDate !== a.date || a.state === b.state) fail('교환할 두 날짜와 휴무·근무 상태를 확인해주세요.');
  const existing = next.changes[a.date];
  ensureEdit(existing, a);
  if (existing?.reason === 'exchange' && existing.exchangeId !== a.exchangeId) fail('수정 중인 교환의 연결 식별자가 달라졌습니다. 다시 열어주세요.');
  const target = next.changes[b.date];
  // Only the two members of the exchange being edited may be replaced.
  if (target && (!existing || existing.reason !== 'exchange' || target.exchangeId !== existing.exchangeId)) fail(`${b.date}에 이미 다른 변경 기록이 있습니다. 교환 날짜를 바꾸거나 기존 기록을 확인해주세요.`);
  ensureEdit(target, b);
  if (existing?.reason === 'exchange') {
    if (existing.partnerDate !== b.date) preserveMemo(next, next.changes[existing.partnerDate!]);
    delete next.changes[existing.partnerDate!];
  }
  next.changes[a.date] = a; next.changes[b.date] = b;
  return validateData(next);
}
export function cancelChange(data: AppData, value: string): AppData {
  date(value);
  const next = validateData(data);
  const existing = next.changes[value];
  preserveMemo(next, existing);
  if (existing?.reason === 'exchange') {
    preserveMemo(next, next.changes[existing.partnerDate!]);
    delete next.changes[existing.partnerDate!];
  }
  delete next.changes[value];
  return validateData(next);
}
export function saveGroupChange(data: AppData, change: GroupChange): AppData {
  const next = validateData(data);
  const incoming = parseGroupChange(change);
  if (next.groupChanges.some(item => item.date === incoming.date && item.id !== incoming.id)) fail('그 날짜에 이미 휴무조 변경이 있습니다. 기존 이력을 수정해주세요.');
  next.groupChanges = [...next.groupChanges.filter(item => item.id !== incoming.id), incoming];
  return validateData(next);
}
export function removeGroupChange(data: AppData, identifier: string): AppData {
  const next = validateData(data);
  next.groupChanges = next.groupChanges.filter(item => item.id !== identifier);
  return next;
}
