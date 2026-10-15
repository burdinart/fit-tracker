// Точка входа React-приложения FitTracker
// Импортируем SVG-иконку, чтобы Vite включил её в бандл (favicon в index.html).
import iconUrl from './assets/icon.svg';
void iconUrl; // сам URL используется index.html при сборке
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const rootElement = document.getElementById('root');

// Защита: монтируем приложение только при наличии контейнера
if (rootElement !== null) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

// Регистрация Service Worker (PWA, офлайн-режим) — только в production-сборке.
// sw.js генерируется скриптом scripts/generate-sw.mjs (injectManifest-подход)
// и копируется в dist/ тем же скриптом после vite build.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => {
        // Ошибка регистрации не критична: приложение работает без офлайн-кэша.
      });
  });
}