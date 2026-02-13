'use client';

import { useState } from 'react';
import { useTranslations } from '../providers/I18nProvider';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import {
    Rocket,
    LayoutDashboard,
    Plus,
    FolderOpen,
    Stethoscope,
    Calendar,
    Zap,
    Wifi,
    Globe,
    ChevronRight,
    BookOpen,
    Lightbulb,
    ChevronDown,
} from 'lucide-react';

const sectionKeys = [
    'gettingStarted',
    'dashboard',
    'newPatient',
    'patientList',
    'team',
    'planning',
    'workflow',
    'sync',
    'language',
] as const;

type SectionKey = (typeof sectionKeys)[number];

const sectionIcons: Record<SectionKey, React.ElementType> = {
    gettingStarted: Rocket,
    dashboard: LayoutDashboard,
    newPatient: Plus,
    patientList: FolderOpen,
    team: Stethoscope,
    planning: Calendar,
    workflow: Zap,
    sync: Wifi,
    language: Globe,
};

const sectionColors: Record<SectionKey, string> = {
    gettingStarted: 'bg-violet-100 text-violet-600',
    dashboard: 'bg-indigo-100 text-indigo-600',
    newPatient: 'bg-emerald-100 text-emerald-600',
    patientList: 'bg-amber-100 text-amber-600',
    team: 'bg-rose-100 text-rose-600',
    planning: 'bg-blue-100 text-blue-600',
    workflow: 'bg-orange-100 text-orange-600',
    sync: 'bg-cyan-100 text-cyan-600',
    language: 'bg-purple-100 text-purple-600',
};

const sectionBorderColors: Record<SectionKey, string> = {
    gettingStarted: 'border-violet-200',
    dashboard: 'border-indigo-200',
    newPatient: 'border-emerald-200',
    patientList: 'border-amber-200',
    team: 'border-rose-200',
    planning: 'border-blue-200',
    workflow: 'border-orange-200',
    sync: 'border-cyan-200',
    language: 'border-purple-200',
};

// Sections that have "steps" (ordered instructions)
const stepSections: SectionKey[] = ['gettingStarted', 'newPatient', 'team', 'language'];
// Sections that have "features" (unordered list)
const featureSections: SectionKey[] = ['dashboard', 'patientList', 'planning', 'sync'];
// Sections that have "tabs" (workflow only)
const tabSections: SectionKey[] = ['workflow'];

function getStepKeys(sectionKey: SectionKey): string[] {
    switch (sectionKey) {
        case 'gettingStarted':
            return ['step1', 'step2', 'step3', 'step4'];
        case 'newPatient':
            return ['step1', 'step2', 'step3', 'step4', 'step5', 'step6', 'step7', 'step8', 'step9'];
        case 'team':
            return ['step1', 'step2', 'step3', 'step4'];
        case 'language':
            return ['step1', 'step2', 'step3'];
        default:
            return [];
    }
}

function getFeatureKeys(sectionKey: SectionKey): string[] {
    switch (sectionKey) {
        case 'dashboard':
            return ['stats', 'gender', 'origin', 'recent', 'performance', 'clinical'];
        case 'patientList':
            return ['search', 'filters', 'sort', 'tabs', 'export', 'details', 'edit', 'delete'];
        case 'planning':
            return ['weekView', 'patientCards', 'status', 'actions'];
        case 'sync':
            return ['offline', 'autoSync', 'manualSync', 'status', 'conflicts'];
        default:
            return [];
    }
}

export default function GuidePage() {
    const t = useTranslations('guide');
    const tCommon = useTranslations('common');
    const router = useRouter();
    const [activeSection, setActiveSection] = useState<SectionKey>('gettingStarted');
    const [mobileTocOpen, setMobileTocOpen] = useState(false);

    const scrollToSection = (key: SectionKey) => {
        setActiveSection(key);
        setMobileTocOpen(false);
        const el = document.getElementById(`section-${key}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/80">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-xl sticky top-16 z-40 border-b border-indigo-50 px-6 py-4 shadow-sm">
                <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <BookOpen size={16} className="text-indigo-400" />
                            <h2 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{t('title')}</h2>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-800">{t('subtitle')}</h1>
                    </div>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="px-4 py-2.5 bg-white text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition border border-slate-200 flex items-center gap-2 text-sm"
                    >
                        <ArrowLeft size={16} /> {tCommon('back')}
                    </button>
                </div>
            </header>

            <div className="max-w-[1600px] mx-auto p-4 md:p-8">
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Sidebar TOC - Desktop */}
                    <aside className="hidden lg:block w-72 shrink-0">
                        <div className="sticky top-40">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">{t('toc')}</h3>
                            <nav className="space-y-1">
                                {sectionKeys.map((key) => {
                                    const Icon = sectionIcons[key];
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => scrollToSection(key)}
                                            className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-3 ${
                                                activeSection === key
                                                    ? 'bg-indigo-50 text-indigo-700'
                                                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                                            }`}
                                        >
                                            <Icon size={16} />
                                            <span>{t(`sections.${key}.title`)}</span>
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>
                    </aside>

                    {/* Mobile TOC */}
                    <div className="lg:hidden">
                        <button
                            onClick={() => setMobileTocOpen(!mobileTocOpen)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-slate-200 shadow-sm text-sm font-bold text-slate-700"
                        >
                            <span className="flex items-center gap-2">
                                <BookOpen size={16} />
                                {t('toc')}
                            </span>
                            <ChevronDown size={16} className={`transition-transform ${mobileTocOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {mobileTocOpen && (
                            <div className="mt-2 bg-white rounded-xl border border-slate-200 shadow-sm p-2 space-y-1">
                                {sectionKeys.map((key) => {
                                    const Icon = sectionIcons[key];
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => scrollToSection(key)}
                                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold transition flex items-center gap-3 ${
                                                activeSection === key
                                                    ? 'bg-indigo-50 text-indigo-700'
                                                    : 'text-slate-500 hover:bg-slate-100'
                                            }`}
                                        >
                                            <Icon size={16} />
                                            <span>{t(`sections.${key}.title`)}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Main Content */}
                    <main className="flex-1 space-y-8">
                        {sectionKeys.map((key) => {
                            const Icon = sectionIcons[key];
                            const isStepSection = stepSections.includes(key);
                            const isFeatureSection = featureSections.includes(key);
                            const isTabSection = tabSections.includes(key);
                            const hasTip = key === 'gettingStarted' || key === 'newPatient' || key === 'sync';
                            const hasHowTo = key === 'planning';

                            return (
                                <section
                                    key={key}
                                    id={`section-${key}`}
                                    className={`bg-white rounded-2xl border ${sectionBorderColors[key]} shadow-sm overflow-hidden scroll-mt-40`}
                                >
                                    {/* Section Header */}
                                    <div className="px-6 py-5 border-b border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2.5 rounded-xl ${sectionColors[key]}`}>
                                                <Icon size={20} />
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-black text-slate-800">
                                                    {t(`sections.${key}.title`)}
                                                </h2>
                                                <p className="text-sm text-slate-500 mt-0.5">
                                                    {t(`sections.${key}.description`)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section Body */}
                                    <div className="px-6 py-5">
                                        {/* Steps (ordered) */}
                                        {isStepSection && (
                                            <ol className="space-y-3">
                                                {getStepKeys(key).map((stepKey, idx) => (
                                                    <li key={stepKey} className="flex items-start gap-3">
                                                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold mt-0.5">
                                                            {idx + 1}
                                                        </span>
                                                        <span className="text-sm text-slate-700 leading-relaxed">
                                                            {t(`sections.${key}.steps.${stepKey}`)}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ol>
                                        )}

                                        {/* Features (unordered) */}
                                        {isFeatureSection && (
                                            <ul className="space-y-3">
                                                {getFeatureKeys(key).map((featureKey) => (
                                                    <li key={featureKey} className="flex items-start gap-3">
                                                        <ChevronRight size={16} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                                                        <span className="text-sm text-slate-700 leading-relaxed">
                                                            {t(`sections.${key}.features.${featureKey}`)}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}

                                        {/* Workflow tabs + features */}
                                        {isTabSection && (
                                            <div className="space-y-5">
                                                <div className="space-y-3">
                                                    <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Workflow</h3>
                                                    {(['preOp', 'bloc', 'postOp'] as const).map((tabKey) => (
                                                        <div key={tabKey} className="flex items-start gap-3 pl-2">
                                                            <ChevronRight size={16} className="text-orange-400 mt-0.5 flex-shrink-0" />
                                                            <span className="text-sm text-slate-700 leading-relaxed">
                                                                {t(`sections.workflow.tabs.${tabKey}`)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="space-y-3">
                                                    <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Features</h3>
                                                    {(['bulkActions', 'search', 'filters', 'realtime'] as const).map((featureKey) => (
                                                        <div key={featureKey} className="flex items-start gap-3 pl-2">
                                                            <ChevronRight size={16} className="text-orange-400 mt-0.5 flex-shrink-0" />
                                                            <span className="text-sm text-slate-700 leading-relaxed">
                                                                {t(`sections.workflow.features.${featureKey}`)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* How-to callout (planning) */}
                                        {hasHowTo && (
                                            <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                                                <div className="flex items-start gap-2">
                                                    <Lightbulb size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                                                    <p className="text-sm text-blue-700 font-medium">
                                                        {t('sections.planning.howTo')}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Tip callout */}
                                        {hasTip && (
                                            <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-100">
                                                <div className="flex items-start gap-2">
                                                    <Lightbulb size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                                    <p className="text-sm text-amber-700 font-medium">
                                                        {t(`sections.${key}.tip`)}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            );
                        })}
                    </main>
                </div>
            </div>
        </div>
    );
}
