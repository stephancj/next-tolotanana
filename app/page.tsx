'use client';

import { useState, useEffect } from 'react';
import FicheMedicale from './components/FicheMedicale';
import RecordList from './components/RecordList';
import { useSync } from './hooks/useSync';
import { MedicalRecord } from '@/lib/client-db';

export default function Home() {
  const [view, setView] = useState<'form' | 'list'>('form');
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | undefined>(undefined);

  // Activate Sync
  const { status, pendingCount, manualSync } = useSync();

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

  return (
    <main className="min-h-screen bg-pink-50/30 font-[family-name:var(--font-geist-sans)]">
      {/* SYNC STATUS INDICATOR */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full shadow-sm text-xs font-medium border border-gray-100">
        <div className={`w-2 h-2 rounded-full ${status === 'syncing' ? 'bg-yellow-400 animate-pulse' : status === 'offline' ? 'bg-red-500' : 'bg-green-500'}`}></div>
        <span className="text-gray-600">
          {status === 'syncing' ? 'Synchro...' : status === 'offline' ? 'Offline' : 'En ligne'}
        </span>
        {pendingCount > 0 && (
          <span className="bg-indigo-100 text-indigo-700 px-1.5 rounded-md">
            {pendingCount} à envoyer
          </span>
        )}
        <button onClick={manualSync} className="ml-1 text-gray-400 hover:text-indigo-600" title="Forcer la synchro">
          ↻
        </button>
      </div>

      {view === 'form' ? (
        <FicheMedicale
          key={selectedRecord ? selectedRecord.id : 'new'}
          initialData={selectedRecord}
          onSuccess={() => {
            setSelectedRecord(undefined);
            // Optional: switch to list or stay on form
          }}
          onNew={() => setSelectedRecord(undefined)} // Reset form
        />
      ) : (
        <RecordList
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
