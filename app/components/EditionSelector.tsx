'use client';

import { useState, useEffect } from 'react';
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

    const handleSelectEdition = (edition: Edition) => {
        saveSelectedEdition(edition);
        onSelect(edition);
        if (onClose) onClose();
    };

    if (!editions) {
        return <LoadingSpinner message={t('loading')} />;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                        <Image src="/logo.png" alt="Logo" width={40} height={40} className="object-contain bg-white rounded-full p-1" />
                        {t('title')}
                    </h2>
                    <p className="text-indigo-100 mt-2">
                        {t('description')}
                    </p>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {/* Liste des éditions */}
                    <div className="space-y-3 mb-6">
                        {editions.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <p className="text-lg">{t('noEditions')}</p>
                                <p className="text-sm mt-2">{t('syncPrompt')}</p>
                            </div>
                        ) : (
                            editions.map((edition) => (
                                <button
                                    key={edition.id}
                                    onClick={() => handleSelectEdition(edition)}
                                    className="w-full text-left bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-indigo-500 hover:shadow-lg transition-all group"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-lg text-gray-800 group-hover:text-indigo-600 transition-colors">
                                                {edition.name}
                                            </h3>
                                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
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
