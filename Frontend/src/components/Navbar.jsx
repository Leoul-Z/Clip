import React from 'react';

export default function Navbar({ onRefresh, onLogout, onOpenBroadcast, onOpenRates, onOpenResetStats, isRefreshing }) {
  return (
    <header className="flex w-full items-center justify-between gap-2 sm:gap-4 border-b border-solid border-neutral-border bg-default-background px-4 sm:px-8 lg:px-20 py-3 sticky top-0 z-40">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-brand-primary shadow-xs">
          <svg
            className="text-[18px] text-white"
            width="1.1em"
            height="1.1em"
            viewBox="0 0 24 24"
          >
            <ellipse
              cx="6"
              cy="6"
              rx="3"
              ry="3"
              fill="none"
              stroke="rgb(255 255 255)"
              strokeWidth="2"
              strokeLinecap="butt"
              strokeLinejoin="miter"
            />
            <ellipse
              cx="6"
              cy="18"
              rx="3"
              ry="3"
              fill="none"
              stroke="rgb(255 255 255)"
              strokeWidth="2"
              strokeLinecap="butt"
              strokeLinejoin="miter"
            />
            <path
              d="M20 4 8.1 15.9m6.4-1.4L20 20M8.1 8.1 12 12"
              fill="none"
              stroke="rgb(255 255 255)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="miter"
            />
          </svg>
        </div>
        <div className="flex flex-col items-start min-w-0">
          <span className="text-heading-3 font-heading-3 text-default-font truncate">
            Clipper Admin
          </span>
          <span className="hidden sm:block text-caption font-caption text-subtext-color truncate">
            Telegram campaign management &amp; payouts
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        <button
          onClick={onOpenRates}
          className="flex items-center gap-1.5 rounded-sm px-2.5 sm:px-3 py-1.5 hover:bg-neutral-100 transition cursor-pointer text-neutral-600 hover:text-neutral-900"
          title="Configure platform payout rates"
        >
          <svg
            className="text-[14px]"
            width="1em"
            height="1em"
            viewBox="0 0 24 24"
          >
            <path
              d="M12 2v20m5-17H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
              fill="none"
              stroke="rgb(75 85 99)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="miter"
            />
          </svg>
          <span className="text-body font-body text-neutral-600 hidden md:inline">
            Pricing rates
          </span>
        </button>

        <button
          onClick={onOpenResetStats}
          className="flex items-center gap-1.5 rounded-sm px-2.5 sm:px-3 py-1.5 hover:bg-error-50 transition cursor-pointer text-neutral-600 hover:text-error-700"
          title="Reset verified views & payments of all clippers"
        >
          <svg
            className="text-[14px]"
            width="1em"
            height="1em"
            viewBox="0 0 24 24"
          >
            <path
              d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8m0-5v5h5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-body font-body hidden lg:inline">
            Reset stats
          </span>
        </button>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 rounded-sm px-2.5 sm:px-3 py-1.5 hover:bg-neutral-100 transition cursor-pointer text-neutral-600 hover:text-neutral-900"
          title="Refresh dashboard data"
        >
          <svg
            className={`text-[14px] ${isRefreshing ? 'animate-spin' : ''}`}
            width="1em"
            height="1em"
            viewBox="0 0 24 24"
          >
            <path
              d="M21 12a9 9 0 1 1-3-6.7L21 8m0-5v5h-5"
              fill="none"
              stroke="rgb(75 85 99)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-body font-body text-neutral-600 hidden md:inline">
            Refresh
          </span>
        </button>

        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 rounded-sm px-2.5 sm:px-3 py-1.5 hover:bg-neutral-100 transition cursor-pointer text-neutral-600 hover:text-neutral-900"
          title="Log out of session"
        >
          <svg
            className="text-[14px]"
            width="1em"
            height="1em"
            viewBox="0 0 24 24"
          >
            <path
              d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9"
              fill="none"
              stroke="rgb(75 85 99)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-body font-body text-neutral-600 hidden md:inline">
            Log out
          </span>
        </button>

        <button
          onClick={onOpenBroadcast}
          className="flex items-center gap-1.5 rounded-sm bg-brand-primary px-2.5 sm:px-3 py-1.5 ml-1 sm:ml-2 hover:bg-brand-600 transition cursor-pointer text-white shadow-xs"
          title="Broadcast message to all clippers via Telegram bot"
        >
          <svg
            className="text-[14px]"
            width="1em"
            height="1em"
            viewBox="0 0 24 24"
          >
            <path
              d="M22 2 11 13M22 2l-7 20-4-9-9-4z"
              fill="none"
              stroke="rgb(255 255 255)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-body-bold font-body-bold text-white hidden sm:inline">
            Broadcast DM
          </span>
        </button>
      </div>
    </header>
  );
}
