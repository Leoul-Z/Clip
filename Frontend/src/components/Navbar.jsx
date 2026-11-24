import React from 'react';
import { Scissors, RefreshCw, LogOut } from 'lucide-react';

export default function Navbar({ onRefresh, onLogout, isRefreshing }) {
  return (
    <header className="glass-nav sticky top-0 z-40 px-4 sm:px-6 py-3.5 border-b border-neutral-800">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-brand-500 to-sky-400 flex items-center justify-center shadow-lg shadow-brand-500/25">
            <Scissors className="text-white w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Clipper Admin <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">Hub</span>
              </h1>
            </div>
            <p className="text-xs text-neutral-400">Telegram Clipper Campaign Management &amp; Payouts</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success-500/10 border border-success-500/20 text-success-500 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse"></span>
            <span>Live PostgreSQL</span>
          </div>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-medium border border-neutral-800 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-neutral-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error-500/10 hover:bg-error-500/20 text-error-500 text-xs font-medium border border-error-500/20 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
