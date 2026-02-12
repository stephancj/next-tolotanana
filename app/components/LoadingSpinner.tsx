'use client';

import Image from 'next/image';
import { useTranslations } from '../providers/I18nProvider';

interface LoadingSpinnerProps {
    message?: string;
    fullScreen?: boolean;
}

export default function LoadingSpinner({ message, fullScreen = true }: LoadingSpinnerProps) {
    const tCommon = useTranslations('common');
    const displayMessage = message || tCommon('loading');

    const containerClass = fullScreen
        ? "fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-indigo-50"
        : "flex items-center justify-center p-12";

    return (
        <div className={containerClass}>
            <div className="flex flex-col items-center gap-6">
                {/* Logo avec animation de pulse et rotation */}
                <div className="relative">
                    {/* Cercle de fond animé */}
                    <div className="absolute inset-0 animate-ping">
                        <div className="w-32 h-32 rounded-full bg-gradient-to-r from-pink-400 to-indigo-400 opacity-20"></div>
                    </div>

                    {/* Spinner rotatif */}
                    <div className="absolute inset-0 animate-spin">
                        <div className="w-32 h-32 rounded-full border-4 border-transparent border-t-pink-500 border-r-indigo-500"></div>
                    </div>

                    {/* Logo central avec pulse */}
                    <div className="relative w-32 h-32 flex items-center justify-center animate-pulse">
                        <div className="w-24 h-24 rounded-2xl bg-white shadow-lg flex items-center justify-center overflow-hidden">
                            <Image
                                src="/logo.png"
                                alt="Logo"
                                width={80}
                                height={80}
                                className="object-contain"
                                priority
                            />
                        </div>
                    </div>
                </div>

                {/* Message de chargement */}
                <div className="text-center">
                    <p className="text-lg font-bold text-slate-700 mb-2">{displayMessage}</p>
                    <div className="flex gap-1 justify-center">
                        <span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                </div>
            </div>
        </div>
    );
}
