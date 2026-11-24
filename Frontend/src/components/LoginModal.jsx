import React, { useState } from 'react';
import { Lock, KeyRound, Eye, EyeOff, ArrowRight, Check } from 'lucide-react';

export default function LoginModal({ isOpen, onLogin, onChangePassword }) {
  const [mode, setMode] = useState('login'); // 'login' | 'change'

  // Login state
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(password);
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid master admin password');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 4) {
      setError('New password must be at least 4 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setLoading(true);
    try {
      await onChangePassword(currentPassword, newPassword);
      // Reset fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMode('login');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update admin password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in overflow-y-auto">
      <div className="flex w-full max-w-[420px] flex-col items-start overflow-hidden rounded-lg bg-default-background shadow-md border border-neutral-border animate-fade-in my-auto">
        {mode === 'login' ? (
          /* LOGIN FORM */
          <div className="flex w-full flex-col items-start p-5 sm:p-7">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-brand-primary text-white shadow-xs">
                <Lock className="w-5 h-5" />
              </div>
              <div className="flex flex-col items-start min-w-0">
                <span className="text-heading-3 font-heading-3 text-default-font truncate">
                  Admin Portal Access
                </span>
                <span className="text-caption font-caption text-subtext-color truncate">
                  Enter master password to unlock
                </span>
              </div>
            </div>

            <p className="text-body font-body text-subtext-color mb-5">
              Access clippers, payment details, unencrypted credentials, and submission controls.
            </p>

            <form onSubmit={handleLoginSubmit} className="w-full space-y-4">
              {error && (
                <div className="p-3 rounded-md bg-error-100 border border-error-200 text-error-800 text-caption font-caption">
                  {error}
                </div>
              )}

              <div className="flex flex-col items-start gap-1.5">
                <span className="text-caption-bold font-caption-bold text-neutral-700">
                  Master Admin Password
                </span>
                <div className="relative w-full flex items-center rounded-sm border border-solid border-neutral-300 bg-default-background focus-within:border-brand-primary">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2 text-base sm:text-body font-body text-default-font outline-none placeholder:text-[#a3a3a3] bg-transparent pr-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-neutral-400 hover:text-neutral-600 transition cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-sm bg-brand-primary hover:bg-brand-600 text-white text-body-bold font-body-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {loading ? (
                  <span>Unlocking...</span>
                ) : (
                  <>
                    <span>Unlock Admin Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Change Password Link */}
              <div className="pt-2 text-center border-t border-neutral-border mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setMode('change');
                  }}
                  className="text-caption font-caption text-subtext-color hover:text-brand-primary transition cursor-pointer"
                >
                  Change master password?
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* CHANGE PASSWORD FORM */
          <div className="flex w-full flex-col items-start p-5 sm:p-7">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-neutral-900 text-white shadow-xs">
                <KeyRound className="w-5 h-5" />
              </div>
              <div className="flex flex-col items-start min-w-0">
                <span className="text-heading-3 font-heading-3 text-default-font truncate">
                  Change Master Password
                </span>
                <span className="text-caption font-caption text-subtext-color truncate">
                  Set a new portal password
                </span>
              </div>
            </div>

            <p className="text-body font-body text-subtext-color mb-5">
              Enter your current master password and specify a new one to secure your dashboard.
            </p>

            <form onSubmit={handleChangeSubmit} className="w-full space-y-3.5">
              {error && (
                <div className="p-3 rounded-md bg-error-100 border border-error-200 text-error-800 text-caption font-caption">
                  {error}
                </div>
              )}

              {/* Current Password */}
              <div className="flex flex-col items-start gap-1">
                <span className="text-caption-bold font-caption-bold text-neutral-700">
                  Current Master Password
                </span>
                <div className="relative w-full flex items-center rounded-sm border border-solid border-neutral-300 bg-default-background focus-within:border-brand-primary">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-3 py-2 text-base sm:text-body font-body text-default-font outline-none placeholder:text-[#a3a3a3] bg-transparent pr-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 text-neutral-400 hover:text-neutral-600 transition cursor-pointer"
                    title={showCurrent ? 'Hide password' : 'Show password'}
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="flex flex-col items-start gap-1">
                <span className="text-caption-bold font-caption-bold text-neutral-700">
                  New Master Password
                </span>
                <div className="relative w-full flex items-center rounded-sm border border-solid border-neutral-300 bg-default-background focus-within:border-brand-primary">
                  <input
                    type={showNew ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 4 characters"
                    className="w-full px-3 py-2 text-base sm:text-body font-body text-default-font outline-none placeholder:text-[#a3a3a3] bg-transparent pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 text-neutral-400 hover:text-neutral-600 transition cursor-pointer"
                    title={showNew ? 'Hide password' : 'Show password'}
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="flex flex-col items-start gap-1">
                <span className="text-caption-bold font-caption-bold text-neutral-700">
                  Confirm New Password
                </span>
                <div className="relative w-full flex items-center rounded-sm border border-solid border-neutral-300 bg-default-background focus-within:border-brand-primary">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full px-3 py-2 text-base sm:text-body font-body text-default-font outline-none placeholder:text-[#a3a3a3] bg-transparent pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 text-neutral-400 hover:text-neutral-600 transition cursor-pointer"
                    title={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-sm bg-brand-primary hover:bg-brand-600 text-white text-body-bold font-body-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {loading ? (
                    <span>Updating...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Update Password &amp; Unlock</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setMode('login');
                  }}
                  className="w-full py-2 rounded-sm border border-solid border-neutral-border bg-default-background hover:bg-neutral-50 text-body font-body text-neutral-700 transition cursor-pointer text-center"
                >
                  ← Back to Login
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
