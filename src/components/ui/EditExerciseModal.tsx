import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type { Exercise } from '../../types';
import type { ExerciseUpdates } from '../../services/exercisesService';

interface EditExerciseModalProps {
  exercise: Exercise;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: ExerciseUpdates) => Promise<void>;
}

/**
 * Модалка редактирования пользовательского упражнения.
 * Поддерживает светлую и темную темы; крупные поля ввода (min-h-[48px]) для мобильного UX.
 */
export function EditExerciseModal({
  exercise,
  isOpen,
  onClose,
  onSave,
}: EditExerciseModalProps): ReactElement | null {
  const [formData, setFormData] = useState<ExerciseUpdates>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Синхронизируем форму с упражнением при каждом открытии модалки.
  useEffect(() => {
    if (!isOpen) return;
    setFormData({
      name: exercise.name,
      muscle_group: exercise.muscleGroup,
      equipment: exercise.equipment,
      is_shoulder_safe: exercise.isShoulderSafe,
      is_knee_safe: exercise.isKneeSafe,
      is_lower_back_safe: exercise.isLowerBackSafe,
    });
    setError(null);
  }, [isOpen, exercise]);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!formData.name || formData.name.trim().length === 0) {
      setError('Название не может быть пустым.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      console.error('[EditExerciseModal] Ошибка сохранения:', err);
      setError(
        err instanceof Error ? err.message : 'Ошибка при сохранении. Попробуйте снова.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  const inputClass =
    'w-full min-h-[48px] rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100';
  const labelClass =
    'mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 dark:bg-slate-800">
        <h2 className="mb-4 text-2xl font-bold text-slate-900 dark:text-slate-100">
          Редактировать упражнение
        </h2>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {/* Название */}
          <div>
            <label className={labelClass} htmlFor="edit-ex-name">
              Название
            </label>
            <input
              id="edit-ex-name"
              type="text"
              value={formData.name ?? ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={inputClass}
              required
            />
          </div>

          {/* Группа мышц */}
          <div>
            <label className={labelClass} htmlFor="edit-ex-muscle">
              Группа мышц
            </label>
            <select
              id="edit-ex-muscle"
              value={formData.muscle_group ?? exercise.muscleGroup}
              onChange={(e) => setFormData({ ...formData, muscle_group: e.target.value })}
              className={inputClass}
            >
              <option value="chest">Грудь</option>
              <option value="back">Спина</option>
              <option value="shoulders">Плечи</option>
              <option value="legs">Ноги</option>
              <option value="arms">Руки</option>
              <option value="core">Кор</option>
              <option value="cardio">Кардио</option>
            </select>
          </div>

          {/* Инвентарь */}
          <div>
            <label className={labelClass} htmlFor="edit-ex-equip">
              Инвентарь
            </label>
            <select
              id="edit-ex-equip"
              value={formData.equipment ?? exercise.equipment}
              onChange={(e) => setFormData({ ...formData, equipment: e.target.value })}
              className={inputClass}
            >
              <option value="barbell">Штанга</option>
              <option value="dumbbell">Гантели</option>
              <option value="machine">Тренажер</option>
              <option value="bodyweight">Свой вес</option>
              <option value="cable">Блок</option>
            </select>
          </div>

          {/* Флаги безопасности */}
          <div className="space-y-2">
            <label className="flex min-h-[44px] items-center gap-2 text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={formData.is_shoulder_safe ?? exercise.isShoulderSafe}
                onChange={(e) =>
                  setFormData({ ...formData, is_shoulder_safe: e.target.checked })
                }
                className="h-5 w-5"
              />
              Безопасно для плеч
            </label>
            <label className="flex min-h-[44px] items-center gap-2 text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={formData.is_knee_safe ?? exercise.isKneeSafe}
                onChange={(e) =>
                  setFormData({ ...formData, is_knee_safe: e.target.checked })
                }
                className="h-5 w-5"
              />
              Безопасно для коленей
            </label>
            <label className="flex min-h-[44px] items-center gap-2 text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={formData.is_lower_back_safe ?? exercise.isLowerBackSafe}
                onChange={(e) =>
                  setFormData({ ...formData, is_lower_back_safe: e.target.checked })
                }
                className="h-5 w-5"
              />
              Безопасно для поясницы
            </label>
          </div>

          {error && <div className="text-sm text-red-500">{error}</div>}

          {/* Кнопки */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="min-h-[48px] flex-1 rounded-lg border border-slate-300 text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="min-h-[48px] flex-1 rounded-lg bg-blue-600 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
