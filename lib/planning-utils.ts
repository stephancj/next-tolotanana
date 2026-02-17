import { getAgeValue } from './age-utils';

export interface PatientCardData {
    id: number;
    public_id: string;
    last_name: string;
    first_name: string;
    age: string;
    distance: string;
    diagnosis_category: string;
    clinical_diagnosis: string;
    planning_day: string;
    program_mission: number;
    dossier_number: string;
    gender: string;
    assignedSurgeonIds: number[];
}

export interface SurgeonData {
    id: number;
    public_id: string;
    name: string;
    specialty?: string;
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

function getPriorityScore(patient: PatientCardData): number {
    let score = 0;

    // Distance scoring: far patients → higher priority (earlier days)
    if (patient.distance === 'loin') score += 100;
    else if (patient.distance === 'un peu loin') score += 50;

    // Baby scoring: young children → higher priority
    const ageYears = getAgeValue(patient.age);
    if (ageYears < 2) score += 80;
    else if (ageYears < 5) score += 30;

    return score;
}

/**
 * Auto-suggest day placements for unplanned patients.
 * Priority: far patients and babies → earlier days. Balances count across days.
 */
export function autoSuggestPlacements(
    unplannedRecords: PatientCardData[],
    existingByDay: Record<string, PatientCardData[]>,
): Record<number, string> {
    const result: Record<number, string> = {};

    // Count existing patients per day
    const dayCounts: Record<string, number> = {};
    for (const day of DAYS) {
        dayCounts[day] = (existingByDay[day] || []).length;
    }

    const totalPlanned = Object.values(dayCounts).reduce((s, c) => s + c, 0);
    const totalToPlace = unplannedRecords.length;
    const maxPerDay = Math.ceil((totalPlanned + totalToPlace) / DAYS.length) + 1;

    // Sort by priority descending
    const sorted = [...unplannedRecords].sort((a, b) => getPriorityScore(b) - getPriorityScore(a));

    for (const patient of sorted) {
        // Find the best day: earliest day that has room
        let bestDay = DAYS[0];
        let minCount = Infinity;

        for (const day of DAYS) {
            const count = dayCounts[day];
            if (count < maxPerDay && count < minCount) {
                minCount = count;
                bestDay = day;
            }
        }

        // For high-priority patients, prefer earlier days even if slightly more loaded
        const score = getPriorityScore(patient);
        if (score >= 80) {
            for (const day of DAYS.slice(0, 2)) {
                if (dayCounts[day] < maxPerDay) {
                    bestDay = day;
                    break;
                }
            }
        }

        result[patient.id!] = bestDay;
        dayCounts[bestDay]++;
    }

    return result;
}

/** Filter age range category */
export function getAgeCategory(age: string): 'baby' | 'child' | 'adult' {
    const years = getAgeValue(age);
    if (years < 2) return 'baby';
    if (years < 12) return 'child';
    return 'adult';
}
