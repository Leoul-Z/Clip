import React from 'react';

export default function StatsCards({ stats, onPendingClick }) {
  const pendingCount = stats.pending_submissions || 0;

  return (
    <div className="w-full items-start rounded-lg border border-solid border-neutral-border bg-default-background grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 overflow-hidden shadow-xs">
      {/* Clippers */}
      <div className="flex flex-col items-start gap-1 self-stretch border-r border-b lg:border-b-0 border-solid border-neutral-border px-5 py-4">
        <span className="w-full text-overline font-overline text-subtext-color uppercase">
          Clippers
        </span>
        <span className="w-full text-heading-1 font-heading-1 text-default-font">
          {stats.total_users || 0}
        </span>
        <span className="w-full text-caption font-caption text-subtext-color">
          Registered
        </span>
      </div>

      {/* Accounts */}
      <div className="flex flex-col items-start gap-1 self-stretch border-r border-b lg:border-b-0 border-solid border-neutral-border px-5 py-4">
        <span className="w-full text-overline font-overline text-subtext-color uppercase">
          Accounts
        </span>
        <span className="w-full text-heading-1 font-heading-1 text-default-font">
          {stats.total_social_accounts || 0}
        </span>
        <span className="w-full text-caption font-caption text-subtext-color">
          Linked socials
        </span>
      </div>

      {/* Submissions */}
      <div className="flex flex-col items-start gap-1 self-stretch border-r sm:border-r-0 lg:border-r border-b lg:border-b-0 border-solid border-neutral-border px-5 py-4">
        <span className="w-full text-overline font-overline text-subtext-color uppercase">
          Submissions
        </span>
        <span className="w-full text-heading-1 font-heading-1 text-default-font">
          {stats.total_submissions || 0}
        </span>
        <span className="w-full text-caption font-caption text-subtext-color">
          Video links
        </span>
      </div>

      {/* Pending */}
      <div
        onClick={onPendingClick}
        className="flex flex-col items-start gap-1 self-stretch border-r border-solid border-neutral-border px-5 py-4 cursor-pointer hover:bg-neutral-50 transition"
        title="View pending submissions"
      >
        <span className="w-full text-overline font-overline text-subtext-color uppercase">
          Pending
        </span>
        <span className="w-full text-heading-1 font-heading-1 text-default-font">
          {pendingCount}
        </span>
        <div className="flex w-full items-center gap-1.5">
          <div
            className={`flex h-1.5 w-1.5 flex-none items-start rounded-full ${
              pendingCount > 0 ? 'bg-amber-500 animate-pulse' : 'bg-success-600'
            }`}
          />
          <span
            className={`text-caption font-caption ${
              pendingCount > 0 ? 'text-amber-800 font-semibold' : 'text-success-800'
            }`}
          >
            {pendingCount > 0 ? `${pendingCount} need review` : 'All caught up'}
          </span>
        </div>
      </div>

      {/* Approved Views */}
      <div className="flex flex-col items-start gap-1 self-stretch border-r border-solid border-neutral-border px-5 py-4">
        <span className="w-full text-overline font-overline text-subtext-color uppercase">
          Approved views
        </span>
        <span className="w-full text-heading-1 font-heading-1 text-default-font">
          {Number(stats.total_views || 0).toLocaleString()}
        </span>
        <span className="w-full text-caption font-caption text-subtext-color">
          Across all platforms
        </span>
      </div>

      {/* Total Paid */}
      <div className="flex flex-col items-start gap-1 self-stretch bg-brand-50 px-5 py-4">
        <span className="w-full text-overline font-overline text-brand-800 uppercase font-semibold">
          Total paid
        </span>
        <span className="w-full text-heading-1 font-heading-1 text-brand-800">
          {Number(stats.total_payments || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{' '}
          ETB
        </span>
        <span className="w-full text-caption font-caption text-brand-700">
          Approved payouts
        </span>
      </div>
    </div>
  );
}
