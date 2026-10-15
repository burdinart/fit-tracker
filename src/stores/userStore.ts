import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { InjuryKey, UserProfile, UserInjuries } from '../types';

/**
 * Zustand store профиля пользователя.
 * Состояние сохраняется в localStorage (ключ 'fit-tracker-user'),
 * поэтому травмы, имя, единицы измерения и отдых по умолчанию переживают перезагрузку.
 * Источник истины для userInjuries — именно этот стор; workoutStore получает
 * их синхронизированную копию (см. WorkoutPage) и использует defaultRestTime при старте тренировки.
 */

/** Минимально допустимый отдых по умолчанию (сек) — защита от «слишком короткого» отдыха. */
const MIN_REST_TIME = 15;

/** Профиль по умолчанию для первого запуска (без сохранённых данных). */
const defaultProfile: UserProfile = {
  id: 'local-user',
  email: '',
  name: '',
  hasShoulderInjury: false,
  hasKneeInjury: false,
  hasLowerBackInjury: false,
  defaultRestTime: 90,
  units: 'kg',
};

/** Соотношение ключа флага травмы в профиле и ключа UserInjuries. */
const injuryFlagToKey: Record<InjuryKey, keyof UserInjuries> = {
  hasShoulderInjury: 'shoulder',
  hasKneeInjury: 'knee',
  hasLowerBackInjury: 'lowerBack',
};

/** Состояние и экшены профиля пользователя. */
export interface UserState {
  /** Текущий профиль пользователя. */
  profile: UserProfile;
  /** Частично обновляет профиль (валидирует отдых и единицы измерения). */
  updateProfile: (data: Partial<UserProfile>) => void;
  /** Переключает флаг травмы по ключу профиля (hasShoulderInjury / hasKneeInjury / hasLowerBackInjury). */
  toggleInjury: (key: InjuryKey) => void;
}

/** Store профиля с персистом в localStorage под ключом 'fit-tracker-user'. */
export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      profile: defaultProfile,

      updateProfile: (data: Partial<UserProfile>) => {
        set((state) => {
          const next: UserProfile = { ...state.profile, ...data };
          // Валидация числовых значений: отдых не ниже минимума, только конечное число.
          if (typeof data.defaultRestTime === 'number') {
            next.defaultRestTime = Number.isFinite(data.defaultRestTime)
              ? Math.max(MIN_REST_TIME, Math.round(data.defaultRestTime))
              : state.profile.defaultRestTime;
          }
          // Защита от мусорных единиц измерения.
          if (data.units !== undefined && data.units !== 'kg' && data.units !== 'lbs') {
            next.units = state.profile.units;
          }
          return { profile: next };
        });
      },

      toggleInjury: (key: InjuryKey) => {
        set((state) => ({
          profile: { ...state.profile, [key]: !state.profile[key] },
        }));
      },
    }),
    {
      name: 'fit-tracker-user',
    },
  ),
);

/**
 * Извлекает набор травм из профиля пользователя.
 * Единая точка конвертации UserProfile → UserInjuries для фильтров упражнений.
 */
export function getInjuriesFromProfile(profile: UserProfile): UserInjuries {
  return {
    shoulder: profile.hasShoulderInjury,
    knee: profile.hasKneeInjury,
    lowerBack: profile.hasLowerBackInjury,
  };
}

/** Возвращает список русских названий активных травм (для отображения в UI). */
export function getActiveInjuryLabels(injuries: UserInjuries): string[] {
  const labels: string[] = [];
  if (injuries.shoulder) labels.push('плеча');
  if (injuries.knee) labels.push('колена');
  if (injuries.lowerBack) labels.push('поясницы');
  return labels;
}

// Реэкспорт соотношения ключей — используется SettingsPage для рендера трёх тумблеров.
export { injuryFlagToKey };
