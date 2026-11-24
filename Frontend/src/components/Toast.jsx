import React from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

export default function Toast({ toasts }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const bgColors = {
          success: 'bg-success-800/20 border-success-500/40 text-success-500',
          error: 'bg-error-800/20 border-error-500/40 text-error-500',
          info: 'bg-brand-900/40 border-brand-500/40 text-brand-400',
        };
        const icons = {
          success: <CheckCircle2 className="w-4 h-4 text-success-500" />,
          error: <XCircle className="w-4 h-4 text-error-500" />,
          info: <Info className="w-4 h-4 text-brand-500" />,
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
