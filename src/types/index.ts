/**
 * Базовые типы данных приложения FitTracker.
 * Описывают упражнения, рабочие подходы, тренировки и профиль пользователя.
 */

/** Группы мышц, на которые направлены упражнения. */
export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'legs'
  | 'arms'
  | 'core'
  | 'cardio';

/** Типы оборудования, используемого в упражнениях. */
export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'bodyweight'
  | 'cable';

/** Упражнение из справочника. */
export interface Exercise {
  /** Уникальный идентификатор упражнения. */
  id: string;
  /** Название упражнения. */
  name: string;
  /** Целевая группа мышц. */
  muscleGroup: MuscleGroup;
  /** Требуемое оборудование. */
  equipment: Equipment;
  /** Безопасно для плечевых суставов. */
  isShoulderSafe: boolean;
  /** Безопасно для коленных суставов. */
  isKneeSafe: boolean;
  /** Безопасно для поясницы. */
  isLowerBackSafe: boolean;
  /** Идентификаторы безопасных альтернатив (если упражнение травмоопасно). */
  alternatives?: string[];
  /** Автор упражнения (id пользователя Supabase), null для системных. */
  createdBy?: string | null;
  /** Пользовательское упражнение (создано из приложения, а не из справочника). */
  isCustom?: boolean;
  /** Порядок отображения в списке (колонка display_order, ставится при drag-and-drop). */
  displayOrder?: number;
}

/** Один рабочий подход в упражнении. */
export interface WorkoutSet {
  /** Уникальный идентификатор подхода. */
  id: string;
  /** Рабочий вес в килограммах. */
  weight: number;
  /** Количество повторений. */
  reps: number;
  /** RPE — субъективная оценка интенсивности (1–10), опционально. */
  rpe?: number;
  /** Флаг выполнения подхода. */
  isCompleted: boolean;
  /** Метка времени завершения подхода (мс). */
  completedAt?: number;
  /** Плановое время отдыха после подхода, в секундах. */
  restTimeSec: number;
}

/** Целевые параметры упражнения, взятые из плана тренировок. */
export interface ExerciseTargets {
  /** Плановое количество подходов. */
  targetSets: number;
  /** Плановое количество повторений в подходе. */
  targetReps: number;
  /** Целевой рабочий вес, кг. */
  targetWeight: number;
}

/** Упражнение внутри тренировочной сессии (с набором подходов). */
export interface WorkoutExercise {
  /** Ссылка на id упражнения из справочника. */
  exerciseId: string;
  /** Подходы, выполненные в этом упражнении. */
  sets: WorkoutSet[];
  /** Заметки к упражнению (техника, самочувствие). */
  notes?: string;
  /** Целевые параметры из плана тренировки (если сессия начата по плану). */
  targets?: ExerciseTargets;
}

/** План тренировки (шаблон), таблица Supabase «workout_plans». */
export interface WorkoutPlan {
  /** Уникальный идентификатор плана. */
  id: string;
  /** Идентификатор владельца плана. */
  user_id: string;
  /** Название плана. */
  name: string;
  /** Описание плана (опционально). */
  description?: string | null;
  /** День недели для расписания ('monday'…'sunday' или null). */
  day_of_week?: string | null;
  /** Метка времени создания (ISO-строка). */
  created_at: string;
}

/** Упражнение внутри плана тренировки, таблица Supabase «workout_plan_exercises». */
export interface WorkoutPlanExercise {
  /** Уникальный идентификатор строки плана. */
  id: string;
  /** Ссылка на план. */
  plan_id: string;
  /** Ссылка на упражнение из справочника. */
  exercise_id: string;
  /** Порядок упражнения в плане. */
  order: number;
  /** Целевое количество подходов. */
  target_sets: number;
  /** Целевое количество повторений. */
  target_reps: number;
  /** Целевой рабочий вес, кг. */
  target_weight: number;
  /** Плановое время отдыха после подхода, сек. */
  rest_time_sec: number;
  /** Заметки (опционально). */
  notes?: string | null;
  /** Упражнение из справочника (результат join «exercise:exercises(*)»). */
  exercise?: Exercise;
}

/** Завершённая или текущая тренировочная сессия. */
export interface WorkoutSession {
  /** Уникальный идентификатор сессии. */
  id: string;
  /** Метка времени начала тренировки (мс). */
  date: number;
  /** Длительность тренировки в секундах. */
  durationSec: number;
  /** Список упражнений с подходами. */
  exercises: WorkoutExercise[];
  /** Шаблон, по которому выполнена тренировка (опционально). */
  templateId?: string;
  /** Признак завершённости сессии. */
  completed: boolean;
}

/** Единицы измерения веса. */
export type WeightUnits = 'kg' | 'lbs';

/** Клавиша травмы, соответствующая флагам UserProfile. */
export type InjuryKey = 'hasShoulderInjury' | 'hasKneeInjury' | 'hasLowerBackInjury';

/** Набор активных травм пользователя (используется для фильтрации упражнений). */
export interface UserInjuries {
  /** Травма плеча. */
  shoulder: boolean;
  /** Травма колена. */
  knee: boolean;
  /** Травма поясницы. */
  lowerBack: boolean;
}

/** Профиль пользователя с параметрами ограничений и настроек. */
export interface UserProfile {
  /** Уникальный идентификатор пользователя. */
  id: string;
  /** Электронная почта. */
  email: string;
  /** Отображаемое имя. */
  name: string;
  /** Есть ли травма плеча (фильтрует небезопасные для плеч упражнения). */
  hasShoulderInjury: boolean;
  /** Есть ли травма колена. */
  hasKneeInjury: boolean;
  /** Есть ли травма поясницы. */
  hasLowerBackInjury: boolean;
  /** Отдых по умолчанию между подходами, в секундах. */
  defaultRestTime: number;
  /** Единицы измерения веса. */
  units: WeightUnits;
}
