import { useState } from 'react';
import { WorkoutPage } from './pages/WorkoutPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { BottomNav } from './components/layout/BottomNav';
import type { TabId } from './components/layout/BottomNav';
import { mockExercises } from './data/mockExercises';

/**
 * Корневой компонент FitTracker (app-shell).
 * Простая вкладочная навигация без роутера: state «workout | history | settings»
 * переключает экраны, BottomNav зафиксирована снизу.
 * Тёмная тема обеспечивается внутри страниц (bg-slate-900, text-slate-100).
 */
function App() {
  const [activeTab, setActiveTab] = useState<TabId>('workout');

  return (
    <>
      {activeTab === 'workout' ? (
        <WorkoutPage exercises={mockExercises} />
      ) : activeTab === 'history' ? (
        <HistoryPage exercises={mockExercises} />
      ) : (
        <SettingsPage />
      )}
      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </>
  );
}

export default App;
