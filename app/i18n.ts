import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales } from '@/lib/i18n-config';

export default getRequestConfig(async () => {
  // Default locale for server-side rendering
  const locale = 'fr';

  if (!locales.includes(locale as any)) notFound();

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default
  };
});
