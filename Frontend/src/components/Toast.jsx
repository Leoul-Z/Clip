import React from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

export default function Toast({ toasts }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const bgColors = {
          success: 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300',
          error: 'bg-rose-950/90 border-rose-500/40 text-rose-300',
          info: 'bg-indigo-950/90 border-indigo-500/40 text-indigo-300',
        };
        const icons = {
          success: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
          error: <XCircle className="w-4 h-4 text-rose-400" />,
          info: <Info className="w-4 h-4 text-indigo-400" />,
        };

        return (
          <div
            key={t.id}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-xl text-xs font-medium backdrop-blur-md pointer-events-auto transition-all animate-fade-in ${
              bgColors[t.type] || bgColors.info
            }`}
          >
            {icons[t.type] || icons.info}
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
