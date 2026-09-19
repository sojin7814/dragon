import { readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { createHash } from 'node:crypto';

const dist = resolve(process.argv[2] || 'dist');
const config = JSON.parse(await readFile(join(dist, 'pwa-build.json'), 'utf8'));
const base = config.base;
const manifest = {
  id: base,
  name: config.name,
  short_name: config.shortName,
  description: '내 휴무와 대바, 양도·교환을 기기에 기록하는 개인용 달력',
  lang: 'ko',
  start_url: base,
  scope: base,
  display: 'standalone',
  background_color: config.backgroundColor,
  theme_color: config.themeColor,
  icons: [
    { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: `${base}icons/maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
await writeFile(join(dist, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(join(dist, '.nojekyll'), '');
await unlink(join(dist, 'pwa-build.json'));

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? walk(join(directory, entry.name)) : join(directory, entry.name)));
  return nested.flat().sort();
}
const paths = (await walk(dist)).filter(path => !['sw.js', '.nojekyll'].includes(relative(dist, path)) && !path.endsWith('.map'));
const template = await readFile(resolve('assets/service-worker.js'), 'utf8');
const hash = createHash('sha256');
hash.update(template);
for (const path of paths) hash.update(relative(dist, path)).update(await readFile(path));
const fingerprint = hash.digest('hex').slice(0, 16);
const cachePrefix = `dragon-calendar-shell:${encodeURIComponent(base)}:`;
const settings = {
  base,
  buildId: config.buildId,
  cachePrefix,
  cacheName: `${cachePrefix}${fingerprint}`,
  files: paths.map(path => `${base}${relative(dist, path).split('\\').join('/')}`),
};
await writeFile(join(dist, 'sw.js'), template.replace('__PWA_SETTINGS__', JSON.stringify(settings)));
console.log(`PWA 준비: ${settings.files.length}개 파일, 범위 ${base}, 빌드 ${config.buildId}`);
