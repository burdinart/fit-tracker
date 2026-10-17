# Стандарты тем FitTracker

Единый стандарт цветовых классов Tailwind для светлой и тёмной тем.
Все новые компоненты обязаны использовать эти пары классов (светлая тема — базовый класс, тёмная — через модификатор `dark:`).

## Фоны
- Основной фон страницы: `bg-slate-50 dark:bg-slate-900`
- Карточки/панели: `bg-white dark:bg-slate-800`
- Вложенные карточки (в модалках): `bg-slate-50 dark:bg-slate-700`
- Инпуты: `bg-white dark:bg-slate-800`

## Текст
- Основной: `text-slate-900 dark:text-slate-100`
- Вторичный: `text-slate-600 dark:text-slate-400`
- Мутный (placeholder): `text-slate-400 dark:text-slate-500`

## Границы
- Обычные: `border-slate-200 dark:border-slate-700`
- Активные/фокус: `border-blue-500`

## Кнопки
- Основная (зелёная): `bg-green-600 hover:bg-green-700 text-white`
- Опасная (красная): `bg-red-600 hover:bg-red-700 text-white`
- Вторичная: `bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-600`
- Иконка: `text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700`

## Бейджи/метки
- Информационный: `bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400`
- Успех: `bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400`
- Предупреждение: `bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400`
- Опасность: `bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400`

## Правила
1. Никаких «только тёмных» классов без светлой альтернативы (`bg-slate-800`, `text-slate-100` и т.п. — только в паре с базовым светлым классом или с префиксом `dark:`).
2. Hover-состояния тоже задаются в парах: `hover:bg-slate-100 dark:hover:bg-slate-700`.
3. Минимальный размер сенсорных элементов — 44–48px (`min-h-[48px]`).
4. Контрастность текста проверять в обеих темах (WCAG AA).
