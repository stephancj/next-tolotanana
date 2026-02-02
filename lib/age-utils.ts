/**
 * Calcule l'âge à partir de la date de naissance
 * - Pour les bébés de moins de 8 semaines : affiche en semaines
 * - Pour les bébés de moins de 2 ans : affiche en mois
 * - Pour les autres : affiche en années
 */
export function calculateAge(dob: string): string {
    if (!dob) return '';

    const birthDate = new Date(dob);
    const today = new Date();

    // Calculer la différence en millisecondes
    const diffMs = today.getTime() - birthDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Moins de 8 semaines (56 jours) : afficher en semaines
    if (diffDays < 56) {
        const weeks = Math.floor(diffDays / 7);
        return weeks === 0 ? '< 1 semaine' :
            weeks === 1 ? '1 semaine' :
                `${weeks} semaines`;
    }

    // Calculer l'âge en mois
    let months = (today.getFullYear() - birthDate.getFullYear()) * 12;
    months += today.getMonth() - birthDate.getMonth();

    // Si le jour du mois actuel est inférieur au jour de naissance, soustraire un mois
    if (today.getDate() < birthDate.getDate()) {
        months--;
    }

    // Moins de 24 mois : afficher en mois
    if (months < 24) {
        return months === 1 ? '1 mois' : `${months} mois`;
    }

    // Calculer l'âge en années
    let years = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        years--;
    }

    return years === 0 ? '< 1 an' :
        years === 1 ? '1 an' :
            `${years} ans`;
}

/**
 * Convertit un âge numérique en format string
 * Utilisé pour la migration des données existantes
 */
export function convertNumericAge(age: number | string): string {
    if (typeof age === 'string') return age;
    if (!age || age === 0) return '';
    return age === 1 ? '1 an' : `${age} ans`;
}

/**
 * Extrait la valeur numérique d'un âge pour le tri
 */
export function getAgeValue(age: string): number {
    if (!age) return 0;

    const match = age.match(/(\d+)/);
    if (!match) return 0;

    const value = parseInt(match[1], 10);

    if (age.includes('semaine')) {
        return value / 52; // Convertir en fraction d'année
    } else if (age.includes('mois')) {
        return value / 12; // Convertir en fraction d'année
    }

    return value; // Déjà en années
}

/**
 * Décompose l'âge en années, mois et semaines pour affichage détaillé
 */
export function getAgeBreakdown(dob: string): { years: number; months: number; weeks: number; totalMonths: number } {
    if (!dob) return { years: 0, months: 0, weeks: 0, totalMonths: 0 };

    const birthDate = new Date(dob);
    const today = new Date();

    // Calculer la différence en millisecondes
    const diffMs = today.getTime() - birthDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(diffDays / 7);

    // Calculer l'âge total en mois
    let totalMonths = (today.getFullYear() - birthDate.getFullYear()) * 12;
    totalMonths += today.getMonth() - birthDate.getMonth();
    if (today.getDate() < birthDate.getDate()) {
        totalMonths--;
    }

    // Calculer les années complètes
    let years = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        years--;
    }

    // Calculer les mois restants (après avoir enlevé les années complètes)
    const remainingMonths = totalMonths - (years * 12);

    return {
        years: Math.max(0, years),
        months: Math.max(0, remainingMonths),
        weeks: Math.max(0, weeks),
        totalMonths: Math.max(0, totalMonths)
    };
}
