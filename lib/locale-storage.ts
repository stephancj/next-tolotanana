/**
 * Gestion du stockage de la langue sélectionnée en localStorage
 */

import { Locale, defaultLocale } from './i18n-config';

const LOCALE_STORAGE_KEY = 'userLocale';

/**
 * Sauvegarde la langue sélectionnée en localStorage
 */
export function saveLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    console.log(`✅ Langue "${locale}" sauvegardée`);
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la langue:', error);
  }
}

/**
 * Récupère la langue sélectionnée depuis le localStorage
 * Retourne la langue par défaut si absente
 */
export function getLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && (stored === 'fr' || stored === 'en')) {
      return stored as Locale;
    }
    return defaultLocale;
  } catch (error) {
    console.error('Erreur lors de la récupération de la langue:', error);
    return defaultLocale;
  }
}

/**
 * Supprime la langue sélectionnée du localStorage
 */
export function clearLocale(): void {
  try {
    localStorage.removeItem(LOCALE_STORAGE_KEY);
    console.log('🗑️  Langue supprimée du localStorage');
  } catch (error) {
    console.error('Erreur lors de la suppression de la langue:', error);
  }
}
