import React, { useState, useEffect } from 'react';
import { X, PenSquare, Trash2, Check, ExternalLink, Send, Eye, DollarSign } from 'lucide-react';

export default function EditSubmissionModal({ isOpen, submission, onClose, onSave, onDelete }) {
  const [views, setViews] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [status, setStatus] = useState('approved');
  const [link, setLink] = useState('');
  const [caption, setCaption] = useState('');
  const [notifyUser, setNotifyUser] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (submission) {
      setViews(submission.views || 0);
      setPaymentAmount(Number(submission.payment_amount || 0).toFixed(2));
      setStatus(submission.status || 'approved');
      setLink(submission.link || '');
      setCaption(submission.caption || '');
      setNotifyUser(true);
    }
  }, [submission]);

  if (!isOpen || !submission) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(submission.id, {
        views: parseInt(views, 10),
        payment_amount: parseFloat(paymentAmount),
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
    if (window.confirm(`Are you sure you want to delete Submission #${submission.id}?`)) {
      onDelete(submission.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-neutral-850 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center">
              <PenSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Edit Submission &amp; Views</h3>
              <p className="text-xs text-neutral-400">
                Submission #{submission.id} • Clipper: {submission.telegram_username}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Submission Info Box */}
          <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Account:</span>
              <span className="font-medium text-neutral-200">
                {(submission.platform || '').toUpperCase()} - {submission.handle || 'No handle'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-400 shrink-0">Direct Video Link:</span>
              <a
                href={submission.link}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-brand-500 hover:underline flex items-center gap-1 truncate max-w-[240px]"
              >
                <span>{submission.link}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
          </div>

          {/* Views & Payment Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-brand-500" /> Views Achieved
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={views}
                onChange={(e) => setViews(e.target.value)}
                placeholder="e.g. 25000"
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500 font-mono"
              />
              <p className="text-[11px] text-neutral-500 mt-1">Manual views count</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-paid-500" /> Payment Amount ($)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 text-sm font-bold">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="e.g. 50.00"
                  className="w-full pl-8 pr-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500 font-mono"
                />
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">Paid to clipper</p>
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Submission Status</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { val: 'pending', label: 'Pending', color: 'text-warning-500', activeBg: 'border-warning-500/60 bg-warning-500/10' },
                { val: 'under_review', label: 'Review', color: 'text-brand-400', activeBg: 'border-brand-500/60 bg-brand-500/10' },
                { val: 'approved', label: 'Approved', color: 'text-success-500', activeBg: 'border-success-500/60 bg-success-500/10' },
                { val: 'rejected', label: 'Rejected', color: 'text-error-500', activeBg: 'border-error-500/60 bg-error-500/10' },
              ].map((s) => (
                <label
                  key={s.val}
                  className={`flex items-center gap-2 p-2 rounded-xl bg-neutral-950 border cursor-pointer text-xs transition ${
                    status === s.val ? s.activeBg : 'border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="modal-status"
                    value={s.val}
                    checked={status === s.val}
                    onChange={() => setStatus(s.val)}
                    className="text-brand-500 focus:ring-0"
                  />
                  <span className={`font-medium ${s.color}`}>{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Edit Link & Caption */}
          <div className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">Edit Link</label>
              <input
                type="url"
                required
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">Edit Caption</label>
              <textarea
                rows={2}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Video caption"
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500 italic"
              ></textarea>
            </div>
          </div>

          {/* Telegram DM Toggle */}
          <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Send className="w-5 h-5 text-brand-500" />
              <div>
                <span className="text-xs font-medium text-neutral-200 block">Notify Clipper on Telegram</span>
                <span className="text-[11px] text-neutral-400">Sends instant bot DM with views, payment &amp; status</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={notifyUser}
              onChange={(e) => setNotifyUser(e.target.checked)}
              className="w-4 h-4 rounded bg-neutral-900 border-neutral-700 text-brand-500 focus:ring-0 cursor-pointer"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={handleDelete}
              className="px-3 py-2 rounded-xl bg-error-500/10 hover:bg-error-500/20 text-error-500 text-xs font-medium border border-error-500/20 transition flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-lg shadow-brand-500/25 transition flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Submission</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
