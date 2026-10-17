import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableItemProps {
  /** Уникальный id элемента для dnd-kit. */
  id: string;
  /** Содержимое карточки (рендерится как раньше). */
  children: ReactNode;
  /** Классы контейнера li (те же, что были у обычной карточки). */
  className: string;
}

/**
 * Обёртка списка элементов с поддержкой drag-and-drop (@dnd-kit).
 * Слева добавляется «ручка» перетаскивания (⠿) — остальной контент не меняется.
 * Используется в WorkoutPage для секций безопасных и ограниченных упражнений.
 */
export function SortableExerciseCard({ id, children, className }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <li ref={setNodeRef} style={style} className={`flex items-stretch gap-1 ${className}`}>
      {/* Ручка для перетаскивания */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="-my-1 shrink-0 cursor-grab touch-none self-center rounded-lg p-2 text-slate-400 transition-colors hover:text-slate-600 active:cursor-grabbing dark:text-slate-500 dark:hover:text-slate-300"
        aria-label="Перетащить упражнение для изменения порядка"
        title="Перетащите, чтобы изменить порядок"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
        </svg>
      </button>
      <div className="flex min-w-0 flex-1">{children}</div>
    </li>
  );
}
