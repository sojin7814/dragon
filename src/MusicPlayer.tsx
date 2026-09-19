import { useEffect, useRef, useState } from 'react';
import { Music2, Pause, Play, SkipBack, SkipForward, ListMusic, AlignLeft } from 'lucide-react';
import { BUILD_ID } from './config';
import { TRACKS, initialTrackIndex, rememberTrack } from './tracks';
import { parseLrc, lyricIndex, formatMusicTime, type LyricLine } from './lyrics';
import Modal from './Modal';

const sourceUrl = (path: string) => `${import.meta.env.BASE_URL}${path}?v=${encodeURIComponent(BUILD_ID)}`;
const lyricCache = new Map<string, LyricLine[]>();

export default function MusicPlayer({ onBusyChange }: { onBusyChange: (busy: boolean) => void }) {
  const [index, setIndex] = useState(initialTrackIndex);
  const indexRef = useRef(index);
  const audioRef = useRef<HTMLAudioElement>(null);
  const generation = useRef(0);
  const pendingSeek = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pending, setPending] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(TRACKS[index].duration || 0);
  const [lines, setLines] = useState<LyricLine[]>([]);
  const [lyricState, setLyricState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [sheet, setSheet] = useState<'tracks' | 'lyrics' | null>(null);
  const track = TRACKS[index];
  const active = lyricIndex(lines, position);
  const mismatch = duration > 0 && (lines.at(-1)?.time || 0) > duration;

  useEffect(() => {
    const audio = audioRef.current!;
    audio.src = sourceUrl(TRACKS[indexRef.current].audio);
    // preload=none and no play() here: navigation/relaunch never starts music.
    return () => { generation.current++; audio.pause(); audio.removeAttribute('src'); audio.load(); };
  }, []);
  useEffect(() => { onBusyChange(playing || pending || Boolean(sheet)); }, [playing, pending, sheet, onBusyChange]);
  useEffect(() => () => onBusyChange(false), [onBusyChange]);
  useEffect(() => {
    setLines([]); setLyricState('loading');
    const cached = lyricCache.get(track.id);
    if (cached) { setLines(cached); setLyricState(cached.length ? 'ready' : 'missing'); return; }
    const controller = new AbortController();
    void fetch(sourceUrl(track.lyrics), { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Lyrics unavailable');
      const parsed = parseLrc(await response.text());
      if (controller.signal.aborted) return;
      lyricCache.set(track.id, parsed); setLines(parsed); setLyricState(parsed.length ? 'ready' : 'missing');
    }).catch(() => { if (!controller.signal.aborted) setLyricState('missing'); });
    return () => controller.abort();
  }, [track]);

  function resetAudio(nextIndex: number) {
    const audio = audioRef.current!;
    generation.current++; audio.pause();
    pendingSeek.current = null;
    indexRef.current = nextIndex;
    setIndex(nextIndex); setPosition(0); setDuration(TRACKS[nextIndex].duration || 0);
    setPlaying(false); setPending(false); setMessage('');
    audio.preload = 'none'; audio.src = sourceUrl(TRACKS[nextIndex].audio); audio.load();
    rememberTrack(TRACKS[nextIndex].id);
  }
  async function play() {
    const audio = audioRef.current!;
    const current = indexRef.current;
    const token = ++generation.current;
    if (audio.error) { audio.load(); pendingSeek.current = null; setPosition(0); }
    if (audio.ended) { audio.currentTime = 0; setPosition(0); }
    setMessage(''); setPending(true);
    try {
      await audio.play();
      if (token !== generation.current) return;
      setPlaying(!audio.paused); setPending(false);
      setFailed(old => ({ ...old, [TRACKS[current].id]: false }));
    } catch (error) {
      if (token !== generation.current) return;
      setPending(false); setPlaying(false);
      if (error instanceof Error && error.name === 'AbortError') return;
      const blocked = error instanceof Error && error.name === 'NotAllowedError';
      setMessage(blocked ? '재생 버튼을 다시 눌러주세요.' : '이 곡을 불러오지 못했어요. 연결을 확인하고 다시 재생해주세요.');
      if (!blocked) setFailed(old => ({ ...old, [TRACKS[current].id]: true }));
    }
  }
  function pause() { generation.current++; audioRef.current!.pause(); setPending(false); setPlaying(false); }
  function selectTrack(next: number, continuePlaying = playing || pending) {
    if (next < 0 || next >= TRACKS.length) return;
    resetAudio(next); setSheet(null);
    if (continuePlaying) void play();
  }
  function seek(time: number) {
    const audio = audioRef.current!;
    const next = Math.max(0, Math.min(time, duration || time));
    if (!Number.isFinite(next)) return;
    setPosition(next);
    if (audio.readyState >= 1) { audio.currentTime = next; pendingSeek.current = null; }
    else { pendingSeek.current = next; audio.preload = 'metadata'; audio.load(); }
  }
  function metadata() {
    const audio = audioRef.current!;
    if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
    if (pendingSeek.current !== null && Number.isFinite(audio.duration)) {
      const next = Math.min(pendingSeek.current, audio.duration);
      audio.currentTime = next; setPosition(next); pendingSeek.current = null;
    }
  }
  function ended() {
    if (indexRef.current + 1 < TRACKS.length) selectTrack(indexRef.current + 1, true);
    else { setPlaying(false); setPending(false); setMessage('마지막 곡까지 들었어요.'); }
  }
  const currentLyric = lyricState === 'loading' ? '가사를 불러오고 있어요.' : lyricState === 'missing' ? '가사가 준비되지 않았어요.'
    : active < 0 ? (playing ? '잠시, 음악에 쉬어가세요.' : '재생을 눌러 잠깐 쉬어가세요.') : lines[active].text || '♪';

  return <section className="music-card" aria-label="음악 플레이어">
    <audio ref={audioRef} preload="none" onLoadedMetadata={metadata} onDurationChange={metadata}
      onTimeUpdate={() => setPosition(audioRef.current!.currentTime)} onSeeked={() => setPosition(audioRef.current!.currentTime)}
      onPlaying={() => { setPlaying(true); setPending(false); }} onPause={() => setPlaying(false)} onEnded={ended}
      onError={() => { setPlaying(false); setPending(false); setMessage('이 곡을 불러오지 못했어요. 연결을 확인하고 다시 재생해주세요.'); setFailed(old => ({ ...old, [TRACKS[indexRef.current].id]: true })); }} />
    <div className="music-kicker"><Music2 size={17} /><span>잠깐, 쉬어가는 노래</span><span>{index + 1} / {TRACKS.length}</span></div>
    <button type="button" className="music-title" aria-label={`곡 선택: ${track.title}`} aria-haspopup="dialog" onClick={() => setSheet('tracks')}><strong>{track.title}</strong><ListMusic size={21} /></button>
    <div className="music-lyrics" aria-label="현재 가사">
      <p className="lyric-neighbour">{active > 0 ? lines[active - 1].text : '\u00a0'}</p>
      <p className="lyric-current">{currentLyric}</p>
      <p className="lyric-neighbour">{lyricState === 'ready' ? (lines[active + 1]?.text || '\u00a0') : '\u00a0'}</p>
    </div>
    <div className="music-progress"><input aria-label="음악 재생 위치" type="range" min="0" max={duration || 1} step="0.01" value={Math.min(position, duration || position)} disabled={!duration} onChange={event => seek(Number(event.target.value))} aria-valuetext={`${formatMusicTime(position)} / ${duration ? formatMusicTime(duration) : '길이 확인 전'}`} /><div className="music-time"><span>{formatMusicTime(position)}</span><span>{duration ? formatMusicTime(duration) : '—:—'}</span></div></div>
    <div className="music-controls"><button type="button" className="icon-button" aria-label="이전 곡" disabled={index === 0} onClick={() => selectTrack(index - 1)}><SkipBack size={21} /></button><button type="button" className="music-play" aria-label={playing || pending ? '음악 일시정지' : '음악 재생'} onClick={() => playing || pending ? pause() : void play()}>{playing || pending ? <Pause size={23} fill="currentColor" /> : <Play size={23} fill="currentColor" />}</button><button type="button" className="icon-button" aria-label="다음 곡" disabled={index === TRACKS.length - 1} onClick={() => selectTrack(index + 1)}><SkipForward size={21} /></button></div>
    <button type="button" className="text-button music-all-lyrics" disabled={lyricState !== 'ready'} onClick={() => setSheet('lyrics')}><AlignLeft size={16} />가사 전체 보기</button>
    {mismatch && <p className="music-note">이 곡은 가사 타이밍 확인이 필요해요.</p>}
    {message && <p role="status" className="music-note">{message}</p>}
    {sheet === 'tracks' && <Modal title="노래 고르기" onClose={() => setSheet(null)}><div className="music-track-list">{TRACKS.map((item, i) => <button type="button" key={item.id} className={`choice ${index === i ? 'active' : ''}`} aria-pressed={index === i} onClick={() => selectTrack(i)}><Music2 size={18} /><span>{item.title}{failed[item.id] && <small>재생 불가 · 연결 후 다시 시도</small>}</span></button>)}</div></Modal>}
    {sheet === 'lyrics' && <Modal title={track.title} onClose={() => setSheet(null)}><p className="muted music-sheet-hint">가사를 누르면 그 위치로 이동해요.</p><ol className="music-full-lyrics">{lines.map((line, i) => <li key={line.time}><button type="button" aria-current={i === active ? 'true' : undefined} disabled={duration > 0 && line.time >= duration} onClick={() => seek(line.time)}><time>{formatMusicTime(line.time)}</time><span>{line.text || '♪'}</span></button></li>)}</ol></Modal>}
  </section>;
}
