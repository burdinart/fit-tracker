/** Идентификаторы вкладок нижней навигации. */
export type TabId = 'workout' | 'plans' | 'history' | 'stats' | 'settings';

/** Пропсы нижней навигации. */
export interface BottomNavProps {
  /** Активная вкладка. */
  activeTab: TabId;
  /** Вызывается при выборе другой вкладки. */
  onChange: (tab: TabId) => void;
}

/** Конфигурация вкладок: id, подпись, иконка. */
const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: 'workout', label: 'Тренировка', icon: '🏋️' },
  { id: 'plans', label: 'Планы', icon: '📋' },
  { id: 'history', label: 'История', icon: '📜' },
  { id: 'stats', label: 'Статистика', icon: '📈' },
  { id: 'settings', label: 'Настройки', icon: '⚙️' },
];

/**
 * Нижняя панель навигации (app-shell стиль PWA): пять вкладок —
 * «Тренировка», «Планы», «История», «Статистика» и «Настройки». Переключение — простой state в App
 * (роутер на этом этапе не нужен). Фиксирована снизу, затемнённый фон,
 * безопасная зона iPhone (env(safe-area-inset-bottom)).
 * Поддерживает светлую и тёмную темы (модификатор dark:).
 */
export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  return (
    <nav
      aria-label="Основная навигация"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-lg">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition ${
                isActive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span className="text-xl leading-none" aria-hidden="true">
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
