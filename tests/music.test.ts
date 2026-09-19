import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseLrc, lyricIndex, formatMusicTime } from '../src/lyrics';
import { initialTrackIndex, rememberTrack, MUSIC_STORAGE_KEY } from '../src/tracks';
afterEach(() => vi.unstubAllGlobals());

describe('lyrics from ordinary LRC files', () => {
  it('handles BOM, metadata, both newline styles, fractions, repeats and untimed lines', () => {
    const lines = parseLrc('\uFEFF[ti:노래]\r\n[ar:가수]\n\n[00:08.20]첫 줄\r\n[00:10]둘째 줄\n[00:10.00]겹친 줄\r[00:12.5][00:14.050]후렴\n설명\n[00:16.00]\n[01:70]잘못된 시간');
    expect(lines).toEqual([{time:8.2,text:'첫 줄'},{time:10,text:'둘째 줄\n겹친 줄'},{time:12.5,text:'후렴'},{time:14.05,text:'후렴'},{time:16,text:''}]);
  });
  it('seeks backwards and forwards at exact boundaries without losing duplicate lyrics', () => {
    const lines = parseLrc('[00:30]셋\n[00:10]하나\n[00:20]둘');
    expect([0,10,29.99,30,100,9].map(t => lyricIndex(lines,t))).toEqual([-1,0,1,2,2,-1]);
    expect(lyricIndex([],3)).toBe(-1); expect(lyricIndex(lines,NaN)).toBe(-1);
    expect(parseLrc('[ti:only metadata]')).toEqual([]);
    expect(() => parseLrc('a'.repeat(1_000_001))).toThrow();
  });
  it('formats partial seconds and unknown durations', () => {
    expect([0,62.99,241.44,NaN,Infinity,-1].map(formatMusicTime)).toEqual(['0:00','1:02','4:01','—:—','—:—','—:—']);
  });
});
describe('separate music preferences', () => {
  it('writes only the music key, restores a known track and tolerates bad/unknown settings', () => {
    const values = new Map([['dragon_calendar_data','original calendar bytes']]);
    vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key),setItem:(key:string,value:string)=>values.set(key,value)});
    rememberTrack('dragon-rest'); expect(initialTrackIndex()).toBe(2);
    expect([...values.keys()]).toEqual(['dragon_calendar_data',MUSIC_STORAGE_KEY]);
    expect(values.get('dragon_calendar_data')).toBe('original calendar bytes');
    values.set(MUSIC_STORAGE_KEY,'{invalid'); expect(initialTrackIndex()).toBe(0);
    rememberTrack('removed-track'); expect(initialTrackIndex()).toBe(0);
  });
  it('keeps music usable when storage is unavailable or full', () => {
    vi.stubGlobal('localStorage',{getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('quota');}});
    expect(initialTrackIndex()).toBe(0); expect(()=>rememberTrack('golfer-day')).not.toThrow();
  });
});
