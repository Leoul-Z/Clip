import React, { useState, useEffect } from 'react';

export default function ResetStatsModal({
  isOpen,
  stats,
  targetUser,
  onClose,
  onConfirm,
}) {
  const [confirmInput, setConfirmInput] = useState('');
  const [notifyUsers, setNotifyUsers] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState(
    '🔄 Campaign Round Reset Notice\n\nA new campaign round has started! Clipper views and earnings have been reset for the new cycle.\n\nKeep clipping and submitting your links to earn for this new round! 🚀'
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfirmInput('');
      setNotifyUsers(false);
      setBroadcastMessage(
        '🔄 Campaign Round Reset Notice\n\nA new campaign round has started! Clipper views and earnings have been reset for the new cycle.\n\nKeep clipping and submitting your links to earn for this new round! 🚀'
      );
      setLoading(false);
    }
  }, [isOpen]);

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

  if (!isOpen) return null;

  const isConfirmed = confirmInput.trim().toUpperCase() === 'RESET';
  const isTargeted = !!targetUser;
  const targetLabel = isTargeted
    ? targetUser.telegram_username || `ID ${targetUser.chat_id}`
    : 'ALL clippers';

  const handleResetSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!isConfirmed) return;
    setLoading(true);
    try {
      await onConfirm({
        chat_id: targetUser ? targetUser.chat_id : null,
        notify_users: notifyUsers,
        broadcast_message: notifyUsers ? broadcastMessage : null,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-[540px] max-w-full flex-col items-start overflow-hidden rounded-lg bg-default-background shadow-xl my-8 animate-in fade-in zoom-in-95 duration-150 border border-neutral-border"
      >
        {/* Header */}
        <div className="flex w-full items-start gap-3 px-6 pt-5 pb-4 border-b border-solid border-neutral-100">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-error-50 text-error-600 border border-error-200">
            <svg className="text-[20px]" width="1em" height="1em" viewBox="0 0 24 24">
              <path
                d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="flex flex-col items-start grow min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-heading-3 font-heading-3 text-default-font">
                Reset Views &amp; Payments
              </span>
              <span className="text-caption-bold font-caption-bold text-error-800 rounded-full bg-error-100 px-2 py-0.5 border border-error-200">
                High Impact
              </span>
            </div>
            <span className="w-full text-caption font-caption text-subtext-color truncate mt-0.5">
              Reset verified views and earnings for {targetLabel}
            </span>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-sm hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition cursor-pointer"
          >
            <svg className="text-[16px]" width="1em" height="1em" viewBox="0 0 24 24">
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
        </div>

        {/* Content Body */}
        <div className="flex w-full flex-col items-start gap-4 px-6 py-4">
          {/* Warning Banner */}
          <div className="flex items-start gap-3 rounded-md border border-solid border-amber-200 bg-amber-50/70 p-3.5 w-full">
            <svg className="text-[18px] text-amber-700 shrink-0 mt-0.5" width="1em" height="1em" viewBox="0 0 24 24">
              <path
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="flex flex-col items-start gap-0.5 text-caption font-caption text-amber-900 leading-relaxed">
              <span className="font-bold">Important Notice:</span>
              <span>
                This will reset <b>verified views to 0</b> and <b>payout amounts to 0.00 ETB</b> for approved submissions.
                Submission links, clipper accounts, and saved bank details will remain intact.
              </span>
            </div>
          </div>

          {/* Impact Stats Grid */}
          <div className="grid grid-cols-2 gap-3 w-full">
            <div className="flex flex-col items-start p-3 rounded-md border border-neutral-border bg-neutral-50">
              <span className="text-overline font-overline text-subtext-color uppercase">
                Views to be reset
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-body-bold font-body-bold text-neutral-800 line-through">
                  {Number(stats?.total_views || 0).toLocaleString()}
                </span>
                <span className="text-body font-body text-neutral-400">➔</span>
                <span className="text-body-bold font-body-bold text-error-700">0</span>
              </div>
            </div>

            <div className="flex flex-col items-start p-3 rounded-md border border-neutral-border bg-neutral-50">
              <span className="text-overline font-overline text-subtext-color uppercase">
                Payments to be reset
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-body-bold font-body-bold text-neutral-800 line-through">
                  {Number(stats?.total_payments || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  ETB
                </span>
                <span className="text-body font-body text-neutral-400">➔</span>
                <span className="text-body-bold font-body-bold text-error-700">0.00 ETB</span>
              </div>
            </div>
          </div>

          {/* Telegram Notification Option */}
          <div className="flex flex-col items-start gap-2 w-full pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={notifyUsers}
                onChange={(e) => setNotifyUsers(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary"
              />
              <span className="text-body font-body text-neutral-700 font-medium">
                Broadcast Telegram notification about the new round
              </span>
            </label>

            {notifyUsers && (
              <div className="flex flex-col items-start gap-1 w-full pl-6 animate-in fade-in duration-100">
                <span className="text-caption font-caption text-neutral-500">
                  Notification message to send to clippers:
                </span>
                <textarea
                  rows={3}
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="w-full rounded-md border border-solid border-neutral-border bg-white px-3 py-2 text-caption font-caption text-default-font placeholder-neutral-400 focus:outline-none focus:border-brand-primary font-mono text-[12px] leading-relaxed"
                />
              </div>
            )}
          </div>

          {/* Safety Type-in Check */}
          <div className="flex flex-col items-start gap-1.5 w-full pt-2 border-t border-solid border-neutral-100">
            <label className="text-caption-bold font-caption-bold text-neutral-700">
              To confirm, type <span className="text-error-700 select-all font-mono font-bold">RESET</span> below:
            </label>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="Type RESET here"
              className="w-full rounded-md border border-solid border-neutral-border bg-white px-3 py-2 text-body font-body text-default-font placeholder-neutral-400 focus:outline-none focus:border-error-500 font-mono"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex w-full items-center justify-end gap-2 border-t border-solid border-neutral-border bg-neutral-50 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-solid border-neutral-border bg-white px-4 py-2 text-body font-body text-neutral-700 hover:bg-neutral-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!isConfirmed || loading}
            onClick={handleResetSubmit}
            className={`flex items-center gap-2 rounded-md px-5 py-2 text-body-bold font-body-bold text-white transition shadow-xs ${
              isConfirmed && !loading
                ? 'bg-error-600 hover:bg-error-700 cursor-pointer'
                : 'bg-neutral-300 text-neutral-500 cursor-not-allowed opacity-60'
            }`}
          >
            {loading ? (
              <span>Resetting...</span>
            ) : (
              <span>Confirm &amp; Reset All</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
