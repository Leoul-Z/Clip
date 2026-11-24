import React from 'react';
import { Scissors, RefreshCw, LogOut } from 'lucide-react';

export default function Navbar({ onRefresh, onLogout, isRefreshing }) {
  return (
    <header className="glass-nav sticky top-0 z-40 px-4 sm:px-6 py-3.5 border-b border-neutral-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-brand-500 to-sky-400 flex items-center justify-center shadow-md shadow-brand-500/20">
            <Scissors className="text-white w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-neutral-900 flex items-center gap-2">
                Clipper Admin <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 border border-brand-200">Hub</span>
              </h1>
            </div>
            <p className="text-xs text-neutral-500">Telegram Clipper Campaign Management &amp; Payouts</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success-50 border border-success-200 text-success-700 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse"></span>
            <span>Live PostgreSQL</span>
          </div>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white hover:bg-neutral-100 text-neutral-700 text-xs font-medium border border-neutral-200 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-neutral-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error-50 hover:bg-error-100 text-error-700 text-xs font-medium border border-error-200 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
