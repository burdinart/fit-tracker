/** Пропсы переключателя-тумблера. */
export interface ToggleProps {
  /** Подписанное состояние (включено/выключено). */
  checked: boolean;
  /** Вызывается при переключении. */
  onChange: (next: boolean) => void;
  /** Основной текст рядом с тумблером. */
  label: string;
  /** Необязательная подсказка под основным текстом. */
  description?: string;
  /** Уникальное имя для aria-связки input ↔ label. */
  name: string;
}

/**
 * Переиспользуемый toggle-переключатель в стиле iOS: скрытый чекбокс +
 * визуальная дорожка с бегунком. Используется на экране настроек для
 * переключателей травм. Доступность: настоящий input[type=checkbox],
 * фокус-обводка, aria-метка.
 */
export function Toggle({ checked, onChange, label, description, name }: ToggleProps) {
  return (
    <label
      htmlFor={name}
      className="flex min-h-[56px] cursor-pointer items-center justify-between gap-4 py-1"
    >
      <span className="min-w-0">
        <span className="block font-medium text-slate-900 dark:text-slate-100">{label}</span>
        {description !== undefined && (
          <span className="block text-xs text-slate-500 dark:text-slate-400">{description}</span>
        )}
      </span>
      <input
        id={name}
        name={name}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      {/* Визуальная дорожка тумблера: реакция через peer-селекторы на скрытый input */}
      <span
        aria-hidden="true"
        className={`relative inline-block h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${
          checked ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700'
        } peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-400`}
      >
        <span
          className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </label>
  );
}
