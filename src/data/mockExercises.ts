import type { Exercise } from '../types';

/**
 * Моковый справочник упражнений для стартовой разработки.
 * В дальнейшем будет заменён на реальный источник данных / IndexedDB.
 */
export const mockExercises: Exercise[] = [
  {
    id: 'ex-dumbbell-press-neutral',
    name: 'Жим гантелей нейтральным хватом',
    muscleGroup: 'chest',
    equipment: 'dumbbell',
    isShoulderSafe: true,
    isKneeSafe: true,
    isLowerBackSafe: true,
  },
  {
    id: 'ex-barbell-bench-press',
    name: 'Жим штанги лежа',
    muscleGroup: 'chest',
    equipment: 'barbell',
    isShoulderSafe: false,
    isKneeSafe: true,
    isLowerBackSafe: true,
    alternatives: ['ex-dumbbell-press-neutral'],
  },
  {
    id: 'ex-back-squat',
    name: 'Приседания со штангой',
    muscleGroup: 'legs',
    equipment: 'barbell',
    isShoulderSafe: true,
    isKneeSafe: true,
    isLowerBackSafe: true,
  },
  {
    id: 'ex-deadlift',
    name: 'Становая тяга',
    muscleGroup: 'back',
    equipment: 'barbell',
    isShoulderSafe: true,
    isKneeSafe: true,
    isLowerBackSafe: false,
    alternatives: ['ex-pull-up'],
  },
  {
    id: 'ex-pull-up',
    name: 'Подтягивания',
    muscleGroup: 'back',
    equipment: 'bodyweight',
    isShoulderSafe: true,
    isKneeSafe: true,
    isLowerBackSafe: true,
  },
  {
    id: 'ex-hammer-press',
    name: 'Жим в хаммере',
    muscleGroup: 'shoulders',
    equipment: 'machine',
    isShoulderSafe: true,
    isKneeSafe: true,
    isLowerBackSafe: true,
  },
  {
    id: 'ex-overhead-press-behind-neck',
    name: 'Жим штанги из-за головы',
    muscleGroup: 'shoulders',
    equipment: 'barbell',
    isShoulderSafe: false,
    isKneeSafe: true,
    isLowerBackSafe: true,
    alternatives: ['ex-hammer-press'],
  },
  {
    id: 'ex-plank',
    name: 'Планка',
    muscleGroup: 'core',
    equipment: 'bodyweight',
    isShoulderSafe: true,
    isKneeSafe: true,
    isLowerBackSafe: true,
  },
];
