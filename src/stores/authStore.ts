import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase, type Database, type ProfileRow } from '../lib/supabase';
import { DEFAULT_REST_TIME } from './workoutStore';

/** Форма вставки профиля (приводим payload явно — strict TS). */
type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];

/** Обязательные поля профиля (без id/email/name/created_at) — Required по оставшимся полям Insert-формы. */
type ProfileRowDefaults = Required<Omit<ProfileInsert, 'id' | 'email' | 'name' | 'created_at'>>;

/** Профиль по умолчанию — тот же, что создаётся при первом входе без строки в таблице. */
const DEFAULT_PROFILE_FIELDS: ProfileRowDefaults = {
  has_shoulder_injury: false,
  has_knee_injury: false,
  has_lower_back_injury: false,
  default_rest_time: DEFAULT_REST_TIME,
  units: 'kg',
};

/** Собирает полный ProfileInsert из id/email/name + дефолтных настроек. */
function buildDefaultProfile(
  id: string,
  email: string | null,
  name: string | null,
): ProfileInsert {
  return { id, email, name, created_at: new Date().toISOString(), ...DEFAULT_PROFILE_FIELDS };
}

/** Локальный профиль-фолбэк (при недоступности Supabase) — структура ProfileRow + дефолты. */
function buildFallbackProfileRow(user: User): ProfileRow {
  const defaults = DEFAULT_PROFILE_FIELDS;
  return {
    id: user.id,
    email: user.email ?? null,
    name: getNameFromMetadata(user),
    has_shoulder_injury: defaults.has_shoulder_injury,
    has_knee_injury: defaults.has_knee_injury,
    has_lower_back_injury: defaults.has_lower_back_injury,
    default_rest_time: defaults.default_rest_time,
    units: defaults.units,
    created_at: new Date().toISOString(),
  };
}

/** Извлекает имя пользователя из метаданных Supabase Auth. */
function getNameFromMetadata(user: User): string | null {
  return ((user.user_metadata as { name?: string })?.name) ?? null;
}

/**
 * Zustand store аутентификации через Supabase Auth.
 * persist НЕ используется: сессия (access/refresh token) хранится самим Supabase
 * в localStorage — здесь только производное состояние (user, profile, isLoading).
 */

/** Ошибки авторизации, переводимые на русский для UI. */
const authErrorMessages: Record<string, string> = {
  'Invalid login credentials': 'Неверный email или пароль',
  'User already registered': 'Пользователь с таким email уже зарегистрирован',
  'Email not confirmed': 'Подтвердите email перед входом',
};

/** Ошибки Supabase, не попавшие в словарь, — сопоставление по подстроке. */
const authErrorFallbacks: Array<[string, string]> = [
  ['For security purposes', 'Слишком много попыток с этого IP (защита Supabase). Попробуйте позже или через другую сеть.'],
  ['rate limit', 'Слишком много попыток. Подождите немного и попробуйте снова.'],
  ['Unable to validate email address', 'Supabase отклонил этот email как некорректный. Укажите реальный адрес почты.'],
  ['invalid signup credentials', 'Регистрация отключена на сервере. Проверьте настройки Auth в проекте Supabase.'],
];

/** Преобразует ошибку Supabase в человекочитаемое сообщение. */
export function translateAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (authErrorMessages[message]) return authErrorMessages[message];
  for (const [needle, human] of authErrorFallbacks) {
    if (message.toLowerCase().includes(needle.toLowerCase())) return human;
  }
  return message;
}

/** Состояние и экшены авторизации. */
export interface AuthState {
  /** Текущий пользователь Supabase Auth (null — не авторизован). */
  user: User | null;
  /** Профиль пользователя из таблицы profiles (null — ещё не загружен). */
  profile: ProfileRow | null;
  /** Идёт ли начальная проверка сессии / сетевой запрос. */
  isLoading: boolean;
  /** Проверяет сохранённую сессию Supabase при загрузке приложения. */
  initSession: () => Promise<void>;
  /** Вход по email/паролю. Возвращает текст ошибки или null при успехе. */
  signIn: (email: string, password: string) => Promise<string | null>;
  /** Регистрация: создаёт auth-пользователя и строку профиля; может вернуть requireConfirmation. */
  signUp: (
    email: string,
    password: string,
    name: string,
  ) => Promise<{ error: string | null; requireConfirmation: boolean }>;
  /** Выход из аккаунта. */
  signOut: () => Promise<void>;
  /** Загружает (или создаёт с дефолтами) профиль текущего пользователя. */
  fetchProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,

  initSession: async () => {
    try {
      // Автоматическая проверка сессии при старте приложения.
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      set({ user: data.session?.user ?? null, isLoading: false });
      if (data.session?.user) {
        await get().fetchProfile();
      }
    } catch (error) {
      console.error('[authStore] Не удалось проверить сессию:', error);
      set({ user: null, profile: null, isLoading: false });
    }
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      set({ user: data.user ?? null });
      await get().fetchProfile();
      return null;
    } catch (error) {
      console.error('[authStore] Ошибка входа:', error);
      return translateAuthError(error);
    } finally {
      set({ isLoading: false });
    }
  },

  signUp: async (email: string, password: string, name: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: name.trim() } },
      });
      if (error) throw error;
      // Если подтверждение email включено — пользователь ещё не «вошёл»
      // (session === null). Создаём строку профиля заранее: при RLS-политике
      // «только свой профиль» анонимный upsert будет отклонён, но это не критично —
      // после подтверждения email при первом входе fetchProfile() создаст профиль сам.
      if (!data.session) {
        if (data.user) {
          try {
            const newProfile = buildDefaultProfile(
              data.user.id,
              data.user.email ?? null,
              name.trim() || null,
            );
            await supabase.from('profiles').upsert(newProfile);
          } catch (error) {
            console.error('[authStore] Не удалось создать профиль при регистрации:', error);
          }
        }
        return { error: null, requireConfirmation: true };
      }
      set({ user: data.user ?? null });
      await get().fetchProfile();
      return { error: null, requireConfirmation: false };
    } catch (error) {
      console.error('[authStore] Ошибка регистрации:', error);
      return { error: translateAuthError(error), requireConfirmation: false };
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('[authStore] Ошибка выхода:', error);
    } finally {
      set({ user: null, profile: null });
    }
  },

  fetchProfile: async () => {
    const user = get().user ?? (await supabase.auth.getSession()).data.session?.user ?? null;
    if (!user) {
      set({ profile: null });
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        set({ profile: data });
        return;
      }
      // Профиля ещё нет (например, триггер БД не сработал) — создаём с дефолтами.
      const newProfile = buildDefaultProfile(user.id, user.email ?? null, getNameFromMetadata(user));
      const { data: created, error: insertError } = await supabase
        .from('profiles')
        .upsert(newProfile)
        .select('*')
        .single();
      if (insertError) throw insertError;
      set({ profile: created });
    } catch (error) {
      console.error('[authStore] Не удалось загрузить профиль:', error);
      // Фолбэк: локально сконструированный профиль, чтобы приложение оставалось рабочим.
      set({ profile: buildFallbackProfileRow(user) });
    }
  },
}));

// Подписка на изменения состояния аутентификации (вход/выход/истечение токена),
// чтобы стор всегда отражал актуальную сессию Supabase.
supabase.auth.onAuthStateChange((event, session) => {
  const current = useAuthStore.getState();
  if (current.user?.id !== (session?.user?.id ?? undefined)) {
    useAuthStore.setState({ user: session?.user ?? null });
  }
  if (event === 'SIGNED_OUT') {
    useAuthStore.setState({ user: null, profile: null });
  }
});
