export type LyricLine = { time: number; text: string };

export function parseLrc(input: string): LyricLine[] {
  if (input.length > 1_000_000) throw new Error('Lyrics too large');
  const lines: LyricLine[] = [];
  for (const raw of input.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/)) {
    let line = raw.trim();
    const times: number[] = [];
    let match: RegExpMatchArray | null;
    while ((match = line.match(/^\[(\d{1,3}):([0-5]\d)(?:\.(\d{1,3}))?\]/))) {
      times.push(Number(match[1]) * 60 + Number(match[2]) + Number(`0.${match[3] || '0'}`));
      line = line.slice(match[0].length);
    }
    // Untimed lines and metadata tags are ignored. Timed empty lines end a lyric.
    for (const time of times) lines.push({ time, text: line.trim() });
  }
  lines.sort((a, b) => a.time - b.time);
  const merged: LyricLine[] = [];
  for (const line of lines) {
    const previous = merged.at(-1);
    if (previous?.time === line.time) previous.text = [previous.text, line.text].filter(Boolean).join('\n');
    else merged.push({ ...line });
  }
  return merged;
}

export function lyricIndex(lines: LyricLine[], currentTime: number): number {
  if (!Number.isFinite(currentTime) || currentTime < 0) return -1;
  let low = 0, high = lines.length;
  while (low < high) { const middle = (low + high) >>> 1; if (lines[middle].time <= currentTime) low = middle + 1; else high = middle; }
  return low - 1;
}

export function formatMusicTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—:—';
  const value = Math.floor(seconds);
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
