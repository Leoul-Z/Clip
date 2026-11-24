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
    <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
        <div className="px-6 py-4 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
          <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-brand-500" />
            <span>Edit Clipper Data</span>
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
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Telegram Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@username"
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 focus:outline-none focus:border-brand-500 focus:bg-white font-mono"
            />
            <p className="text-[11px] text-neutral-500 mt-1">Locked Telegram username for this clipper</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Bank / Payment Details</label>
            <textarea
              rows={3}
              value={paymentDetails}
              onChange={(e) => setPaymentDetails(e.target.value)}
              placeholder="e.g. Commercial Bank of Ethiopia (CBE) 100012345678"
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 focus:outline-none focus:border-brand-500 focus:bg-white font-mono text-xs"
            ></textarea>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-neutral-200">
            <button
              type="button"
              onClick={handleDelete}
              className="px-3 py-2 rounded-xl bg-error-50 hover:bg-error-100 text-error-700 text-xs font-medium border border-error-200 transition flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete User</span>
            </button>

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
                <span>Save Clipper</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
