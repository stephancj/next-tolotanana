'use client';

import { useState, useEffect } from 'react';
import FicheMedicale from './components/FicheMedicale';
import RecordList from './components/RecordList';

export default function Home() {
  const [view, setView] = useState<'form' | 'list'>('form');
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

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
      {view === 'form' ? (
        <FicheMedicale
          key={selectedRecord ? selectedRecord.id : 'new'}
          initialData={selectedRecord}
          onSuccess={() => {
            setSelectedRecord(null);
            // Optional: switch to list or stay on form
          }}
          onNew={() => setSelectedRecord(null)} // Reset form
        />
      ) : (
        <RecordList
          onBack={() => {
            setSelectedRecord(null);
            setView('form');
          }}
          onEdit={(record: any) => {
            setSelectedRecord(record);
            setView('form');
          }}
        />
      )}
    </main>
  );
}
