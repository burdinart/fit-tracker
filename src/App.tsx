import { mockExercises } from './data/mockExercises';
import { muscleGroupLabels } from './utils/labels';

/**
 * Стартовый экран FitTracker (тёмная тема).
 * Отображает список моковых упражнений: название и группу мышц.
 * В дальнейшем будет заменён на роутинг по страницам (src/pages).
 */
function App() {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 px-4 py-6">
        <h1 className="text-2xl font-bold tracking-tight">FitTracker</h1>
        <p className="mt-1 text-sm text-slate-400">
          Силовые тренировки с учётом ограничений
        </p>
      </header>

      <section className="mx-auto max-w-lg px-4 py-6">
        <h2 className="mb-3 text-lg font-semibold">Справочник упражнений</h2>
        <ul className="space-y-2">
          {mockExercises.map((exercise) => (
            <li
              key={exercise.id}
              className="flex items-center justify-between rounded-lg bg-slate-800 px-4 py-3 shadow-sm"
            >
              <span className="font-medium">{exercise.name}</span>
              <span className="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-300">
                {muscleGroupLabels[exercise.muscleGroup]}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export default App;
