import { WorkoutPage } from './pages/WorkoutPage';
import { mockExercises } from './data/mockExercises';

/**
 * Корневой компонент FitTracker.
 * Рендерит главный экран тренировки (WorkoutPage) с моковым справочником упражнений.
 * Тёмная тема обеспечивается внутри WorkoutPage (bg-slate-900, text-slate-100).
 */
function App() {
  return <WorkoutPage exercises={mockExercises} />;
}

export default App;
