# fit-tracker
PWA приложение для силовых тренировок с учетом ограничений и таймерами

## Стек
- **Vite** + **React 19** + **TypeScript** (strict)
- **Tailwind CSS v4** (CSS-first конфигурация через `@tailwindcss/vite`)
- **Zustand 5** с middleware `persist` (localStorage) — тренировка переживает перезагрузку
- **PWA**: web-app manifest, иконки, service worker (офлайн-кэш: network-first для навигации, cache-first для статики)

## Возможности
- Выбор упражнений из справочника с фильтрацией по ограничениям (травмы плеча / колена / поясницы)
- Экран активной тренировки: секундомер, карточки упражнений, подходы (вес / повторы / ✓)
- Таймер отдыха между подходами (+/−15 c, пропуск, вибрация по окончании)
- Все таймеры считаются от абсолютных меток `Date.now()` — корректны после сворачивания/заморозки вкладки

## Структура
```
src/
  types/          базовые типы данных (Exercise, WorkoutSet, WorkoutSession, UserProfile)
  data/           моковый справочник упражнений
  stores/         zustand-store активной тренировки (persist в localStorage)
  hooks/          useWorkoutTimer, useRestTimer
  components/     UI экрана тренировки (WorkoutHeader, ExerciseCard, RestTimer)
  pages/          WorkoutPage (экран выбора + экран тренировки)
  utils/          форматирование времени/веса, ярлыки, haptics
public/           манифест PWA, иконки, service worker
```

## Команды
```bash
npm install       # установка зависимостей
npm run dev       # локальная разработка (http://localhost:5173/fit-tracker/)
npm run build     # проверка типов (tsc --noEmit) + прод-сборка в dist/
npm run preview   # предпросмотр прод-сборки
```

## Деплой
GitHub Pages: workflow `.github/workflows/deploy.yml` собирает проект и публикует по адресу
https://burdinart.github.io/fit-tracker/ (базовый путь задан в `vite.config.ts`).
