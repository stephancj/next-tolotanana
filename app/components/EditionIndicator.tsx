'use client';

import { useState, useEffect } from 'react';
import { Edition } from '@/lib/client-db';
import { getDaysUntilExpiration } from '@/lib/edition-storage';
import { useTranslations } from '../providers/I18nProvider';

interface EditionIndicatorProps {
    edition: Edition | null;
    onChangeEdition: () => void;
}

export default function EditionIndicator({ edition, onChangeEdition }: EditionIndicatorProps) {
    const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
    const t = useTranslations('editions.indicator');

    useEffect(() => {
        const days = getDaysUntilExpiration();
        setDaysRemaining(days);
    }, [edition]);

    if (!edition) return null;

    const isExpiringSoon = daysRemaining !== null && daysRemaining <= 7;

    return (
        <div className="bg-white shadow-sm rounded-xl px-4 py-2 border border-gray-100 flex items-center gap-3">
            <div className="flex flex-col">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                        {t('active')}
                    </span>
                    {isExpiringSoon && (
                        <span className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                            ⏰ {t('daysRemaining', { days: daysRemaining })}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <span className="font-bold text-indigo-600 text-sm leading-tight">
                        {edition.name}
                    </span>
                    <span className="text-gray-400 text-xs">|</span>
                    <span className="text-xs text-gray-600 leading-tight">
                        📍 {edition.place} • {edition.year}
                    </span>
                </div>
            </div>
            <button
                onClick={onChangeEdition}
                className="w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-all flex items-center justify-center group"
                title={t('change')}
            >
                <span className="text-sm group-hover:rotate-180 transition-transform duration-300">
                    🔄
                </span>
            </button>
        </div>
    );
}
