/**
 * Helper functions to translate database enum values to display language
 * Database stores French values, this translates them for display
 */

import { Locale } from './i18n-config';

export function translateDay(day: string | undefined | null, locale: Locale): string {
  if (!day) return '';

  const dayMap: Record<string, Record<Locale, string>> = {
    'Lundi': { fr: 'Lundi', en: 'Monday' },
    'Mardi': { fr: 'Mardi', en: 'Tuesday' },
    'Mercredi': { fr: 'Mercredi', en: 'Wednesday' },
    'Jeudi': { fr: 'Jeudi', en: 'Thursday' },
    'Vendredi': { fr: 'Vendredi', en: 'Friday' },
    'A définir': { fr: 'A définir', en: 'To define' },
  };

  return dayMap[day]?.[locale] || day;
}

export function translateDistance(distance: string | undefined | null, locale: Locale): string {
  if (!distance) return '';

  const distanceMap: Record<string, Record<Locale, string>> = {
    'en ville': { fr: 'en ville', en: 'In city' },
    'En ville': { fr: 'En ville', en: 'In city' },
    'un peu loin': { fr: 'un peu loin', en: 'Nearby' },
    'Un peu loin': { fr: 'Un peu loin', en: 'Nearby' },
    'loin': { fr: 'loin', en: 'Far' },
    'Loin': { fr: 'Loin', en: 'Far' },
    'non précisé': { fr: 'non précisé', en: 'Unspecified' },
    'Non précisé': { fr: 'Non précisé', en: 'Unspecified' },
  };

  return distanceMap[distance]?.[locale] || distance;
}

export function translatePharmacyStatus(status: string | undefined | null, locale: Locale): string {
  if (!status) return '';

  const statusMap: Record<string, Record<Locale, string>> = {
    'pending': { fr: 'À récupérer', en: 'Pending' },
    'retrieved': { fr: 'Médicaments récupérés', en: 'Medications retrieved' },
    'none': { fr: 'Aucune prescription', en: 'No prescription' },
  };

  return statusMap[status]?.[locale] || status;
}

export function translateGender(gender: string | undefined | null, locale: Locale): string {
  if (!gender) return '';

  const genderMap: Record<string, Record<Locale, string>> = {
    'M': { fr: 'Masculin', en: 'Male' },
    'F': { fr: 'Féminin', en: 'Female' },
  };

  return genderMap[gender]?.[locale] || gender;
}
