import React, { useState } from 'react';

export default function UsersManager({
  users,
  onDeleteUser,
  onViewSubmissions,
  onSendMessage,
  onCopy,
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [revealedIds, setRevealedIds] = useState(new Set());

  // Search & filter
  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    const uname = (u.telegram_username || '').toLowerCase();
    const cid = String(u.chat_id || '');
    const bank = (u.payment_details || '').toLowerCase();
    const handles = (u.social_accounts || []).map((sa) => (sa.handle || '').toLowerCase()).join(' ');

    const matchesSearch = !q || uname.includes(q) || cid.includes(q) || bank.includes(q) || handles.includes(q);
    if (!matchesSearch) return false;

    if (filter === 'has_bank') return u.payment_details && u.payment_details.trim().length > 0;
    if (filter === 'missing_bank') return !u.payment_details || u.payment_details.trim().length === 0;
    if (filter === 'has_socials') return (u.social_accounts || []).length > 0;
    if (filter === 'has_submissions') return (u.submission_count || 0) > 0;

    return true;
  });

  const togglePassword = (accId) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(accId)) next.delete(accId);
      else next.add(accId);
      return next;
    });
  };

  const getPlatformBadge = (platform) => {
    const p = (platform || '').toLowerCase();
    if (p.includes('twitter') || p === 'x') {
      return (
        <div className="flex h-6 w-6 flex-none items-center justify-center rounded-sm bg-neutral-900">
          <span className="text-caption-bold font-caption-bold text-white">𝕏</span>
        </div>
      );
    }
    if (p.includes('youtube')) {
      return (
        <div className="flex h-6 w-6 flex-none items-center justify-center rounded-sm bg-[#ff0000]">
          <svg className="text-[12px] text-white" width="1em" height="1em" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" fill="rgb(255 255 255)" />
          </svg>
        </div>
      );
    }
    if (p.includes('tiktok')) {
      return (
        <div className="flex h-6 w-6 flex-none items-center justify-center rounded-sm bg-neutral-900">
          <span className="text-caption-bold font-caption-bold text-white">♪</span>
        </div>
      );
    }
    if (p.includes('instagram')) {
      return (
        <div className="flex h-6 w-6 flex-none items-center justify-center rounded-sm bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600">
          <span className="text-caption-bold font-caption-bold text-white">📸</span>
        </div>
      );
    }
    return (
      <div className="flex h-6 w-6 flex-none items-center justify-center rounded-sm bg-neutral-600 text-white text-xs">
        🌐
      </div>
    );
  };

  const parsePayoutMethods = (paymentDetails) => {
    if (!paymentDetails || !paymentDetails.trim()) return [];
    return paymentDetails
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((entry) => {
        // Parse "Bank Name: 12345678" or "Bank Name 12345678"
        if (entry.includes(':')) {
          const [name, ...rest] = entry.split(':');
          return { name: name.trim(), account: rest.join(':').trim(), raw: entry };
        }
        if (entry.includes('-')) {
          const [name, ...rest] = entry.split('-');
          return { name: name.trim(), account: rest.join('-').trim(), raw: entry };
        }
        return { name: 'Account / Wallet', account: entry, raw: entry };
      });
  };

  return (
    <div className="flex w-full flex-col items-start gap-4">
      {/* Search & Filter Toolbar */}
      <div className="flex w-full flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {/* Search Input */}
        <div className="flex items-center gap-2 rounded-sm border border-solid border-neutral-border bg-default-background px-3 py-2 grow">
          <svg className="text-[14px]" width="1em" height="1em" viewBox="0 0 24 24">
            <ellipse
              cx="11"
              cy="11"
              rx="7"
              ry="7"
              fill="none"
              stroke="rgb(156 163 175)"
              strokeWidth="2"
              strokeLinecap="butt"
              strokeLinejoin="miter"
            />
            <path
              d="m20 20-3.5-3.5"
              fill="none"
              stroke="rgb(156 163 175)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="miter"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search @username, chat ID, bank info or handle"
            className="w-full text-body font-body text-default-font placeholder-neutral-400 focus:outline-none bg-transparent"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-neutral-400 hover:text-neutral-600 text-xs font-bold px-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Dropdown */}
        <div className="flex items-center gap-2 rounded-sm border border-solid border-neutral-border bg-default-background px-3 py-2 relative">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-body font-body text-default-font bg-transparent focus:outline-none pr-5 cursor-pointer appearance-none"
          >
            <option value="all">All clippers</option>
            <option value="has_bank">With bank info</option>
            <option value="missing_bank">Missing bank info</option>
            <option value="has_socials">With linked socials</option>
            <option value="has_submissions">With submissions</option>
          </select>
          <svg
            className="text-[14px] pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
            width="1em"
            height="1em"
            viewBox="0 0 24 24"
          >
            <path
              d="m6 9 6 6 6-6"
              fill="none"
              stroke="rgb(107 114 128)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="miter"
            />
          </svg>
        </div>

        {/* Show Passwords Toggle */}
        <button
          type="button"
          onClick={() => setShowAllPasswords(!showAllPasswords)}
          className="flex items-center gap-2 rounded-sm border border-solid border-neutral-border bg-default-background px-3 py-2 hover:bg-neutral-50 transition cursor-pointer select-none"
        >
          <div
            className={`flex h-4 w-7 flex-none items-center rounded-full px-0.5 transition ${
              showAllPasswords ? 'bg-brand-primary justify-end' : 'bg-neutral-300 justify-start'
            }`}
          >
            <div className="flex h-3 w-3 flex-none items-start rounded-full bg-default-background shadow-xs" />
          </div>
          <span className="text-body font-body text-neutral-700">
            Show passwords
          </span>
        </button>
      </div>

      {/* Clippers Cards List */}
      <div className="flex w-full flex-col items-start gap-3">
        {filteredUsers.length === 0 ? (
          <div className="w-full p-12 text-center border border-neutral-border rounded-lg bg-default-background text-neutral-400 text-body">
            No clippers match your search or filter.
          </div>
        ) : (
          filteredUsers.map((u) => {
            const rawUsername = u.telegram_username || '';
            const cleanUsername = rawUsername.startsWith('@') ? rawUsername.substring(1) : rawUsername;
            const tgLink = cleanUsername ? `https://t.me/${cleanUsername}` : null;
            const socials = u.social_accounts || [];
            const payoutMethods = parsePayoutMethods(u.payment_details);
            const initialLetter = (cleanUsername ? cleanUsername[0] : 'U').toUpperCase();

            return (
              <div
                key={u.id}
                className="flex w-full flex-col items-start overflow-hidden rounded-lg border border-solid border-neutral-border bg-default-background shadow-xs hover:border-neutral-300 transition"
              >
                {/* Card Header Bar */}
                <div className="flex w-full items-center justify-between gap-3 border-b border-solid border-neutral-border px-4 sm:px-5 py-3 flex-wrap sm:flex-nowrap">
                  {/* User Avatar & Identity */}
                  <div className="flex items-center gap-3 min-w-0 grow">
                    {/* Initial Avatar */}
                    <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand-100">
                      <span className="text-body-bold font-body-bold text-brand-700">
                        {initialLetter}
                      </span>
                    </div>

                    {/* Username & ID */}
                    <div className="flex flex-col items-start min-w-0">
                      <div className="flex items-center gap-1.5 max-w-full">
                        {tgLink ? (
                          <a
                            href={tgLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-body-bold font-body-bold text-default-font hover:text-brand-primary transition truncate"
                          >
                            {rawUsername || 'Anonymous'}
                          </a>
                        ) : (
                          <span className="text-body-bold font-body-bold text-default-font truncate">
                            {rawUsername || 'Anonymous'}
                          </span>
                        )}
                        <div className="flex h-4 w-4 flex-none items-center justify-center rounded-full bg-brand-primary">
                          <svg className="text-[10px]" width="1em" height="1em" viewBox="0 0 24 24">
                            <path
                              d="M21.5 3.5 2.6 10.8c-1 .4-1 1.6 0 1.9l4.8 1.5 1.8 5.6c.2.7 1.1.9 1.6.4l2.7-2.5 4.8 3.5c.6.4 1.4.1 1.6-.6l3.2-15.3c.2-.9-.7-1.6-1.6-1.3z"
                              fill="rgb(255 255 255)"
                            />
                          </svg>
                        </div>
                      </div>
                      <span className="w-full text-monospace-caption font-monospace-caption text-subtext-color">
                        ID {u.chat_id}
                      </span>
                    </div>
                  </div>

                  {/* Clipper KPI Stats */}
                  <div className="flex items-center gap-4 sm:gap-6 px-0 sm:px-2 w-full sm:w-auto justify-between sm:justify-end order-3 sm:order-2 py-2 sm:py-0 border-t sm:border-t-0 border-neutral-100">
                    <div className="flex flex-col items-start sm:items-end">
                      <span className="text-overline font-overline text-subtext-color uppercase">
                        Views
                      </span>
                      <span
                        className={`text-body-bold font-body-bold ${
                          (u.views || 0) > 0 ? 'text-default-font' : 'text-neutral-400'
                        }`}
                      >
                        {Number(u.views || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex flex-col items-center sm:items-end">
                      <span className="text-overline font-overline text-subtext-color uppercase">
                        Earned
                      </span>
                      <span
                        className={`text-body-bold font-body-bold ${
                          (u.money || 0) > 0 ? 'text-default-font' : 'text-neutral-400'
                        }`}
                      >
                        {Number(u.money || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        ETB
                      </span>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="text-overline font-overline text-subtext-color uppercase">
                        Clips
                      </span>
                      <span
                        className={`text-body-bold font-body-bold ${
                          (u.submission_count || 0) > 0 ? 'text-default-font' : 'text-neutral-400'
                        }`}
                      >
                        {u.submission_count || 0}
                      </span>
                    </div>
                  </div>

                  <div className="hidden sm:flex h-8 w-px flex-none items-start bg-neutral-border order-3" />

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 order-2 sm:order-4">
                    {/* DM Button */}
                    <button
                      onClick={() => onSendMessage(u)}
                      className="flex items-center gap-1.5 rounded-sm border border-solid border-neutral-border px-2.5 sm:px-3 py-1.5 hover:bg-neutral-50 transition cursor-pointer"
                      title="Direct message this clipper via Telegram"
                    >
                      <svg className="text-[14px]" width="1em" height="1em" viewBox="0 0 24 24">
                        <path
                          d="M22 2 11 13M22 2l-7 20-4-9-9-4z"
                          fill="none"
                          stroke="rgb(55 65 81)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="text-body font-body text-neutral-700">DM</span>
                    </button>

                    {/* Clips Button */}
                    <button
                      onClick={() => onViewSubmissions(u)}
                      className={`flex items-center rounded-sm px-2.5 sm:px-3 py-1.5 transition cursor-pointer ${
                        (u.submission_count || 0) > 0
                          ? 'bg-brand-primary hover:bg-brand-600 text-white shadow-xs'
                          : 'border border-solid border-neutral-border hover:bg-neutral-50 text-neutral-700'
                      }`}
                      title="Filter and inspect only this user's clips"
                    >
                      <span
                        className={`text-body font-body ${
                          (u.submission_count || 0) > 0 ? 'font-body-bold text-white' : 'text-neutral-700'
                        }`}
                      >
                        Clips
                      </span>
                    </button>

                    {/* Delete User */}
                    <button
                      onClick={() => onDeleteUser(u)}
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-sm hover:bg-error-100 transition cursor-pointer text-neutral-400 hover:text-error-600"
                      title="Delete Clipper"
                    >
                      <svg className="text-[16px]" width="1em" height="1em" viewBox="0 0 24 24">
                        <path
                          d="M3 6h18m-2 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Split 2-Column Body */}
                <div className="flex w-full flex-col md:flex-row items-stretch">
                  {/* Left Column: Payout Methods */}
                  <div className="flex w-full md:w-80 flex-none flex-col items-start gap-2 border-b md:border-b-0 md:border-r border-solid border-neutral-border px-5 py-3 bg-white">
                    <div className="flex w-full items-center justify-between">
                      <span className="text-overline font-overline text-subtext-color uppercase">
                        Payout methods
                      </span>
                      {payoutMethods.length > 1 && (
                        <button
                          onClick={() => onCopy(payoutMethods.map((p) => p.raw).join('\n'), 'All payout methods')}
                          className="text-caption-bold font-caption-bold text-brand-700 hover:underline cursor-pointer"
                        >
                          Copy all
                        </button>
                      )}
                    </div>

                    {payoutMethods.length === 0 ? (
                      <div className="w-full py-4 text-center text-xs text-neutral-400 italic">
                        Not provided yet
                      </div>
                    ) : (
                      payoutMethods.map((pm, idx) => (
                        <div
                          key={idx}
                          className="flex w-full items-center gap-3 rounded-md bg-neutral-50 px-3 py-2 border border-neutral-100/80"
                        >
                          <div className="flex flex-col items-start grow min-w-0">
                            <span className="w-full text-caption font-caption text-subtext-color truncate">
                              {pm.name}
                            </span>
                            <span className="w-full text-monospace-body font-monospace-body text-default-font truncate select-all">
                              {pm.account}
                            </span>
                          </div>
                          <button
                            onClick={() => onCopy(pm.account || pm.raw, `${pm.name} account`)}
                            className="text-neutral-400 hover:text-neutral-700 transition cursor-pointer p-1 shrink-0"
                            title="Copy account number"
                          >
                            <svg className="text-[14px]" width="1em" height="1em" viewBox="0 0 24 24">
                              <rect
                                x="9"
                                y="9"
                                width="13"
                                height="13"
                                rx="2"
                                ry="2"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="butt"
                                strokeLinejoin="miter"
                              />
                              <path
                                d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="miter"
                              />
                            </svg>
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Right Column: Linked Social Accounts Table */}
                  <div className="flex flex-col items-start px-5 py-3 grow min-w-0 overflow-x-auto">
                    {/* Column Headers */}
                    <div className="w-full items-start gap-4 pb-2 grid grid-cols-[1.3fr_1.5fr_0.7fr_0.8fr] min-w-[420px]">
                      <span className="self-stretch text-overline font-overline text-subtext-color uppercase">
                        Account
                      </span>
                      <span className="self-stretch text-overline font-overline text-subtext-color uppercase">
                        Login password
                      </span>
                      <span className="self-stretch text-overline font-overline text-subtext-color text-right uppercase">
                        Views
                      </span>
                      <span className="self-stretch text-overline font-overline text-subtext-color text-right uppercase">
                        Earned
                      </span>
                    </div>

                    {socials.length === 0 ? (
                      <div className="w-full py-6 text-center text-xs text-neutral-400 italic border-t border-solid border-neutral-border">
                        No social accounts linked yet
                      </div>
                    ) : (
                      socials.map((sa) => {
                        const isRevealed = showAllPasswords || revealedIds.has(sa.id);
                        const passValue = sa.password || '';

                        return (
                          <div
                            key={sa.id}
                            className="w-full items-center gap-4 border-t border-solid border-neutral-border py-2.5 grid grid-cols-[1.3fr_1.5fr_0.7fr_0.8fr] min-w-[420px]"
                          >
                            {/* Platform Icon & Handle */}
                            <div className="flex items-center gap-2 min-w-0">
                              {getPlatformBadge(sa.platform)}
                              <span
                                className="text-monospace-body font-monospace-body text-default-font truncate select-all"
                                title={sa.handle}
                              >
                                {sa.handle}
                              </span>
                            </div>

                            {/* Password Pill with Eye Toggle */}
                            <div className="flex items-center gap-2 rounded-sm border border-solid border-neutral-border px-2.5 py-1 w-fit bg-white">
                              <span
                                className={`text-monospace-body font-monospace-body tracking-[0.2em] select-all ${
                                  isRevealed ? 'text-brand-700 font-semibold' : 'text-neutral-500'
                                }`}
                              >
                                {isRevealed ? passValue || <i className="text-neutral-400">empty</i> : '••••••••'}
                              </span>
                              <button
                                onClick={() => togglePassword(sa.id)}
                                className="text-neutral-400 hover:text-neutral-700 transition cursor-pointer p-0.5"
                                title={isRevealed ? 'Hide password' : 'View password'}
                              >
                                <svg className="text-[14px]" width="1em" height="1em" viewBox="0 0 24 24">
                                  <path
                                    d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="butt"
                                    strokeLinejoin="miter"
                                  />
                                  <ellipse
                                    cx="12"
                                    cy="12"
                                    rx="3"
                                    ry="3"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="butt"
                                    strokeLinejoin="miter"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={() => onCopy(passValue, `${sa.platform} password`)}
                                className="text-neutral-400 hover:text-success-600 transition cursor-pointer p-0.5"
                                title="Copy password"
                              >
                                <svg className="text-[13px]" width="1em" height="1em" viewBox="0 0 24 24">
                                  <rect
                                    x="9"
                                    y="9"
                                    width="13"
                                    height="13"
                                    rx="2"
                                    ry="2"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="butt"
                                    strokeLinejoin="miter"
                                  />
                                  <path
                                    d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="miter"
                                  />
                                </svg>
                              </button>
                            </div>

                            {/* Views */}
                            <span
                              className={`text-monospace-body font-monospace-body text-right ${
                                (sa.views || 0) > 0 ? 'text-default-font' : 'text-neutral-400'
                              }`}
                            >
                              {(sa.views || 0) > 0 ? Number(sa.views).toLocaleString() : '—'}
                            </span>

                            {/* Earned */}
                            <span
                              className={`text-monospace-body font-monospace-body text-right ${
                                (sa.money || 0) > 0 ? 'text-default-font' : 'text-neutral-400'
                              }`}
                            >
                              {(sa.money || 0) > 0
                                ? `${Number(sa.money).toFixed(2)} ETB`
                                : 'No clips yet'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Footer Bar */}
        <div className="flex w-full items-center justify-between px-1 py-1 text-subtext-color">
          <span className="text-caption font-caption">
            Showing {filteredUsers.length} of {users.length} clippers
          </span>
          <div className="flex items-center gap-1.5">
            <svg className="text-[12px]" width="1em" height="1em" viewBox="0 0 24 24">
              <rect
                x="4"
                y="11"
                width="16"
                height="10"
                rx="2"
                ry="2"
                fill="none"
                stroke="rgb(107 114 128)"
                strokeWidth="2"
                strokeLinecap="butt"
                strokeLinejoin="miter"
              />
              <path
                d="M8 11V7a4 4 0 0 1 8 0v4"
                fill="none"
                stroke="rgb(107 114 128)"
                strokeWidth="2"
                strokeLinecap="butt"
                strokeLinejoin="miter"
              />
            </svg>
            <span className="text-caption font-caption text-subtext-color">
              Usernames, bank details and handles are locked by clippers
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
