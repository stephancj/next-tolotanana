'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type Tone = 'success' | 'error' | 'info';
type Toast = { id: string; message: string; tone: Tone; action?: { label: string; run: () => void } };
type ConfirmOptions = { title: string; message: string; confirmLabel?: string; destructive?: boolean };
type Feedback = {
  notify: (message: string, tone?: Tone, action?: Toast['action']) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};
const Context = createContext<Feedback | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmation, setConfirmation] = useState<(ConfirmOptions & { settle: (value: boolean) => void }) | null>(null);
  const dismiss = useCallback((id: string) => setToasts(items => items.filter(item => item.id !== id)), []);
  const notify = useCallback((message: string, tone: Tone = 'info', action?: Toast['action']) => {
    const id = crypto.randomUUID(); setToasts(items => [...items.slice(-2), { id, message, tone, action }]);
    window.setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000);
  }, [dismiss]);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>(settle => setConfirmation({ ...options, settle })), []);
  const closeConfirm = useCallback((answer: boolean) => { confirmation?.settle(answer); setConfirmation(null); }, [confirmation]);
  useEffect(() => { if (!confirmation) return; const close = (event: KeyboardEvent) => { if (event.key === 'Escape') closeConfirm(false); }; document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close); }, [closeConfirm, confirmation]);

  return <Context.Provider value={{ notify, confirm }}>{children}
    <div aria-live="polite" aria-atomic="true" className="mobile-safe-bottom fixed inset-x-4 bottom-0 z-[100] flex flex-col gap-2 sm:left-auto sm:right-4 sm:w-[min(92vw,420px)]">
      {toasts.map(toast => { const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? AlertTriangle : Info; return <div key={toast.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-950 px-4 py-3 text-sm text-white shadow-xl"><Icon aria-hidden size={19} className={toast.tone === 'success' ? 'text-emerald-400' : toast.tone === 'error' ? 'text-red-400' : 'text-indigo-300'} /><span className="flex-1 font-medium">{toast.message}</span>{toast.action && <button onClick={() => { toast.action!.run(); dismiss(toast.id); }} className="font-bold text-indigo-300 underline-offset-2 hover:underline">{toast.action.label}</button>}<button onClick={() => dismiss(toast.id)} aria-label="Fermer la notification" className="rounded p-1 text-slate-400 hover:text-white"><X size={16} /></button></div>; })}
    </div>
    {confirmation && <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/45 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeConfirm(false); }}><div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-6"><h2 id="confirm-title" className="text-xl font-black text-slate-900">{confirmation.title}</h2><p id="confirm-description" className="mt-2 text-sm leading-6 text-slate-600">{confirmation.message}</p><div className="mt-6 flex flex-col-reverse gap-2 min-[380px]:flex-row min-[380px]:justify-end"><button autoFocus onClick={() => closeConfirm(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 font-bold text-slate-700">Annuler</button><button onClick={() => closeConfirm(true)} className={`min-h-11 rounded-lg px-5 font-bold text-white ${confirmation.destructive ? 'bg-red-600' : 'bg-indigo-600'}`}>{confirmation.confirmLabel || 'Confirmer'}</button></div></div></div>}
  </Context.Provider>;
}
export function useFeedback() { const value = useContext(Context); if (!value) throw new Error('useFeedback must be used inside FeedbackProvider'); return value; }
