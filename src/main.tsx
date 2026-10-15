// Точка входа React-приложения FitTracker
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');

// Защита: монтируем приложение только при наличии контейнера
if (rootElement !== null) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// Регистрация Service Worker (PWA, офлайн-режим) — только в production-сборке.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/fit-tracker/sw.js').catch(() => {
      // Ошибка регистрации не критична: приложение работает без офлайн-кэша.
    });
  });
}
