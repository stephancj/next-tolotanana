'use client';
import { useTranslations } from '../providers/I18nProvider';
export default function LoadingSpinner({ message, fullScreen = true }: { message?: string; fullScreen?: boolean }) {
  const t = useTranslations('common');
  return <div role="status" aria-live="polite" className={fullScreen ? 'fixed inset-0 z-50 grid place-items-center bg-slate-50' : 'grid min-h-40 place-items-center'}><div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4"><span aria-hidden className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" /><span className="font-semibold text-slate-700">{message || t('loading')}</span></div></div>;
}
