/**
 * Gestion du stockage de l'édition sélectionnée en localStorage
 * Validité : 1 mois
 */

import { Edition } from './client-db';

const STORAGE_KEY = 'selectedEdition';
const VALIDITY_MONTHS = 1;

export interface StoredEdition {
    editionId: number;
    editionName: string;
    editionPlace: string;
    editionYear: number;
    expiresAt: string; // ISO timestamp
}

/**
 * Sauvegarde l'édition sélectionnée en localStorage
 * Validité : 1 mois à partir de maintenant
 */
export function saveSelectedEdition(edition: Edition): void {
    if (!edition.id) {
        console.error('Cannot save edition without ID');
        return;
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + VALIDITY_MONTHS);

    const storedData: StoredEdition = {
        editionId: edition.id,
        editionName: edition.name,
        editionPlace: edition.place,
        editionYear: edition.year,
        expiresAt: expiresAt.toISOString()
    };

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(storedData));
        console.log(`✅ Édition "${edition.name}" sauvegardée (expire le ${expiresAt.toLocaleDateString()})`);
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de l\'édition:', error);
    }
}

/**
 * Récupère l'édition sélectionnée depuis le localStorage
 * Retourne null si absente ou expirée
 */
export function getSelectedEdition(): StoredEdition | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            console.log('ℹ️  Aucune édition sauvegardée');
            return null;
        }

        const data: StoredEdition = JSON.parse(stored);
        const expiresAt = new Date(data.expiresAt);
        const now = new Date();

        // Vérifier si expiré
        if (expiresAt < now) {
            console.log(`⏰ Édition "${data.editionName}" expirée (${expiresAt.toLocaleDateString()})`);
            clearSelectedEdition();
            return null;
        }

        const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`✅ Édition "${data.editionName}" valide (expire dans ${daysRemaining} jours)`);
        return data;
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'édition:', error);
        clearSelectedEdition();
        return null;
    }
}

/**
 * Supprime l'édition sélectionnée du localStorage
 */
export function clearSelectedEdition(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
        console.log('🗑️  Édition supprimée du localStorage');
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'édition:', error);
    }
}

/**
 * Vérifie si une édition est sélectionnée et valide
 */
export function hasValidEdition(): boolean {
    return getSelectedEdition() !== null;
}

/**
 * Prolonge la validité de l'édition actuelle d'un mois
 */
export function extendEditionValidity(): boolean {
    const current = getSelectedEdition();
    if (!current) {
        console.log('⚠️  Aucune édition à prolonger');
        return false;
    }

    const newExpiresAt = new Date();
    newExpiresAt.setMonth(newExpiresAt.getMonth() + VALIDITY_MONTHS);

    const updated: StoredEdition = {
        ...current,
        expiresAt: newExpiresAt.toISOString()
    };

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        console.log(`✅ Validité prolongée jusqu'au ${newExpiresAt.toLocaleDateString()}`);
        return true;
    } catch (error) {
        console.error('Erreur lors de la prolongation:', error);
        return false;
    }
}

/**
 * Obtient le nombre de jours restants avant expiration
 */
export function getDaysUntilExpiration(): number | null {
    const current = getSelectedEdition();
    if (!current) return null;

    const expiresAt = new Date(current.expiresAt);
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
