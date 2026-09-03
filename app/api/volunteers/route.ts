import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/neon-db';
import { editions, volunteerRegistrations } from '@/lib/schema';
import { publicCorsHeaders } from '@/lib/public-cors';
import { sendVolunteerConfirmation } from '@/lib/brevo';

const allowedRoles = new Set(['accueil', 'enregistrement', 'logistique', 'interpretariat', 'restauration', 'communication']);
const allowedSkills = new Set(['organisation', 'relation-patient', 'premiers-secours', 'photo-video', 'reseaux-sociaux', 'traduction', 'conduite', 'cuisine']);
const allowedCommissions = new Set(['logistique', 'communication', 'technique', 'finance', 'sponsoring', 'hebergement']);
const allowedShirtSizes = new Set(['XS', 'S', 'M', 'L', 'XL', 'XXL']);
const allowedDiets = new Set(['aucune', 'sans-porc', 'vegetarien', 'vegetalien', 'halal', 'sans-gluten', 'sans-lactose', 'autre']);
const allowedOrganizationTypes = new Set(['rotaract', 'rotary']);
const allowedStatuses = new Set(['pending', 'accepted', 'waitlisted', 'rejected']);
const allowedAssignments = new Set(['', 'logistique', 'communication', 'technique', 'finance', 'sponsoring', 'hebergement']);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (value: unknown, max = 180) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const cleanList = (value: unknown, allowed: Set<string>, max = 12) => Array.isArray(value)
    ? [...new Set(value.map((item) => clean(item, 50)).filter((item) => allowed.has(item)))].slice(0, max)
    : [];
const cleanDates = (value: unknown) => Array.isArray(value)
    ? [...new Set(value.map((item) => clean(item, 10)).filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item)))].slice(0, 45)
    : [];
const cleanPreviousEditions = (value: unknown) => Array.isArray(value) ? value.slice(0, 8).map((item) => ({
    year: clean(item && typeof item === 'object' ? (item as Record<string, unknown>).year : '', 4),
    place: clean(item && typeof item === 'object' ? (item as Record<string, unknown>).place : '', 100),
    role: clean(item && typeof item === 'object' ? (item as Record<string, unknown>).role : '', 100),
})).filter((item) => item.year || item.place || item.role) : [];

const respond = (request: Request, body: object, status: number) => NextResponse.json(body, {
    status,
    headers: publicCorsHeaders(request),
});

const configuredAdminKey = () => process.env.VOLUNTEER_ADMIN_KEY || (process.env.NODE_ENV === 'development' ? 'tolotagnana-dev' : '');
const isAdmin = (request: Request) => {
    const expected = configuredAdminKey();
    return Boolean(expected && request.headers.get('x-admin-key') === expected);
};

export async function GET(request: Request) {
    if (!configuredAdminKey()) return respond(request, { error: 'Configurez VOLUNTEER_ADMIN_KEY sur le serveur.' }, 503);
    if (!isAdmin(request)) return respond(request, { error: 'Accès non autorisé.' }, 401);

    const rows = await db.select({
        public_id: volunteerRegistrations.public_id,
        first_name: volunteerRegistrations.first_name,
        last_name: volunteerRegistrations.last_name,
        email: volunteerRegistrations.email,
        phone: volunteerRegistrations.phone,
        organization_type: volunteerRegistrations.organization_type,
        club_name: volunteerRegistrations.club_name,
        club_status: volunteerRegistrations.club_status,
        city: volunteerRegistrations.city,
        preferred_roles: volunteerRegistrations.preferred_roles,
        available_full_mission: volunteerRegistrations.available_full_mission,
        available_dates: volunteerRegistrations.available_dates,
        has_previous_experience: volunteerRegistrations.has_previous_experience,
        skills: volunteerRegistrations.skills,
        other_skills: volunteerRegistrations.other_skills,
        preferred_commissions: volunteerRegistrations.preferred_commissions,
        motivation: volunteerRegistrations.motivation,
        contribution: volunteerRegistrations.contribution,
        tshirt_size: volunteerRegistrations.tshirt_size,
        dietary_preference: volunteerRegistrations.dietary_preference,
        dietary_details: volunteerRegistrations.dietary_details,
        emergency_contact_name: volunteerRegistrations.emergency_contact_name,
        emergency_contact_phone: volunteerRegistrations.emergency_contact_phone,
        assigned_commission: volunteerRegistrations.assigned_commission,
        status: volunteerRegistrations.status,
        created_at: volunteerRegistrations.created_at,
        edition_name: editions.name,
        edition_place: editions.place,
        edition_year: editions.year,
    }).from(volunteerRegistrations)
        .innerJoin(editions, eq(volunteerRegistrations.edition_id, editions.id))
        .orderBy(desc(volunteerRegistrations.created_at));

    return respond(request, rows, 200);
}

export async function PATCH(request: Request) {
    if (!configuredAdminKey()) return respond(request, { error: 'Configurez VOLUNTEER_ADMIN_KEY sur le serveur.' }, 503);
    if (!isAdmin(request)) return respond(request, { error: 'Accès non autorisé.' }, 401);
    const body = await request.json();
    const publicId = clean(body.public_id, 40);
    const status = clean(body.status, 20);
    const assignedCommission = clean(body.assigned_commission, 40);
    if (!publicId || !allowedStatuses.has(status) || !allowedAssignments.has(assignedCommission)) return respond(request, { error: 'Mise à jour invalide.' }, 400);

    const [updated] = await db.update(volunteerRegistrations).set({
        status,
        assigned_commission: assignedCommission || null,
        updated_at: new Date(),
    }).where(eq(volunteerRegistrations.public_id, publicId)).returning({ public_id: volunteerRegistrations.public_id });
    if (!updated) return respond(request, { error: 'Candidature introuvable.' }, 404);
    return respond(request, { success: true }, 200);
}

export function OPTIONS(request: Request) {
    return new NextResponse(null, {
        status: 204,
        headers: {
            ...publicCorsHeaders(request),
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
        },
    });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        if (clean(body.website)) return respond(request, { success: true }, 201);

        const editionPublicId = clean(body.edition_public_id, 40);
        const firstName = clean(body.first_name, 80);
        const lastName = clean(body.last_name, 80);
        const email = clean(body.email, 180).toLowerCase();
        const phone = clean(body.phone, 40);
        const organizationType = clean(body.organization_type, 20);
        const clubName = clean(body.club_name, 140);
        const clubStatus = clean(body.club_status, 80);
        const city = clean(body.city, 120);
        const motivation = clean(body.motivation, 1200);
        const preferredRoles = cleanList(body.preferred_roles, allowedRoles);
        const availableFullMission = body.available_full_mission === true;
        const availableDates = cleanDates(body.available_dates);
        const hasPreviousExperience = body.has_previous_experience === true;
        const previousEditions = cleanPreviousEditions(body.previous_editions);
        const engagementExperience = clean(body.engagement_experience, 1000);
        const skills = cleanList(body.skills, allowedSkills);
        const otherSkills = clean(body.other_skills, 300);
        const preferredCommissions = cleanList(body.preferred_commissions, allowedCommissions);
        const contribution = clean(body.contribution, 800);
        const tshirtSize = clean(body.tshirt_size, 4);
        const dietaryPreference = clean(body.dietary_preference, 20);
        const dietaryDetails = clean(body.dietary_details, 180);
        const allergies = clean(body.allergies, 500);
        const emergencyContactName = clean(body.emergency_contact_name, 160);
        const emergencyContactPhone = clean(body.emergency_contact_phone, 40);

        if (!editionPublicId || !firstName || !lastName || !emailPattern.test(email) || phone.length < 6 || !allowedOrganizationTypes.has(organizationType) || !clubName || !clubStatus || (!availableFullMission && availableDates.length === 0) || preferredRoles.length === 0 || !motivation || !allowedShirtSizes.has(tshirtSize) || !allowedDiets.has(dietaryPreference) || (dietaryPreference === 'autre' && !dietaryDetails) || !emergencyContactName || emergencyContactPhone.length < 6 || body.consent !== true) {
            return respond(request, { error: 'Vérifiez les champs obligatoires.' }, 400);
        }

        const [edition] = await db.select({ id: editions.id, name: editions.name, place: editions.place, year: editions.year }).from(editions).where(and(
            eq(editions.public_id, editionPublicId),
            eq(editions.is_active, 1),
            eq(editions.registration_open, true),
            eq(editions.deleted, false),
        )).limit(1);

        if (!edition) return respond(request, { error: 'Cette édition n’est plus ouverte aux inscriptions.' }, 404);

        const [existing] = await db.select({ id: volunteerRegistrations.id }).from(volunteerRegistrations).where(and(
            eq(volunteerRegistrations.edition_id, edition.id),
            eq(volunteerRegistrations.email, email),
        )).limit(1);

        if (existing) return respond(request, { error: 'Une inscription existe déjà pour cette adresse e-mail.' }, 409);

        const [created] = await db.insert(volunteerRegistrations).values({
            public_id: uuidv4(),
            edition_id: edition.id,
            first_name: firstName,
            last_name: lastName,
            email,
            phone,
            organization_type: organizationType,
            club_name: clubName,
            club_status: clubStatus,
            city: city || null,
            preferred_roles: preferredRoles,
            availability: availableFullMission ? 'Toute la mission' : availableDates.join(', '),
            available_full_mission: availableFullMission,
            available_dates: availableDates,
            has_previous_experience: hasPreviousExperience,
            previous_editions: hasPreviousExperience ? previousEditions : [],
            engagement_experience: engagementExperience || null,
            skills,
            other_skills: otherSkills || null,
            preferred_commissions: preferredCommissions,
            motivation,
            contribution,
            tshirt_size: tshirtSize,
            dietary_preference: dietaryPreference,
            dietary_details: dietaryDetails || null,
            allergies: allergies || null,
            emergency_contact_name: emergencyContactName,
            emergency_contact_phone: emergencyContactPhone,
            consent: true,
        }).returning({ public_id: volunteerRegistrations.public_id });

        let confirmationEmailSent = false;
        try {
            const emailResult = await sendVolunteerConfirmation({
                email,
                firstName,
                lastName,
                editionName: edition.name,
                editionPlace: edition.place,
                editionYear: edition.year,
                registrationId: created.public_id,
            });
            confirmationEmailSent = emailResult.sent;
            if (emailResult.skipped) console.warn('Brevo confirmation skipped: BREVO_API_KEY or BREVO_SENDER_EMAIL is missing.');
        } catch (emailError) {
            console.error('Brevo volunteer confirmation failed', emailError);
        }

        return respond(request, { success: true, registration_id: created.public_id, confirmation_email_sent: confirmationEmailSent }, 201);
    } catch (error) {
        console.error('Volunteer registration failed', error);
        return respond(request, { error: 'L’inscription n’a pas pu être enregistrée. Réessayez.' }, 500);
    }
}
