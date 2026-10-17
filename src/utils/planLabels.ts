/** Дни недели для планов тренировок (значения совпадают с миграцией 007: 'monday'…'sunday'). */
export type WeekDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

/** Все дни недели в порядке начала рабочей недели. */
export const WEEK_DAYS: readonly WeekDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

/** Русские подписи дней недели для интерфейса. */
export const weekDayLabels: Record<WeekDay, string> = {
  monday: 'Понедельник',
  tuesday: 'Вторник',
  wednesday: 'Среда',
  thursday: 'Четверг',
  friday: 'Пятница',
  saturday: 'Суббота',
  sunday: 'Воскресенье',
};

/** Короткие подписи дней для чипов и компактных карточек. */
export const weekDayShortLabels: Record<WeekDay, string> = {
  monday: 'Пн',
  tuesday: 'Вт',
  wednesday: 'Ср',
  thursday: 'Чт',
  friday: 'Пт',
  saturday: 'Сб',
  sunday: 'Вс',
};

/** Проверяет, является ли строка валидным значением дня недели. */
export function isWeekDay(value: unknown): value is WeekDay {
  return typeof value === 'string' && (WEEK_DAYS as readonly string[]).includes(value);
}
