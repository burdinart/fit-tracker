/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Публичный VAPID-ключ для Web Push (не секрет; пустой — пуши отключены). */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Импортируемые SVG-ассеты (иконки) — Vite отдаёт URL собранного файла.
declare module '*.svg' {
  const url: string;
  export default url;
}
