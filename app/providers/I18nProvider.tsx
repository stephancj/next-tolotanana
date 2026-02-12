'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Locale, defaultLocale } from '@/lib/i18n-config';
import { getLocale } from '@/lib/locale-storage';
import frMessages from '@/messages/fr.json';
import enMessages from '@/messages/en.json';

type Messages = typeof frMessages;

interface I18nContextType {
  locale: Locale;
  messages: Messages;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const messagesMap: Record<Locale, Messages> = {
  fr: frMessages,
  en: enMessages,
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedLocale = getLocale();
    setLocale(storedLocale);
  }, []);

  const messages = messagesMap[locale];

  // Translation function with support for nested keys and parameter interpolation
  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = messages;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }

    if (typeof value !== 'string') {
      console.warn(`Translation value is not a string: ${key}`);
      return key;
    }

    // Replace parameters in the string (e.g., {name})
    if (params) {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        value = value.replace(`{${paramKey}}`, String(paramValue));
      });
    }

    return value;
  };

  // Prevent hydration mismatch by not rendering children until mounted
  if (!mounted) {
    return <div className="min-h-screen bg-slate-50/80">{children}</div>;
  }

  return (
    <I18nContext.Provider value={{ locale, messages, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslations(namespace?: string) {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useTranslations must be used within I18nProvider');
  }

  return (key: string, params?: Record<string, string | number>): string => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    return context.t(fullKey, params);
  };
}

export function useLocale() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useLocale must be used within I18nProvider');
  }

  return context.locale;
}
