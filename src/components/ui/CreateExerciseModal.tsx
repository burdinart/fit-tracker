import { useState } from 'react';
import type { Equipment, MuscleGroup } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { muscleGroupLabels } from '../../utils/labels';

/** Пропсы модалки создания пользовательского упражнения. */
export interface CreateExerciseModalProps {
  /** Вызывается при закрытии (крестик, фон, отмена). */
  onClose: () => void;
  /** Вызывается после успешного сохранения — родитель перезапрашивает справочник. */
  onCreated: () => void;
}

/** Значения select «Инвентарь» — соответствуют доменному типу Equipment. */
const equipmentOptions: { value: Equipment; label: string }[] = [
  { value: 'barbell', label: 'Штанга' },
  { value: 'dumbbell', label: 'Гантели' },
  { value: 'machine', label: 'Тренажёр' },
  { value: 'bodyweight', label: 'Собственный вес' },
  { value: 'cable', label: 'Блок / кроссовер' },
];

/** Порядок и подписи чекбоксов безопасности. */
const safetyOptions: { key: 'shoulder' | 'knee' | 'lowerBack'; label: string }[] = [
  { key: 'shoulder', label: 'Безопасно для плеч' },
  { key: 'knee', label: 'Безопасно для коленей' },
  { key: 'lowerBack', label: 'Безопасно для поясницы' },
];

/**
 * Модалка создания пользовательского упражнения (ШАГ 4).
 * Поля: название, группа мышц, инвентарь + три чекбокса безопасности.
 * При сохранении вставляет строку в Supabase (is_custom = true, created_by = id
 * текущего пользователя) — RLS-политика «Users can insert custom exercises»
 * разрешает вставку только аутентифицированным.
 */
export function CreateExerciseModal({ onClose, onCreated }: CreateExerciseModalProps) {
  const userId = useAuthStore((state) => state.user?.id);

  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('chest');
  const [equipment, setEquipment] = useState<Equipment>('barbell');
  const [shoulderSafe, setShoulderSafe] = useState(true);
  const [kneeSafe, setKneeSafe] = useState(true);
  const [lowerBackSafe, setLowerBackSafe] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && !isSaving && userId !== undefined;

  /** Вставляет упражнение в таблицу exercises и уведомляет родителя. */
  const handleSave = async (): Promise<void> => {
    if (userId === undefined || trimmedName.length === 0) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from('exercises').insert({
        name: trimmedName,
        muscle_group: muscleGroup,
        equipment: equipment,
        is_shoulder_safe: shoulderSafe,
        is_knee_safe: kneeSafe,
        is_lower_back_safe: lowerBackSafe,
        is_custom: true,
        created_by: userId,
      });
      if (insertError !== null) {
        throw insertError;
      }
      onCreated();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Не удалось сохранить упражнение');
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-exercise-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-800 p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="create-exercise-title" className="text-xl font-bold text-slate-100">
            Новое упражнение
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="min-h-[44px] min-w-[44px] rounded-xl text-2xl leading-none text-slate-400 transition hover:bg-slate-700 hover:text-white"
          >
            ×
          </button>
        </div>

        {/* Название */}
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-300">Название</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Например: Тяга гантели одной рукой"
            maxLength={80}
            className="min-h-[48px] w-full rounded-xl border border-slate-600 bg-slate-900 px-3 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </label>

        {/* Группа мышц */}
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-300">Группа мышц</span>
          <select
            value={muscleGroup}
            onChange={(event) => setMuscleGroup(event.target.value as MuscleGroup)}
            className="min-h-[48px] w-full rounded-xl border border-slate-600 bg-slate-900 px-3 text-slate-100 focus:border-emerald-500 focus:outline-none"
          >
            {(Object.keys(muscleGroupLabels) as MuscleGroup[]).map((group) => (
              <option key={group} value={group}>
                {muscleGroupLabels[group]}
              </option>
            ))}
          </select>
        </label>

        {/* Инвентарь */}
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-300">Инвентарь</span>
          <select
            value={equipment}
            onChange={(event) => setEquipment(event.target.value as Equipment)}
            className="min-h-[48px] w-full rounded-xl border border-slate-600 bg-slate-900 px-3 text-slate-100 focus:border-emerald-500 focus:outline-none"
          >
            {equipmentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {/* Чекбоксы безопасности */}
        <fieldset className="space-y-1">
          <legend className="mb-1 text-sm font-medium text-slate-300">Безопасность суставов</legend>
          {safetyOptions.map(({ key, label }) => {
            const checked =
              key === 'shoulder' ? shoulderSafe : key === 'knee' ? kneeSafe : lowerBackSafe;
            const toggle =
              key === 'shoulder'
                ? setShoulderSafe
                : key === 'knee'
                  ? setKneeSafe
                  : setLowerBackSafe;
            return (
              <label
                key={key}
                className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl px-1 text-sm text-slate-200 hover:bg-slate-700/50"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => toggle(event.target.checked)}
                  className="h-5 w-5 shrink-0 accent-emerald-500"
                />
                {label}
              </label>
            );
          })}
        </fieldset>

        {error !== null && (
          <p className="rounded-xl border border-rose-600 bg-rose-950/50 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] flex-1 rounded-xl border border-slate-600 bg-slate-700/60 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canSave}
            className="min-h-[48px] flex-1 rounded-xl bg-emerald-600 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
