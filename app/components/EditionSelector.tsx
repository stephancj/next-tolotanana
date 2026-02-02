'use client';

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Edition } from '@/lib/client-db';
import { saveSelectedEdition } from '@/lib/edition-storage';

interface EditionSelectorProps {
    onSelect: (edition: Edition) => void;
    onClose?: () => void;
}

export default function EditionSelector({ onSelect, onClose }: EditionSelectorProps) {
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newEdition, setNewEdition] = useState({
        name: '',
        place: '',
        year: new Date().getFullYear(),
        description: ''
    });

    const [isLoadingFromRemote, setIsLoadingFromRemote] = useState(false);

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
                            console.log(`📥 ${remoteEditions.length} éditions récupérées du serveur`);
                            // Insert into local DB
                            await db.editions.bulkPut(remoteEditions.map((e: any) => ({
                                ...e,
                                // Ensure types match Dexie schema
                                is_active: e.is_active ? 1 : 0,
                                deleted: e.deleted ? 1 : 0,
                                sync_status: 'synced'
                            })));
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
    }, [editions]);

    const handleSelectEdition = (edition: Edition) => {
        saveSelectedEdition(edition);
        onSelect(edition);
        if (onClose) onClose();
    };

    const handleCreateEdition = async () => {
        if (!newEdition.name || !newEdition.place) {
            alert('Veuillez remplir le nom et le lieu');
            return;
        }

        try {
            const edition: Edition = {
                public_id: crypto.randomUUID(),
                name: newEdition.name,
                place: newEdition.place,
                year: newEdition.year,
                description: newEdition.description,
                is_active: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                deleted: 0,
                sync_status: 'pending_update'
            };

            const id = await db.editions.add(edition);
            const createdEdition = await db.editions.get(id);

            if (createdEdition) {
                handleSelectEdition(createdEdition);
            }
        } catch (error) {
            console.error('Erreur lors de la création de l\'édition:', error);
            alert('Erreur lors de la création de l\'édition');
        }
    };

    if (!editions) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Chargement des éditions...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                        <span className="text-3xl">📋</span>
                        Sélectionner une Édition
                    </h2>
                    <p className="text-indigo-100 mt-2">
                        Choisissez la mission médicale pour laquelle vous souhaitez travailler
                    </p>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {!showCreateForm ? (
                        <>
                            {/* Liste des éditions */}
                            <div className="space-y-3 mb-6">
                                {editions.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        <p className="text-lg">Aucune édition disponible</p>
                                        <p className="text-sm mt-2">Créez votre première édition pour commencer</p>
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

                            {/* Bouton Créer */}
                            <button
                                onClick={() => setShowCreateForm(true)}
                                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold py-4 px-6 rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                            >
                                <span className="text-2xl">➕</span>
                                Créer une Nouvelle Édition
                            </button>
                        </>
                    ) : (
                        <>
                            {/* Formulaire de création */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Nom de l'édition *
                                    </label>
                                    <input
                                        type="text"
                                        value={newEdition.name}
                                        onChange={(e) => setNewEdition({ ...newEdition, name: e.target.value })}
                                        placeholder="Ex: Mission Morondava 2026"
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Lieu *
                                        </label>
                                        <input
                                            type="text"
                                            value={newEdition.place}
                                            onChange={(e) => setNewEdition({ ...newEdition, place: e.target.value })}
                                            placeholder="Ex: Morondava"
                                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Année
                                        </label>
                                        <input
                                            type="number"
                                            value={newEdition.year}
                                            onChange={(e) => setNewEdition({ ...newEdition, year: parseInt(e.target.value) })}
                                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Description (optionnel)
                                    </label>
                                    <textarea
                                        value={newEdition.description}
                                        onChange={(e) => setNewEdition({ ...newEdition, description: e.target.value })}
                                        placeholder="Description de la mission..."
                                        rows={3}
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none resize-none"
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        onClick={() => setShowCreateForm(false)}
                                        className="flex-1 bg-gray-200 text-gray-700 font-bold py-3 px-6 rounded-xl hover:bg-gray-300 transition-all"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        onClick={handleCreateEdition}
                                        className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3 px-6 rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md"
                                    >
                                        Créer
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
