import React, { useState, useEffect } from 'react';
import { X, Send, Users, User, Info, Check } from 'lucide-react';

export default function SendMessageModal({ isOpen, targetUser, onClose, onSend }) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMessage('');
      setError('');
      setLoading(false);
    }
  }, [isOpen, targetUser]);

  if (!isOpen) return null;

  const isBroadcast = !targetUser;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Please enter a message to send.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onSend({
        chat_id: targetUser ? targetUser.chat_id : null,
        message: message.trim(),
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send Telegram message.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isBroadcast
                ? 'bg-warning-100 text-warning-800 border border-warning-200'
                : 'bg-brand-50 text-brand-600 border border-brand-200'
            }`}>
              {isBroadcast ? <Users className="w-5 h-5" /> : <Send className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-base">
                {isBroadcast ? 'Broadcast to All Clippers' : `Send DM to ${targetUser.telegram_username || 'User'}`}
              </h3>
              <p className="text-xs text-neutral-500">
                {isBroadcast
                  ? 'Deliver an announcement to every registered user via Telegram'
                  : `Direct bot notification to Chat ID: ${targetUser.chat_id}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white hover:bg-neutral-100 text-neutral-500 hover:text-neutral-700 border border-neutral-200 transition flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-error-50 border border-error-200 text-error-700 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Recipient Notice */}
          <div className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
            isBroadcast
              ? 'bg-amber-50/70 border-amber-200 text-amber-900'
              : 'bg-brand-50/70 border-brand-200 text-brand-900'
          }`}>
            <Info className="w-4 h-4 shrink-0" />
            <div>
              {isBroadcast ? (
                <span>
                  <strong>Broadcast Mode:</strong> This message will be sent through the Telegram bot to all clippers currently in the database.
                </span>
              ) : (
                <span>
                  <strong>Recipient:</strong> Sending exclusively to{' '}
                  <span className="font-semibold">{targetUser.telegram_username || 'User'}</span> (ID:{' '}
                  <code className="font-mono">{targetUser.chat_id}</code>).
                </span>
              )}
            </div>
          </div>

          {/* Message Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-neutral-700">Message Content</label>
              <span className="text-[11px] text-neutral-400 font-mono">{message.length} chars</span>
            </div>
            <textarea
              rows={5}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                isBroadcast
                  ? 'e.g. 📢 New clipper campaign is live! Payouts are now 500 ETB per 10k views. Submit your clips under 🔗 Submission Links.'
                  : 'e.g. Hello! Please update your CBE account details so we can process your payout.'
              }
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 focus:outline-none focus:border-brand-500 focus:bg-white resize-y"
            ></textarea>
            <p className="text-[11px] text-neutral-500 mt-1">
              Supports standard Telegram formatting like <code>&lt;b&gt;bold&lt;/b&gt;</code>,{' '}
              <code>&lt;i&gt;italic&lt;/i&gt;</code>, and <code>&lt;a href="..."&gt;links&lt;/a&gt;</code>.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-neutral-200">
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
              className={`px-5 py-2 rounded-xl text-white text-xs font-semibold shadow-md transition flex items-center gap-2 ${
                isBroadcast
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                  : 'bg-brand-500 hover:bg-brand-600 shadow-brand-500/20'
              }`}
            >
              {loading ? (
                <span>Sending...</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{isBroadcast ? 'Broadcast Message' : 'Send Direct Message'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
