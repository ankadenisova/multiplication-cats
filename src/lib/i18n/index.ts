/**
 * UI dictionary for the current language.
 *
 *   import { t } from "@/lib/i18n";
 *   t.study.start            // "Start a session" or "Начать сессию"
 *
 * The language comes from APP_LOCALE (see locale.ts). To add a language: copy en.ts to
 * <code>.ts, translate, add it to DICTIONARIES and to LOCALES in locale.ts.
 */
import en, { type Dictionary } from "./en";
import ru from "./ru";
import { locale, type Locale } from "./locale";

const DICTIONARIES: Record<Locale, Dictionary> = { en, ru };

export const t: Dictionary = DICTIONARIES[locale];
export { locale };
export type { Locale, Dictionary };
