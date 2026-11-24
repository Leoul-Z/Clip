import React from 'react';
import { Users, Video, Clock, Eye, DollarSign, Share2 } from 'lucide-react';

export default function StatsCards({ stats, onPendingClick }) {
  const formatNum = (n) => Number(n || 0).toLocaleString();
  const formatCurr = (n) => `$${Number(n || 0).toFixed(2)}`;

  return (
    <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
      {/* Total Clippers */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm hover:border-neutral-300 transition">
        <div className="flex items-center justify-between text-neutral-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Clippers</span>
          <Users className="text-brand-500 w-4 h-4" />
        </div>
        <div className="text-2xl font-bold text-neutral-900">{formatNum(stats.total_users)}</div>
        <div className="text-[11px] text-neutral-500 mt-1">Registered users</div>
      </div>

      {/* Total Submissions */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm hover:border-neutral-300 transition">
        <div className="flex items-center justify-between text-neutral-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Submissions</span>
          <Video className="text-brand-500 w-4 h-4" />
        </div>
        <div className="text-2xl font-bold text-neutral-900">{formatNum(stats.total_submissions)}</div>
        <div className="text-[11px] text-neutral-500 mt-1">Total video links</div>
      </div>

      {/* Pending Review (Warning: #F59E0B) */}
      <div
        onClick={onPendingClick}
        className="bg-warning-50 p-4 rounded-xl border border-warning-200 shadow-sm hover:border-warning-300 transition cursor-pointer"
      >
        <div className="flex items-center justify-between text-warning-700 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Pending</span>
          <Clock className="text-warning-600 w-4 h-4" />
        </div>
        <div className="text-2xl font-bold text-warning-700">{formatNum(stats.pending_submissions)}</div>
        <div className="text-[11px] text-warning-600 font-medium mt-1">Awaiting review ⚠️</div>
      </div>

      {/* Total Approved Views */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm hover:border-neutral-300 transition">
        <div className="flex items-center justify-between text-neutral-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Total Views</span>
          <Eye className="text-brand-500 w-4 h-4" />
        </div>
        <div className="text-2xl font-bold text-brand-600">{formatNum(stats.total_views)}</div>
        <div className="text-[11px] text-neutral-500 mt-1">Approved views</div>
      </div>

      {/* Total Paid (Paid: #6366F1) */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm hover:border-neutral-300 transition">
        <div className="flex items-center justify-between text-neutral-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Total Paid</span>
          <DollarSign className="text-paid-500 w-4 h-4" />
        </div>
        <div className="text-2xl font-bold text-paid-600">{formatCurr(stats.total_payments)}</div>
        <div className="text-[11px] text-neutral-500 mt-1">Approved payouts</div>
      </div>

      {/* Linked Social Accounts */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm hover:border-neutral-300 transition">
        <div className="flex items-center justify-between text-neutral-500 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Accounts</span>
          <Share2 className="text-brand-500 w-4 h-4" />
        </div>
        <div className="text-2xl font-bold text-neutral-900">{formatNum(stats.total_social_accounts)}</div>
        <div className="text-[11px] text-neutral-500 mt-1">Linked socials</div>
      </div>
    </section>
  );
}
