import { useEffect } from 'react';
import { useThemeStore, applyTheme } from '../../stores/themeStore';

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  // Применяем тему при монтировании и изменении (с плавным переходом цветов)
  useEffect(() => {
    document.documentElement.classList.add('theme-transition');
    applyTheme(theme);
  }, [theme]);

  const handleToggle = (): void => {
    toggleTheme();
  };

  return (
    <button
      onClick={handleToggle}
      className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center"
      aria-label={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
    >
      {theme === 'dark' ? (
        // Иконка солнца ☀️ — клик включает светлую тему
        <svg
          className="w-6 h-6 text-yellow-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        // Иконка луны 🌙 — клик включает темную тему
        <svg
          className="w-6 h-6 text-slate-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  );
}
