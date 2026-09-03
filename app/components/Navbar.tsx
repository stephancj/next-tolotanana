'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Activity, Calendar, ChevronDown, CircleHelp, ClipboardList, FolderOpen, LayoutDashboard, Menu, Plus, RefreshCw, Stethoscope, Users, X, Zap } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEdition } from '../providers/EditionProvider';
import { useSync } from '../hooks/useSync';
import { useLocale } from '../providers/I18nProvider';
import LanguageSwitcher from './LanguageSwitcher';

const primary = [
  { path: '/dashboard', key: 'home', icon: LayoutDashboard },
  { path: '/list', key: 'patients', icon: FolderOpen },
  { path: '/planning', key: 'planning', icon: Calendar },
  { path: '/workflow', key: 'workflow', icon: Zap },
  { path: '/form', key: 'new', icon: Plus }
];
const secondary = [
  { path: '/team', key: 'team', icon: Users },
  { path: '/volunteers', key: 'volunteers', icon: ClipboardList },
  { path: '/monitoring', key: 'synchronization', icon: Activity },
  { path: '/guide', key: 'guide', icon: CircleHelp }
];

const navTranslations = {
  fr: { home:'Accueil', patients:'Patients', planning:'Planning', workflow:'Workflow', new:'Nouveau', team:'Équipe', volunteers:'Volontaires', synchronization:'Synchronisation', guide:'Guide', more:'Plus', mainNavigation:'Navigation principale', homeLabel:'Accueil ToloTanana', sync:'Synchronisation', conflict:'conflit', conflicts:'conflits', pending:'en attente', offline:'Hors ligne', syncing:'Synchronisation', syncError:'Erreur sync', saved:'Sauvegardé', changeEdition:'Changer d’édition', chooseEdition:'Choisir une édition', edition:'Édition', closeMenu:'Fermer le menu', openMenu:'Ouvrir le menu' },
  en: { home:'Home', patients:'Patients', planning:'Planning', workflow:'Workflow', new:'New', team:'Team', volunteers:'Volunteers', synchronization:'Synchronization', guide:'Guide', more:'More', mainNavigation:'Main navigation', homeLabel:'ToloTanana home', sync:'Synchronization', conflict:'conflict', conflicts:'conflicts', pending:'pending', offline:'Offline', syncing:'Synchronizing', syncError:'Sync error', saved:'Saved', changeEdition:'Change edition', chooseEdition:'Choose an edition', edition:'Edition', closeMenu:'Close menu', openMenu:'Open menu' },
} as const;

export default function Navbar() {
  const locale = useLocale(); const labels = navTranslations[locale];
  const router = useRouter(); const pathname = usePathname();
  const { currentEdition, setShowEditionSelector } = useEdition();
  const { status, pendingCount, conflictCount, manualSync } = useSync();
  const editionOptional = pathname?.startsWith('/volunteers');
  const [mobile, setMobile] = useState(false); const [more, setMore] = useState(false); const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const close = (event: MouseEvent) => { if (!moreRef.current?.contains(event.target as Node)) setMore(false); }; document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close); }, []);
  const navigate = (path: string) => { router.push(path); setMobile(false); setMore(false); };
  const active = (path: string) => pathname?.startsWith(path);
  const syncLabel = conflictCount ? `${conflictCount} ${conflictCount > 1 ? labels.conflicts : labels.conflict}` : pendingCount ? `${pendingCount} ${labels.pending}` : status === 'offline' ? labels.offline : status === 'syncing' ? labels.syncing : status === 'error' ? labels.syncError : labels.saved;
  const syncTone = conflictCount ? 'bg-amber-50 text-amber-800 border-amber-200' : status === 'error' ? 'bg-red-50 text-red-800 border-red-200' : pendingCount || status === 'offline' ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200';
  const syncAction = () => conflictCount ? router.push('/sync-conflicts') : void manualSync();

  return <nav aria-label={labels.mainNavigation} className="sticky top-0 z-50 border-b border-slate-200 bg-white">
    <div className="safe-x mx-auto flex h-16 max-w-[1600px] items-center gap-2 lg:gap-3 lg:px-6">
      <button onClick={() => navigate('/dashboard')} className="flex min-h-11 items-center gap-2 rounded-lg pr-2 text-left focus-visible:outline-indigo-600" aria-label={labels.homeLabel}><Image src="/logo.png" alt="" width={32} height={32} /><span className="hidden font-black text-slate-900 sm:block">ToloTanana</span></button>
      <div className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex">{primary.map(item => { const Icon = item.icon; return <button key={item.path} onClick={() => navigate(item.path)} aria-current={active(item.path) ? 'page' : undefined} className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-bold ${active(item.path) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}><Icon size={18} />{labels[item.key as keyof typeof labels]}</button>; })}</div>
      <div className="ml-auto flex items-center gap-2">
        <button onClick={syncAction} aria-label={`${labels.sync}: ${syncLabel}`} title={syncLabel} className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-bold ${syncTone}`}><span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${status === 'syncing' ? 'animate-pulse bg-amber-500' : conflictCount ? 'bg-amber-600' : status === 'error' ? 'bg-red-600' : pendingCount ? 'bg-slate-500' : 'bg-emerald-600'}`} /><span className="hidden min-[400px]:inline">{syncLabel}</span></button>
        {!editionOptional && <button onClick={() => setShowEditionSelector(true)} className="hidden min-h-10 max-w-44 items-center gap-2 truncate rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 sm:flex" title={labels.changeEdition}><Stethoscope size={16} /><span className="truncate">{currentEdition?.name || labels.chooseEdition}</span><RefreshCw size={13} /></button>}
        <div className="relative hidden lg:block" ref={moreRef}><button onClick={() => setMore(value => !value)} aria-expanded={more} className="flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-bold text-slate-600 hover:bg-slate-50">{labels.more} <ChevronDown size={16} /></button>{more && <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">{secondary.map(item => { const Icon = item.icon; return <button key={item.path} onClick={() => navigate(item.path)} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Icon size={18} />{labels[item.key as keyof typeof labels]}</button>; })}<div className="my-2 border-t border-slate-100" /><LanguageSwitcher /></div>}</div>
        <button onClick={() => setMobile(value => !value)} aria-expanded={mobile} aria-controls="mobile-navigation" aria-label={mobile ? labels.closeMenu : labels.openMenu} className="grid min-h-11 min-w-11 place-items-center rounded-lg text-slate-700 hover:bg-slate-50 lg:hidden">{mobile ? <X /> : <Menu />}</button>
      </div>
    </div>
    {mobile && <div id="mobile-navigation" className="mobile-scroll mobile-safe-bottom max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-slate-200 bg-white p-3 shadow-xl lg:hidden"><div className="grid grid-cols-1 gap-1 min-[360px]:grid-cols-2">{[...primary, ...secondary].map(item => { const Icon = item.icon; return <button key={item.path} onClick={() => navigate(item.path)} className={`flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-bold ${active(item.path) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}`}><Icon size={19} />{labels[item.key as keyof typeof labels]}</button>; })}</div><div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">{!editionOptional && <button onClick={() => setShowEditionSelector(true)} className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-semibold">{currentEdition?.name || labels.edition}</button>}<LanguageSwitcher /></div></div>}
  </nav>;
}
