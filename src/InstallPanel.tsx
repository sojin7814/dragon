import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { PUBLIC_URL, STORAGE_KEY } from './config';
import type { InstallState } from './install';

const dismissKey = `${STORAGE_KEY}_install_dismissed_on`;
function dismissedOn() { try { return localStorage.getItem(dismissKey); } catch { return null; } }
type Props = { state: InstallState; today: string; onInstall: () => void; promotion?: boolean };

export default function InstallPanel({ state, today, onInstall, promotion = false }: Props) {
  const [dismissed, setDismissed] = useState(dismissedOn);
  const [copyMessage, setCopyMessage] = useState('');
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === dismissKey) setDismissed(dismissedOn()); };
    window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync);
  }, []);
  const { status, android } = state;
  if (status === 'installed') return promotion ? null : <p className="muted">홈 화면 앱이 설치되어 있어요.</p>;
  if (promotion && (dismissed === today || !(['available', 'prompting'].includes(status) || (android && ['external', 'unsupported'].includes(status))))) return null;
  async function copyAddress() {
    try { await navigator.clipboard.writeText(PUBLIC_URL); setCopyMessage('주소를 복사했어요. 브라우저 주소창에 붙여넣어주세요.'); }
    catch { setCopyMessage('아래 주소를 길게 눌러 복사해주세요.'); }
  }
  return <section className={`install-panel ${promotion ? 'install-promotion' : ''}`} aria-label="홈 화면 설치">
    <div className="install-heading"><img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} width="44" height="44" alt="" /><div><h3>{promotion ? '드래곤 휴무를 앱처럼 사용하세요' : '홈 화면에 설치'}</h3><p>홈 화면에서 바로 열어보세요.</p></div>
      {promotion && <button type="button" className="icon-button install-dismiss" aria-label="설치 안내 오늘 닫기" onClick={() => { setDismissed(today); try { localStorage.setItem(dismissKey, today); } catch { /* Still hidden for this page session. */ } }}><X size={18} /></button>}
    </div>
    {status === 'available' && <button type="button" className="button primary install-button" onClick={onInstall}><Download size={18} />홈 화면에 설치</button>}
    {status === 'prompting' && <p role="status" className="muted">브라우저의 설치 확인창을 확인해주세요.</p>}
    {status === 'waiting' && !state.message && <p className="muted">브라우저가 설치를 준비하면 여기에 설치 버튼이 나타나요.</p>}
    {(status === 'external' || status === 'unsupported') && <>
      <p>{status === 'external' ? '홈 화면에 설치하려면 Chrome 또는 Samsung Internet으로 열어주세요.' : android ? '이 브라우저에서는 바로 설치가 지원되지 않습니다. Chrome 또는 Samsung Internet에서 열어주세요.' : '이 브라우저에서는 바로 설치가 지원되지 않습니다. Chrome 또는 Edge에서 열어주세요.'}</p>
      <button type="button" className="button" onClick={copyAddress}>앱 주소 복사</button>
      {copyMessage && <><p role="status" className="muted">{copyMessage}</p><input aria-label="설치할 앱 주소" readOnly value={PUBLIC_URL} onFocus={event => event.currentTarget.select()} /></>}
    </>}
    {status === 'ios' && <p>Safari의 공유 → 홈 화면에 추가 → 추가를 누르세요. ‘웹 앱으로 열기’가 보이면 켜주세요.</p>}
    {!promotion && state.message && <p role="status" className="muted">{state.message}</p>}
  </section>;
}
