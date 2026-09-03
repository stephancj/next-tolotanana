import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales } from '@/lib/i18n-config';

export default getRequestConfig(async () => {
  // Default locale for server-side rendering
  const locale: (typeof locales)[number] = 'fr';

  if (!locales.includes(locale)) notFound();

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default
  };
});
