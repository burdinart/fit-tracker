import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';

/**
 * Zustand store активной тренировки.
 * Состояние сохраняется в localStorage (middleware persist),
 * поэтому тренировка не теряется при перезагрузке страницы или сворачивании вкладки.
 * Все таймеры считаются от меток времени (Date.now()), а не инкрементом —
 * это гарантирует корректное время после «заморозки» вкладки браузером.
 */

/** Значение отдыха по умолчанию, если сохранённых данных ещё нет (сек). */
const DEFAULT_REST_TIME = 90;

/** Состояние и экшены активной тренировки. */
export interface WorkoutState {
  /** Идёт ли сейчас тренировка. */
  isWorkoutActive: boolean;
  /** Метка времени начала тренировки (мс) или null, если тренировка не идёт. */
  sessionStartTime: number | null;
  /** Общее прошедшее время тренировки в секундах (обновляется хуком useWorkoutTimer). */
  elapsedSec: number;
  /** Упражнения, добавленные в текущую сессию. */
  currentExercises: WorkoutExercise[];
  /** Активен ли сейчас таймер отдыха. */
  isResting: boolean;
  /** Плановая длительность текущего отдыха в секундах. */
  restTimeLeftSec: number;
  /** Длительность отдыха по умолчанию между подходами (сек). */
  defaultRestTime: number;
  /** Метка времени начала текущего отдыха (мс) или null. */
  restStartedAt: number | null;

  /** Начинает новую тренировку: фиксирует время старта. */
  startWorkout: () => void;
  /** Завершает тренировку, возвращает готовую сессию и сбрасывает состояние. */
  stopWorkout: () => WorkoutSession;
  /** Добавляет упражнение в сессию с одним пустым подходом. */
  addExercise: (exerciseId: string) => void;
  /** Удаляет упражнение из сессии по его id. */
  removeExercise: (exerciseId: string) => void;
  /** Добавляет новый подход в указанное упражнение. */
  addSet: (exerciseId: string) => void;
  /** Частично обновляет данные подхода (вес, повторения, RPE и т.д.). */
  updateSet: (exerciseId: string, setId: string, data: Partial<WorkoutSet>) => void;
  /** Помечает подход выполненным и запускает таймер отдыха. */
  completeSet: (exerciseId: string, setId: string) => void;
  /** Изменяет длительность отдыха по умолчанию на delta секунд (не ниже 0). */
  adjustRestTime: (delta: number) => void;
  /** Досрочно завершает текущий отдых. */
  skipRest: () => void;
  /** Обновляет прошедшее время тренировки (вызывается из useWorkoutTimer). */
  setElapsedSec: (sec: number) => void;
}

/** Генерация короткого уникального идентификатора для подхода. */
function generateId(): string {
  return `set-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Создаёт пустой подход с весом/повторами по нулям и плановым отдыхом. */
function createEmptySet(restTimeSec: number): WorkoutSet {
  return {
    id: generateId(),
    weight: 0,
    reps: 0,
    isCompleted: false,
    restTimeSec,
  };
}

/** Дефолтное (пустое) состояние стора. */
const initialState = {
  isWorkoutActive: false,
  sessionStartTime: null,
  elapsedSec: 0,
  currentExercises: [] as WorkoutExercise[],
  isResting: false,
  restTimeLeftSec: DEFAULT_REST_TIME,
  defaultRestTime: DEFAULT_REST_TIME,
  restStartedAt: null as number | null,
};

/** Хелпер: применяет мутацию к упражнению с заданным exerciseId. */
function mapExercise(
  exercises: WorkoutExercise[],
  exerciseId: string,
  transform: (exercise: WorkoutExercise) => WorkoutExercise,
): WorkoutExercise[] {
  return exercises.map((exercise) =>
    exercise.exerciseId === exerciseId ? transform(exercise) : exercise,
  );
}

/** Хелпер: применяет мутацию к подходу с заданным setId внутри упражнения. */
function mapSet(
  exercises: WorkoutExercise[],
  exerciseId: string,
  setId: string,
  transform: (workoutSet: WorkoutSet) => WorkoutSet,
): WorkoutExercise[] {
  return mapExercise(exercises, exerciseId, (exercise) => ({
    ...exercise,
    sets: exercise.sets.map((workoutSet) =>
      workoutSet.id === setId ? transform(workoutSet) : workoutSet,
    ),
  }));
}

/** Store активной тренировки с персистом в localStorage под ключом 'fit-tracker-workout'. */
export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      ...initialState,

      startWorkout: () => {
        set({
          isWorkoutActive: true,
          sessionStartTime: Date.now(),
          elapsedSec: 0,
          currentExercises: [],
          isResting: false,
          restStartedAt: null,
        });
      },

      stopWorkout: () => {
        const { sessionStartTime, currentExercises, elapsedSec } = get();
        const startTime = sessionStartTime ?? Date.now();
        // Длительность считаем от меток времени, с защитой от отрицательного значения.
        const durationSec = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
        const session: WorkoutSession = {
          id: `session-${startTime.toString(36)}`,
          date: startTime,
          durationSec: durationSec > 0 ? durationSec : elapsedSec,
          exercises: currentExercises,
          completed: true,
        };
        // Полный сброс состояния активной тренировки.
        set({ ...initialState });
        return session;
      },

      addExercise: (exerciseId: string) => {
        const { currentExercises, defaultRestTime } = get();
        // Не дублируем упражнение, если оно уже есть в сессии.
        if (currentExercises.some((e) => e.exerciseId === exerciseId)) {
          return;
        }
        set({
          currentExercises: [
            ...currentExercises,
            { exerciseId, sets: [createEmptySet(defaultRestTime)] },
          ],
        });
      },

      removeExercise: (exerciseId: string) => {
        set({
          currentExercises: get().currentExercises.filter(
            (e) => e.exerciseId !== exerciseId,
          ),
        });
      },

      addSet: (exerciseId: string) => {
        const { defaultRestTime } = get();
        set({
          currentExercises: mapExercise(get().currentExercises, exerciseId, (exercise) => ({
            ...exercise,
            sets: [...exercise.sets, createEmptySet(defaultRestTime)],
          })),
        });
      },

      updateSet: (exerciseId: string, setId: string, data: Partial<WorkoutSet>) => {
        set({
          currentExercises: mapSet(get().currentExercises, exerciseId, setId, (workoutSet) => ({
            ...workoutSet,
            ...data,
            id: workoutSet.id, // id подхода неизменен
          })),
        });
      },

      completeSet: (exerciseId: string, setId: string) => {
        const now = Date.now();
        const { defaultRestTime } = get();
        set({
          currentExercises: mapSet(get().currentExercises, exerciseId, setId, (workoutSet) => ({
            ...workoutSet,
            isCompleted: true,
            completedAt: now,
          })),
          // Запускаем таймер отдыха: обратный отсчёт считается от restStartedAt.
          isResting: true,
          restStartedAt: now,
          restTimeLeftSec: defaultRestTime,
        });
      },

      adjustRestTime: (delta: number) => {
        const next = Math.max(0, get().defaultRestTime + delta);
        set({ defaultRestTime: next });
      },

      skipRest: () => {
        set({ isResting: false, restStartedAt: null, restTimeLeftSec: get().defaultRestTime });
      },

      setElapsedSec: (sec: number) => {
        set({ elapsedSec: sec });
      },
    }),
    {
      name: 'fit-tracker-workout',
    },
  ),
);
