import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { ThemeToggle } from '../components/ui/ThemeToggle';

/**
 * Экран входа и регистрации (Supabase Auth).
 * Тёмная тема, крупные поля ввода, форма по центру экрана.
 * Режим «вход/регистрация» переключается кнопкой внизу формы;
 * при регистрации появляется поле «Имя».
 */
export function AuthPage() {
  // Режим формы: вход или регистрация.
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const signIn = useAuthStore((state) => state.signIn);
  const signUp = useAuthStore((state) => state.signUp);

  /** Переключение режима очищает сообщения об ошибках. */
  const switchMode = (next: 'signin' | 'signup') => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  /** Общая отправка формы с валидацией и обработкой ошибок Supabase. */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email.trim()) {
      setError('Введите email');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Введите имя');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signin') {
        const fail = await signIn(email, password);
        if (fail) setError(fail);
      } else {
        const result = await signUp(email, password, name);
        if (result.error) {
          setError(result.error);
        } else if (result.requireConfirmation) {
          setInfo('Аккаунт создан! Проверьте почту для подтверждения email, затем войдите.');
          setMode('signin');
        }
      }
    } catch (err) {
      console.error('[AuthPage] Неожиданная ошибка авторизации:', err);
      setError('Не удалось выполнить запрос. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-base text-slate-900 placeholder-slate-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500';

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-white px-4 py-8 dark:bg-slate-900">
      {/* Переключатель темы — правый верхний угол */}
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        {/* Логотип / заголовок */}
        <div className="mb-8 text-center">
          <div className="mb-3 text-5xl" aria-hidden>
            🏋️
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">FitTracker</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {mode === 'signin' ? 'Войдите, чтобы продолжить тренировку' : 'Создайте аккаунт'}
          </p>
        </div>

        {/* Карточка формы */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-800/60"
        >
          {mode === 'signup' && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Имя</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Как вас зовут?"
                autoComplete="name"
                className={inputClass}
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Минимум 6 символов"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              className={inputClass}
            />
          </label>

          {/* Сообщения об ошибках / успехе.
              Контейнер всегда присутствует в DOM (aria-live), чтобы скринридеры
              и тесты стабильно видели появление текста; видимость сообщения
              управляется внутренним элементом. */}
          <div aria-live="assertive" role="alert">
            {error && (
              <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                ⚠️ {error}
              </p>
            )}
          </div>
          <div aria-live="polite">
            {info && (
              <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
                ✓ {info}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-emerald-600 py-3.5 text-base font-semibold text-white transition hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50"
          >
            {submitting
              ? 'Подождите…'
              : mode === 'signin'
                ? 'Войти'
                : 'Зарегистрироваться'}
          </button>

          {/* Переключатель режима */}
          <button
            type="button"
            onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
            className="w-full py-1 text-center text-sm text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
          >
            {mode === 'signin' ? 'Нет аккаунта? Регистрация' : 'Уже есть аккаунт? Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}

