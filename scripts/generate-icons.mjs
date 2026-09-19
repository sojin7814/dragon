import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Preserve the supplied original. Only deterministic resizing and padding are permitted.
const source = resolve(process.argv.slice(2).find(argument => argument !== '--') || 'assets/icon-original.png');
const output = resolve('public/icons');
await mkdir(output, { recursive: true });
const original = await readFile(source);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const metadata = await sharp(source).metadata();
if (Math.min(metadata.width || 0, metadata.height || 0) < 512) {
  throw new Error('아이콘 원본은 가로·세로 512px 이상인 원본 파일을 사용해주세요.');
}

// Sample one existing dark corner pixel for NEW margins only; never recolor the image.
const corner = await sharp(original).extract({ left: metadata.width - 1, top: metadata.height - 1, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
const background = { r: corner[0], g: corner[1], b: corner[2], alpha: 1 };
const paddingColor = `#${[background.r, background.g, background.b].map(value => value.toString(16).padStart(2, '0')).join('')}`;
const pngOptions = { compressionLevel: 9, adaptiveFiltering: false, palette: false };
const sizes = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180, 'favicon-32.png': 32 };
for (const [name, size] of Object.entries(sizes)) {
  await sharp(original).resize(size, size, { fit: 'contain', kernel: 'lanczos3', background }).png(pngOptions).toFile(`${output}/${name}`);
}

// A 288px square fits completely inside the 512px maskable safe circle (radius 204.8px).
// Even the supplied original's corners remain inside the safe area: no drawing is cropped.
const maskableSize = 512;
const contentSize = Math.floor(maskableSize * 0.8 / Math.SQRT2 / 2) * 2;
const padding = (maskableSize - contentSize) / 2;
await sharp(original).resize(contentSize, contentSize, { fit: 'contain', kernel: 'lanczos3', background })
  .extend({ top: padding, right: padding, bottom: padding, left: padding, background })
  .png(pngOptions).toFile(`${output}/maskable-512.png`);

const outputs = [];
for (const [filename, size] of [...Object.entries(sizes), ['maskable-512.png', maskableSize]]) {
  const bytes = await readFile(`${output}/${filename}`);
  const result = await sharp(bytes).metadata();
  if (result.width !== size || result.height !== size || result.format !== 'png') throw new Error(`아이콘 크기 검증 실패: ${filename}`);
  outputs.push({ filename, width: result.width, height: result.height, sha256: sha256(bytes) });
}
if (sha256(await readFile(source)) !== sha256(original)) throw new Error('원본 파일이 변경되었습니다.');
await writeFile(resolve('assets/icon-verification.json'), `${JSON.stringify({
  source: { filename: basename(source), width: metadata.width, height: metadata.height, sha256: sha256(original) },
  operation: 'Original pixels resized with Lanczos3; no redraw, crop, recolor, or composition changes.',
  margin: { color: paddingColor, sampledAt: [metadata.width - 1, metadata.height - 1], appliesTo: 'new padding only' },
  maskable: { width: maskableSize, contentWidth: contentSize, paddingPerEdge: padding, safeCircleRadius: maskableSize * 0.4 },
  renderer: { sharp: sharp.versions.sharp, vips: sharp.versions.vips },
  outputs,
}, null, 2)}\n`);
console.log(`사용자 원본 아이콘 출력·크기 검증 완료: 192, 512, iOS 180, favicon 32, maskable 512 (원본 ${contentSize}px + 여백 ${padding}px)`);
console.log(`원본 SHA256: ${sha256(original)} / 여백색: ${paddingColor}`);
