'use client';

import { useState, useEffect } from 'react';
import { Edition } from '@/lib/client-db';
import { useTranslations } from '../providers/I18nProvider';

interface Surgeon {
    id: number;
    public_id: string;
    name: string;
    specialty?: string;
    email?: string;
    phone?: string;
    is_active: number;
}

interface SurgeonManagerProps {
    currentEdition: Edition | null;
    onBack: () => void;
}

export default function SurgeonManager({ currentEdition, onBack }: SurgeonManagerProps) {
    const [surgeons, setSurgeons] = useState<Surgeon[]>([]);
    const [editionSurgeons, setEditionSurgeons] = useState<Surgeon[]>([]);
    const [loading, setLoading] = useState(true);
    const [newSurgeonName, setNewSurgeonName] = useState('');
    const [newSpecialty, setNewSpecialty] = useState('');
    const t = useTranslations('surgeons');

    useEffect(() => {
        fetchData();
    }, [currentEdition]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const allRes = await fetch('/api/surgeons');
            if (allRes.ok) {
                const allData = await allRes.json();
                setSurgeons(allData);
            }

            if (currentEdition?.id) {
                const linkedRes = await fetch(`/api/editions/${currentEdition.id}/surgeons`);
                if (linkedRes.ok) {
                    const linkedData = await linkedRes.json();
                    setEditionSurgeons(linkedData);
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSurgeon = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSurgeonName.trim()) return;

        try {
            const res = await fetch('/api/surgeons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newSurgeonName, specialty: newSpecialty }),
            });

            if (res.ok) {
                setNewSurgeonName('');
                setNewSpecialty('');
                fetchData(); // Refresh list
            }
        } catch (error) {
            console.error('Error creating surgeon:', error);
        }
    };

    const handleLinkSurgeon = async (surgeon: Surgeon) => {
        if (!currentEdition?.id) return;

        try {
            const res = await fetch(`/api/editions/${currentEdition.id}/surgeons`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ surgeon_id: surgeon.id }),
            });

            if (res.ok) {
                fetchData();
            }
        } catch (error) {
            console.error('Error linking surgeon:', error);
        }
    };

    const handleUnlinkSurgeon = async (surgeon: Surgeon) => {
        if (!currentEdition?.id) return;

        try {
            const res = await fetch(`/api/editions/${currentEdition.id}/surgeons`, {
                method: 'DELETE', // DELETE request
                headers: { 'Content-Type': 'application/json' }, // We need to send content type for DELETE with body
                body: JSON.stringify({ surgeon_id: surgeon.id }),
            });

            if (res.ok) {
                fetchData();
            }
        } catch (error) {
            console.error('Error unlinking surgeon:', error);
        }
    };

    const isLinked = (surgeonId: number) => {
        return editionSurgeons.some(s => s.id === surgeonId);
    };

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-lg mt-8">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h2 className="text-2xl font-bold text-gray-800">{t('title')}</h2>
                <button onClick={onBack} className="text-gray-500 hover:text-gray-700">{t('close')}</button>
            </div>

            {/* Create Surgeon Form */}
            <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-lg mb-4 text-gray-700">{t('add.title')}</h3>
                <form onSubmit={handleCreateSurgeon} className="flex gap-4">
                    <input
                        type="text"
                        placeholder={t('add.namePlaceholder')}
                        value={newSurgeonName}
                        onChange={(e) => setNewSurgeonName(e.target.value)}
                        className="flex-1 px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                    />
                    <input
                        type="text"
                        placeholder={t('add.specialtyPlaceholder')}
                        value={newSpecialty}
                        onChange={(e) => setNewSpecialty(e.target.value)}
                        className="flex-1 px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition">
                        {t('add.submit')}
                    </button>
                </form>
            </div>

            {/* List and Assign */}
            <div>
                <h3 className="font-semibold text-lg mb-4 text-gray-700 flex justify-between">
                    <span>{t('list.title')}</span>
                    {currentEdition && <span className="text-sm font-normal text-gray-500">{t('list.subtitle', { editionName: currentEdition.name })}</span>}
                </h3>

                {loading ? (
                    <div className="text-center py-8">{t('list.loading')}</div>
                ) : (
                    <div className="space-y-2">
                        {surgeons.length === 0 ? (
                            <p className="text-gray-500 italic">{t('list.empty')}</p>
                        ) : (
                            surgeons.map((surgeon) => {
                                const active = isLinked(surgeon.id);
                                return (
                                    <div key={surgeon.id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded border border-gray-100">
                                        <div>
                                            <p className="font-bold text-gray-800">{surgeon.name}</p>
                                            <p className="text-sm text-gray-500">{surgeon.specialty || t('list.unspecified')}</p>
                                        </div>
                                        {currentEdition && (
                                            <button
                                                onClick={() => active ? handleUnlinkSurgeon(surgeon) : handleLinkSurgeon(surgeon)}
                                                className={`px-4 py-1.5 rounded text-sm font-medium transition ${active
                                                    ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700'
                                                    : 'bg-gray-200 text-gray-600 hover:bg-indigo-100 hover:text-indigo-700'
                                                    }`}
                                            >
                                                {active ? t('list.assigned') : t('list.assign')}
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
