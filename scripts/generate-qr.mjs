import QRCode from 'qrcode';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { loadEnv } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const options = { errorCorrectionLevel: 'M', margin: 4, width: 1000, color: { dark: '#000000', light: '#ffffff' } };

// Keep the checks equivalent to src/files.ts. Passing the checks does not establish approval.
export function validatePublicUrl(value) {
  if (!value) throw new Error('배포 주소 확정 후 생성: 승인된 VITE_PUBLIC_URL 또는 --url 주소가 필요합니다.');
  let url;
  try { url = new URL(value); } catch { throw new Error('정식 공개 주소의 형식을 확인해주세요.'); }
  const host = url.hostname.toLowerCase();
  const nonPublic = !host.includes('.') || host.includes(':') || /^\d+(\.\d+){3}$/.test(host)
    || /(^|\.)(localhost|local|test|invalid|example)$/.test(host)
    || /(^|\.)(example\.(com|org|net)|github\.com|raw\.githubusercontent\.com|bit\.ly|t\.co|tinyurl\.com|ngrok(-free)?\.(app|io)|trycloudflare\.com|vercel\.app|netlify\.app|replit\.dev|replit\.app|pages\.dev|webcontainer\.io|csb\.app|codespaces\.dev|githubpreview\.dev|app\.github\.dev)$/.test(host);
  if (value !== value.trim() || url.protocol !== 'https:' || url.port || url.username || url.password
    || /[?#<>\s]/.test(value) || nonPublic || value.length > 1000) {
    throw new Error('QR에는 개인정보와 추가 매개변수가 없는, 승인된 고정 HTTPS 앱 주소만 사용할 수 있습니다. 임시 주소·코드 저장소·로컬 주소는 허용하지 않습니다.');
  }
  return value; // Preserve exactly the configured string in QR, printed text, and share text.
}

function decode(buffer, expected, description) {
  const png = PNG.sync.read(buffer);
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height, { inversionAttempts: 'dontInvert' });
  if (!decoded || decoded.data !== expected) throw new Error(`${description}: 독립 QR 디코딩 결과가 정식 주소와 일치하지 않습니다.`);
}

const escape = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function copyQrPixels(backgroundBuffer, qrBuffer, left, top) {
  const background = PNG.sync.read(backgroundBuffer);
  const qr = PNG.sync.read(qrBuffer);
  if (!Number.isInteger(left) || !Number.isInteger(top) || left < 0 || top < 0
    || left + qr.width > background.width || top + qr.height > background.height) {
    throw new Error('카톡 QR 배치가 이미지 범위를 벗어났습니다.');
  }
  // Copy pixels only after the SVG text/background has rendered. This avoids
  // librsvg <image href> support and any platform-dependent image resampling.
  PNG.bitblt(qr, background, 0, 0, qr.width, qr.height, left, top);
  const output = PNG.sync.write(background);
  const finalImage = PNG.sync.read(output);
  for (let row = 0; row < qr.height; row++) {
    const sourceOffset = row * qr.width * 4;
    const destinationOffset = ((top + row) * finalImage.width + left) * 4;
    const sourceRow = qr.data.subarray(sourceOffset, sourceOffset + qr.width * 4);
    const destinationRow = finalImage.data.subarray(destinationOffset, destinationOffset + qr.width * 4);
    if (!sourceRow.equals(destinationRow)) throw new Error('카톡 안내 이미지 합성 중 QR 픽셀이 변경됐습니다.');
  }
  return output;
}

async function createImages(url, name) {
  const rawPng = await QRCode.toBuffer(url, { ...options, type: 'png' });
  const rawSvg = await QRCode.toString(url, { ...options, type: 'svg' });
  const qrRows = url.match(/.{1,58}/g) || [url];
  const qrHeight = 1032 + qrRows.length * 32;
  const qrText = qrRows.map((line, index) => `<text x="500" y="${1026 + index * 32}" text-anchor="middle" font-family="monospace" font-size="25" fill="#000000">${escape(line)}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${qrHeight}" viewBox="0 0 1000 ${qrHeight}"><rect width="1000" height="${qrHeight}" fill="#ffffff"/>${rawSvg}${qrText}</svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  decode(png, url, 'PNG');
  decode(await sharp(Buffer.from(svg)).png().toBuffer(), url, 'SVG');
  const image = `data:image/png;base64,${rawPng.toString('base64')}`;
  const rows = url.match(/.{1,48}/g) || [url];
  const textRows = rows.map((line, index) => `<text x="540" y="${1010 + index * 31}" text-anchor="middle" font-size="24">${escape(line)}</text>`).join('');
  const bottom = 1045 + rows.length * 31;
  const height = bottom + 180;
  const posterSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${height}" viewBox="0 0 1080 ${height}">
  <rect width="1080" height="${height}" fill="#f5f6f2"/><rect x="40" y="40" width="1000" height="${height - 80}" rx="38" fill="#fff"/>
  <g font-family="Malgun Gothic,Apple SD Gothic Neo,Noto Sans CJK KR,sans-serif" fill="#183b2c">
  <text x="540" y="142" text-anchor="middle" font-size="60" font-weight="700">${escape(name)}</text>
  <text x="540" y="212" text-anchor="middle" font-size="32">내 휴무를 편하게 확인하세요</text>
  <text x="540" y="265" text-anchor="middle" font-size="25" fill="#52635a">개인용 기록장 · 회사 공식 서비스가 아니에요</text>
  ${textRows}
  <text x="540" y="${bottom + 45}" text-anchor="middle" font-size="28">카톡에서는 함께 보낸 링크를 눌러 여세요</text>
  <text x="540" y="${bottom + 96}" text-anchor="middle" font-size="24">종이·PC의 QR → 휴대폰 카메라 → 앱 주소 열기</text>
  <text x="540" y="${bottom + 139}" text-anchor="middle" font-size="22" fill="#52635a">앱 열기 → 홈 화면에 설치 → 설치</text>
  </g></svg>`;
  const moduleCount = QRCode.create(url, { errorCorrectionLevel: options.errorCorrectionLevel }).modules.size;
  const modulesWithMargin = moduleCount + options.margin * 2;
  const scale = Math.floor(700 / modulesWithMargin);
  if (scale < 1) throw new Error('카톡 안내 이미지에 넣기에 QR 주소가 너무 깁니다.');
  // Do not specify width: scale keeps every QR module an exact integer square.
  const posterQr = await QRCode.toBuffer(url, {
    errorCorrectionLevel: options.errorCorrectionLevel, margin: options.margin,
    color: options.color, scale, type: 'png',
  });
  const qrSide = modulesWithMargin * scale;
  const actualQr = PNG.sync.read(posterQr);
  if (actualQr.width !== qrSide || actualQr.height !== qrSide) throw new Error('QR 정수 배율의 이미지 크기가 일치하지 않습니다.');
  decode(posterQr, url, '카톡 QR 원본');
  const posterBackground = await sharp(Buffer.from(posterSvg)).png().toBuffer();
  const poster = copyQrPixels(posterBackground, posterQr, Math.floor((1080 - qrSide) / 2), 310);
  decode(poster, url, '카톡 안내 이미지');
  return { png, svg, image, poster };
}

function printHtml(url, name, image) {
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(name)} · A4 설치 안내</title>
<style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;color:#183b2c;background:#f5f6f2;font-family:Malgun Gothic,Apple SD Gothic Neo,sans-serif;line-height:1.5}main{max-width:760px;margin:24px auto;padding:38px;background:white;border:1px solid #d6e0d8;text-align:center}h1{font-size:38px;margin:0 0 12px}.lead{font-size:22px}img{width:100mm;max-width:100%;height:auto;display:block;margin:16px auto}.url{font:16px monospace;overflow-wrap:anywhere}section{text-align:left;background:#f5f6f2;border-radius:12px;padding:16px;margin-top:16px}h2{font-size:20px;margin:0 0 8px}p{margin:8px 0}.muted{color:#52635a}button{padding:14px 22px;font:inherit;cursor:pointer}@media print{body{background:white}main{margin:0;border:0;padding:0;max-width:none}button{display:none}section{break-inside:avoid}}</style>
<main><h1>${escape(name)}</h1><p class="lead">내 휴무를 편하게 확인하세요</p><p class="muted">개인용 휴무 기록장 · 회사 공식 서비스가 아니에요</p>
<img alt="정식 앱 주소 QR코드" src="${image}"><p class="url">${escape(url)}</p>
<p class="lead">휴대폰 카메라로 QR을 비추세요<br>→ 드래곤 휴무 열기 → 홈 화면에 설치 → 설치</p>
<section><h2>갤럭시 · 지원 PC</h2><p>앱의 ‘홈 화면에 설치’를 누른 뒤 확인창에서 설치하세요.<br>지원 브라우저에서 설치가 준비되면 버튼이 나타나요.</p></section>
<section><h2>아이폰 · 아이패드</h2><p>Safari에서 열기 → 공유 → 홈 화면에 추가 → 추가<br>‘웹 앱으로 열기’가 보이면 켜세요.</p></section>
<section><h2>카카오톡으로 받았다면</h2><p>같은 휴대폰에서는 함께 받은 링크를 누르세요. 설치가 안 보이면 주소를 복사해 Safari·Chrome·삼성 인터넷에서 여세요.</p></section>
<p class="muted">QR은 앱 주소만 열어요. 자동 설치나 기록 이전·백업 기능은 아니에요.<br>기록은 각 기기에 저장돼요. 휴대폰 변경·사이트 데이터 삭제 전에는 백업해주세요.</p>
<button type="button" onclick="window.print()">A4로 인쇄하기</button></main></html>`;
}

async function selfTest() {
  const rejected = ['', 'http://site.github.io/app/', 'https://localhost/app/', 'https://127.0.0.1/',
    'https://github.com/owner/repo', 'https://site.github.io/app/?name=someone', 'https://site.github.io/app/#memo',
    'https://example.com/', 'https://test.trycloudflare.com/', 'https://test.vercel.app/',
    'https://username:password@site.github.io/app/', 'https://site.github.io:444/app/'];
  for (const value of rejected) {
    let failed = false;
    try { validatePublicUrl(value); } catch { failed = true; }
    if (!failed) throw new Error(`금지 URL 검증 실패: ${value}`);
  }
  // Reserved test domain; kept entirely in memory, never exported as a production QR.
  const url = 'https://qr-verification.example/calendar/';
  await createImages(url, 'QR 생성 검증');
  console.log('QR 자체 점검 통과: PNG·SVG·카톡 이미지 독립 디코딩 일치, 카톡 QR 정수 배율·픽셀 무손실 복사, 금지 주소 차단. 테스트 이미지는 저장하지 않았습니다.');
}

async function main() {
  const args = process.argv.slice(2).filter(arg => arg !== '--');
  if (args.length === 1 && args[0] === '--self-test') { await selfTest(); return; }
  if (args.length && (args.length !== 2 || args[0] !== '--url')) {
    throw new Error('사용법: pnpm qr [--url 승인된_HTTPS_공개주소] 또는 pnpm qr --self-test');
  }
  const env = loadEnv('production', root, 'VITE_');
  const url = validatePublicUrl(args[1] || process.env.VITE_PUBLIC_URL || env.VITE_PUBLIC_URL || '');
  const { name } = JSON.parse(await readFile(resolve(root, 'assets/app.json'), 'utf8'));
  const images = await createImages(url, name);
  const output = resolve(root, 'generated/qr');
  await mkdir(output, { recursive: true });
  const shareText = `${name}: 내 휴무와 일정·휴무 계획을 기록해보세요.\n${url}\n\n위 링크를 눌러 여세요. 종이나 PC 화면의 QR은 휴대폰 카메라로 비추면 됩니다.\n갤럭시·지원 PC: 홈 화면에 설치 → 설치 / 아이폰: Safari 공유 → 홈 화면에 추가 → 추가\n개인용 기록장이며 회사 공식 서비스가 아닙니다. QR은 자동 설치·기록 이전·백업 기능이 아닙니다.\n`;
  await Promise.all([
    writeFile(resolve(output, 'dragon-calendar-qr.png'), images.png),
    writeFile(resolve(output, 'dragon-calendar-qr.svg'), images.svg),
    writeFile(resolve(output, 'a4-install-guide.html'), printHtml(url, name, images.image)),
    writeFile(resolve(output, 'kakao-share.png'), images.poster),
    writeFile(resolve(output, 'kakao-message.txt'), shareText),
    writeFile(resolve(output, 'verification.json'), JSON.stringify({ url, checkedAt: new Date().toISOString(), independentDecoder: 'jsQR + pngjs', png: 'pass', svgRaster: 'pass', kakaoImage: 'pass', kakaoQrPixelCopy: 'pass: integer-scale PNG copied without resizing', phoneCamera: '미검증: 종이/PC 화면 실기기 촬영 필요' }, null, 2) + '\n'),
  ]);
  console.log(`QR PNG/SVG, A4 HTML, 카톡 이미지·문구 생성 완료: ${output}\n독립 디코더와 주소 일치 확인 완료. 휴대폰 카메라 촬영은 별도로 확인해주세요.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
