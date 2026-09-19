import { BUILD_ID } from './config';

export interface PwaState {
  install: 'available' | 'installed' | 'manual';
  update: 'none' | 'ready' | 'blocked';
  offlineReady: boolean;
  message: string;
}

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
const CHANNEL = 'dragon-calendar-pwa';
const state: PwaState = { install: 'manual', update: 'none', offlineReady: false, message: '' };
const subscribers = new Set<(state: PwaState) => void>();
let installEvent: InstallEvent | null = null;
let registration: ServiceWorkerRegistration | null = null;
let busy = false;
let started = false;
let pendingReload = false;
let reloading = false;
let lock: { id: string; worker: ServiceWorker; timeout: ReturnType<typeof setTimeout>; root: HTMLElement | null; priorInert: boolean; overlay: HTMLElement } | null = null;
let lastUpdateCheck = 0;
let lastAttempt = 0;
let autoTimer: ReturnType<typeof setTimeout> | null = null;

function publish(next: Partial<PwaState>) {
  Object.assign(state, next);
  subscribers.forEach(callback => callback({ ...state }));
}

function standalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function post(worker: ServiceWorker | null | undefined, data: Record<string, unknown>) {
  worker?.postMessage({ channel: CHANNEL, ...data });
}

function releaseLock() {
  if (!lock) return;
  clearTimeout(lock.timeout);
  if (lock.root) lock.root.inert = lock.priorInert;
  lock.overlay.remove();
  lock = null;
}

function holdForUpdate(id: string, worker: ServiceWorker) {
  const root = document.getElementById('root');
  const priorInert = root?.inert || false;
  if (root) root.inert = true;
  const overlay = document.createElement('div');
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.tabIndex = -1;
  overlay.textContent = '새 버전을 안전하게 적용하고 있어요…';
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', zIndex: '99999', display: 'grid', placeItems: 'center',
    background: 'rgba(246,247,242,.97)', color: '#184d3b', padding: '2rem', font: '600 18px system-ui',
  });
  document.body.append(overlay);
  overlay.focus();
  const timeout = setTimeout(() => {
    post(worker, { type: 'UPDATE_CANCEL', id });
    releaseLock();
    publish({ update: 'blocked', message: '업데이트 응답을 기다리지 못했어요. 현재 버전을 계속 사용하고 나중에 적용해주세요.' });
  }, 12000);
  lock = { id, worker, root, priorInert, overlay, timeout };
}

function reloadWhenSafe() {
  if (!pendingReload || busy || reloading || document.visibilityState !== 'visible') return;
  reloading = true;
  window.location.reload();
}

function queueAutoUpdate() {
  if (autoTimer) clearTimeout(autoTimer);
  if (busy || document.visibilityState !== 'visible') return;
  autoTimer = setTimeout(() => {
    if (pendingReload) reloadWhenSafe();
    else if (registration?.waiting && Date.now() - lastAttempt > 15000) void applyUpdate();
  }, 900);
}

function waitingFound() {
  // First installation briefly enters "installed" before automatic activation.
  // It is only an update when a previous worker is already active.
  if (!registration?.waiting || !registration.active) return;
  publish({ update: busy ? 'blocked' : 'ready', message: '새 버전이 준비됐어요. 작성 중인 내용을 저장한 뒤 안전하게 적용할게요.' });
  queueAutoUpdate();
}

function reportReady() {
  post(navigator.serviceWorker.controller, { type: 'CLIENT_READY', buildId: BUILD_ID });
  post(registration?.active, { type: 'CHECK_READY' });
}

async function checkForUpdate() {
  if (!registration || !navigator.onLine || Date.now() - lastUpdateCheck < 60 * 60 * 1000) return;
  lastUpdateCheck = Date.now();
  try { await registration.update(); }
  catch { /* Keep the working offline version; do not replace its cache. */ }
}

export function setPwaBusy(value: boolean): void {
  busy = value;
  if (busy && lock) {
    post(lock.worker, { type: 'UPDATE_CANCEL', id: lock.id });
    releaseLock();
  }
  if (busy && (registration?.waiting || pendingReload)) {
    publish({ update: 'blocked', message: '작성 또는 파일 작업이 끝난 뒤 새 버전을 적용할게요.' });
  }
  if (!busy) queueAutoUpdate();
}

export async function requestInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!installEvent || standalone()) return 'unavailable';
  const event = installEvent;
  installEvent = null;
  publish({ install: 'manual' });
  try {
    // Must remain in the user's button handler; never trigger this automatically.
    await event.prompt();
    const { outcome } = await event.userChoice;
    publish({ message: outcome === 'accepted' ? '설치 요청을 보냈어요. 설치 완료는 브라우저에서 확인해주세요.' : '설치를 취소했어요. 그대로 사용할 수 있어요.' });
    return outcome;
  } catch {
    publish({ message: '설치창을 열 수 없어요. 설치 방법을 확인해주세요.' });
    return 'unavailable';
  }
}

export async function applyUpdate(): Promise<void> {
  if (busy || document.visibilityState !== 'visible') {
    publish({ update: 'blocked', message: '작성 중인 내용을 저장하거나 닫은 뒤 업데이트를 적용해주세요.' });
    return;
  }
  if (pendingReload) { reloadWhenSafe(); return; }
  if (!registration?.waiting || lock) return;
  lastAttempt = Date.now();
  publish({ update: 'ready', message: '열려 있는 다른 앱 창의 저장 상태를 확인하고 있어요.' });
  post(registration.waiting, { type: 'REQUEST_UPDATE' });
}

export function startPwa(onState: (state: PwaState) => void): () => void {
  subscribers.add(onState);
  onState({ ...state });
  if (!started) {
    started = true;
    const display = window.matchMedia('(display-mode: standalone)');
    const updateInstall = () => {
      if (standalone()) { installEvent = null; publish({ install: 'installed' }); }
    };
    updateInstall();
    display.addEventListener('change', updateInstall);
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      if (!standalone()) { installEvent = event as InstallEvent; publish({ install: 'available' }); }
    });
    window.addEventListener('appinstalled', () => { installEvent = null; publish({ install: 'installed', message: '앱이 설치됐어요. 홈 화면이나 앱 목록에서 열어보세요.' }); });
    const resume = () => {
      if (document.visibilityState === 'visible') { void checkForUpdate(); queueAutoUpdate(); }
      else if (lock) { post(lock.worker, { type: 'UPDATE_CANCEL', id: lock.id }); releaseLock(); }
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', () => { lastUpdateCheck = 0; void checkForUpdate(); });
    window.addEventListener('focus', resume);

    if ('serviceWorker' in navigator && window.isSecureContext && import.meta.env.PROD) {
      const scope = new URL(import.meta.env.BASE_URL, window.location.origin).href;
      const script = new URL('sw.js', scope).href;
      let hadOurController = navigator.serviceWorker.controller?.scriptURL === script;
      navigator.serviceWorker.addEventListener('message', event => {
        const data = event.data;
        const worker = event.source as ServiceWorker | null;
        if (data?.channel !== CHANNEL || !worker || worker.scriptURL !== script) return;
        if (data.type === 'UPDATE_PREPARE') {
          const safe = !busy && !lock && document.visibilityState === 'visible';
          if (safe) holdForUpdate(data.id, worker);
          post(worker, { type: 'UPDATE_ANSWER', id: data.id, safe });
        } else if (data.type === 'UPDATE_COMMIT') {
          const safe = !busy && lock?.id === data.id && document.visibilityState === 'visible';
          post(worker, { type: 'UPDATE_ANSWER', id: data.id, safe });
        } else if (data.type === 'UPDATE_RELEASE') {
          if (lock?.id === data.id) releaseLock();
          publish({ update: 'blocked', message: data.reason });
        } else if (data.type === 'OFFLINE_READY') {
          publish({ offlineReady: true });
        } else if (data.type === 'REPORT_BUILD' || data.type === 'ACTIVE') {
          reportReady();
        }
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (navigator.serviceWorker.controller?.scriptURL !== script) return;
        if (hadOurController) {
          pendingReload = true;
          if (lock && !busy) reloadWhenSafe();
          else publish({ update: 'ready', message: '새 버전이 준비됐어요. 저장 후 업데이트 적용을 눌러주세요.' });
        } else { hadOurController = true; reportReady(); }
      });
      void navigator.serviceWorker.register(script, { scope, updateViaCache: 'none' }).then(value => {
        registration = value;
        waitingFound();
        registration.addEventListener('updatefound', () => {
          const installing = registration?.installing;
          installing?.addEventListener('statechange', () => {
            if (installing.state === 'installed') waitingFound();
            if (installing.state === 'activated') reportReady();
          });
        });
        reportReady();
        void checkForUpdate();
      }).catch(() => publish({ offlineReady: false, message: '오프라인 준비를 끝내지 못했어요. 인터넷 연결 후 앱을 다시 열어주세요.' }));
    }
  }
  return () => subscribers.delete(onState);
}
