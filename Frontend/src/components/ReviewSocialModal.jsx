import React, { useState, useEffect } from 'react';

export default function ReviewSocialModal({
  isOpen,
  account,
  user,
  onClose,
  onSave,
}) {
  const [status, setStatus] = useState('approved');
  const [note, setNote] = useState('');
  const [notifyUser, setNotifyUser] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (account) {
      const initialStatus = account.status === 'rejected' ? 'rejected' : 'approved';
      setStatus(initialStatus);
      setNote('');
      setNotifyUser(true);
      setShowPassword(false);
      setCopied(false);
    }
  }, [account, isOpen]);

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

  if (!isOpen || !account) return null;

  const rawUsername = user?.telegram_username || '';
  const cleanUsername = rawUsername.startsWith('@') ? rawUsername.substring(1) : rawUsername;
  const platform = (account.platform || 'social').toLowerCase();
  const handle = account.handle || '';
  const pass = account.password || '';

  const getPlatformIcon = () => {
    if (platform.includes('youtube')) {
      return (
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-[#ff0000]">
          <svg className="text-[15px] text-white" width="1em" height="1em" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" fill="rgb(255 255 255)" />
          </svg>
        </div>
      );
    }
    if (platform.includes('tiktok')) {
      return (
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-neutral-900">
          <span className="text-[14px] font-bold text-white">♪</span>
        </div>
      );
    }
    if (platform.includes('twitter') || platform === 'x') {
      return (
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-neutral-900">
          <span className="text-[14px] font-bold text-white">𝕏</span>
        </div>
      );
    }
    return (
      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white text-sm">
        📸
      </div>
    );
  };

  const handleCopyPassword = () => {
    if (!pass) return;
    navigator.clipboard.writeText(pass);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleQuickNote = (template) => {
    setNote(template);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      await onSave(account.id, {
        status,
        message: note.trim() || undefined,
        notify_user: notifyUser,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-[560px] max-w-full flex-col items-start overflow-hidden rounded-lg bg-default-background shadow-md my-8 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex w-full items-start gap-3 px-6 pt-5 pb-4 border-b border-solid border-neutral-100">
          <div className="flex flex-col items-start gap-1 grow min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-heading-3 font-heading-3 text-default-font">
                Review Linked Account
              </span>
              {account.status === 'pending' && (
                <span className="text-caption-bold font-caption-bold text-amber-800 rounded-full bg-amber-100 px-2 py-0.5">
                  Pending Review
                </span>
              )}
              {account.status === 'approved' && (
                <span className="text-caption-bold font-caption-bold text-success-800 rounded-full bg-success-100 px-2 py-0.5">
                  Approved
                </span>
              )}
              {account.status === 'rejected' && (
                <span className="text-caption-bold font-caption-bold text-error-800 rounded-full bg-error-100 px-2 py-0.5">
                  Rejected
                </span>
              )}
            </div>
            <span className="w-full text-body font-body text-subtext-color truncate">
              {rawUsername ? `@${cleanUsername}` : 'Clipper'} · ID: {user?.chat_id || 'Unknown'}
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
          {/* Account & Password Info Banner */}
          <div className="flex items-center gap-3 rounded-md border border-solid border-neutral-border p-3.5 w-full bg-neutral-50/60">
            {getPlatformIcon()}
            <div className="flex min-w-0 flex-col items-start grow">
              <span className="w-full text-body-bold font-body-bold text-default-font truncate">
                {platform.toUpperCase()} · {handle}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-caption font-caption text-neutral-500">
                  Password:
                </span>
                <span className="text-monospace-caption font-monospace-caption font-semibold text-brand-700 tracking-wider">
                  {showPassword ? (pass || '<empty>') : '••••••••'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-xs text-neutral-400 hover:text-neutral-700 cursor-pointer ml-1"
                  title={showPassword ? 'Hide password' : 'Show plaintext'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="text-xs text-neutral-400 hover:text-brand-primary cursor-pointer"
                  title="Copy password"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          {/* Decision Segmented Buttons */}
          <div className="flex flex-col items-start gap-1.5 w-full">
            <span className="text-caption-bold font-caption-bold text-neutral-700">
              Review Decision
            </span>
            <div className="grid grid-cols-2 gap-2.5 w-full">
              {/* Accept / Approve Button */}
              <button
                type="button"
                onClick={() => setStatus('approved')}
                className={`flex items-center justify-center gap-2 rounded-md border py-2.5 px-3 text-body-bold font-body-bold transition cursor-pointer ${
                  status === 'approved'
                    ? 'border-success-600 bg-success-50 text-success-800 shadow-xs ring-1 ring-success-600'
                    : 'border-neutral-border bg-white text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                <svg className="text-[16px]" width="1em" height="1em" viewBox="0 0 24 24">
                  <path
                    d="M20 6 9 17l-5-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Accept &amp; Approve</span>
              </button>

              {/* Reject Button */}
              <button
                type="button"
                onClick={() => setStatus('rejected')}
                className={`flex items-center justify-center gap-2 rounded-md border py-2.5 px-3 text-body-bold font-body-bold transition cursor-pointer ${
                  status === 'rejected'
                    ? 'border-error-600 bg-error-50 text-error-800 shadow-xs ring-1 ring-error-600'
                    : 'border-neutral-border bg-white text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                <svg className="text-[16px]" width="1em" height="1em" viewBox="0 0 24 24">
                  <path
                    d="M18 6 6 18M6 6l12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Reject Account</span>
              </button>
            </div>
          </div>

          {/* Review Message Note */}
          <div className="flex flex-col items-start gap-1.5 w-full">
            <div className="flex items-center justify-between w-full">
              <span className="text-caption-bold font-caption-bold text-neutral-700">
                Message to Clipper <span className="font-normal text-neutral-400">(optional)</span>
              </span>
              <span className="text-caption font-caption text-neutral-400">
                Included in Telegram DM
              </span>
            </div>

            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                status === 'approved'
                  ? 'e.g. Account verified! You are ready to start submitting clips.'
                  : 'e.g. Incorrect password or handle not found. Please re-check.'
              }
              className="w-full rounded-md border border-solid border-neutral-border bg-white px-3 py-2 text-body font-body text-default-font placeholder-neutral-400 focus:outline-none focus:border-brand-primary"
            />

            {/* Quick Template Pills */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[11px] text-neutral-400 font-medium">Templates:</span>
              {status === 'approved' ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleQuickNote('Account credentials verified! You can now start submitting video clips.')}
                    className="text-[11px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded cursor-pointer transition"
                  >
                    Verified &amp; Ready
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickNote('Welcome aboard! Keep up the great work.')}
                    className="text-[11px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded cursor-pointer transition"
                  >
                    Welcome
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleQuickNote('Password incorrect. Please re-link with your active account password.')}
                    className="text-[11px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded cursor-pointer transition"
                  >
                    Wrong Password
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickNote('Handle does not match any existing channel or profile.')}
                    className="text-[11px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded cursor-pointer transition"
                  >
                    Handle Not Found
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Live Telegram Message Preview */}
          <div className="flex w-full flex-col items-start gap-1.5 rounded-md border border-solid border-blue-200 bg-blue-50/50 p-3">
            <div className="flex items-center gap-1.5 text-blue-900">
              <svg className="text-[13px]" width="1em" height="1em" viewBox="0 0 24 24">
                <path
                  d="M21.5 3.5 2.6 10.8c-1 .4-1 1.6 0 1.9l4.8 1.5 1.8 5.6c.2.7 1.1.9 1.6.4l2.7-2.5 4.8 3.5c.6.4 1.4.1 1.6-.6l3.2-15.3c.2-.9-.7-1.6-1.6-1.3z"
                  fill="currentColor"
                />
              </svg>
              <span className="text-caption-bold font-caption-bold">
                Telegram Notification Preview
              </span>
            </div>

            <div className="w-full rounded bg-white p-2.5 text-caption font-caption text-neutral-800 border border-blue-100 font-mono text-[12px] leading-relaxed select-all">
              {status === 'approved' ? (
                <>
                  <p className="font-bold text-success-700">🎉 Social Account Approved!</p>
                  <p className="mt-1">
                    Your <b>{platform.toUpperCase()}</b> account (<code>{handle}</code>) has been approved by the admin.
                  </p>
                  {note && (
                    <p className="mt-1 text-neutral-600">
                      📝 <b>Admin Note:</b> <i>{note}</i>
                    </p>
                  )}
                  <p className="mt-1 text-neutral-500">
                    🚀 You can now submit your video clips posted from this handle under <b>➕ Submit Link</b>!
                  </p>
                </>
              ) : (
                <>
                  <p className="font-bold text-error-700">⚠️ Social Account Not Approved</p>
                  <p className="mt-1">
                    Your <b>{platform.toUpperCase()}</b> account (<code>{handle}</code>) was not approved by the admin.
                  </p>
                  {note && (
                    <p className="mt-1 text-neutral-600">
                      📝 <b>Admin Note:</b> <i>{note}</i>
                    </p>
                  )}
                  <p className="mt-1 text-neutral-500">
                    Please verify your credentials and link your account again under <b>📱 Link Social Account</b>.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Toggle Telegram DM */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={notifyUser}
              onChange={(e) => setNotifyUser(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary"
            />
            <span className="text-body font-body text-neutral-700">
              Send Telegram DM notification to clipper immediately
            </span>
          </label>
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
            disabled={loading}
            onClick={handleSubmit}
            className={`flex items-center gap-2 rounded-md px-5 py-2 text-body-bold font-body-bold text-white transition shadow-xs cursor-pointer ${
              status === 'approved'
                ? 'bg-success-600 hover:bg-success-700'
                : 'bg-error-600 hover:bg-error-700'
            }`}
          >
            {loading ? (
              <span>Saving...</span>
            ) : status === 'approved' ? (
              <span>Confirm &amp; Approve</span>
            ) : (
              <span>Confirm &amp; Reject</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
