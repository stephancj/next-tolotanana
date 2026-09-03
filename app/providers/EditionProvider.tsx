'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Edition, db } from '@/lib/client-db';
import { getSelectedEdition, StoredEdition } from '@/lib/edition-storage';
import EditionSelector from '@/app/components/EditionSelector';
import { usePathname } from 'next/navigation';

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
    const pathname = usePathname();
    const editionOptional = pathname?.startsWith('/volunteers');
    const [currentEdition, setCurrentEditionState] = useState<Edition | null>(null);
    const [showEditionSelector, setShowEditionSelector] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

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

                setShowEditionSelector(!editionOptional);
                setIsLoading(false);
            } catch (error) {
                console.error("Error loading edition:", error);
                setShowEditionSelector(!editionOptional);
                setIsLoading(false);
            }
        };

        loadEdition();
    }, [editionOptional]);

    const handleSelectEdition = (edition: Edition) => {
        setCurrentEditionState(edition);
        setShowEditionSelector(false);
    };

    if (isLoading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600"></div>
                    <p className="mt-4 text-gray-600 font-medium">Chargement de l&apos;édition...</p>
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
