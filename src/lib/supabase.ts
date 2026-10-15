import { createClient, type Session } from '@supabase/supabase-js';

/**
 * Единая точка доступа к Supabase.
 * URL и anon-ключ читаются из переменных окружения Vite (.env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
 * Anon-ключ публичный (виден в бандле), поэтому безопасность обеспечивают RLS-политики на стороне БД.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Не роняем приложение — предупреждаем: без конфигурации облачные функции будут падать с понятной ошибкой.
  console.warn(
    '[supabase] Не заданы VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — облачные функции недоступны.',
  );
}

/* ------------------------------------------------------------------ */
/*  Полная типизация базы данных (без автогенерации типов).            */
/*  Соответствует реальным таблицам проекта: profiles, exercises,      */
/*  workout_sessions, workout_sets (snake_case, как в Postgres).       */
/* ------------------------------------------------------------------ */

/** Тип значений JSON-колонок Supabase (стандартное определение из генератора типов). */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/**
 * Схема Database для дженерика createClient<Database>.
 * Каждая таблица описана тройкой Row / Insert / Update — именно этого
 * ожидает postgrest-js для корректной типизации .insert() и .upsert().
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          name: string | null;
          has_shoulder_injury: boolean;
          has_knee_injury: boolean;
          has_lower_back_injury: boolean;
          default_rest_time: number;
          units: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          email?: string | null;
          name?: string | null;
          has_shoulder_injury?: boolean;
          has_knee_injury?: boolean;
          has_lower_back_injury?: boolean;
          default_rest_time?: number;
          units?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          name?: string | null;
          has_shoulder_injury?: boolean;
          has_knee_injury?: boolean;
          has_lower_back_injury?: boolean;
          default_rest_time?: number;
          units?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      exercises: {
        Row: {
          id: string;
          name: string;
          muscle_group: string;
          equipment: string;
          is_shoulder_safe: boolean;
          is_knee_safe: boolean;
          is_lower_back_safe: boolean;
          alternatives: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          muscle_group: string;
          equipment: string;
          is_shoulder_safe?: boolean;
          is_knee_safe?: boolean;
          is_lower_back_safe?: boolean;
          alternatives?: string[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          muscle_group?: string;
          equipment?: string;
          is_shoulder_safe?: boolean;
          is_knee_safe?: boolean;
          is_lower_back_safe?: boolean;
          alternatives?: string[] | null;
          created_at?: string;
        };
        Relationships: [];
      };
      workout_sessions: {
        Row: {
          id: string;
          user_id: string;
          started_at: string;
          duration_sec: number;
          completed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          started_at: string;
          duration_sec?: number;
          completed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          started_at?: string;
          duration_sec?: number;
          completed?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      workout_sets: {
        Row: {
          id: string;
          session_id: string;
          exercise_id: string | null;
          weight: number;
          reps: number;
          rpe: number | null;
          rest_time_sec: number;
          is_completed: boolean;
          completed_at: string | null;
          order: number;
        };
        Insert: {
          id?: string;
          session_id: string;
          exercise_id?: string | null;
          weight?: number;
          reps?: number;
          rpe?: number | null;
          rest_time_sec?: number;
          is_completed?: boolean;
          completed_at?: string | null;
          "order"?: number;
        };
        Update: {
          id?: string;
          session_id?: string;
          exercise_id?: string | null;
          weight?: number;
          reps?: number;
          rpe?: number | null;
          rest_time_sec?: number;
          is_completed?: boolean;
          completed_at?: string | null;
          "order"?: number;
        };
        Relationships: [];
      };
      // Push-подписки (Web Push). Таблица создается SQL-миграцией; типы свободные.
      push_subscriptions: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

/* ------------------------------------------------------------------ */
/*  Доменные типы слоя Supabase — выводятся из схемы Database.         */
/* ------------------------------------------------------------------ */

/** Строка таблицы «профили пользователей». */
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
/** Строка таблицы «упражнения» (справочник). */
export type ExerciseRow = Database['public']['Tables']['exercises']['Row'];
/** Строка таблицы «тренировочные сессии». */
export type WorkoutSessionRow = Database['public']['Tables']['workout_sessions']['Row'];
/** Строка таблицы «подходы». */
export type WorkoutSetRow = Database['public']['Tables']['workout_sets']['Row'];

/** Формы вставки/обновления (для строгой типизации payload'ов insert/upsert). */
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ExerciseInsert = Database['public']['Tables']['exercises']['Insert'];
export type WorkoutSessionInsert = Database['public']['Tables']['workout_sessions']['Insert'];
export type WorkoutSetInsert = Database['public']['Tables']['workout_sets']['Insert'];

/** Псевдонимы доменных типов по требованиям задачи. */
export type Profile = ProfileRow;
export type Exercise = ExerciseRow;
export type CloudWorkoutSession = WorkoutSessionRow;
export type CloudWorkoutSet = WorkoutSetRow;

/** Клиент Supabase (auth + rest). Экспортируется как единственная точка доступа. */
export const supabase = createClient<Database>(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'public-anon-key',
);

/** Тип сессии аутентификации Supabase (реэкспорт для удобства stores/pages). */
export type AuthSession = Session;
