export type InstallStatus = 'waiting' | 'available' | 'prompting' | 'accepted' | 'installed' | 'external' | 'unsupported' | 'ios';
export type InstallState = { status: InstallStatus; android: boolean; message: string };
interface InstallEvent extends Event {
  prompt(): Promise<unknown>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const subscribers = new Set<(state: InstallState) => void>();
let eventToPrompt: InstallEvent | null = null;
let initialized = false;
let installedThisSession = false;
let state: InstallState = { status: 'waiting', android: false, message: '' };

function standalone() {
  return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
function environment(): InstallState {
  const ua = navigator.userAgent;
  const android = /Android/i.test(ua);
  const ios = /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const external = /KAKAOTALK|Instagram|FBAN|FBAV|; wv\)/i.test(ua);
  const status = standalone() || installedThisSession ? 'installed' : external ? 'external' : ios ? 'ios'
    : 'onbeforeinstallprompt' in window ? 'waiting' : 'unsupported';
  return { status, android, message: '' };
}
function publish(next: Partial<InstallState>) {
  state = { ...state, ...next };
  subscribers.forEach(callback => callback({ ...state }));
}

// Capture before React renders, so an early browser event is not lost.
export function initializeInstall() {
  if (initialized) return;
  initialized = true;
  state = environment();
  window.addEventListener('beforeinstallprompt', raw => {
    if (standalone() || installedThisSession || environment().status === 'external') return;
    const event = raw as InstallEvent;
    if (typeof event.prompt !== 'function' || !event.userChoice) return;
    event.preventDefault();
    eventToPrompt = event;
    publish({ status: 'available', message: '' });
  });
  const markInstalled = () => {
    installedThisSession = true;
    eventToPrompt = null;
    publish({ status: 'installed', message: '' });
  };
  window.addEventListener('appinstalled', markInstalled);
  for (const mode of ['standalone', 'fullscreen']) {
    matchMedia(`(display-mode: ${mode})`).addEventListener('change', () => { if (standalone()) markInstalled(); });
  }
}
export function getInstallState(): InstallState { initializeInstall(); return { ...state }; }
export function subscribeInstall(callback: (value: InstallState) => void) {
  initializeInstall(); subscribers.add(callback); callback({ ...state });
  return () => { subscribers.delete(callback); };
}
export async function requestInstall(): Promise<void> {
  if (!eventToPrompt || state.status !== 'available' || standalone()) return;
  const event = eventToPrompt;
  eventToPrompt = null; // Browser events are single-use, including after cancellation or failure.
  publish({ status: 'prompting', message: '' });
  try {
    // Called synchronously by the click handler, before any await or network work.
    await event.prompt();
    const choice = await event.userChoice;
    if (installedThisSession || standalone()) return;
    publish(choice.outcome === 'accepted'
      ? { status: 'accepted', message: '설치 요청을 보냈어요. 브라우저의 설치 완료 안내를 확인해주세요.' }
      : { status: 'waiting', message: '설치를 취소했어요. 그대로 사용할 수 있어요.' });
  } catch {
    if (!installedThisSession && !standalone()) publish({ status: 'waiting', message: '설치창을 열지 못했어요. 다시 설치할 수 있게 되면 버튼이 나타나요.' });
  }
}
