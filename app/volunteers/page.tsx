'use client';

import {
  CalendarDays,
  CalendarCog,
  ChevronDown,
  Download,
  ExternalLink,
  Globe2,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useLocale } from '../providers/I18nProvider';

type Volunteer = {
  public_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  organization_type: string;
  club_name: string;
  club_status: string;
  city: string | null;
  preferred_roles: string[];
  available_full_mission: boolean;
  available_dates: string[];
  skills: string[];
  other_skills: string | null;
  preferred_commissions: string[];
  motivation: string | null;
  contribution: string | null;
  tshirt_size: string | null;
  dietary_preference: string | null;
  dietary_details: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  assigned_commission: string | null;
  status: string;
  created_at: string;
  edition_name: string;
  edition_place: string;
  edition_year: number;
};

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  accepted: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  waitlisted: 'bg-blue-50 text-blue-800 ring-blue-200',
  rejected: 'bg-rose-50 text-rose-800 ring-rose-200',
};

const translations = {
  fr: {
    status: { pending: 'À étudier', accepted: 'Acceptée', waitlisted: 'En attente', rejected: 'Refusée' },
    commissions: { logistique: 'Logistique', communication: 'Communication', technique: 'Technique', finance: 'Finance', sponsoring: 'Sponsoring', hebergement: 'Hébergement' },
    values: { accueil: 'Accueil', enregistrement: 'Enregistrement', interpretariat: 'Interprétariat', restauration: 'Restauration', organisation: 'Organisation', 'relation-patient': 'Relation patient', 'premiers-secours': 'Premiers secours', 'photo-video': 'Photo et vidéo', 'reseaux-sociaux': 'Réseaux sociaux', traduction: 'Traduction', conduite: 'Conduite', cuisine: 'Cuisine', membre: 'Membre', sympathisant: 'Sympathisant·e', invite: 'Invité·e', aucune: 'Aucune restriction', vegetarien: 'Végétarien', vegetalien:'Végétalien', halal:'Halal', 'sans-porc': 'Sans porc', 'sans-gluten':'Sans gluten', 'sans-lactose':'Sans lactose', autre: 'Autre' },
    secureAccess: 'Accès sécurisé', managementSpace: 'Espace de gestion des volontaires', restricted: 'Un accès réservé à l’équipe d’organisation pour étudier et répartir les candidatures.', openApplications: 'Ouvrir les candidatures', keyHelp: 'Saisissez la clé administrateur. Elle reste uniquement dans cette session.', adminKey: 'Clé administrateur', checking: 'Vérification…', access: 'Accéder à l’espace',
    applications: 'Candidatures volontaires', application: 'candidature', applicationsPlural: 'candidatures', updated: 'Actualisé à', refresh: 'Actualiser les candidatures', export: 'Exporter', publicSite: 'Voir le site public', manageEditions:'Gérer les inscriptions', all: 'Toutes', search: 'Rechercher une candidature', searchPlaceholder: 'Rechercher par nom, club, ville, téléphone…', result: 'résultat', results: 'résultats', noResult: 'Aucune candidature trouvée', noResultHelp: 'Modifiez la recherche ou choisissez un autre statut.', resetFilters: 'Réinitialiser les filtres',
    candidate: 'Candidat', availability: 'Disponibilité', commission: 'Commission', decision: 'Décision', details: 'Détails', received: 'Reçue le', wholeMission: 'Toute la mission', day: 'jour', days: 'jours', noRole: 'Aucun rôle indiqué', unassigned: 'Non affectée', hideDetails: 'Masquer les détails', showApplication: 'Voir la candidature', hideFor: 'Masquer les détails de', showFor: 'Afficher les détails de',
    contact: 'Coordonnées', practical: 'Informations pratiques', tshirt: 'T-shirt', diet: 'Alimentation', notProvided: 'Non renseigné', cityNotProvided: 'Ville non renseignée', motivation: 'Motivation', motivationMissing: 'Non renseignée', comment: 'Commentaire', noComment: 'Aucun commentaire', skills: 'Compétences', preferredCommissions: 'Commissions souhaitées', noPreference: 'Aucune préférence', emergency: 'Contact d’urgence', updateFailed: 'La modification n’a pas été enregistrée.', loadFailed: 'Chargement impossible.', loadError: 'Erreur de chargement.', movement: 'Mouvement', club: 'Club', clubStatus: 'Statut club', roles: 'Rôles',
  },
  en: {
    status: { pending: 'To review', accepted: 'Accepted', waitlisted: 'Waitlisted', rejected: 'Rejected' },
    commissions: { logistique: 'Logistics', communication: 'Communication', technique: 'Technical', finance: 'Finance', sponsoring: 'Sponsorship', hebergement: 'Accommodation' },
    values: { accueil: 'Reception', enregistrement: 'Registration', interpretariat: 'Interpreting', restauration: 'Catering', organisation: 'Organisation', 'relation-patient': 'Patient support', 'premiers-secours': 'First aid', 'photo-video': 'Photo and video', 'reseaux-sociaux': 'Social media', traduction: 'Translation', conduite: 'Driving', cuisine: 'Cooking', membre: 'Member', sympathisant: 'Supporter', invite: 'Guest', aucune: 'No restriction', vegetarien: 'Vegetarian', vegetalien:'Vegan', halal:'Halal', 'sans-porc': 'No pork', 'sans-gluten':'Gluten-free', 'sans-lactose':'Lactose-free', autre: 'Other' },
    secureAccess: 'Secure access', managementSpace: 'Volunteer management workspace', restricted: 'Restricted to the organising team for reviewing and assigning applications.', openApplications: 'Open applications', keyHelp: 'Enter the administrator key. It is kept only for this session.', adminKey: 'Administrator key', checking: 'Checking…', access: 'Open workspace',
    applications: 'Volunteer applications', application: 'application', applicationsPlural: 'applications', updated: 'Updated at', refresh: 'Refresh applications', export: 'Export', publicSite: 'View public website', manageEditions:'Manage registration', all: 'All', search: 'Search applications', searchPlaceholder: 'Search by name, club, city or phone…', result: 'result', results: 'results', noResult: 'No applications found', noResultHelp: 'Change your search or select another status.', resetFilters: 'Reset filters',
    candidate: 'Candidate', availability: 'Availability', commission: 'Commission', decision: 'Decision', details: 'Details', received: 'Received on', wholeMission: 'Entire mission', day: 'day', days: 'days', noRole: 'No preferred role', unassigned: 'Unassigned', hideDetails: 'Hide details', showApplication: 'View application', hideFor: 'Hide details for', showFor: 'Show details for',
    contact: 'Contact details', practical: 'Practical information', tshirt: 'T-shirt', diet: 'Diet', notProvided: 'Not provided', cityNotProvided: 'City not provided', motivation: 'Motivation', motivationMissing: 'Not provided', comment: 'Comment', noComment: 'No comment', skills: 'Skills', preferredCommissions: 'Preferred commissions', noPreference: 'No preference', emergency: 'Emergency contact', updateFailed: 'The change could not be saved.', loadFailed: 'Unable to load applications.', loadError: 'Loading error.', movement: 'Organisation', club: 'Club', clubStatus: 'Club status', roles: 'Roles',
  },
} as const;

export default function VolunteersPage() {
  const locale = useLocale();
  const copy = translations[locale];
  const publicSiteUrl = process.env.NEXT_PUBLIC_ROTARACT_SITE_URL || (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:4322/tolotagnana/' : 'https://tolotagnana.rotaract.mg');
  const pretty = (value: string | null | undefined) => value ? copy.values[value as keyof typeof copy.values] || value.charAt(0).toUpperCase() + value.slice(1).replaceAll('-', ' ') : copy.notProvided;
  const formatDate = (value: string) => new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
  const developmentKey = process.env.NODE_ENV === 'development' ? 'tolotagnana-dev' : '';
  const [key, setKey] = useState(developmentKey);
  const [rows, setRows] = useState<Volunteer[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function load(candidateKey = key) {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/volunteers', {
        headers: { 'x-admin-key': candidateKey },
        cache: 'no-store',
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || copy.loadFailed);
      sessionStorage.setItem('volunteer-admin-key', candidateKey);
      setRows(body);
      setAuthorized(true);
      setLastUpdated(new Date());
    } catch (loadError) {
      setRows([]);
      setAuthorized(false);
      setError(loadError instanceof Error ? loadError.message : copy.loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const savedKey = sessionStorage.getItem('volunteer-admin-key') || developmentKey;
    setKey(savedKey);
    if (savedKey) void load(savedKey);
    // La clé de développement ne change pas pendant la session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [developmentKey]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      pending: rows.filter((row) => row.status === 'pending').length,
      accepted: rows.filter((row) => row.status === 'accepted').length,
      waitlisted: rows.filter((row) => row.status === 'waitlisted').length,
      rejected: rows.filter((row) => row.status === 'rejected').length,
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      const haystack = [
        row.first_name,
        row.last_name,
        row.email,
        row.phone,
        row.club_name,
        row.city,
        row.assigned_commission,
      ].join(' ').toLowerCase();
      return (status === 'all' || row.status === status) && haystack.includes(normalizedQuery);
    });
  }, [rows, query, status]);

  const update = async (row: Volunteer, patch: Partial<Volunteer>) => {
    const next = { ...row, ...patch };
    setUpdating(row.public_id);
    setError('');
    setRows((current) => current.map((item) => (item.public_id === row.public_id ? next : item)));
    try {
      const response = await fetch('/api/volunteers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({
          public_id: row.public_id,
          status: next.status,
          assigned_commission: next.assigned_commission || '',
        }),
      });
      if (!response.ok) throw new Error();
      setLastUpdated(new Date());
    } catch {
      setRows((current) => current.map((item) => (item.public_id === row.public_id ? row : item)));
      setError(`${copy.updateFailed} (${row.first_name} ${row.last_name})`);
    } finally {
      setUpdating(null);
    }
  };

  const exportCsv = () => {
    const columns = [locale === 'fr' ? 'Nom' : 'Name', 'Email', locale === 'fr' ? 'Téléphone' : 'Phone', copy.movement, copy.club, copy.clubStatus, copy.availability, copy.roles, copy.commission, copy.decision];
    const data = filtered.map((row) => [
      `${row.first_name} ${row.last_name}`,
      row.email,
      row.phone,
      row.organization_type,
      row.club_name,
      row.club_status,
      row.available_full_mission ? copy.wholeMission : row.available_dates.join(' '),
      row.preferred_roles.join(' '),
      row.assigned_commission || '',
      copy.status[row.status as keyof typeof copy.status],
    ]);
    const csv = [columns, ...data]
      .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'candidatures-tolotagnana.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (!authorized) {
    return (
      <main className="mx-auto grid min-h-[72vh] max-w-5xl place-items-center px-5 py-12">
        <section className="grid w-full overflow-hidden rounded-2xl border border-slate-200 bg-white md:grid-cols-[.8fr_1.2fr]">
          <div className="hidden bg-indigo-950 p-10 text-white md:block">
            <ShieldCheck size={34} className="text-orange-400" />
            <p className="mt-12 text-xs font-bold uppercase tracking-[.18em] text-indigo-200">Tolo-Tagnana</p>
            <h1 className="mt-3 text-3xl font-black leading-tight">{copy.managementSpace}</h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-indigo-100">{copy.restricted}</p>
          </div>
          <div className="p-7 sm:p-10">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-50 text-indigo-700 md:hidden"><KeyRound size={21} /></div>
            <p className="mt-7 text-xs font-extrabold uppercase tracking-[.16em] text-indigo-700 md:mt-0">{copy.secureAccess}</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">{copy.openApplications}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{copy.keyHelp}</p>
            <label className="mt-7 block">
              <span className="clinical-label">{copy.adminKey}</span>
              <input className="clinical-input" type="password" value={key} autoFocus onChange={(event) => setKey(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void load(event.currentTarget.value)} />
            </label>
            {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
            <button onClick={() => load()} disabled={!key || loading} className="mt-5 min-h-12 w-full rounded-lg bg-indigo-700 px-5 font-bold text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? copy.checking : copy.access}
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.16em] text-indigo-700"><ShieldCheck size={15} /> Tolo-Tagnana</div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{copy.applications}</h1>
          <p className="mt-2 text-sm text-slate-600">Fort-Dauphin 2027 · {rows.length} {rows.length === 1 ? copy.application : copy.applicationsPlural}</p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && <span className="hidden text-xs text-slate-500 sm:block">{copy.updated} {lastUpdated.toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
          <Link href="/volunteers/editions" aria-label={copy.manageEditions} title={copy.manageEditions} className="flex h-11 w-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 xl:w-auto xl:px-3"><CalendarCog size={17}/><span className="hidden xl:inline">{copy.manageEditions}</span></Link>
          <a href={publicSiteUrl} target="_blank" rel="noreferrer" aria-label={copy.publicSite} title={copy.publicSite} className="flex h-11 w-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 xl:w-auto xl:px-3"><Globe2 size={17} /><span className="hidden xl:inline">{copy.publicSite}</span><ExternalLink size={13} className="hidden xl:block" /></a>
          <button onClick={() => load()} disabled={loading} aria-label={copy.refresh} className="grid h-11 w-11 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-50"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button>
          <button onClick={exportCsv} disabled={!filtered.length} className="flex min-h-11 items-center gap-2 rounded-lg bg-indigo-700 px-4 text-sm font-bold text-white transition hover:bg-indigo-800 disabled:opacity-50"><Download size={17} /> <span className="hidden sm:inline">{copy.export}</span> CSV</button>
        </div>
      </header>

      <section aria-label={`${copy.applications}: ${copy.decision}`} className="mb-5 grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-5">
        {[
          ['all', copy.all],
          ['pending', copy.status.pending],
          ['accepted', copy.status.accepted],
          ['waitlisted', copy.status.waitlisted],
          ['rejected', copy.status.rejected],
        ].map(([value, label]) => (
          <button key={value} onClick={() => setStatus(value)} aria-pressed={status === value} className={`min-h-20 border-b border-r border-slate-100 px-4 text-left transition last:border-r-0 sm:border-b-0 ${status === value ? 'bg-indigo-50 text-indigo-900' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
            <strong className="block text-2xl font-black">{counts[value as keyof typeof counts]}</strong>
            <span className="text-xs font-bold">{label}</span>
          </button>
        ))}
      </section>

      <section className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{copy.search}</span>
          <Search className="pointer-events-none absolute left-3 top-3.5 text-slate-400" size={18} />
          <input className="clinical-input pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} />
        </label>
        <p className="px-2 text-xs font-semibold text-slate-500">{filtered.length} {filtered.length === 1 ? copy.result : copy.results}</p>
      </section>

      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}

      {!filtered.length ? (
        <section className="grid place-items-center rounded-xl border border-slate-200 bg-white px-6 py-20 text-center">
          <Users className="text-slate-300" size={38} />
          <h2 className="mt-4 font-black text-slate-900">{copy.noResult}</h2>
          <p className="mt-1 text-sm text-slate-500">{copy.noResultHelp}</p>
          {(query || status !== 'all') && <button onClick={() => { setQuery(''); setStatus('all'); }} className="mt-5 text-sm font-bold text-indigo-700 underline underline-offset-4">{copy.resetFilters}</button>}
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label={copy.applications}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse text-left">
              <caption className="sr-only">{copy.applications}</caption>
              <colgroup><col className="w-[30%]"/><col className="w-[20%]"/><col className="w-[21%]"/><col className="w-[20%]"/><col className="w-[9%]"/></colgroup>
              <thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-[.08em] text-slate-500">
                <tr><th scope="col" className="px-5 py-3">{copy.candidate}</th><th scope="col" className="px-4 py-3">{copy.availability}</th><th scope="col" className="px-4 py-3">{copy.commission}</th><th scope="col" className="px-4 py-3">{copy.decision}</th><th scope="col" className="px-4 py-3 text-center">{copy.details}</th></tr>
              </thead>
            {filtered.map((row) => {
              const isExpanded = expanded === row.public_id;
              const isUpdating = updating === row.public_id;
              return (
                <tbody key={row.public_id} className="border-t border-slate-200 first:border-t-0">
                  <tr className={`transition-colors ${isExpanded ? 'bg-indigo-50/40' : 'bg-white hover:bg-slate-50/70'}`}>
                    <th scope="row" className="px-5 py-4 align-middle font-normal">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-black text-slate-950">{row.first_name} {row.last_name}</h2>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-extrabold uppercase text-slate-600">{row.organization_type}</span>
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-indigo-700">{row.club_name} · {pretty(row.club_status)}</p>
                      <p className="mt-1 text-xs text-slate-500">{copy.received} {formatDate(row.created_at)}</p>
                    </th>

                    <td className="px-4 py-4 align-middle">
                      <p className="flex items-center gap-2 text-sm font-bold text-slate-800"><CalendarDays size={16} className="text-slate-400" />{row.available_full_mission ? copy.wholeMission : `${row.available_dates.length} ${row.available_dates.length === 1 ? copy.day : copy.days}`}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{row.preferred_roles.map(pretty).join(', ') || copy.noRole}</p>
                    </td>

                    <td className="px-4 py-4 align-middle">
                      <select aria-label={`${copy.commission}: ${row.first_name} ${row.last_name}`} className="clinical-input min-h-11 text-sm" disabled={isUpdating} value={row.assigned_commission || ''} onChange={(event) => update(row, { assigned_commission: event.target.value })}>
                        <option value="">{copy.unassigned}</option>
                        {Object.entries(copy.commissions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </td>

                    <td className="px-4 py-4 align-middle">
                      <select aria-label={`${copy.decision}: ${row.first_name} ${row.last_name}`} className={`min-h-11 w-full rounded-lg px-3 text-sm font-bold ring-1 ring-inset focus:outline-none focus:ring-2 ${statusStyles[row.status] || statusStyles.pending}`} disabled={isUpdating} value={row.status} onChange={(event) => update(row, { status: event.target.value })}>
                        {Object.entries(copy.status).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </td>

                    <td className="px-4 py-4 text-center align-middle"><button onClick={() => setExpanded(isExpanded ? null : row.public_id)} aria-expanded={isExpanded} aria-controls={`volunteer-${row.public_id}`} className="mx-auto grid h-11 w-11 place-items-center rounded-lg text-indigo-700 hover:bg-indigo-100" aria-label={`${isExpanded ? copy.hideFor : copy.showFor} ${row.first_name} ${row.last_name}`}><ChevronDown size={18} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} /></button></td>
                  </tr>

                  {isExpanded && (
                    <tr id={`volunteer-${row.public_id}`} className="border-t border-indigo-100 bg-indigo-50/20">
                      <td colSpan={5} className="px-5 py-6">
                       <div className="grid gap-7 lg:grid-cols-[.9fr_1.25fr_1fr]">
                        <section>
                          <h3 className="text-xs font-extrabold uppercase tracking-[.1em] text-slate-500">{copy.contact}</h3>
                          <div className="mt-3 grid gap-2 text-sm text-slate-700">
                            <a className="flex items-center gap-2 hover:text-indigo-700" href={`mailto:${row.email}`}><Mail size={15} className="text-slate-400" />{row.email}</a>
                            <a className="flex items-center gap-2 hover:text-indigo-700" href={`tel:${row.phone}`}><Phone size={15} className="text-slate-400" />{row.phone}</a>
                            <p className="flex items-center gap-2"><MapPin size={15} className="text-slate-400" />{row.city || copy.cityNotProvided}</p>
                          </div>
                          <h3 className="mt-6 text-xs font-extrabold uppercase tracking-[.1em] text-slate-500">{copy.practical}</h3>
                          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm"><dt className="text-slate-500">{copy.tshirt}</dt><dd className="font-semibold text-slate-800">{row.tshirt_size || copy.notProvided}</dd><dt className="text-slate-500">{copy.diet}</dt><dd className="font-semibold text-slate-800">{pretty(row.dietary_preference)}{row.dietary_details ? ` · ${row.dietary_details}` : ''}</dd></dl>
                        </section>

                        <section>
                          <h3 className="text-xs font-extrabold uppercase tracking-[.1em] text-slate-500">{copy.motivation}</h3>
                          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{row.motivation || copy.motivationMissing}</p>
                          <h3 className="mt-6 text-xs font-extrabold uppercase tracking-[.1em] text-slate-500">{copy.comment}</h3>
                          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{row.contribution || copy.noComment}</p>
                        </section>

                        <section>
                          <h3 className="text-xs font-extrabold uppercase tracking-[.1em] text-slate-500">{copy.skills}</h3>
                          <div className="mt-3 flex flex-wrap gap-2">{[...row.skills, ...(row.other_skills ? row.other_skills.split(',').map((item) => item.trim()).filter(Boolean) : [])].map((skill) => <span key={skill} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{pretty(skill)}</span>)}</div>
                          <h3 className="mt-6 text-xs font-extrabold uppercase tracking-[.1em] text-slate-500">{copy.preferredCommissions}</h3>
                          <p className="mt-2 text-sm font-semibold text-slate-800">{row.preferred_commissions.map((item) => copy.commissions[item as keyof typeof copy.commissions] || pretty(item)).join(', ') || copy.noPreference}</p>
                          <h3 className="mt-6 text-xs font-extrabold uppercase tracking-[.1em] text-slate-500">{copy.emergency}</h3>
                          <p className="mt-2 text-sm text-slate-700">{row.emergency_contact_name || copy.notProvided}{row.emergency_contact_phone && <> · <a className="font-semibold text-indigo-700" href={`tel:${row.emergency_contact_phone}`}>{row.emergency_contact_phone}</a></>}</p>
                        </section>
                      </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
