'use client';

import { useState } from 'react';
import { useTranslations } from '../providers/I18nProvider';
import LanguageSwitcher from './LanguageSwitcher';
import Image from 'next/image';
import { LayoutDashboard, Stethoscope, Calendar, Zap, FolderOpen, Plus, Menu, X, RefreshCw } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useEdition } from '../providers/EditionProvider';

export default function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const t = useTranslations('dashboard');
    const router = useRouter();
    const pathname = usePathname();
    const { currentEdition, setShowEditionSelector } = useEdition();

    const handleNavigate = (path: string) => {
        router.push(path);
        setIsMenuOpen(false);
    };

    const menuItems = [
        { id: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: '/team', label: t('buttons.team'), icon: Stethoscope },
        { id: '/planning', label: t('buttons.planning'), icon: Calendar },
        { id: '/workflow', label: t('buttons.workflow'), icon: Zap },
        { id: '/list', label: t('buttons.list'), icon: FolderOpen },
        { id: '/form', label: t('buttons.new'), icon: Plus },
    ];

    const currentPath = pathname || '/dashboard';

    // Helper to check active state
    const isActive = (path: string) => {
        if (path === '/dashboard' && currentPath === '/') return true;
        return currentPath.startsWith(path);
    };

    const editionName = currentEdition ? `${currentEdition.name} - ${currentEdition.year}` : undefined;

    return (
        <nav className="bg-white border-b border-indigo-100 sticky top-0 z-50">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    {/* Logo & Title */}
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNavigate('/dashboard')}>
                        <Image src="/logo.png" alt="Logo" width={32} height={32} className="object-contain" />
                        <div className="hidden md:block">
                            <span className="font-black text-slate-800 text-lg tracking-tight">ToloTanana</span>
                            {editionName && <span className="ml-2 text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full">{editionName}</span>}
                        </div>
                    </div>

                    {/* Desktop Menu */}
                    <div className="hidden lg:flex items-center gap-2">

                        <button
                            onClick={() => setShowEditionSelector(true)}
                            title="Changer d'édition"
                            className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                            <RefreshCw size={20} />
                        </button>
                        <LanguageSwitcher />
                        <div className="h-6 w-px bg-slate-200 mx-2"></div>
                        {menuItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleNavigate(item.id)}
                                    className={`px-3 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${isActive(item.id)
                                        ? 'bg-indigo-50 text-indigo-600'
                                        : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    <Icon size={18} />
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="flex items-center gap-2 lg:hidden">
                        <button
                            onClick={() => setShowEditionSelector(true)}
                            title="Changer d'édition"
                            className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                            <RefreshCw size={20} />
                        </button>
                        <LanguageSwitcher />
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="p-2 rounded-lg text-slate-600 hover:bg-slate-50 focus:outline-none"
                        >
                            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu Dropdown */}
            {isMenuOpen && (
                <div className="lg:hidden border-t border-slate-100 bg-white absolute w-full shadow-lg">
                    <div className="px-4 pt-2 pb-4 space-y-1">
                        {menuItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleNavigate(item.id)}
                                    className={`w-full text-left px-4 py-3 rounded-xl text-base font-bold transition flex items-center gap-3 ${isActive(item.id)
                                        ? 'bg-indigo-50 text-indigo-600'
                                        : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    <Icon size={20} />
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </nav>
    );
}
