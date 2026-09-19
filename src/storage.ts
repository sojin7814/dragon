import { STORAGE_KEY } from './config';
import { validateData } from './domain';
import type { AppData } from './types';

export const SAFETY_COPY_KEY = `${STORAGE_KEY}_before_restore`;
const LOCK_NAME = `${STORAGE_KEY}_write`;
const MAX_BACKUP_BYTES = 16 * 1024 * 1024;
let writeQueue: Promise<unknown> = Promise.resolve();

function storageError(error: unknown): Error {
  if (error instanceof Error && !(error instanceof DOMException)) return error;
  return new Error('기기에 저장하지 못했습니다. 저장공간이나 브라우저의 저장 허용 설정을 확인한 뒤 다시 시도해주세요. 작성한 내용은 그대로 남아 있습니다.');
}
export function loadData(): { data: AppData | null; raw: string | null; error: string | null } {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { data: null, raw, error: null };
    return { data: validateData(JSON.parse(raw)), raw, error: null };
  } catch {
    return { data: null, raw, error: raw === null ? '기기 저장공간을 읽지 못했습니다. 브라우저의 저장 허용 설정을 확인해주세요.' : '저장된 기록을 읽지 못했습니다. 원본은 덮어쓰지 않았습니다. 원본을 내려받거나 정상 백업을 불러와 복원해주세요.' };
  }
}
function serializeWrite<T>(work: () => T): Promise<T> {
  const execute = async () => {
    if (typeof navigator !== 'undefined' && navigator.locks?.request) return navigator.locks.request(LOCK_NAME, { mode: 'exclusive' }, work);
    // No await between comparison and setItem; local writes remain one synchronous operation.
    return work();
  };
  const result = writeQueue.then(execute, execute);
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
}
function save(data: AppData, expectedRaw: string | null, restoring: boolean): Promise<string> {
  let checked: AppData;
  try { checked = validateData(data); } catch (error) { return Promise.reject(error); }
  return serializeWrite(() => {
    try {
      const currentRaw = localStorage.getItem(STORAGE_KEY);
      if (currentRaw !== expectedRaw) throw new Error('다른 창에서 기록이 바뀌었습니다. 현재 기록을 다시 불러온 뒤 저장해주세요. 작성한 내용은 그대로 남아 있습니다.');
      let current: AppData | null = null;
      if (currentRaw !== null) {
        try { current = validateData(JSON.parse(currentRaw)); } catch {
          if (!restoring) throw new Error('현재 저장된 기록을 읽을 수 없어 덮어쓰지 않았습니다. 원본을 보관한 뒤 백업 복원을 이용해주세요.');
        }
      }
      if (!restoring && current && current.calendarId !== checked.calendarId) throw new Error('현재 달력과 다른 기록입니다. 백업 불러오기를 이용해주세요.');
      const next = { ...checked, revision: Math.max(current?.revision || 0, checked.revision) + 1, updatedAt: new Date().toISOString() };
      const raw = JSON.stringify(validateData(next));
      // If making the safety copy fails, the current record remains untouched.
      if (restoring && currentRaw !== null) localStorage.setItem(SAFETY_COPY_KEY, currentRaw);
      localStorage.setItem(STORAGE_KEY, raw);
      return raw;
    } catch (error) { throw storageError(error); }
  });
}
export function persistData(data: AppData, expectedRaw: string | null): Promise<string> { return save(data, expectedRaw, false); }
export function restoreData(data: AppData, expectedRaw: string | null): Promise<string> { return save(data, expectedRaw, true); }
export function readSafetyCopy(): string | null {
  try { return localStorage.getItem(SAFETY_COPY_KEY); } catch { return null; }
}
export function makeBackup(data: AppData): string {
  return JSON.stringify({ app: 'dragon-calendar', formatVersion: 1, createdAt: new Date().toISOString(), data: validateData(data) }, null, 2);
}
export function parseBackup(text: string): AppData {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new Error('백업 파일이 너무 큽니다. 16MB 이하인 이 앱의 백업을 선택해주세요.');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('읽을 수 없는 백업 파일입니다. 원래 기록은 유지됩니다.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('드래곤 휴무의 정상 백업 파일을 선택해주세요.');
  const envelope = value as Record<string, unknown>;
  if (envelope.app !== 'dragon-calendar' || envelope.formatVersion !== 1 || typeof envelope.createdAt !== 'string' || !Number.isFinite(Date.parse(envelope.createdAt))) throw new Error('이 앱의 백업 형식이나 버전이 아닙니다. 원래 기록은 유지됩니다.');
  return validateData(envelope.data);
}
