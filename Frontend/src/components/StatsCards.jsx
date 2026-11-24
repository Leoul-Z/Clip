import React from 'react';

export default function StatsCards({ stats, onPendingClick }) {
  const pendingCount = stats.pending_submissions || 0;

  return (
    <div className="w-full items-start rounded-lg border border-solid border-neutral-border bg-default-background grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 overflow-hidden shadow-xs">
      {/* 1. Clippers */}
      <div className="flex flex-col items-start gap-1 self-stretch border-r border-b lg:border-b-0 border-solid border-neutral-border px-3.5 sm:px-5 py-3 sm:py-4">
        <span className="w-full text-overline font-overline text-subtext-color uppercase truncate">
          Clippers
        </span>
        <span className="w-full text-lg sm:text-heading-1 font-heading-1 text-default-font truncate">
          {stats.total_users || 0}
        </span>
        <span className="w-full text-caption font-caption text-subtext-color truncate">
          Registered
        </span>
      </div>

      {/* 2. Accounts */}
      <div className="flex flex-col items-start gap-1 self-stretch border-b sm:border-r lg:border-b-0 border-solid border-neutral-border px-3.5 sm:px-5 py-3 sm:py-4">
        <span className="w-full text-overline font-overline text-subtext-color uppercase truncate">
          Accounts
        </span>
        <span className="w-full text-lg sm:text-heading-1 font-heading-1 text-default-font truncate">
          {stats.total_social_accounts || 0}
        </span>
        <div className="flex w-full items-center gap-1.5 truncate">
          {stats.pending_social_accounts > 0 ? (
            <>
              <div className="flex h-1.5 w-1.5 flex-none items-start rounded-full bg-amber-500 animate-pulse" />
              <span className="text-caption font-caption text-amber-800 font-semibold truncate">
                {stats.pending_social_accounts} pending review
              </span>
            </>
          ) : (
            <span className="w-full text-caption font-caption text-subtext-color truncate">
              Linked socials
            </span>
          )}
        </div>
      </div>

      {/* 3. Submissions */}
      <div className="flex flex-col items-start gap-1 self-stretch border-r border-b sm:border-b-0 lg:border-b-0 border-solid border-neutral-border px-3.5 sm:px-5 py-3 sm:py-4">
        <span className="w-full text-overline font-overline text-subtext-color uppercase truncate">
          Submissions
        </span>
        <span className="w-full text-lg sm:text-heading-1 font-heading-1 text-default-font truncate">
          {stats.total_submissions || 0}
        </span>
        <span className="w-full text-caption font-caption text-subtext-color truncate">
          Video links
        </span>
      </div>

      {/* 4. Pending */}
      <div
        onClick={onPendingClick}
        className="flex flex-col items-start gap-1 self-stretch border-b sm:border-b-0 sm:border-r lg:border-b-0 border-solid border-neutral-border px-3.5 sm:px-5 py-3 sm:py-4 cursor-pointer hover:bg-neutral-50 transition"
        title="View pending submissions"
      >
        <span className="w-full text-overline font-overline text-subtext-color uppercase truncate">
          Pending
        </span>
        <span className="w-full text-lg sm:text-heading-1 font-heading-1 text-default-font truncate">
          {pendingCount}
        </span>
        <div className="flex w-full items-center gap-1.5 truncate">
          <div
            className={`flex h-1.5 w-1.5 flex-none items-start rounded-full ${
              pendingCount > 0 ? 'bg-amber-500 animate-pulse' : 'bg-success-600'
            }`}
          />
          <span
            className={`text-caption font-caption truncate ${
              pendingCount > 0 ? 'text-amber-800 font-semibold' : 'text-success-800'
            }`}
          >
            {pendingCount > 0 ? `${pendingCount} need review` : 'All caught up'}
          </span>
        </div>
      </div>

      {/* 5. Approved Views */}
      <div className="flex flex-col items-start gap-1 self-stretch border-r border-solid border-neutral-border px-3.5 sm:px-5 py-3 sm:py-4">
        <span className="w-full text-overline font-overline text-subtext-color uppercase truncate">
          Approved views
        </span>
        <span className="w-full text-lg sm:text-heading-1 font-heading-1 text-default-font truncate">
          {Number(stats.total_views || 0).toLocaleString()}
        </span>
        <span className="w-full text-caption font-caption text-subtext-color truncate">
          All platforms
        </span>
      </div>

      {/* 6. Total Paid */}
      <div className="flex flex-col items-start gap-1 self-stretch bg-brand-50 px-3.5 sm:px-5 py-3 sm:py-4">
        <span className="w-full text-overline font-overline text-brand-800 uppercase font-semibold truncate">
          Total paid
        </span>
        <span className="w-full text-lg sm:text-heading-1 font-heading-1 text-brand-800 truncate">
          {Number(stats.total_payments || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{' '}
          ETB
        </span>
        <span className="w-full text-caption font-caption text-brand-700 truncate">
          Approved payouts
        </span>
      </div>
    </div>
  );
}
