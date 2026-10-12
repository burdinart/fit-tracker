// Конфигурация Vite: React + Tailwind v4 + базовый путь для GitHub Pages
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Репозиторий публикуется по адресу https://burdinart.github.io/fit-tracker/
  base: '/fit-tracker/',
  build: {
    outDir: 'dist',
  },
});
