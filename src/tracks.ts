export type MusicTrack = { id: string; title: string; audio: string; lyrics: string; duration?: number };

// Paths are relative to public/. Add an MP3, an LRC, and one entry here for a new song.
export const TRACKS: MusicTrack[] = [
  { id: 'caddie-day', title: '캐디의 하루', audio: 'assets/music/caddie-day.mp3', lyrics: 'assets/music/caddie-day.lrc', duration: 241.44 },
  { id: 'golfer-day', title: '오늘 왜 이러지', audio: 'assets/music/golfer-day.mp3', lyrics: 'assets/music/golfer-day.lrc', duration: 176.4 },
  { id: 'dragon-rest', title: '드래곤, 마음이 쉬어 가는 곳', audio: 'assets/music/dragon-rest.mp3', lyrics: 'assets/music/dragon-rest.lrc', duration: 228 },
];

export const MUSIC_STORAGE_KEY = 'dragon_music_player_state';

export function initialTrackIndex(): number {
  try {
    const value = JSON.parse(localStorage.getItem(MUSIC_STORAGE_KEY) || 'null');
    const index = TRACKS.findIndex(track => track.id === value?.trackId);
    return Math.max(0, index);
  } catch { return 0; }
}
export function rememberTrack(id: string): void {
  try { localStorage.setItem(MUSIC_STORAGE_KEY, JSON.stringify({ trackId: id })); }
  catch { /* Playback remains usable when preference storage is unavailable. */ }
}
