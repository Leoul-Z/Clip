import React, { useState, useEffect } from 'react';
import { X, Key, Trash2, Check, Eye, EyeOff, Lock } from 'lucide-react';

export default function EditSocialModal({ isOpen, account, chatId, onClose, onSave, onDelete }) {
  const [platform, setPlatform] = useState('tiktok');
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (account) {
      setPlatform(account.platform || 'tiktok');
      setHandle(account.handle || '');
      setPassword(account.password || '');
    } else {
      setPlatform('tiktok');
      setHandle('');
      setPassword('');
    }
  }, [account]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        platform,
        handle,
        password,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (account && window.confirm(`Delete linked ${account.platform} account (${account.handle})?`)) {
      onDelete(account.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
        <div className="px-6 py-4 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
          <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
            <Key className="w-4 h-4 text-brand-500" />
            <span>{account ? 'Edit Social Account & Password' : 'Add Linked Social Account'}</span>
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white hover:bg-neutral-100 text-neutral-500 hover:text-neutral-700 border border-neutral-200 transition flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Platform</label>
            <input
              type="text"
              disabled
              value={platform.toUpperCase()}
              className="w-full px-3.5 py-2.5 bg-neutral-100 border border-neutral-200 rounded-xl text-sm text-neutral-500 font-semibold cursor-not-allowed select-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-neutral-700">Account Handle</label>
              <span className="text-[11px] text-neutral-400 font-medium flex items-center gap-1">
                <Lock className="w-3 h-3 text-neutral-400" /> Locked by user
              </span>
            </div>
            <input
              type="text"
              disabled
              value={handle}
              className="w-full px-3.5 py-2.5 bg-neutral-100 border border-neutral-200 rounded-xl text-sm text-neutral-500 font-mono cursor-not-allowed select-all"
            />
            <p className="text-[11px] text-neutral-400 mt-1">Clippers link and manage their own handles via Telegram.</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-neutral-700">
                Password <span className="text-[10px] text-brand-600 font-normal">(unencrypted view)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-xs text-neutral-500 hover:text-brand-600 flex items-center gap-1"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPassword ? 'Mask' : 'Show Plaintext'}</span>
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter plaintext password"
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 focus:outline-none focus:border-brand-500 focus:bg-white font-mono"
            />
            <p className="text-[11px] text-neutral-500 mt-1">Stored encrypted in DB; viewable &amp; editable by admin.</p>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-neutral-200">
            {account ? (
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-2 rounded-xl bg-error-50 hover:bg-error-100 text-error-700 text-xs font-medium border border-error-200 transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            ) : <div></div>}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-md shadow-brand-500/20 transition flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Account</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
