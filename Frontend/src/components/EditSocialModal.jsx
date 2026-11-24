import React, { useState, useEffect } from 'react';
import { X, Key, Trash2, Check, Eye, EyeOff } from 'lucide-react';

export default function EditSocialModal({ isOpen, account, chatId, onClose, onSave, onDelete }) {
  const [platform, setPlatform] = useState('tiktok');
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true); // default visible for admin!
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
        <div className="px-6 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <Key className="w-4 h-4 text-purple-400" />
            <span>{account ? 'Edit Social Account & Password' : 'Add Linked Social Account'}</span>
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="tiktok">TikTok</option>
              <option value="youtube">YouTube</option>
              <option value="twitter">Twitter / X</option>
              <option value="instagram">Instagram</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Account Handle</label>
            <input
              type="text"
              required
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@handle"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-300">
                Password <span className="text-[10px] text-indigo-400 font-normal">(unencrypted view)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1"
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
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">Stored encrypted in DB; viewable & editable by admin.</p>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            {account ? (
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium border border-rose-500/20 transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            ) : <div></div>}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition flex items-center gap-1.5"
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
