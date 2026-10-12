/**
 * Утилита тактильной обратной связи (вибрация) для PWA.
 * Используется при завершении подхода или срабатывании таймера отдыха.
 */

/** Длительность вибрации в миллисекундах. */
const HAPTIC_DURATION_MS = 50;

/**
 * Запускает короткую вибрацию, если браузер поддерживает Navigator Vibration API.
 * Безопасно вызывается на устройствах без поддержки (например, десктопном Safari).
 */
export function triggerHaptic(): void {
  // Проверяем наличие объекта navigator и метода vibrate.
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(HAPTIC_DURATION_MS);
  }
}
