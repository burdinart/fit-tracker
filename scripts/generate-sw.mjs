#!/usr/bin/env node
/**
 * Пост-сборочный скрипт PWA (аналог vite-plugin-pwa injectManifest):
 *  1) генерирует PNG-иконки всех размеров из src/assets/icon.svg (sharp);
 *  2) компилирует src/sw.ts через Vite SSR-build (workbox-* бандлятся в файл);
 *  3) подставляет в sw.js реальный манифест пре-кэша dist-ассетов (__WB_MANIFEST);
 *  4) кладёт sw.js в public/ (dev) и dist/ (prod).
 * Запускается как часть `npm run build` (после vite build).
 */
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import sharp from 'sharp';
import { glob } from 'glob';
import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url)).replace(/[/\\]scripts$/, '');
const BASE = '/fit-tracker/';

/* ---------- 1. Иконки из SVG ---------- */
const svgPath = join(root, 'src/assets/icon.svg');
const iconsDir = join(root, 'public/icons');
mkdirSync(iconsDir, { recursive: true });

/** Целевые растровые иконки; safeZone — запас для maskable (безопасная зона 80%). */
const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'maskable-192.png', size: 192, safeZone: true },
  { file: 'maskable-512.png', size: 512, safeZone: true },
  { file: 'apple-touch-icon.png', size: 180 },
];

for (const t of targets) {
  const inner = t.safeZone ? Math.round(t.size * 0.8) : t.size;
  let pipeline = sharp(svgPath, { density: Math.ceil((inner / 512) * 96) + 2 }).resize(inner, inner, {
    fit: 'contain',
    background: 'transparent',
  });
  if (t.safeZone) {
    const pad = (size) => Math.floor((t.size - size) / 2);
    pipeline = pipeline.extend({
      top: pad(inner),
      bottom: t.size - inner - pad(inner),
      left: pad(inner),
      right: t.size - inner - pad(inner),
      background: '#0f172a',
    });
  } else {
    pipeline = pipeline.flatten({ background: '#0f172a' });
  }
  await pipeline.png().toFile(join(iconsDir, t.file));
  console.log(`[pwa] иконка сгенерирована: ${t.file} (${t.size}x${t.size})`);
}

/* ---------- 2. Компиляция src/sw.ts -> dist/sw.raw.js ---------- */
await build({
  configFile: false,
  logLevel: 'warn',
  root,
  plugins: [react(), tailwindcss()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    minify: 'esbuild',
    rollupOptions: {
      input: join(root, 'src/sw.ts'),
      output: { entryFileNames: 'sw.raw.js' },
    },
  },
});

/* ---------- 3. Манифест пре-кэша + запись sw.js ---------- */
const files = await glob(['**/*.{js,css,png,svg,webmanifest}', 'index.html', 'offline.html'], {
  cwd: join(root, 'dist'),
  ignore: ['sw.js', 'sw.raw.js'],
});
const manifest = files.map((f) => ({ url: BASE + f.split('?')[0], revision: null }));

let sw = readFileSync(join(root, 'dist/sw.raw.js'), 'utf8');
if (!sw.includes('__WB_MANIFEST')) {
  throw new Error('[pwa] В скомпилированном sw.js не найден маркер __WB_MANIFEST');
}
sw = sw.replace('__WB_MANIFEST', JSON.stringify(manifest));
writeFileSync(join(root, 'dist/sw.js'), sw);
cpSync(join(root, 'dist/sw.js'), join(root, 'public/sw.js')); // синхронизируем dev-копию
console.log(`[pwa] sw.js сгенерирован: ${manifest.length} записей пре-кэша`);
