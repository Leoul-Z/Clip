import React from 'react';

export default function Navbar({ onRefresh, onLogout, onOpenBroadcast, onOpenRates, isRefreshing }) {
  return (
    <header className="flex w-full items-center gap-4 border-b border-solid border-neutral-border bg-default-background px-4 sm:px-12 lg:px-20 py-3 sticky top-0 z-40">
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
      <div className="flex flex-col items-start grow">
        <span className="w-full text-heading-3 font-heading-3 text-default-font">
          Clipper Admin
        </span>
        <span className="w-full text-caption font-caption text-subtext-color">
          Telegram campaign management &amp; payouts
        </span>
      </div>
      <div className="flex items-center gap-1 sm:gap-1.5">
        <button
          onClick={onOpenRates}
          className="flex items-center gap-1.5 rounded-sm px-3 py-1.5 hover:bg-neutral-100 transition cursor-pointer text-neutral-600 hover:text-neutral-900"
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
          <span className="text-body font-body text-neutral-600 hidden sm:inline">
            Pricing rates
          </span>
        </button>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 rounded-sm px-3 py-1.5 hover:bg-neutral-100 transition cursor-pointer text-neutral-600 hover:text-neutral-900"
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
          <span className="text-body font-body text-neutral-600 hidden sm:inline">
            Refresh
          </span>
        </button>

        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 rounded-sm px-3 py-1.5 hover:bg-neutral-100 transition cursor-pointer text-neutral-600 hover:text-neutral-900"
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
          <span className="text-body font-body text-neutral-600 hidden sm:inline">
            Log out
          </span>
        </button>

        <button
          onClick={onOpenBroadcast}
          className="flex items-center gap-1.5 rounded-sm bg-brand-primary px-3 py-1.5 ml-1 sm:ml-2 hover:bg-brand-600 transition cursor-pointer text-white shadow-xs"
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
          <span className="text-body-bold font-body-bold text-white">
            Broadcast DM
          </span>
        </button>
      </div>
    </header>
  );
}
