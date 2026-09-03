'use client';

import { ArrowLeft, CalendarDays, CheckCircle2, ExternalLink, Globe2, KeyRound, LockKeyhole, RefreshCw, Users, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useLocale } from '../../providers/I18nProvider';

type Edition = {
  public_id: string;
  name: string;
  place: string;
  year: number;
  start_date: string | null;
  end_date: string | null;
  is_active: number | null;
  registration_open: boolean;
  application_count: number;
};

const translations = {
  fr: {
    eyebrow:'Administration des volontaires', title:'Éditions et inscriptions', intro:'Choisissez les éditions visibles dans le formulaire public et autorisées à recevoir des candidatures.', back:'Candidatures', publicSite:'Voir le formulaire public', refresh:'Actualiser', total:'éditions', openCount:'ouvertes aux inscriptions', applications:'candidatures reçues', applicationsOne:'candidature reçue', open:'Inscriptions ouvertes', closed:'Inscriptions fermées', inactive:'Édition inactive', noDates:'Dates non renseignées', openAction:'Ouvrir les inscriptions', closeAction:'Fermer les inscriptions', confirmClose:'Confirmer la fermeture', cancel:'Annuler', opening:'Ouverture…', closing:'Fermeture…', openHelp:'L’édition apparaîtra immédiatement dans le formulaire Astro.', closeHelp:'L’édition reste dans l’historique, mais aucune nouvelle candidature ne sera acceptée.', inactiveHelp:'Activez d’abord cette édition dans les paramètres généraux.', secure:'Accès sécurisé', key:'Clé administrateur', keyHelp:'Utilisez la même clé que pour les candidatures.', access:'Accéder aux éditions', checking:'Vérification…', empty:'Aucune édition disponible.', loadError:'Impossible de charger les éditions.', updateError:'La modification n’a pas été enregistrée.', savedOpen:'Les inscriptions sont maintenant ouvertes.', savedClosed:'Les inscriptions sont maintenant fermées.',
  },
  en: {
    eyebrow:'Volunteer administration', title:'Editions and registration', intro:'Choose which editions are shown in the public form and allowed to receive applications.', back:'Applications', publicSite:'View public form', refresh:'Refresh', total:'editions', openCount:'open for registration', applications:'applications received', applicationsOne:'application received', open:'Registration open', closed:'Registration closed', inactive:'Inactive edition', noDates:'Dates not provided', openAction:'Open registration', closeAction:'Close registration', confirmClose:'Confirm closing', cancel:'Cancel', opening:'Opening…', closing:'Closing…', openHelp:'The edition will immediately appear in the Astro form.', closeHelp:'The edition remains in the history, but no new application will be accepted.', inactiveHelp:'Activate this edition in the general settings first.', secure:'Secure access', key:'Administrator key', keyHelp:'Use the same key as for volunteer applications.', access:'Open editions', checking:'Checking…', empty:'No editions available.', loadError:'Unable to load editions.', updateError:'The change could not be saved.', savedOpen:'Registration is now open.', savedClosed:'Registration is now closed.',
  },
} as const;

export default function VolunteerEditionsPage() {
  const locale = useLocale();
  const copy = translations[locale];
  const developmentKey = process.env.NODE_ENV === 'development' ? 'tolotagnana-dev' : '';
  const publicFormUrl = process.env.NEXT_PUBLIC_ROTARACT_SITE_URL
    ? `${process.env.NEXT_PUBLIC_ROTARACT_SITE_URL.replace(/\/$/, '')}/volontaire/`
    : process.env.NODE_ENV === 'development'
      ? 'http://127.0.0.1:4322/tolotagnana/volontaire/'
      : 'https://tolotagnana.rotaract.mg/volontaire/';
  const [key, setKey] = useState(developmentKey);
  const [rows, setRows] = useState<Edition[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load(candidateKey = key) {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/volunteer-editions', { headers: { 'x-admin-key': candidateKey }, cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || copy.loadError);
      sessionStorage.setItem('volunteer-admin-key', candidateKey);
      setRows(body); setAuthorized(true);
    } catch (loadError) {
      setAuthorized(false); setError(loadError instanceof Error ? loadError.message : copy.loadError);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    const savedKey = sessionStorage.getItem('volunteer-admin-key') || developmentKey;
    setKey(savedKey); if (savedKey) void load(savedKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [developmentKey]);

  const totals = useMemo(() => ({
    open: rows.filter((row) => row.registration_open && row.is_active === 1).length,
    applications: rows.reduce((sum, row) => sum + Number(row.application_count), 0),
  }), [rows]);

  const updateRegistration = async (edition: Edition, registrationOpen: boolean) => {
    if (!registrationOpen && confirmClose !== edition.public_id) { setConfirmClose(edition.public_id); return; }
    setConfirmClose(null); setUpdating(edition.public_id); setError(''); setNotice('');
    const previous = edition.registration_open;
    setRows((current) => current.map((row) => row.public_id === edition.public_id ? { ...row, registration_open: registrationOpen } : row));
    try {
      const response = await fetch('/api/volunteer-editions', { method:'PATCH', headers:{ 'Content-Type':'application/json', 'x-admin-key':key }, body:JSON.stringify({ public_id:edition.public_id, registration_open:registrationOpen }) });
      if (!response.ok) throw new Error();
      setNotice(registrationOpen ? copy.savedOpen : copy.savedClosed);
    } catch {
      setRows((current) => current.map((row) => row.public_id === edition.public_id ? { ...row, registration_open: previous } : row));
      setError(copy.updateError);
    } finally { setUpdating(null); }
  };

  const formatDay = (value: string) => new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { day:'numeric', month:'long', year:'numeric' }).format(new Date(`${value}T12:00:00`));

  if (!authorized) return <main className="mx-auto grid min-h-[70vh] max-w-lg place-items-center px-5 py-12"><section className="w-full rounded-2xl border border-slate-200 bg-white p-8"><div className="grid h-12 w-12 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><KeyRound /></div><p className="mt-7 text-xs font-extrabold uppercase tracking-[.16em] text-indigo-700">{copy.secure}</p><h1 className="mt-2 text-2xl font-black text-slate-950">{copy.title}</h1><p className="mt-2 text-sm leading-6 text-slate-600">{copy.keyHelp}</p><label className="mt-7 block"><span className="clinical-label">{copy.key}</span><input className="clinical-input" type="password" value={key} onChange={(event) => setKey(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void load(event.currentTarget.value)} /></label>{error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}<button onClick={() => load()} disabled={!key || loading} className="mt-5 min-h-12 w-full rounded-lg bg-indigo-700 px-5 font-bold text-white disabled:opacity-50">{loading ? copy.checking : copy.access}</button></section></main>;

  return <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
    <div className="mb-7 flex flex-wrap items-start justify-between gap-5">
      <div><Link href="/volunteers" className="inline-flex items-center gap-2 text-sm font-bold text-indigo-700 hover:underline"><ArrowLeft size={16}/>{copy.back}</Link><p className="mt-6 text-xs font-extrabold uppercase tracking-[.16em] text-indigo-700">{copy.eyebrow}</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{copy.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{copy.intro}</p></div>
      <div className="flex gap-2"><a href={publicFormUrl} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"><Globe2 size={17}/><span className="hidden sm:inline">{copy.publicSite}</span><ExternalLink size={13}/></a><button onClick={() => load()} disabled={loading} aria-label={copy.refresh} className="grid h-11 w-11 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-indigo-700"><RefreshCw size={17} className={loading ? 'animate-spin' : ''}/></button></div>
    </div>

    <section className="mb-5 grid overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-3"><div className="p-5"><strong className="block text-3xl font-black text-slate-950">{rows.length}</strong><span className="text-sm font-semibold text-slate-500">{copy.total}</span></div><div className="border-t border-slate-100 p-5 sm:border-l sm:border-t-0"><strong className="block text-3xl font-black text-emerald-700">{totals.open}</strong><span className="text-sm font-semibold text-slate-500">{copy.openCount}</span></div><div className="border-t border-slate-100 p-5 sm:border-l sm:border-t-0"><strong className="block text-3xl font-black text-indigo-700">{totals.applications}</strong><span className="text-sm font-semibold text-slate-500">{totals.applications === 1 ? copy.applicationsOne : copy.applications}</span></div></section>
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
    {notice && <p role="status" className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800"><CheckCircle2 size={17}/>{notice}</p>}

    {!rows.length ? <section className="rounded-xl border border-slate-200 bg-white py-20 text-center text-sm text-slate-500">{copy.empty}</section> : <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="divide-y divide-slate-200">{rows.map((edition) => {
      const isActive = edition.is_active === 1; const isOpen = edition.registration_open && isActive; const isUpdating = updating === edition.public_id; const confirming = confirmClose === edition.public_id;
      return <article key={edition.public_id} className="grid gap-5 px-5 py-5 lg:grid-cols-[1fr_.8fr_.55fr_auto] lg:items-center">
        <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black text-slate-950">{edition.name}</h2><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${isOpen ? 'bg-emerald-50 text-emerald-800' : isActive ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-800'}`}>{isOpen ? <CheckCircle2 size={13}/> : isActive ? <LockKeyhole size={13}/> : <XCircle size={13}/>} {isOpen ? copy.open : isActive ? copy.closed : copy.inactive}</span></div><p className="mt-1 text-sm font-semibold text-indigo-700">{edition.place} · {edition.year}</p></div>
        <div><span className="clinical-label"><CalendarDays size={13} className="mr-1 inline"/>{locale === 'fr' ? 'Dates' : 'Dates'}</span><p className="text-sm font-semibold text-slate-700">{edition.start_date && edition.end_date ? `${formatDay(edition.start_date)} – ${formatDay(edition.end_date)}` : copy.noDates}</p></div>
        <div><span className="clinical-label"><Users size={13} className="mr-1 inline"/>{locale === 'fr' ? 'Candidatures' : 'Applications'}</span><strong className="text-xl font-black text-slate-900">{edition.application_count}</strong></div>
        <div className="lg:min-w-56">{isOpen ? <><button onClick={() => updateRegistration(edition, false)} disabled={isUpdating} className={`min-h-11 w-full rounded-lg px-4 text-sm font-bold transition disabled:opacity-50 ${confirming ? 'bg-rose-700 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:border-rose-300 hover:text-rose-700'}`}>{isUpdating ? copy.closing : confirming ? copy.confirmClose : copy.closeAction}</button>{confirming && <button onClick={() => setConfirmClose(null)} className="mt-2 w-full text-xs font-bold text-slate-500 underline">{copy.cancel}</button>}<p className="mt-2 text-xs leading-5 text-slate-500">{copy.closeHelp}</p></> : <><button onClick={() => updateRegistration(edition, true)} disabled={isUpdating || !isActive} className="min-h-11 w-full rounded-lg bg-indigo-700 px-4 text-sm font-bold text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-45">{isUpdating ? copy.opening : copy.openAction}</button><p className="mt-2 text-xs leading-5 text-slate-500">{isActive ? copy.openHelp : copy.inactiveHelp}</p></>}</div>
      </article>;
    })}</div></section>}
  </main>;
}
