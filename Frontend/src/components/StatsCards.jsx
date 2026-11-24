import React from 'react';
import { Users, Video, Clock, Eye, DollarSign, Share2 } from 'lucide-react';

export default function StatsCards({ stats, onPendingClick }) {
  const formatNum = (n) => Number(n || 0).toLocaleString();
  const formatCurr = (n) => `$${Number(n || 0).toFixed(2)}`;

  return (
    <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
      {/* Total Clippers */}
      <div className="glass-panel p-4 rounded-xl border border-neutral-800 hover:border-neutral-700 transition">
        <div className="flex items-center justify-between text-neutral-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Clippers</span>
          <Users className="text-brand-500 w-4 h-4" />
        </div>
        <div className="text-2xl font-bold text-neutral-0">{formatNum(stats.total_users)}</div>
        <div className="text-[11px] text-neutral-400 mt-1">Registered users</div>
      </div>

      {/* Total Submissions */}
      <div className="glass-panel p-4 rounded-xl border border-neutral-800 hover:border-neutral-700 transition">
        <div className="flex items-center justify-between text-neutral-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Submissions</span>
          <Video className="text-brand-400 w-4 h-4" />
        </div>
        <div className="text-2xl font-bold text-neutral-0">{formatNum(stats.total_submissions)}</div>
        <div className="text-[11px] text-neutral-400 mt-1">Total video links</div>
      </div>

      {/* Pending Review (Warning: #F59E0B) */}
      <div
        onClick={onPendingClick}
        className="glass-panel p-4 rounded-xl border border-warning-500/30 bg-warning-500/5 hover:border-warning-500/50 transition cursor-pointer"
      >
        <div className="flex items-center justify-between text-warning-500 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Pending</span>
          <Clock className="text-warning-500 w-4 h-4" />
        </div>
        <div className="text-2xl font-bold text-warning-500">{formatNum(stats.pending_submissions)}</div>
        <div className="text-[11px] text-warning-500/80 mt-1">Awaiting review ⚠️</div>
      </div>

      {/* Total Approved Views */}
      <div className="glass-panel p-4 rounded-xl border border-neutral-800 hover:border-neutral-700 transition">
        <div className="flex items-center justify-between text-neutral-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Total Views</span>
          <Eye className="text-brand-500 w-4 h-4" />
        </div>
        <div className="text-2xl font-bold text-brand-400">{formatNum(stats.total_views)}</div>
        <div className="text-[11px] text-neutral-400 mt-1">Approved views</div>
      </div>

      {/* Total Paid (Paid: #6366F1) */}
      <div className="glass-panel p-4 rounded-xl border border-neutral-800 hover:border-neutral-700 transition">
        <div className="flex items-center justify-between text-neutral-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Total Paid</span>
          <DollarSign className="text-paid-500 w-4 h-4" />
        </div>
        <div className="text-2xl font-bold text-paid-500">{formatCurr(stats.total_payments)}</div>
        <div className="text-[11px] text-neutral-400 mt-1">Approved payouts</div>
      </div>

      {/* Linked Social Accounts */}
      <div className="glass-panel p-4 rounded-xl border border-neutral-800 hover:border-neutral-700 transition">
        <div className="flex items-center justify-between text-neutral-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Accounts</span>
          <Share2 className="text-sky-400 w-4 h-4" />
        </div>
        <div className="text-2xl font-bold text-sky-400">{formatNum(stats.total_social_accounts)}</div>
        <div className="text-[11px] text-neutral-400 mt-1">Linked socials</div>
      </div>
    </section>
  );
}
