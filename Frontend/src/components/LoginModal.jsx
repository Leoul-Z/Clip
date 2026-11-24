import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function LoginModal({ isOpen, onLogin }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
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

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-neutral-200 rounded-3xl w-full max-w-sm shadow-2xl p-6 sm:p-8 text-center animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 border border-brand-200 flex items-center justify-center mx-auto mb-4 shadow-sm">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900 mb-1">Admin Portal Access</h2>
        <p className="text-xs text-neutral-500 mb-6">
          Enter your master admin password to access clipper data, unencrypted passwords, and submission controls.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {error && (
            <div className="p-3 rounded-xl bg-error-50 border border-error-200 text-error-700 text-xs text-center font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Master Admin Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 focus:outline-none focus:border-brand-500 focus:bg-white pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold shadow-md shadow-brand-500/20 transition flex items-center justify-center gap-2"
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
        </form>
      </div>
    </div>
  );
}
