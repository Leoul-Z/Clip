import React, { useState, useEffect } from 'react';

export default function EditSubmissionModal({
  isOpen,
  submission,
  rates,
  onClose,
  onSave,
  onDelete,
}) {
  const [views, setViews] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState('0.00');
  const [status, setStatus] = useState('approved');
  const [link, setLink] = useState('');
  const [isEditingLink, setIsEditingLink] = useState(false);
  const [caption, setCaption] = useState('');
  const [notifyUser, setNotifyUser] = useState(true);
  const [loading, setLoading] = useState(false);

  // Platform active payout rate per 1,000 views
  const getPlatformRate = () => {
    const p = (submission?.platform || '').toLowerCase();
    if (p.includes('youtube')) return rates?.youtube ?? 60.0;
    if (p.includes('tiktok')) return rates?.tiktok ?? 60.0;
    if (p.includes('twitter') || p === 'x') return rates?.twitter ?? 45.0;
    if (p.includes('instagram')) return rates?.instagram ?? 40.0;
    return rates?.[p] ?? 50.0;
  };

  const activeRate = getPlatformRate();

  useEffect(() => {
    if (submission) {
      setViews(submission.views || 0);
      setPaymentAmount(Number(submission.payment_amount || 0).toFixed(2));
      setStatus(submission.status || 'approved');
      setLink(submission.link || '');
      setIsEditingLink(false);
      setCaption(submission.caption || '');
      setNotifyUser(true);
    }
  }, [submission, isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !submission) return null;

  const currentViewsNum = parseInt(views, 10) || 0;
  const expectedPayoutNum = (currentViewsNum / 1000) * activeRate;
  const expectedPayoutStr = expectedPayoutNum.toFixed(2);
  const currentPayoutNum = parseFloat(paymentAmount) || 0;
  const isMatchingPayout = Math.abs(currentPayoutNum - expectedPayoutNum) < 0.01;

  const handleViewsChange = (newVal) => {
    setViews(newVal);
    const parsed = parseInt(newVal, 10) || 0;
    // Auto calculate if payout was 0 or already matched the previous rate
    if (!paymentAmount || parseFloat(paymentAmount) === 0 || isMatchingPayout) {
      setPaymentAmount(((parsed / 1000) * activeRate).toFixed(2));
    }
  };

  const handleSyncPayout = () => {
    setPaymentAmount(expectedPayoutStr);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      await onSave(submission.id, {
        views: parseInt(views, 10) || 0,
        payment_amount: parseFloat(paymentAmount) || 0,
        status,
        link,
        caption,
        notify_user: notifyUser,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (
      window.confirm(
        `Are you sure you want to delete Submission #${submission.id} for @${
          submission.telegram_username || submission.chat_id
        }?`
      )
    ) {
      onDelete(submission.id);
      onClose();
    }
  };

  const formatRelativeTime = (isoStr) => {
    if (!isoStr) return 'recently';
    try {
      const diffMs = Date.now() - new Date(isoStr).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return 'just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHrs = Math.floor(diffMin / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      const diffDays = Math.floor(diffHrs / 24);
      if (diffDays === 1) return 'yesterday';
      if (diffDays < 30) return `${diffDays} days ago`;
      return new Date(isoStr).toLocaleDateString();
    } catch {
      return 'recently';
    }
  };

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

  const getStatusBadge = (st) => {
    switch (st) {
      case 'approved':
        return (
          <span className="text-caption-bold font-caption-bold text-success-800 rounded-full bg-success-100 px-2 py-0.5">
            Approved
          </span>
        );
      case 'under_review':
        return (
          <span className="text-caption-bold font-caption-bold text-brand-700 rounded-full bg-brand-50 px-2 py-0.5 border border-brand-200">
            In review
          </span>
        );
      case 'rejected':
        return (
          <span className="text-caption-bold font-caption-bold text-error-800 rounded-full bg-error-100 px-2 py-0.5">
            Rejected
          </span>
        );
      default:
        return (
          <span className="text-caption-bold font-caption-bold text-warning-800 rounded-full bg-warning-100 px-2 py-0.5">
            Pending
          </span>
        );
    }
  };

  const platformDisplayName =
    (submission.platform || '').toLowerCase() === 'twitter'
      ? 'Twitter / X'
      : (submission.platform || 'Platform').charAt(0).toUpperCase() +
        (submission.platform || 'Platform').slice(1);

  const cleanUsername = (submission.telegram_username || '').replace(/^@/, '');
  const usernameDisplay = cleanUsername ? `@${cleanUsername}` : `Chat ID: ${submission.chat_id}`;

  // Bot preview message based on current status and values
  let botPreviewText = `✅ Your ${platformDisplayName} clip was approved: ${currentViewsNum.toLocaleString()} views → ${paymentAmount} ETB.`;
  if (status === 'under_review') {
    botPreviewText = `👀 Your ${platformDisplayName} clip is now under review.`;
  } else if (status === 'rejected') {
    botPreviewText = `❌ Your ${platformDisplayName} clip was reviewed and could not be approved.`;
  } else if (status === 'pending') {
    botPreviewText = `⏳ Your ${platformDisplayName} clip is marked as pending review.`;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-[560px] flex-col items-start overflow-hidden rounded-lg bg-default-background shadow-md border border-neutral-border animate-fade-in max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex w-full items-start gap-3 px-6 pt-5 pb-4">
          <div className="flex flex-col items-start gap-1 grow">
            <div className="flex w-full items-center gap-2">
              <span className="text-heading-3 font-heading-3 text-default-font">
                Submission #{submission.id}
              </span>
              {getStatusBadge(status)}
            </div>
            <span className="w-full text-body font-body text-subtext-color">
              {usernameDisplay} · submitted {formatRelativeTime(submission.submitted_at)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-sm hover:bg-neutral-100 transition cursor-pointer"
            title="Close"
          >
            <svg
              className="text-[16px] text-default-font"
              width="1em"
              height="1em"
              viewBox="0 0 24 24"
            >
              <path
                d="M18 6 6 18M6 6l12 12"
                fill="none"
                stroke="rgb(107 114 128)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="miter"
              />
            </svg>
          </button>
        </div>

        {/* Platform & Clip Link Strip */}
        <div className="flex items-center gap-3 rounded-md border border-solid border-neutral-border px-3 py-2.5 self-stretch mx-4 sm:mx-6">
          {getPlatformIcon(submission.platform)}
          <div className="flex min-w-[0px] flex-col items-start grow">
            <span className="w-full text-body-bold font-body-bold text-default-font">
              {platformDisplayName} · {submission.handle || cleanUsername || 'Account'}
            </span>
            {isEditingLink ? (
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="Video link URL"
                className="w-full text-monospace-caption font-monospace-caption text-brand-700 bg-neutral-50 px-2 py-0.5 rounded border border-neutral-300 outline-none focus:border-brand-primary"
              />
            ) : (
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="line-clamp-1 w-full text-monospace-caption font-monospace-caption text-brand-700 break-all hover:underline"
                title={link}
              >
                {link || 'No video link'}
              </a>
            )}
          </div>

          {/* Toggle Edit Link */}
          <button
            type="button"
            onClick={() => setIsEditingLink(!isEditingLink)}
            className={`flex h-8 w-8 flex-none items-center justify-center rounded-sm transition cursor-pointer ${
              isEditingLink ? 'bg-brand-50 text-brand-700' : 'hover:bg-neutral-100'
            }`}
            title={isEditingLink ? 'Finish editing link' : 'Edit link URL'}
          >
            <svg
              className="text-[15px] text-default-font"
              width="1em"
              height="1em"
              viewBox="0 0 24 24"
            >
              <path
                d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"
                fill="none"
                stroke="rgb(107 114 128)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* External Link */}
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-sm hover:bg-neutral-100 transition cursor-pointer"
            title="Open video link in new tab"
          >
            <svg
              className="text-[15px] text-default-font"
              width="1em"
              height="1em"
              viewBox="0 0 24 24"
            >
              <path
                d="M15 3h6v6m-11 5L21 3m-3 10v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
                fill="none"
                stroke="rgb(107 114 128)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>

        {/* Body Fields */}
        <div className="flex w-full flex-col items-start gap-4 sm:gap-5 px-4 sm:px-6 py-4 sm:py-5">
          {/* Views & Payout Grid */}
          <div className="w-full items-start gap-4 grid grid-cols-1 sm:grid-cols-2">
            {/* Views */}
            <div className="flex flex-col items-start gap-1.5 self-stretch">
              <span className="w-full text-caption-bold font-caption-bold text-neutral-700">
                Views
              </span>
              <input
                className="w-full rounded-sm border border-solid border-neutral-300 px-3 py-2 text-monospace-body font-monospace-body text-default-font outline-none placeholder:text-[#a3a3a3] focus:border-brand-primary"
                placeholder="0"
                value={views}
                onChange={(e) => handleViewsChange(e.target.value)}
                type="number"
                min="0"
                step="1"
              />
              <span className="w-full text-caption font-caption text-subtext-color">
                Counted manually from the clip
              </span>
            </div>

            {/* Payout */}
            <div className="flex flex-col items-start gap-1.5 self-stretch">
              <span className="w-full text-caption-bold font-caption-bold text-neutral-700">
                Payout
              </span>
              <div className="flex w-full items-center overflow-hidden rounded-sm border border-solid border-neutral-300 focus-within:border-brand-primary">
                <input
                  className="w-0 flex-none px-3 py-2 text-monospace-body font-monospace-body text-default-font outline-none placeholder:text-[#a3a3a3] min-w-0 grow bg-transparent"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  type="text"
                />
                <span className="text-caption font-caption text-subtext-color pr-3 select-none">
                  ETB
                </span>
              </div>
              <div className="flex w-full items-center gap-1">
                <svg
                  className="text-[12px] text-default-font shrink-0"
                  width="1em"
                  height="1em"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M13 2 3 14h9l-1 8 10-12h-9z"
                    fill="none"
                    stroke="rgb(20 121 168)"
                    strokeWidth="2"
                    strokeLinecap="butt"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-caption font-caption text-subtext-color truncate">
                  {currentViewsNum.toLocaleString()} × {activeRate} ETB / 1K =
                </span>
                {isMatchingPayout ? (
                  <span className="text-caption-bold font-caption-bold text-brand-700 whitespace-nowrap">
                    {expectedPayoutStr} · Matches
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSyncPayout}
                    className="text-caption-bold font-caption-bold text-warning-800 hover:text-warning-900 underline whitespace-nowrap cursor-pointer"
                    title="Click to apply auto-calculated rate"
                  >
                    {expectedPayoutStr} · Apply
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Status Selector */}
          <div className="flex w-full flex-col items-start gap-1.5">
            <span className="w-full text-caption-bold font-caption-bold text-neutral-700">
              Status
            </span>
            <div className="flex w-full items-start gap-1 rounded-md bg-neutral-100 px-1 py-1 overflow-x-auto">
              {/* Pending */}
              <button
                type="button"
                onClick={() => setStatus('pending')}
                className={`flex items-center justify-center gap-1.5 self-stretch rounded-sm py-1.5 grow transition cursor-pointer ${
                  status === 'pending' ? 'bg-default-background shadow-sm' : 'hover:bg-neutral-200/50'
                }`}
              >
                <div className="flex h-2 w-2 flex-none items-start rounded-full bg-warning-500" />
                <span
                  className={
                    status === 'pending'
                      ? 'text-caption-bold font-caption-bold text-warning-800'
                      : 'text-caption font-caption text-subtext-color'
                  }
                >
                  Pending
                </span>
              </button>

              {/* In review */}
              <button
                type="button"
                onClick={() => setStatus('under_review')}
                className={`flex items-center justify-center gap-1.5 self-stretch rounded-sm py-1.5 grow transition cursor-pointer ${
                  status === 'under_review' ? 'bg-default-background shadow-sm' : 'hover:bg-neutral-200/50'
                }`}
              >
                <div className="flex h-2 w-2 flex-none items-start rounded-full bg-brand-primary" />
                <span
                  className={
                    status === 'under_review'
                      ? 'text-caption-bold font-caption-bold text-brand-700'
                      : 'text-caption font-caption text-subtext-color'
                  }
                >
                  In review
                </span>
              </button>

              {/* Approved */}
              <button
                type="button"
                onClick={() => setStatus('approved')}
                className={`flex items-center justify-center gap-1.5 self-stretch rounded-sm py-1.5 grow transition cursor-pointer ${
                  status === 'approved' ? 'bg-default-background shadow-sm' : 'hover:bg-neutral-200/50'
                }`}
              >
                <div className="flex h-2 w-2 flex-none items-start rounded-full bg-success-600" />
                <span
                  className={
                    status === 'approved'
                      ? 'text-caption-bold font-caption-bold text-success-800'
                      : 'text-caption font-caption text-subtext-color'
                  }
                >
                  Approved
                </span>
              </button>

              {/* Rejected */}
              <button
                type="button"
                onClick={() => setStatus('rejected')}
                className={`flex items-center justify-center gap-1.5 self-stretch rounded-sm py-1.5 grow transition cursor-pointer ${
                  status === 'rejected' ? 'bg-default-background shadow-sm' : 'hover:bg-neutral-200/50'
                }`}
              >
                <div className="flex h-2 w-2 flex-none items-start rounded-full bg-error-500" />
                <span
                  className={
                    status === 'rejected'
                      ? 'text-caption-bold font-caption-bold text-error-800'
                      : 'text-caption font-caption text-subtext-color'
                  }
                >
                  Rejected
                </span>
              </button>
            </div>
          </div>

          {/* Caption */}
          <div className="flex w-full flex-col items-start gap-1.5">
            <div className="flex w-full items-center justify-between">
              <span className="text-caption-bold font-caption-bold text-neutral-700">
                Caption
              </span>
              <span className="text-caption font-caption text-neutral-400">
                Optional
              </span>
            </div>
            <textarea
              className="h-16 w-full flex-none rounded-sm border border-solid border-neutral-300 px-3 py-2 text-body font-body text-default-font outline-none placeholder:text-neutral-400 focus:border-brand-primary resize-none"
              placeholder="Caption the clipper posted with this video"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>

          {/* Telegram Notification Card */}
          <div className="flex w-full flex-col items-start gap-3 rounded-md border border-solid border-neutral-border px-3 py-3">
            <div className="flex w-full items-center gap-3">
              <div className="flex flex-col items-start grow">
                <span className="w-full text-body-bold font-body-bold text-default-font">
                  Notify {usernameDisplay} on Telegram
                </span>
                <span className="w-full text-caption font-caption text-subtext-color">
                  The bot DMs them the result when you save
                </span>
              </div>
              <button
                type="button"
                onClick={() => setNotifyUser(!notifyUser)}
                className={`flex h-5 w-9 flex-none items-center rounded-full px-0.5 py-0.5 transition cursor-pointer ${
                  notifyUser ? 'bg-brand-primary justify-end' : 'bg-neutral-300 justify-start'
                }`}
                title={notifyUser ? 'Notification enabled' : 'Notification disabled'}
              >
                <div className="flex h-4 w-4 flex-none items-start rounded-full bg-default-background shadow-xs" />
              </button>
            </div>

            {notifyUser && (
              <div className="flex w-full flex-col items-start gap-1 rounded-md bg-brand-50 px-2.5 py-2.5 animate-fade-in">
                <div className="flex flex-col items-start gap-1 bg-default-background px-3 py-2 shadow-sm w-fit max-w-[90%] rounded-lg rounded-tl-[2px]">
                  <span className="w-full text-body font-body text-default-font">
                    {botPreviewText}
                  </span>
                  <span className="w-full text-caption font-caption text-neutral-400 text-right">
                    @clipp_bot
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex w-full items-center gap-2 border-t border-solid border-neutral-border bg-neutral-50 px-4 sm:px-6 py-3 flex-wrap">
          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center gap-1.5 rounded-sm px-2 py-1.5 hover:bg-error-100 transition cursor-pointer"
            title="Delete this submission"
          >
            <svg
              className="text-[14px] text-default-font"
              width="1em"
              height="1em"
              viewBox="0 0 24 24"
            >
              <path
                d="M3 6h18m-2 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                fill="none"
                stroke="rgb(220 38 38)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-body font-body text-error-600">Delete</span>
          </button>

          <div className="flex items-start grow" />

          <button
            type="button"
            onClick={onClose}
            className="flex items-center rounded-sm border border-solid border-neutral-border bg-default-background px-3 py-1.5 hover:bg-neutral-50 transition cursor-pointer"
          >
            <span className="text-body font-body text-neutral-700">Cancel</span>
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-sm bg-brand-primary px-3 py-1.5 hover:bg-brand-600 transition cursor-pointer disabled:opacity-50"
          >
            <svg
              className="text-[14px] text-default-font"
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
            <span className="text-body-bold font-body-bold text-neutral-0">
              {loading ? 'Saving...' : notifyUser ? 'Save & notify' : 'Save changes'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
