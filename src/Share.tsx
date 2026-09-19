import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { APP_NAME, PUBLIC_URL } from './config';
import { downloadFile, publicUrlError, shareFile } from './files';

type QrImage = { png: string; svg: string; blob: Blob };

async function makeQr(): Promise<QrImage> {
  const options = { errorCorrectionLevel: 'M' as const, margin: 4, width: 768, color: { dark: '#000000', light: '#ffffff' } };
  const rawCanvas = document.createElement('canvas');
  const [, rawSvg] = await Promise.all([QRCode.toCanvas(rawCanvas, PUBLIC_URL, options), QRCode.toString(PUBLIC_URL, { ...options, type: 'svg' })]);
  const rows: string[] = PUBLIC_URL.match(/.{1,52}/g) || [PUBLIC_URL];
  const height = 792 + rows.length * 28;
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, 768, height);
  context.drawImage(rawCanvas, 0, 0);
  context.fillStyle = '#000000';
  context.font = '20px monospace';
  context.textAlign = 'center';
  rows.forEach((line, index) => context.fillText(line, 384, 790 + index * 28));
  const png = canvas.toDataURL('image/png');
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const labels = rows.map((line, index) => `<text x="384" y="${790 + index * 28}" text-anchor="middle" font-family="monospace" font-size="20" fill="#000000">${escape(line)}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="${height}" viewBox="0 0 768 ${height}"><rect width="768" height="${height}" fill="#ffffff"/>${rawSvg}${labels}</svg>`;
  const bytes = Uint8Array.from(atob(png.split(',')[1]), char => char.charCodeAt(0));
  return { png, svg, blob: new Blob([bytes], { type: 'image/png' }) };
}

export function Share() {
  const [qr, setQr] = useState<QrImage | null>(null);
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState(false);
  const invalid = publicUrlError(PUBLIC_URL);

  useEffect(() => {
    if (invalid) return;
    let active = true;
    makeQr().then(value => { if (active) setQr(value); })
      .catch(() => { if (active) setMessage('QR을 만들지 못했어요. 아래 주소를 복사해서 공유해주세요.'); });
    return () => { active = false; };
  }, [invalid]);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(PUBLIC_URL);
      setMessage('앱 주소를 복사했어요. 카카오톡 대화창에 붙여넣어 보내세요.');
    } catch {
      setMessage('자동 복사를 사용할 수 없어요. 아래 주소를 길게 누르거나 선택해서 복사해주세요.');
    }
  }

  async function shareAddress() {
    if (!navigator.share) { await copyAddress(); return; }
    try {
      await navigator.share({ title: APP_NAME, text: '내 휴무와 계획을 기록하세요. 앱에서 홈 화면에 설치 버튼을 누르면 편하게 사용할 수 있어요.', url: PUBLIC_URL });
      setMessage('공유 창에서의 작업을 마쳤어요.');
    } catch (error) {
      setMessage(error instanceof Error && error.name === 'AbortError'
        ? '공유를 취소했거나 공유할 앱을 선택하지 않았어요.' : '공유 창을 열지 못했어요. 주소 복사를 이용해주세요.');
    }
  }

  async function shareImage() {
    if (!qr) return;
    try {
      const result = await shareFile(qr.blob, 'dragon-calendar-qr.png');
      setMessage(result === 'shared' ? '공유 창에서의 작업을 마쳤어요.'
        : result === 'cancelled' ? '공유를 취소했거나 공유할 앱을 선택하지 않았어요.'
        : '이 환경에서는 이미지 공유를 지원하지 않아요. QR 이미지 저장을 이용해주세요.');
    } catch { setMessage('이미지를 공유하지 못했어요. QR 이미지 저장을 이용해주세요.'); }
  }

  if (invalid) return <div className="stack"><p className="notice">{invalid}</p>
    <p className="muted">정식 앱 주소가 정해지면 이곳에 QR과 공유 버튼이 나타나요.</p>
    <p>QR은 앱 주소를 열어줘요. 개인 일정이나 이름·메모를 전달하거나 앱을 자동으로 설치하지 않아요.</p>
  </div>;

  return <div className="stack">
    <p>동료에게 앱 주소를 알려주세요. 내 근무 유형·이름·메모는 함께 전달되지 않아요.</p>
    <label className="stack">정식 앱 주소
      <input aria-label="정식 앱 주소" readOnly value={PUBLIC_URL} onFocus={event => event.currentTarget.select()} />
    </label>
    <div className="row">
      <button type="button" className="button primary" onClick={copyAddress}>주소 복사</button>
      {typeof navigator.share === 'function' && <button type="button" className="button" onClick={shareAddress}>앱 주소 공유</button>}
    </div>
    {qr && <>
      <figure style={{ margin: 0, textAlign: 'center' }}>
        <img src={qr.png} width={expanded ? 600 : 250} height={expanded ? 600 : 250}
          style={{ width: expanded ? '100%' : 250, maxWidth: '100%', height: 'auto', background: '#fff' }}
          alt={`${APP_NAME} 정식 앱 주소 QR코드`} />
        <figcaption style={{ overflowWrap: 'anywhere', fontSize: '.9rem', marginTop: 8 }}>{PUBLIC_URL}</figcaption>
      </figure>
      <div className="row">
        <button type="button" className="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'QR 작게 보기' : 'QR 크게 보기'}</button>
        <button type="button" className="button" onClick={() => { downloadFile(qr.blob, 'dragon-calendar-qr.png'); setMessage('QR 이미지 저장을 요청했어요. 다운로드 또는 파일 앱을 확인해주세요.'); }}>QR 이미지 저장</button>
        <button type="button" className="button" onClick={() => { downloadFile(qr.svg, 'dragon-calendar-qr.svg', 'image/svg+xml'); setMessage('SVG 파일 저장을 요청했어요.'); }}>인쇄용 SVG 저장</button>
        {typeof navigator.share === 'function' && <button type="button" className="button" onClick={shareImage}>QR 이미지 공유</button>}
      </div>
    </>}
    {message && <p className="notice" role="status">{message}</p>}
    <p>종이나 PC 화면의 QR은 휴대폰 카메라로 비추세요. 같은 휴대폰에서 받았다면 <a href={PUBLIC_URL}>앱 주소 열기</a> 또는 주소 복사를 이용하세요.</p>
    <p className="muted">QR 촬영 → 드래곤 휴무 열기 → 홈 화면에 설치 → 설치. 버튼은 지원 브라우저에서 설치가 준비되면 나타나요. 카카오톡에서는 주소를 복사해 Chrome 또는 Samsung Internet에서 여세요.</p>
  </div>;
}

export default Share;
