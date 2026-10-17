import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ExerciseTargets, UserInjuries, WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';
import { useUserStore, getInjuriesFromProfile } from './userStore';
import { useAuthStore } from './authStore';
import {
  supabase,
  type Database,
} from '../lib/supabase';

/** Формы вставки для cloud-таблиц (приводим payload'ы к ним явно — strict TS). */
type SessionInsert = Database['public']['Tables']['workout_sessions']['Insert'];
type SetInsert = Database['public']['Tables']['workout_sets']['Insert'];
import { addToQueue } from '../services/syncQueue';
import { generateUUID, isValidUUID } from '../utils/uuid';

/** Типы травм пользователя для фильтрации небезопасных упражнений. */
export type InjuryType = 'shoulder' | 'knee' | 'lowerBack';

/**
 * Zustand store активной тренировки.
 * Состояние сохраняется в localStorage (middleware persist),
 * поэтому тренировка не теряется при перезагрузке страницы или сворачивании вкладки.
 * Все таймеры считаются от меток времени (Date.now()), а не инкрементом —
 * это гарантирует корректное время после «заморозки» вкладки браузером.
 */

/** Дефолтный отдых между подходами, сек (используется стором и при создании профиля в Supabase). */
export const DEFAULT_REST_TIME = 90;

/** Минимальный шаг изменения длительности отдыха (сек) — защита от «слишком короткого» отдыха. */
const MIN_REST_TIME = 15;

/** Состояние и экшены активной тренировки. */
export interface WorkoutState {
  /** Идёт ли сейчас тренировка. */
  isWorkoutActive: boolean;
  /** Метка времени начала тренировки (мс) или null, если тренировка не идёт. */
  sessionStartTime: number | null;
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
  /** Флаги травм пользователя — влияют на подсветку небезопасных упражнений. */
  userInjuries: UserInjuries;

  /** Начинает новую тренировку: фиксирует время старта. */
  startWorkout: () => void;
  /** Завершает тренировку, возвращает готовую сессию и сбрасывает состояние. */
  stopWorkout: () => WorkoutSession;
  /** Добавляет упражнение в сессию с одним пустым подходом (опционально — цели из плана). */
  addExercise: (exerciseId: string, targets?: ExerciseTargets) => void;
  /** Удаляет упражнение из сессии по его id. */
  removeExercise: (exerciseId: string) => void;
  /** Добавляет новый подход в указанное упражнение. */
  addSet: (exerciseId: string) => void;
  /** Частично обновляет данные подхода (вес, повторения, RPE и т.д.). */
  updateSet: (exerciseId: string, setId: string, data: Partial<WorkoutSet>) => void;
  /** Помечает подход выполненным и запускает таймер отдыха. */
  completeSet: (exerciseId: string, setId: string) => void;
  /** Изменяет длительность отдыха по умолчанию на delta секунд (не ниже MIN_REST_TIME). */
  adjustRestTime: (delta: number) => void;
  /** Досрочно завершает текущий отдых. */
  skipRest: () => void;
  /** Переключает флаг травмы пользователя (плечо / колено / поясница). */
  toggleInjury: (type: InjuryType) => void;
  /** Полная синхронизация derived-полей (травмы + отдых по умолчанию) с профилем из userStore. */
  syncWithProfile: () => void;
  /**
   * Сохраняет завершённую сессию в Supabase (workout_sessions + workout_sets).
   * При ошибке сети/авторизации данные кладутся в локальную очередь офлайн-синхронизации.
   */
  syncSessionToCloud: (session: WorkoutSession) => Promise<void>;
}

/**
 * Конвертирует доменную сессию приложения в формы вставки таблиц Supabase.
 * id остаются стабильными — повторная отправка из очереди идемпотентна (upsert / on-conflict-вставка).
 * Поле «order» в workout_sets записывается в кавычках — это зарезервированное слово Postgres.
 */
export function buildCloudPayload(userId: string, session: WorkoutSession): {
  /** Стабильный UUID сессии, использованный при построении payload (в т.ч. нормализованный). */
  sessionId: string;
  sessionRow: SessionInsert;
  setRows: SetInsert[];
} {
  // Защита от старых не-UUID id (session-xxx / set-xxx) из localStorage и очереди:
  // PostgreSQL требует uuid, иначе вставка падает с "Invalid input syntax for type uuid".
  // Нормализованный sessionId возвращаем наружу — синхронизация очередей должна
  // использовать ровно те же id, что ушли в облако (идемпотентность повторных отправок).
  const sessionId = isValidUUID(session.id) ? session.id : generateUUID();
  // Строка сессии для таблицы workout_sessions.
  const sessionRow: SessionInsert = {
    id: sessionId,
    user_id: userId, // UUID из auth.users (supabase.auth.getUser()), а не произвольная строка
    started_at: new Date(session.date).toISOString(),
    duration_sec: session.durationSec,
    completed: session.completed,
  };
  // Подходы: по одному на выполненный подход, порядок внутри упражнения — по индексу.
  const setRows: SetInsert[] = session.exercises.flatMap((exercise) =>
    exercise.sets.map((workoutSet, index): SetInsert => ({
      id: isValidUUID(workoutSet.id) ? workoutSet.id : generateUUID(),
      session_id: sessionId,
      exercise_id: exercise.exerciseId,
      weight: workoutSet.weight,
      reps: workoutSet.reps,
      rpe: workoutSet.rpe ?? null,
      rest_time_sec: workoutSet.restTimeSec,
      is_completed: workoutSet.isCompleted,
      completed_at: workoutSet.completedAt ? new Date(workoutSet.completedAt).toISOString() : null,
      "order": index + 1,
    })),
  );
  return { sessionId, sessionRow, setRows };
}

/** Генерация идентификатора подхода — UUID v4 (колонка workout_sets.id имеет тип uuid). */
function generateId(): string {
  return generateUUID();
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
  sessionStartTime: null as number | null,
  currentExercises: [] as WorkoutExercise[],
  isResting: false,
  restTimeLeftSec: DEFAULT_REST_TIME,
  defaultRestTime: DEFAULT_REST_TIME,
  restStartedAt: null as number | null,
  userInjuries: { shoulder: false, knee: false, lowerBack: false } as UserInjuries,
};

/**
 * Синхронизирует derived-состояние workoutStore с профилем пользователя:
 * травмы — копия из userStore (источник истины — SettingsPage),
 * отдых по умолчанию — значение из профиля.
 */
function syncFromProfile(): Pick<WorkoutState, 'userInjuries' | 'defaultRestTime'> {
  const profile = useUserStore.getState().profile;
  return {
    userInjuries: getInjuriesFromProfile(profile),
    defaultRestTime: Math.max(MIN_REST_TIME, profile.defaultRestTime),
  };
}

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
        const { currentExercises } = get();
        // Защита от «пустого старта»: если на экране выбора не добавлено ни одного
        // упражнения, тренировку не начинаем — иначе пользователь попадал на экран
        // с надписью «Нет упражнений» вместо активной тренировки.
        if (currentExercises.length === 0) {
          return;
        }
        set({
          isWorkoutActive: true,
          sessionStartTime: Date.now(),
          // ВАЖНО: текущий набор упражнений сохраняем (не сбрасываем в []) —
          // именно сброс вызывал баг «Начать тренировку → Нет упражнений».
          currentExercises,
          isResting: false,
          restStartedAt: null,
          // На старт подтягиваем актуальные настройки из профиля (отдых, травмы).
          ...syncFromProfile(),
        });
      },

      stopWorkout: () => {
        const { sessionStartTime, currentExercises } = get();
        const startTime = sessionStartTime ?? Date.now();
        // Длительность считаем от меток времени, с защитой от отрицательного значения.
        const durationSec = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
        const session: WorkoutSession = {
          // id сессии — UUID v4: колонка workout_sessions.id имеет тип uuid,
          // старые строки вида "session-xxx" ломали вставку в PostgreSQL.
          id: generateUUID(),
          date: startTime,
          durationSec,
          exercises: currentExercises,
          completed: true,
        };
        // Полный сброс состояния активной тренировки.
        set({ ...initialState });
        return session;
      },

      addExercise: (exerciseId: string, targets?: ExerciseTargets) => {
        const { currentExercises, defaultRestTime } = get();
        // Не дублируем упражнение, если оно уже есть в сессии.
        if (currentExercises.some((e) => e.exerciseId === exerciseId)) {
          return;
        }
        set({
          currentExercises: [
            ...currentExercises,
            {
              exerciseId,
              sets: [createEmptySet(defaultRestTime)],
              // Целевые параметры из плана (если тренировка начата по плану).
              ...(targets !== undefined ? { targets } : {}),
            },
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
        // Повторное нажатие ✓ на уже выполненном подходе — только перезапуск отдыха.
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

      /**
       * Корректировка ТЕКУЩЕГО отдыха на delta секунд (+15 / −15).
       * Остаток пересчитываем от абсолютной метки restStartedAt (как в useRestTimer),
       * затем стартуем новый отсчёт: restStartedAt = now, restTimeLeftSec = новый остаток.
       * Если отдых не активен — меняем плановую длительность для следующих подходов.
       */
      adjustRestTime: (delta: number) => {
        const { isResting, restStartedAt, restTimeLeftSec, defaultRestTime } = get();
        if (isResting && restStartedAt !== null) {
          const passedSec = Math.floor((Date.now() - restStartedAt) / 1000);
          const currentRemaining = Math.max(0, restTimeLeftSec - passedSec);
          const newRemaining = Math.max(MIN_REST_TIME, currentRemaining + delta);
          set({ restStartedAt: Date.now(), restTimeLeftSec: newRemaining });
          return;
        }
        set({ defaultRestTime: Math.max(MIN_REST_TIME, defaultRestTime + delta) });
      },

      skipRest: () => {
        set({ isResting: false, restStartedAt: null, restTimeLeftSec: get().defaultRestTime });
      },

      toggleInjury: (type: InjuryType) => {
        const { userInjuries } = get();
        // Инвертируем выбранный флаг травмы, остальные сохраняем.
        set({ userInjuries: { ...userInjuries, [type]: !userInjuries[type] } });
      },

      /** Полная синхронизация derived-полей (травмы + отдых) с профилем из userStore. */
      syncWithProfile: () => {
        set(syncFromProfile());
      },

      /** Сохраняет завершённую тренировку в Supabase; при сбое — в очередь офлайн-синхронизации. */
      syncSessionToCloud: async (session: WorkoutSession) => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) {
          // Не авторизован — сохраняем локально: история (historyStore) уже записана,
          // в облако уйдёт после входа через повторный вызов или очередь не нужна.
          console.warn('[workoutStore] Пользователь не авторизован — сессия осталась только в локальной истории.');
          return;
        }
        const { sessionId, sessionRow, setRows } = buildCloudPayload(userId, session);
        try {
          // 1) Сессия.
          const { error: sessionError } = await supabase.from('workout_sessions').upsert(sessionRow);
          if (sessionError) throw sessionError;
          // 2) Подходы (одной пакетной вставкой).
          if (setRows.length > 0) {
            const { error: setsError } = await supabase.from('workout_sets').insert(setRows);
            if (setsError) throw setsError;
          }
          console.info(`[workoutStore] Сессия ${sessionId} синхронизирована с облаком.`);
        } catch (error) {
          // Нет соединения / ошибка БД — кладём в очередь, отправим при появлении сети.
          console.error('[workoutStore] Ошибка облачной синхронизации — данные помещены в очередь:', error);
          addToQueue({ session: sessionRow, sets: setRows });
        }
      },
    }),
    {
      name: 'fit-tracker-workout',
    },
  ),
);

// Источник истины по травмам и отдыху — профиль пользователя (userStore).
// При любом изменении профиля обновляем derived-состояние workoutStore,
// чтобы фильтрация упражнений мгновенно реагировала на настройки.
useUserStore.subscribe((state, prevState) => {
  if (state.profile !== prevState.profile) {
    useWorkoutStore.getState().syncWithProfile();
  }
});
