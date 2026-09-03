'use client';

import { useState, useEffect } from 'react';
import { Locale, locales, localeNames } from '@/lib/i18n-config';
import { saveLocale, getLocale } from '@/lib/locale-storage';

export default function LanguageSwitcher() {
  const [locale, setLocale] = useState<Locale>('fr');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
      setLocale(getLocale());
    });
  }, []);

  const handleLocaleChange = (newLocale: Locale) => {
    if (newLocale === locale) return;

    saveLocale(newLocale);
    setLocale(newLocale);

    // Reload page to apply new locale
    window.location.reload();
  };

  // Avoid hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="flex gap-2">
        <div className="px-3 py-1.5 rounded-lg bg-gray-100 w-20 h-9 animate-pulse"></div>
        <div className="px-3 py-1.5 rounded-lg bg-gray-100 w-20 h-9 animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {locales.map((loc) => (
        <button
          key={loc}
          onClick={() => handleLocaleChange(loc)}
          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
            locale === loc
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
          }`}
          aria-label={`Switch to ${localeNames[loc]}`}
        >
          {localeNames[loc]}
        </button>
      ))}
    </div>
  );
}
