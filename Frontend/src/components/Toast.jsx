import React from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

export default function Toast({ toasts }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const bgColors = {
          success: 'bg-white border-success-500/40 text-success-800 shadow-lg shadow-success-500/10',
          error: 'bg-white border-error-500/40 text-error-800 shadow-lg shadow-error-500/10',
          info: 'bg-white border-brand-500/40 text-brand-800 shadow-lg shadow-brand-500/10',
        };
        const icons = {
          success: <CheckCircle2 className="w-4 h-4 text-success-600" />,
          error: <XCircle className="w-4 h-4 text-error-600" />,
          info: <Info className="w-4 h-4 text-brand-600" />,
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
