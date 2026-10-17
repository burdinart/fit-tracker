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

/** Упражнение внутри тренировочной сессии (с набором подходов). */
export interface WorkoutExercise {
  /** Ссылка на id упражнения из справочника. */
  exerciseId: string;
  /** Подходы, выполненные в этом упражнении. */
  sets: WorkoutSet[];
  /** Заметки к упражнению (техника, самочувствие). */
  notes?: string;
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
