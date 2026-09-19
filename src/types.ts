export type HouseGroup = 'A' | 'B' | 'C' | 'D';
// Preserve the original house IDs in saved calendars and history.
export type Group = HouseGroup | 'WEEKDAY_MON_FRI' | 'WEEKEND_FRI_SUN' | 'WEEKEND_SAT_SUN';
export type WorkState = 'off' | 'work';
export type Reason = 'transfer' | 'exchange' | 'cover' | 'manual';
export type Theme = 'light' | 'dark' | 'system';
export interface GroupChange { id: string; date: string; group: Group }
export interface DayChange { id: string; date: string; state: WorkState; reason: Reason; person: string; memo: string; exchangeId?: string; partnerDate?: string }
export interface AppData { schemaVersion: 1; revision: number; calendarId: string; initialGroup: Group; groupChanges: GroupChange[]; changes: Record<string, DayChange>; notes: Record<string, string>; theme: Theme; updatedAt: string }
export interface DayInfo { date: string; group: Group; baseState: WorkState; state: WorkState; change?: DayChange; note: string }
