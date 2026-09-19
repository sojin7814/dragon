import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import app from './assets/app.json' with { type: 'json' };

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const input = process.env.BASE_PATH || env.BASE_PATH || '/';
  if (!input.startsWith('/') || input.includes('..') || input.includes('?') || input.includes('#') || input.includes('//') || input.includes('\\')) {
    throw new Error('BASE_PATH는 / 또는 /저장소명/처럼 입력해주세요.');
  }
  const base = input.endsWith('/') ? input : `${input}/`;
  const buildId = (process.env.BUILD_ID || process.env.GITHUB_SHA?.slice(0, 12) || new Date().toISOString().replace(/[:.]/g, '-'));
  return {
    base,
    define: { __BUILD_ID__: JSON.stringify(buildId) },
    build: { target: 'es2022', sourcemap: false },
    plugins: [react(), {
      name: 'dragon-pwa-metadata',
      transformIndexHtml(html: string) {
        return html.replaceAll('__APP_NAME__', app.name.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'))
          .replaceAll('__THEME_COLOR__', app.themeColor);
      },
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'pwa-build.json', source: JSON.stringify({ base, buildId, ...app }) });
      },
    }],
  };
});
