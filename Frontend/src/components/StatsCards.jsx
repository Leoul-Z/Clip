import React from 'react';
import { Users, Video, Clock, Eye, DollarSign, Share2 } from 'lucide-react';

export default function StatsCards({ stats, onPendingClick }) {
  const formatNum = (n) => Number(n || 0).toLocaleString();
  const formatCurr = (n) => `$${Number(n || 0).toFixed(2)}`;

  return (
    <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
      {/* Total Users */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Clippers</span>
          <Users className="text-indigo-400 w-4 h-4" />
        </div>
        <div className="text-2xl font-bold text-white">{formatNum(stats.total_users)}</div>
        <div className="text-[11px] text-slate-400 mt-1">Registered users</div>
      </div>

      {/* Total Submissions */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Submissions</span>
          <Video className="text-purple-400 w-4 h-4" />
        </div>
        <div className="text-2xl font-bold text-white">{formatNum(stats.total_submissions)}</div>
        <div className="text-[11px] text-slate-400 mt-1">Total video links</div>
      </div>

      {/* Pending Review */}
      <div
        onClick={onPendingClick}
        className="glass-panel p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 transition cursor-pointer"
      >
        <div className="flex items-center justify-between text-amber-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Pending</span>
          <Clock className="text-amber-400 w-4 h-4" />
        </div>
        <div className="text-2xl font-bold text-amber-400">{formatNum(stats.pending_submissions)}</div>
        <div className="text-[11px] text-amber-300/80 mt-1">Awaiting review ⚠️</div>
      </div>

      {/* Approved Views */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Total Views</span>
          <Eye className="text-cyan-400 w-4 h-4" />
        </div>
        <div className="text-2xl font-bold text-cyan-400">{formatNum(stats.total_views)}</div>
        <div className="text-[11px] text-slate-400 mt-1">Approved clips</div>
      </div>

      {/* Total Payouts */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Total Paid</span>
          <DollarSign className="text-emerald-400 w-4 h-4" />
        </div>
        <div className="text-2xl font-bold text-emerald-400">{formatCurr(stats.total_payments)}</div>
        <div className="text-[11px] text-slate-400 mt-1">Approved payouts</div>
      </div>

      {/* Linked Social Accounts */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Accounts</span>
          <Share2 className="text-pink-400 w-4 h-4" />
        </div>
        <div className="text-2xl font-bold text-pink-400">{formatNum(stats.total_social_accounts)}</div>
        <div className="text-[11px] text-slate-400 mt-1">Linked socials</div>
      </div>
    </section>
  );
}
