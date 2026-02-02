'use client';

import { useState, useEffect } from 'react';
import FicheMedicale from './components/FicheMedicale';
import RecordList from './components/RecordList';
import EditionSelector from './components/EditionSelector';
import { useSync } from './hooks/useSync';
import { MedicalRecord, Edition, db } from '@/lib/client-db';
import { getSelectedEdition, StoredEdition } from '@/lib/edition-storage';

export default function Home() {
  const [view, setView] = useState<'form' | 'list'>('form');
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | undefined>(undefined);
  const [currentEdition, setCurrentEdition] = useState<Edition | null>(null);
  const [showEditionSelector, setShowEditionSelector] = useState(false);
  const [isLoadingEdition, setIsLoadingEdition] = useState(true);

  // Activate Sync
  useSync();

  // Vérifier et charger l'édition au démarrage
  useEffect(() => {
    const loadEdition = async () => {
      try {
        const stored: StoredEdition | null = getSelectedEdition();

        if (stored) {
          // Charger l'édition depuis Dexie
          const edition = await db.editions.get(stored.editionId);
          if (edition && edition.is_active === 1 && edition.deleted === 0) {
            setCurrentEdition(edition);
            setIsLoadingEdition(false);
            return;
          }
        }

        // Pas d'édition valide → afficher le sélecteur
        setShowEditionSelector(true);
        setIsLoadingEdition(false);
      } catch (error) {
        console.error('Erreur lors du chargement de l\'édition:', error);
        setShowEditionSelector(true);
        setIsLoadingEdition(false);
      }
    };

    loadEdition();
  }, []);

  useEffect(() => {
    // Listen for custom event from FicheMedicale component
    const handleSwitch = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail === 'list') {
        setView('list');
      }
    };

    document.addEventListener('switchTab', handleSwitch);
    return () => document.removeEventListener('switchTab', handleSwitch);
  }, []);

  const handleEditionSelect = (edition: Edition) => {
    setCurrentEdition(edition);
    setShowEditionSelector(false);
  };

  const handleChangeEdition = () => {
    setShowEditionSelector(true);
  };

  // Écran de chargement
  if (isLoadingEdition) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Chargement...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-pink-50/30 font-[family-name:var(--font-geist-sans)]">
      {/* EDITION SELECTOR MODAL */}
      {showEditionSelector && (
        <EditionSelector
          onSelect={handleEditionSelect}
          onClose={() => setShowEditionSelector(false)}
        />
      )}

      {view === 'form' ? (
        <FicheMedicale
          key={selectedRecord ? selectedRecord.id : 'new'}
          initialData={selectedRecord}
          currentEditionId={currentEdition?.id}
          edition={currentEdition}
          onChangeEdition={handleChangeEdition}
          onSuccess={() => {
            setSelectedRecord(undefined);
          }}
          onNew={() => setSelectedRecord(undefined)}
        />
      ) : (
        <RecordList
          currentEditionId={currentEdition?.id}
          edition={currentEdition}
          onChangeEdition={handleChangeEdition}
          onBack={() => {
            setSelectedRecord(undefined);
            setView('form');
          }}
          onEdit={(record: MedicalRecord) => {
            setSelectedRecord(record);
            setView('form');
          }}
        />
      )}
    </main>
  );
}
