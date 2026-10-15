import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { InjuryKey, WeightUnits } from '../types';
import { useUserStore } from '../stores/userStore';
import { getSafeExercises } from '../utils/exerciseFilter';
import { mockExercises } from '../data/mockExercises';
import { Toggle } from '../components/ui/Toggle';

/** Описание одного toggle-переключателя травмы. */
interface InjuryToggleConfig {
  /** Ключ флага в UserProfile. */
  key: InjuryKey;
  /** Подпись в интерфейсе. */
  label: string;
  /** Подсказка: сколько упражнений скрывает эта травма. */
  hint: string;
}

/** Три переключателя травм согласно постановке задачи. */
const injuryToggles: InjuryToggleConfig[] = [
  { key: 'hasShoulderInjury', label: 'Травма плеча', hint: 'жимы лёжа, жимы из-за головы' },
  { key: 'hasKneeInjury', label: 'Травма колена', hint: 'глубокие приседания, выпады' },
  { key: 'hasLowerBackInjury', label: 'Травма поясницы', hint: 'становая тяга, тяжёлые наклоны' },
];

/** Минимально допустимый отдых по умолчанию (сек) — согласован с userStore/workoutStore. */
const MIN_REST_SEC = 15;

/**
 * Экран настроек профиля.
 * Имя, единицы измерения, три toggle-переключателя травм и отдых по умолчанию.
 * Данные редактируются в локальном состоянии черновика и применяются к userStore
 * по кнопке «Сохранить» (persist → localStorage 'fit-tracker-user').
 * После сохранения показывается счётчик скрытых упражнений — обратная связь
 * о том, как настройки влияют на фильтрацию справочника.
 */
export function SettingsPage() {
  const profile = useUserStore((state) => state.profile);
  const updateProfile = useUserStore((state) => state.updateProfile);

  // Черновик формы: инициализируется из сохранённого профиля.
  const [nameDraft, setNameDraft] = useState(profile.name);
  const [unitsDraft, setUnitsDraft] = useState<WeightUnits>(profile.units);
  const [restDraft, setRestDraft] = useState(String(profile.defaultRestTime));
  // Флаг «есть несохранённые изменения» и сообщение об успешном сохранении.
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Синхронизируем черновик, если профиль изменился извне (например, другая вкладка).
  useEffect(() => {
    setNameDraft(profile.name);
    setUnitsDraft(profile.units);
    setRestDraft(String(profile.defaultRestTime));
  }, [profile.name, profile.units, profile.defaultRestTime]);

  /** Текущие значения травм читаем напрямую из стора — тумблеры применяются мгновенно. */
  const isDirty =
    nameDraft !== profile.name ||
    unitsDraft !== profile.units ||
    restDraft !== String(profile.defaultRestTime);

  /** Сохранение текстовых полей и отдыха (травмы сохраняются сразу при переключении). */
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const parsedRest = Number.parseInt(restDraft, 10);
    updateProfile({
      name: nameDraft.trim(),
      units: unitsDraft,
      defaultRestTime: Number.isFinite(parsedRest) ? parsedRest : profile.defaultRestTime,
    });
    setSavedAt(Date.now());
  };

  /** Сколько упражнений скрылось бы при текущих (несохранённых) тумблерах травм. */
  const currentInjuries = {
    shoulder: profile.hasShoulderInjury,
    knee: profile.hasKneeInjury,
    lowerBack: profile.hasLowerBackInjury,
  };
  const { safe, unsafe } = getSafeExercises(mockExercises, currentInjuries);

  return (
    <main className="min-h-screen bg-slate-900 pb-32 text-slate-100">
      <header className="border-b border-slate-800 px-4 py-6">
        <h1 className="text-2xl font-bold tracking-tight">Настройки</h1>
        <p className="mt-1 text-sm text-slate-400">Профиль, ограничения и параметры тренировки</p>
      </header>

      <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-4 px-4 py-6">
        {/* Карточка: основные параметры */}
        <section className="rounded-2xl border border-slate-800 bg-slate-800/60 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Профиль
          </h2>

          <label htmlFor="settings-name" className="block">
            <span className="mb-1 block text-sm font-medium">Имя</span>
            <input
              id="settings-name"
              type="text"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              placeholder="Как к вам обращаться?"
              autoComplete="name"
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-3 text-base outline-none focus:border-emerald-500"
            />
          </label>

          <div className="mt-4">
            <span className="mb-1 block text-sm font-medium">Единицы измерения веса</span>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Единицы измерения">
              {(
                [
                  { value: 'kg' as const, label: 'Килограммы (кг)' },
                  { value: 'lbs' as const, label: 'Фунты (lbs)' },
                ]
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={unitsDraft === option.value}
                  onClick={() => setUnitsDraft(option.value)}
                  className={`min-h-[48px] rounded-xl border px-3 text-sm font-medium transition ${
                    unitsDraft === option.value
                      ? 'border-emerald-500 bg-emerald-600/20 text-emerald-300'
                      : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <label htmlFor="settings-rest" className="mt-4 block">
            <span className="mb-1 block text-sm font-medium">Отдых по умолчанию, сек</span>
            <input
              id="settings-rest"
              type="number"
              inputMode="numeric"
              min={MIN_REST_SEC}
              step={5}
              value={restDraft}
              onChange={(event) => setRestDraft(event.target.value)}
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-3 text-base tabular-nums outline-none focus:border-emerald-500"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Минимум {MIN_REST_SEC} секунд. Используется для новых подходов и таймера отдыха.
            </span>
          </label>
        </section>

        {/* Карточка: переключатели травм */}
        <section className="rounded-2xl border border-slate-800 bg-slate-800/60 p-4">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Ограничения (травмы)
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            Небезопасные упражнения скрываются из списка выбора; их можно добавить только через
            предупреждение. Переключения применяются сразу.
          </p>
          <div className="divide-y divide-slate-700/70">
            {injuryToggles.map((toggle) => (
              <Toggle
                key={toggle.key}
                name={toggle.key}
                label={toggle.label}
                description={`Скрывает небезопасные: ${toggle.hint}`}
                checked={profile[toggle.key]}
                onChange={() => useUserStore.getState().toggleInjury(toggle.key)}
              />
            ))}
          </div>
          <p className="mt-3 rounded-xl bg-slate-900/70 px-3 py-2 text-xs text-slate-400">
            Сейчас доступно <span className="font-semibold text-emerald-400">{safe.length}</span>{' '}
            из {mockExercises.length} упражнений
            {unsafe.length > 0 && (
              <>
                {' '}· скрыто по травмам:{' '}
                <span className="font-semibold text-rose-400">{unsafe.length}</span>
              </>
            )}
          </p>
        </section>

        {/* Сообщение о сохранении */}
        {savedAt !== null && !isDirty && (
          <p className="rounded-xl border border-emerald-700 bg-emerald-900/30 px-4 py-2.5 text-sm text-emerald-300">
            ✓ Настройки сохранены
          </p>
        )}

        <button
          type="submit"
          className="min-h-[56px] w-full rounded-2xl bg-emerald-600 text-lg font-bold text-white transition hover:bg-emerald-500 active:scale-[0.99]"
        >
          Сохранить
        </button>
      </form>
    </main>
  );
}
