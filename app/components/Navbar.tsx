'use client';

import { useState } from 'react';
import { useTranslations } from '../providers/I18nProvider';
import LanguageSwitcher from './LanguageSwitcher';
import Image from 'next/image';

interface NavbarProps {
    onNavigate: (view: string) => void;
    currentView: string;
    editionName?: string;
    onRefresh?: () => void;
    refreshing?: boolean;
}

export default function Navbar({ onNavigate, currentView, editionName, onRefresh, refreshing }: NavbarProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const t = useTranslations('dashboard');
    const tCommon = useTranslations('common');

    const handleNavigate = (view: string) => {
        onNavigate(view);
        setIsMenuOpen(false);
    };

    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
        { id: 'surgeons', label: t('buttons.team'), icon: '🩺' },
        { id: 'planning', label: t('buttons.planning'), icon: '📅' },
        { id: 'workflow', label: t('buttons.workflow'), icon: '⚡' },
        { id: 'list', label: t('buttons.list'), icon: '📂' },
        { id: 'form', label: t('buttons.new'), icon: '✚' },
    ];

    return (
        <nav className="bg-white border-b border-indigo-100 sticky top-0 z-50">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    {/* Logo & Title */}
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNavigate('dashboard')}>
                        <Image src="/logo.png" alt="Logo" width={32} height={32} className="object-contain" />
                        <div className="hidden md:block">
                            <span className="font-black text-slate-800 text-lg tracking-tight">ToloTanana</span>
                            {editionName && <span className="ml-2 text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full">{editionName}</span>}
                        </div>
                    </div>

                    {/* Desktop Menu */}
                    <div className="hidden lg:flex items-center gap-2">
                        {onRefresh && (
                            <button
                                onClick={onRefresh}
                                disabled={refreshing}
                                className={`p-2 rounded-lg text-slate-500 hover:bg-slate-50 transition ${refreshing ? 'animate-spin' : ''}`}
                                title={tCommon('refresh')}
                            >
                                🔄
                            </button>
                        )}
                        <LanguageSwitcher />
                        <div className="h-6 w-px bg-slate-200 mx-2"></div>
                        {menuItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => handleNavigate(item.id)}
                                className={`px-3 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${currentView === item.id
                                    ? 'bg-indigo-50 text-indigo-600'
                                    : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                <span>{item.icon}</span>
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="flex items-center gap-4 lg:hidden">
                        {onRefresh && (
                            <button
                                onClick={onRefresh}
                                disabled={refreshing}
                                className={`p-2 rounded-lg text-slate-500 hover:bg-slate-50 transition ${refreshing ? 'animate-spin' : ''}`}
                            >
                                🔄
                            </button>
                        )}
                        <LanguageSwitcher />
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="p-2 rounded-lg text-slate-600 hover:bg-slate-50 focus:outline-none"
                        >
                            <span className="text-2xl">{isMenuOpen ? '✕' : '☰'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu Dropdown */}
            {isMenuOpen && (
                <div className="lg:hidden border-t border-slate-100 bg-white absolute w-full shadow-lg">
                    <div className="px-4 pt-2 pb-4 space-y-1">
                        {menuItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => handleNavigate(item.id)}
                                className={`w-full text-left px-4 py-3 rounded-xl text-base font-bold transition flex items-center gap-3 ${currentView === item.id
                                    ? 'bg-indigo-50 text-indigo-600'
                                    : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                <span className="text-xl">{item.icon}</span>
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </nav>
    );
}
