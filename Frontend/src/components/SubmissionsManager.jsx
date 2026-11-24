import React, { useState } from 'react';

export default function SubmissionsManager({
  submissions,
  onEditSubmission,
  onCopy,
  selectedUser = null,
  onClearSelectedUser,
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Pre-filter submissions by selected user if active
  const userScopedSubs = selectedUser
    ? submissions.filter((s) => {
        const targetChatId = selectedUser.chat_id;
        const targetUname = (selectedUser.telegram_username || '').replace(/^@/, '').toLowerCase();
        const subUname = (s.telegram_username || '').replace(/^@/, '').toLowerCase();

        return (
          (targetChatId && s.chat_id === targetChatId) ||
          (targetUname && subUname === targetUname)
        );
      })
    : submissions;

  // Status counts based on the active user scope
  const counts = {
    all: userScopedSubs.length,
    pending: userScopedSubs.filter((s) => s.status === 'pending').length,
    under_review: userScopedSubs.filter((s) => s.status === 'under_review').length,
    approved: userScopedSubs.filter((s) => s.status === 'approved').length,
    rejected: userScopedSubs.filter((s) => s.status === 'rejected').length,
  };

  const filteredSubs = userScopedSubs.filter((s) => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (platformFilter !== 'all' && (s.platform || '').toLowerCase() !== platformFilter.toLowerCase()) return false;

    const q = search.trim().toLowerCase();
    if (q) {
      const uname = (s.telegram_username || '').toLowerCase();
      const link = (s.link || '').toLowerCase();
      const caption = (s.caption || '').toLowerCase();
      const handle = (s.handle || '').toLowerCase();
      const id = String(s.id || '');
      return uname.includes(q) || link.includes(q) || caption.includes(q) || handle.includes(q) || id.includes(q);
    }
    return true;
  });

  // Calculate totals for footer
  const totalViews = filteredSubs.reduce((acc, s) => acc + (parseInt(s.views, 10) || 0), 0);
  const totalPayout = filteredSubs.reduce((acc, s) => acc + (parseFloat(s.payment_amount) || 0), 0);

  const getPlatformIcon = (platform) => {
    const p = (platform || '').toLowerCase();
    if (p.includes('youtube')) {
      return (
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-[#ff0000]">
          <svg className="text-[14px] text-default-font" width="1em" height="1em" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" fill="rgb(255 255 255)" />
          </svg>
        </div>
      );
    }
    if (p.includes('tiktok')) {
      return (
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-neutral-900">
          <span className="text-body-bold font-body-bold text-neutral-0">♪</span>
        </div>
      );
    }
    if (p.includes('twitter') || p === 'x') {
      return (
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-neutral-900">
          <span className="text-body-bold font-body-bold text-neutral-0">𝕏</span>
        </div>
      );
    }
    return (
      <div className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-[#e1306c]">
        <svg className="text-[16px] text-default-font" width="1em" height="1em" viewBox="0 0 24 24">
          <rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="5"
            ry="5"
            fill="none"
            stroke="rgb(255 255 255)"
            strokeWidth="2"
            strokeLinecap="butt"
            strokeLinejoin="miter"
          />
          <ellipse
            cx="12"
            cy="12"
            rx="4"
            ry="4"
            fill="none"
            stroke="rgb(255 255 255)"
            strokeWidth="2"
            strokeLinecap="butt"
            strokeLinejoin="miter"
          />
          <ellipse cx="17.5" cy="6.5" rx="1.2" ry="1.2" fill="rgb(255 255 255)" />
        </svg>
      </div>
    );
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return (
          <span className="self-stretch text-caption-bold font-caption-bold text-success-800 rounded-full bg-success-100 px-2 py-0.5 whitespace-nowrap">
            Approved
          </span>
        );
      case 'under_review':
        return (
          <span className="self-stretch text-caption-bold font-caption-bold text-brand-700 rounded-full bg-brand-50 border border-brand-200 px-2 py-0.5 whitespace-nowrap">
            In review
          </span>
        );
      case 'rejected':
        return (
          <span className="self-stretch text-caption-bold font-caption-bold text-error-800 rounded-full bg-error-100 px-2 py-0.5 whitespace-nowrap">
            Rejected
          </span>
        );
      default:
        return (
          <span className="self-stretch text-caption-bold font-caption-bold text-warning-800 rounded-full bg-warning-100 px-2 py-0.5 whitespace-nowrap">
            Pending
          </span>
        );
    }
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '-';
    try {
      return new Date(isoStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="flex w-full flex-col items-start gap-4 animate-fade-in">
      {/* Toolbar: Status Filter Pills + Search + Platform */}
      <div className="flex w-full flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {/* Status segmented pills */}
        <div className="flex items-center gap-1 rounded-md bg-neutral-100 px-1 py-1 overflow-x-auto">
          {/* All */}
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`flex items-center gap-1.5 rounded-sm px-3 py-1 transition cursor-pointer shrink-0 ${
              statusFilter === 'all'
                ? 'bg-default-background shadow-sm'
                : 'hover:bg-neutral-200/50'
            }`}
          >
            <span
              className={
                statusFilter === 'all'
                  ? 'text-caption-bold font-caption-bold text-default-font'
                  : 'text-caption font-caption text-subtext-color'
              }
            >
              All
            </span>
            <span className="text-caption font-caption text-subtext-color">
              {counts.all}
            </span>
          </button>

          {/* Pending */}
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`flex items-center gap-1.5 rounded-sm px-3 py-1 transition cursor-pointer shrink-0 ${
              statusFilter === 'pending'
                ? 'bg-default-background shadow-sm'
                : 'hover:bg-neutral-200/50'
            }`}
          >
            <div className="flex h-1.5 w-1.5 flex-none items-start rounded-full bg-warning-500" />
            <span
              className={
                statusFilter === 'pending'
                  ? 'text-caption-bold font-caption-bold text-default-font'
                  : 'text-caption font-caption text-subtext-color'
              }
            >
              Pending {counts.pending}
            </span>
          </button>

          {/* In review */}
          <button
            type="button"
            onClick={() => setStatusFilter('under_review')}
            className={`flex items-center gap-1.5 rounded-sm px-3 py-1 transition cursor-pointer shrink-0 ${
              statusFilter === 'under_review'
                ? 'bg-default-background shadow-sm'
                : 'hover:bg-neutral-200/50'
            }`}
          >
            <div className="flex h-1.5 w-1.5 flex-none items-start rounded-full bg-brand-primary" />
            <span
              className={
                statusFilter === 'under_review'
                  ? 'text-caption-bold font-caption-bold text-default-font'
                  : 'text-caption font-caption text-subtext-color'
              }
            >
              In review {counts.under_review}
            </span>
          </button>

          {/* Approved */}
          <button
            type="button"
            onClick={() => setStatusFilter('approved')}
            className={`flex items-center gap-1.5 rounded-sm px-3 py-1 transition cursor-pointer shrink-0 ${
              statusFilter === 'approved'
                ? 'bg-default-background shadow-sm'
                : 'hover:bg-neutral-200/50'
            }`}
          >
            <div className="flex h-1.5 w-1.5 flex-none items-start rounded-full bg-success-600" />
            <span
              className={
                statusFilter === 'approved'
                  ? 'text-caption-bold font-caption-bold text-default-font'
                  : 'text-caption font-caption text-subtext-color'
              }
            >
              Approved {counts.approved}
            </span>
          </button>

          {/* Rejected */}
          <button
            type="button"
            onClick={() => setStatusFilter('rejected')}
            className={`flex items-center gap-1.5 rounded-sm px-3 py-1 transition cursor-pointer shrink-0 ${
              statusFilter === 'rejected'
                ? 'bg-default-background shadow-sm'
                : 'hover:bg-neutral-200/50'
            }`}
          >
            <div className="flex h-1.5 w-1.5 flex-none items-start rounded-full bg-error-500" />
            <span
              className={
                statusFilter === 'rejected'
                  ? 'text-caption-bold font-caption-bold text-default-font'
                  : 'text-caption font-caption text-subtext-color'
              }
            >
              Rejected {counts.rejected}
            </span>
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="flex items-center gap-2 rounded-sm border border-solid border-neutral-border bg-default-background px-3 py-1.5 grow">
          <svg
            className="text-[14px] text-default-font shrink-0"
            width="1em"
            height="1em"
            viewBox="0 0 24 24"
          >
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

          {/* Scoped Clipper Chip */}
          {selectedUser && (
            <div className="flex items-center gap-1 rounded-sm bg-brand-100 pl-2 pr-1 py-0.5 shrink-0">
              <span className="text-caption-bold font-caption-bold text-brand-800">
                Clipper: @{selectedUser.telegram_username?.replace(/^@/, '') || selectedUser.chat_id}
              </span>
              <button
                type="button"
                onClick={onClearSelectedUser}
                className="hover:opacity-75 cursor-pointer ml-0.5"
                title="Clear filter to view all clippers' submissions"
              >
                <svg
                  className="text-[12px] text-default-font"
                  width="1em"
                  height="1em"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M18 6 6 18M6 6l12 12"
                    fill="none"
                    stroke="rgb(17 87 122)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="miter"
                  />
                </svg>
              </button>
            </div>
          )}

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search link, caption or handle"
            className="w-full text-body font-body text-default-font placeholder:text-neutral-400 outline-none bg-transparent"
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="text-neutral-400 hover:text-neutral-600 cursor-pointer shrink-0"
              title="Clear search"
            >
              <svg className="text-[12px]" width="1em" height="1em" viewBox="0 0 24 24">
                <path
                  d="M18 6 6 18M6 6l12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="miter"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Platform Selector Dropdown */}
        <div className="relative flex items-center gap-2 rounded-sm border border-solid border-neutral-border bg-default-background px-3 py-1.5 shrink-0">
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="appearance-none bg-transparent pr-6 text-body font-body text-default-font outline-none cursor-pointer"
          >
            <option value="all">All platforms</option>
            <option value="youtube">YouTube</option>
            <option value="tiktok">TikTok</option>
            <option value="twitter">Twitter / X</option>
            <option value="instagram">Instagram</option>
          </select>
          <svg
            className="pointer-events-none absolute right-3 text-[14px] text-default-font"
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
      </div>

      {/* Submissions Table matching mockup */}
      <div className="flex w-full flex-col items-start overflow-hidden rounded-lg border border-solid border-neutral-border bg-default-background shadow-xs">
        {/* Table Header */}
        <div className="w-full items-center gap-4 border-b border-solid border-neutral-border bg-neutral-50 px-5 py-2.5 grid grid-cols-[120px_1fr_100px_130px_110px_88px]">
          <span className="text-overline font-overline text-subtext-color uppercase">
            Submission
          </span>
          <span className="text-overline font-overline text-subtext-color uppercase">
            Clip
          </span>
          <span className="text-overline font-overline text-subtext-color text-right uppercase">
            Views
          </span>
          <span className="text-overline font-overline text-subtext-color text-right uppercase">
            Payout
          </span>
          <span className="text-overline font-overline text-subtext-color uppercase">
            Status
          </span>
          <span className="text-overline font-overline text-subtext-color uppercase text-right">
            {' '}
          </span>
        </div>

        {/* Rows */}
        {filteredSubs.length === 0 ? (
          <div className="flex w-full flex-col items-center justify-center py-12 px-5 text-center text-subtext-color gap-2">
            <span className="text-body font-body text-neutral-600">
              No submissions found matching your filters.
            </span>
            {(search || statusFilter !== 'all' || platformFilter !== 'all' || selectedUser) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                  setPlatformFilter('all');
                  if (onClearSelectedUser) onClearSelectedUser();
                }}
                className="text-caption font-caption text-brand-primary hover:underline cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          filteredSubs.map((sub, idx) => {
            const isLast = idx === filteredSubs.length - 1;
            const viewsCount = parseInt(sub.views, 10) || 0;
            const payoutAmount = parseFloat(sub.payment_amount) || 0;
            const cleanHandle = sub.handle
              ? `@${sub.handle.replace(/^@/, '')}`
              : sub.telegram_username
              ? `@${sub.telegram_username.replace(/^@/, '')}`
              : `Chat ID: ${sub.chat_id}`;

            return (
              <div
                key={sub.id}
                className={`w-full items-center gap-4 px-5 py-3 grid grid-cols-[120px_1fr_100px_130px_110px_88px] hover:bg-neutral-50 transition ${
                  !isLast ? 'border-b border-solid border-neutral-border' : ''
                }`}
              >
                {/* 1. Submission ID & Date */}
                <div className="flex flex-col items-start">
                  <span className="w-full text-body-bold font-body-bold text-default-font">
                    #{sub.id}
                  </span>
                  <span className="w-full text-caption font-caption text-subtext-color">
                    {formatDate(sub.submitted_at)}
                  </span>
                </div>

                {/* 2. Clip: Icon + Handle + Link + Caption */}
                <div className="flex min-w-[0px] items-start gap-3">
                  {getPlatformIcon(sub.platform)}
                  <div className="flex min-w-[0px] flex-col items-start grow">
                    <span className="w-full text-body-bold font-body-bold text-default-font truncate">
                      {cleanHandle}
                    </span>
                    <a
                      href={sub.link}
                      target="_blank"
                      rel="noreferrer"
                      className="line-clamp-1 w-full text-monospace-caption font-monospace-caption text-brand-700 break-all hover:underline"
                      title={sub.link}
                    >
                      {sub.link}
                    </a>
                    {sub.caption ? (
                      <span
                        className="line-clamp-1 w-full text-caption font-caption text-neutral-400 italic truncate"
                        title={sub.caption}
                      >
                        “{sub.caption}”
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* 3. Views */}
                <span
                  className={`text-monospace-body font-monospace-body text-right ${
                    viewsCount > 0 ? 'text-default-font font-semibold' : 'text-neutral-400'
                  }`}
                >
                  {viewsCount.toLocaleString()}
                </span>

                {/* 4. Payout */}
                <span
                  className={`text-monospace-body font-monospace-body text-right ${
                    payoutAmount > 0 ? 'text-default-font font-semibold' : 'text-neutral-400'
                  }`}
                >
                  {payoutAmount.toFixed(2)} ETB
                </span>

                {/* 5. Status Badge */}
                <div className="flex items-start">{getStatusBadge(sub.status)}</div>

                {/* 6. Edit Action */}
                <div className="flex items-start justify-end">
                  <button
                    type="button"
                    onClick={() => onEditSubmission(sub)}
                    className="flex items-center gap-1.5 self-stretch rounded-sm border border-solid border-neutral-border bg-default-background px-2.5 py-1 hover:bg-neutral-100 transition cursor-pointer shadow-2xs"
                  >
                    <svg
                      className="text-[13px] text-default-font"
                      width="1em"
                      height="1em"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"
                        fill="none"
                        stroke="rgb(55 65 81)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-caption-bold font-caption-bold text-neutral-700">
                      Edit
                    </span>
                  </button>
                </div>
              </div>
            );
          })
        )}

        {/* Footer Summary */}
        <div className="flex w-full items-center justify-between border-t border-solid border-neutral-border bg-neutral-50 px-5 py-2.5">
          <span className="text-caption font-caption text-subtext-color">
            {filteredSubs.length} submission{filteredSubs.length !== 1 ? 's' : ''}
            {selectedUser
              ? ` from @${selectedUser.telegram_username?.replace(/^@/, '') || selectedUser.chat_id}`
              : ''}
          </span>
          <span className="text-caption-bold font-caption-bold text-default-font">
            Total {totalViews.toLocaleString()} views · {totalPayout.toFixed(2)} ETB
          </span>
        </div>
      </div>
    </div>
  );
}
