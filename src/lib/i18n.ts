export const SITE_ORIGIN = 'https://bitevo.work';

export const supportedLocales = ['en', 'ru'] as const;
export type SiteLocale = (typeof supportedLocales)[number];

export const localeMeta: Record<SiteLocale, { htmlLang: string; ogLocale: string; dir: 'ltr' | 'rtl'; label: string }> = {
  en: { htmlLang: 'en', ogLocale: 'en_US', dir: 'ltr', label: 'English' },
  ru: { htmlLang: 'ru', ogLocale: 'ru_RU', dir: 'ltr', label: 'Русский' }
};

export function absoluteSiteUrl(path: string) {
  return new URL(path, SITE_ORIGIN).toString();
}

export function localizedPath(locale: SiteLocale, path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (locale === 'en') return normalized;
  return normalized === '/' ? '/ru' : `/ru${normalized}`;
}
