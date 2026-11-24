import React, { useState, useEffect } from 'react';
import { X, CreditCard, Trash2, Check } from 'lucide-react';

export default function EditUserModal({ isOpen, user, onClose, onSave, onDelete }) {
  const [username, setUsername] = useState('');
  const [paymentDetails, setPaymentDetails] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.telegram_username || '');
      setPaymentDetails(user.payment_details || '');
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(user.chat_id, {
        telegram_username: username,
        payment_details: paymentDetails,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete user ${user.telegram_username} (Chat ID: ${user.chat_id})? This will also remove their submissions and linked accounts.`)) {
      onDelete(user.chat_id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
        <div className="px-6 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <span>Edit Clipper Data</span>
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
            <label className="block text-xs font-semibold text-slate-300 mb-1">Telegram Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@username"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">Locked Telegram username for this clipper</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Bank / Payment Details</label>
            <textarea
              rows={3}
              value={paymentDetails}
              onChange={(e) => setPaymentDetails(e.target.value)}
              placeholder="e.g. Commercial Bank of Ethiopia (CBE) 100012345678"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 font-mono text-xs"
            ></textarea>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={handleDelete}
              className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium border border-rose-500/20 transition flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete User</span>
            </button>

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
                <span>Save Clipper</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
