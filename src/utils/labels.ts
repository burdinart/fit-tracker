import type { MuscleGroup } from '../types';

/**
 * Русские названия групп мышц для отображения в интерфейсе.
 */
export const muscleGroupLabels: Record<MuscleGroup, string> = {
  chest: 'Грудь',
  back: 'Спина',
  shoulders: 'Плечи',
  legs: 'Ноги',
  arms: 'Руки',
  core: 'Кор',
  cardio: 'Кардио',
};
