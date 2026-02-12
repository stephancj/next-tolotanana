'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Edition, db } from '@/lib/client-db';
import { getSelectedEdition, StoredEdition } from '@/lib/edition-storage';
import { useSync } from '../hooks/useSync';
import EditionSelector from '@/app/components/EditionSelector';

interface EditionContextType {
    currentEdition: Edition | null;
    currentEditionId: number | undefined;
    isLoading: boolean;
    setCurrentEdition: (edition: Edition) => void;
    showEditionSelector: boolean;
    setShowEditionSelector: (show: boolean) => void;
}

const EditionContext = createContext<EditionContextType | undefined>(undefined);

export function EditionProvider({ children }: { children: ReactNode }) {
    const [currentEdition, setCurrentEditionState] = useState<Edition | null>(null);
    const [showEditionSelector, setShowEditionSelector] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Sync hook needs to run globally
    useSync();

    useEffect(() => {
        const loadEdition = async () => {
            try {
                const stored: StoredEdition | null = getSelectedEdition();

                if (stored) {
                    const edition = await db.editions.get(stored.editionId);
                    if (edition && edition.is_active === 1 && edition.deleted === 0) {
                        setCurrentEditionState(edition);
                        setIsLoading(false);
                        return;
                    }
                }

                setShowEditionSelector(true);
                setIsLoading(false);
            } catch (error) {
                console.error("Error loading edition:", error);
                setShowEditionSelector(true);
                setIsLoading(false);
            }
        };

        loadEdition();
    }, []);

    const handleSelectEdition = (edition: Edition) => {
        setCurrentEditionState(edition);
        setShowEditionSelector(false);
    };

    if (isLoading) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600 font-medium">Chargement de l'édition...</p>
                </div>
            </main>
        );
    }

    return (
        <EditionContext.Provider value={{
            currentEdition,
            currentEditionId: currentEdition?.id,
            isLoading,
            setCurrentEdition: handleSelectEdition,
            showEditionSelector,
            setShowEditionSelector
        }}>
            {showEditionSelector && (
                <EditionSelector
                    onSelect={handleSelectEdition}
                    onClose={() => setShowEditionSelector(false)}
                />
            )}
            {children}
        </EditionContext.Provider>
    );
}

export function useEdition() {
    const context = useContext(EditionContext);
    if (context === undefined) {
        throw new Error('useEdition must be used within an EditionProvider');
    }
    return context;
}
