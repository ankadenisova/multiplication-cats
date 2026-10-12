/**
 * UI language. Set APP_LOCALE=en or APP_LOCALE=ru in .env (default: en).
 * next.config.ts copies the value into the client bundle at build time, so this works in
 * server and client components alike. To add another language, create src/lib/i18n/<code>.ts
 * with the same shape as en.ts and register it in index.ts.
 */
export const LOCALES = ["en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

export function resolveLocale(value: string | undefined): Locale {
  const v = (value ?? "").trim().toLowerCase();
  return (LOCALES as readonly string[]).includes(v) ? (v as Locale) : "en";
}

export const locale: Locale = resolveLocale(process.env.APP_LOCALE);
