'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Edition } from '@/lib/client-db';
import { saveSelectedEdition } from '@/lib/edition-storage';
import LoadingSpinner from './LoadingSpinner';
import { useTranslations } from '../providers/I18nProvider';

interface EditionSelectorProps {
    onSelect: (edition: Edition) => void;
    onClose?: () => void;
}

export default function EditionSelector({ onSelect, onClose }: EditionSelectorProps) {
    const [isLoadingFromRemote, setIsLoadingFromRemote] = useState(false);
    const firstEditionRef = useRef<HTMLButtonElement>(null);
    const t = useTranslations('editions.selector');

    // Charger toutes les éditions actives
    const editions = useLiveQuery(
        () => db.editions
            .where('is_active').equals(1)
            .and(e => e.deleted === 0)
            .reverse()
            .sortBy('year')
    );

    // Sync remote editions if local is empty
    useEffect(() => {
        if (editions !== undefined && editions.length === 0 && !isLoadingFromRemote) {
            const fetchRemote = async () => {
                setIsLoadingFromRemote(true);
                try {
                    const res = await fetch('/api/editions');
                    if (res.ok) {
                        const remoteEditions = await res.json();
                        if (Array.isArray(remoteEditions) && remoteEditions.length > 0) {
                            console.log(`📥 ${remoteEditions.length} ${t('retrieved')}`);
                            // Insert into local DB
                            await db.editions.bulkPut(remoteEditions.map((e: Partial<Edition>) => ({
                                ...e,
                                // Ensure types match Dexie schema
                                is_active: e.is_active ? 1 : 0,
                                deleted: e.deleted ? 1 : 0,
                                sync_status: 'synced'
                            } as Edition)));
                        }
                    }
                } catch (err) {
                    console.error("Failed to fetch remote editions", err);
                } finally {
                    setIsLoadingFromRemote(false);
                }
            };
            fetchRemote();
        }
    }, [editions, isLoadingFromRemote, t]);

    useEffect(() => {
        firstEditionRef.current?.focus();
        const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && onClose) onClose(); };
        document.addEventListener('keydown', close);
        return () => document.removeEventListener('keydown', close);
    }, [onClose, editions]);

    const handleSelectEdition = (edition: Edition) => {
        saveSelectedEdition(edition);
        onSelect(edition);
        if (onClose) onClose();
    };

    if (!editions) {
        return <LoadingSpinner message={t('loading')} />;
    }

    return (
        <div className="mobile-dialog-shell fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div role="dialog" aria-modal="true" aria-labelledby="edition-dialog-title" className="mobile-dialog flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
                {/* Header */}
                <div className="border-b border-slate-200 bg-white p-4 sm:p-6">
                    <h2 id="edition-dialog-title" className="flex items-center gap-3 text-2xl font-black text-slate-950">
                        <Image src="/logo.png" alt="Logo" width={40} height={40} className="object-contain bg-white rounded-full p-1" />
                        {t('title')}
                    </h2>
                    <p className="mt-2 text-slate-600">
                        {t('description')}
                    </p>
                </div>

                {/* Content */}
                <div className="mobile-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                    {/* Liste des éditions */}
                    <div className="space-y-3 mb-6">
                        {editions.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <p className="text-lg">{t('noEditions')}</p>
                                <p className="text-sm mt-2">{t('syncPrompt')}</p>
                            </div>
                        ) : (
                            editions.map((edition, index) => (
                                <button
                                    ref={index === 0 ? firstEditionRef : undefined}
                                    key={edition.id}
                                    onClick={() => handleSelectEdition(edition)}
                                    className="w-full text-left bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-indigo-500 hover:shadow-lg transition-all group"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-lg text-gray-800 group-hover:text-indigo-600 transition-colors">
                                                {edition.name}
                                            </h3>
                                            <div className="mt-2 flex flex-col gap-1 text-sm text-gray-600 min-[420px]:flex-row min-[420px]:gap-4">
                                                <span className="flex items-center gap-1">
                                                    <span>📍</span>
                                                    {edition.place}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <span>📅</span>
                                                    {edition.year}
                                                </span>
                                            </div>
                                            {edition.description && (
                                                <p className="text-sm text-gray-500 mt-2">
                                                    {edition.description}
                                                </p>
                                            )}
                                        </div>
                                        <div className="ml-4">
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 group-hover:bg-indigo-600 flex items-center justify-center transition-colors">
                                                <span className="text-xl group-hover:scale-110 transition-transform">
                                                    ➜
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
