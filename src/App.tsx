import { useEffect, useState } from 'react';
import { WorkoutPage } from './pages/WorkoutPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthPage } from './pages/AuthPage';
import { BottomNav } from './components/layout/BottomNav';
import type { TabId } from './components/layout/BottomNav';
import { useAuthStore } from './stores/authStore';
import { fetchExercises } from './services/exercisesService';
import { syncQueue } from './services/syncQueue';
import type { Exercise } from './types';
import { mockExercises } from './data/mockExercises';

/**
 * Корневой компонент FitTracker (app-shell).
 * 1) При загрузке проверяет сессию Supabase Auth (authStore.initSession):
 *    не авторизован — экран AuthPage; авторизован — основное приложение.
 * 2) Справочник упражнений загружается из БД (exercisesService.fetchExercises),
 *    при ошибке сети — фолбэк на моковые данные.
 * 3) Простая вкладочная навигация без роутера: state «workout | history | settings».
 * Тёмная тема обеспечивается внутри страниц (bg-slate-900, text-slate-100).
 */
function App() {
  const [activeTab, setActiveTab] = useState<TabId>('workout');
  const [exercises, setExercises] = useState<Exercise[]>(mockExercises);

  // Состояния авторизации из authStore.
  const isLoading = useAuthStore((state) => state.isLoading);
  const user = useAuthStore((state) => state.user);

  // Проверка сохранённой сессии при старте приложения + авто-синхронизация очереди офлайн-данных.
  useEffect(() => {
    void useAuthStore.getState().initSession();
    // Если раньше не было сети и тренировки копились в очереди — пробуем отправить.
    void syncQueue().catch((error) => console.error('[App] Ошибка синхронизации очереди:', error));
  }, []);

  // Загрузка справочника упражнений из Supabase после авторизации (RLS требует сессию).
  useEffect(() => {
    if (user === null) return;
    let cancelled = false;
    fetchExercises()
      .then((rows) => {
        if (cancelled) return;
        // Пустой ответ или ошибка — оставляем моки, чтобы приложение было рабочим.
        if (rows.length > 0) setExercises(rows);
      })
      .catch((error) => {
        console.warn('[App] Упражнения из БД недоступны, используем моковые данные:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Идёт начальная проверка сессии — показываем спиннер вместо «мигания» AuthPage.
  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-900 text-slate-400">
        <div className="animate-pulse text-lg">Загрузка…</div>
      </div>
    );
  }

  // Не авторизован — только экран входа/регистрации.
  if (user === null) {
    return <AuthPage />;
  }

  return (
    <>
      {activeTab === 'workout' ? (
        <WorkoutPage exercises={exercises} />
      ) : activeTab === 'history' ? (
        <HistoryPage exercises={exercises} />
      ) : (
        <SettingsPage />
      )}
      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </>
  );
}

export default App;
