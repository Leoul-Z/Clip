import React, { useState } from 'react';
import {
  Search,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  X,
  Share2,
  Send,
  Lock,
} from 'lucide-react';

export default function UsersManager({
  users,
  onDeleteUser,
  onViewSubmissions,
  onSendMessage,
  onCopy,
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [revealedIds, setRevealedIds] = useState(new Set());

  // Search & filter
  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    const uname = (u.telegram_username || '').toLowerCase();
    const cid = String(u.chat_id || '');
    const bank = (u.payment_details || '').toLowerCase();
    const handles = (u.social_accounts || []).map((sa) => (sa.handle || '').toLowerCase()).join(' ');

    const matchesSearch = !q || uname.includes(q) || cid.includes(q) || bank.includes(q) || handles.includes(q);
    if (!matchesSearch) return false;

    if (filter === 'has_bank') return u.payment_details && u.payment_details.trim().length > 0;
    if (filter === 'missing_bank') return !u.payment_details || u.payment_details.trim().length === 0;
    if (filter === 'has_socials') return (u.social_accounts || []).length > 0;
    if (filter === 'has_submissions') return (u.submission_count || 0) > 0;

    return true;
  });

  const togglePassword = (accId) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(accId)) next.delete(accId);
      else next.add(accId);
      return next;
    });
  };

  const getPlatformIcon = (platform) => {
    const p = (platform || '').toLowerCase();
    if (p === 'tiktok') return <i className="fa-brands fa-tiktok text-neutral-800"></i>;
    if (p === 'youtube') return <i className="fa-brands fa-youtube text-red-600"></i>;
    if (p === 'twitter') return <i className="fa-brands fa-x-twitter text-neutral-800"></i>;
    if (p === 'instagram') return <i className="fa-brands fa-instagram text-pink-600"></i>;
    return <Share2 className="w-3 h-3 text-neutral-400" />;
  };

  return (
    <section className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clippers by @username, Chat ID, bank info, or handle..."
            className="w-full pl-10 pr-10 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-brand-500 focus:bg-white"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dropdown & Toggle Passwords */}
        <div className="flex items-center flex-wrap gap-2.5">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-700 focus:outline-none focus:border-brand-500"
          >
            <option value="all">All Clippers</option>
            <option value="has_bank">With Bank Info</option>
            <option value="missing_bank">Missing Bank Info</option>
            <option value="has_socials">With Linked Socials</option>
            <option value="has_submissions">With Submissions</option>
          </select>

          <button
            onClick={() => {
              setShowAllPasswords(!showAllPasswords);
              if (!showAllPasswords) {
                onCopy('', 'All passwords unmasked unencrypted');
              }
            }}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 border ${
              showAllPasswords
                ? 'bg-brand-50 border-brand-300 text-brand-700 shadow-sm'
                : 'bg-white hover:bg-neutral-50 text-brand-600 border-neutral-200'
            }`}
          >
            {showAllPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showAllPasswords ? 'Hide All Passwords' : 'Show All Passwords'}</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-900">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500 border-b border-neutral-200">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Clipper</th>
                <th className="px-4 py-3.5 font-semibold">Bank / Payment Details</th>
                <th className="px-4 py-3.5 font-semibold">Linked Social Accounts</th>
                <th className="px-4 py-3.5 font-semibold">
                  <span className="flex items-center gap-1.5">
                    Account Passwords
                    <span className="text-[10px] lowercase font-normal px-1.5 py-0.2 rounded bg-brand-50 text-brand-700 border border-brand-200">
                      unencrypted
                    </span>
                  </span>
                </th>
                <th className="px-4 py-3.5 font-semibold text-right">Approved Stats</th>
                <th className="px-4 py-3.5 font-semibold text-center">Clips</th>
                <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-neutral-400">
                    No clippers match your search or filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const rawUsername = u.telegram_username || '';
                  const cleanUsername = rawUsername.startsWith('@') ? rawUsername.substring(1) : rawUsername;
                  const tgLink = cleanUsername ? `https://t.me/${cleanUsername}` : null;
                  const socials = u.social_accounts || [];

                  return (
                    <tr key={u.id} className="hover:bg-neutral-50/80 transition">
                      {/* Clipper Username & Chat ID */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-brand-50 border border-brand-200 text-brand-600 flex items-center justify-center font-bold text-xs uppercase">
                            {cleanUsername ? cleanUsername[0] : 'U'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              {tgLink ? (
                                <a
                                  href={tgLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-semibold text-neutral-900 hover:text-brand-600 transition"
                                >
                                  {rawUsername || 'Anonymous'}
                                </a>
                              ) : (
                                <span className="font-semibold text-neutral-900">{rawUsername || 'Anonymous'}</span>
                              )}
                              {tgLink && <i className="fa-brands fa-telegram text-brand-500 text-xs"></i>}
                            </div>
                            <div className="text-[11px] text-neutral-500 font-mono">ID: {u.chat_id}</div>
                          </div>
                        </div>
                      </td>

                      {/* Bank / Payment Info (Multiple Details Supported) */}
                      <td className="px-4 py-4">
                        {(() => {
                          const paymentLines = (u.payment_details || '')
                            .split('\n')
                            .map((l) => l.trim())
                            .filter(Boolean);

                          if (paymentLines.length === 0) {
                            return <span className="text-neutral-400 text-xs italic">Not provided yet</span>;
                          }

                          return (
                            <div className="space-y-1.5 max-w-[260px]">
                              {paymentLines.map((line, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-success-50 border border-success-200 text-xs font-mono text-success-800"
                                >
                                  <span className="truncate select-all" title={line}>
                                    {paymentLines.length > 1 ? `${idx + 1}. ` : ''}{line}
                                  </span>
                                  <button
                                    onClick={() => onCopy(line, `Payment detail #${idx + 1}`)}
                                    className="text-success-600 hover:text-success-800 shrink-0 p-0.5 rounded hover:bg-success-100 transition"
                                    title="Copy this payment detail"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                              {paymentLines.length > 1 && (
                                <button
                                  onClick={() => onCopy(paymentLines.join('\n'), 'All payment details')}
                                  className="text-[10px] text-neutral-500 hover:text-neutral-700 font-medium underline flex items-center gap-1 mt-0.5"
                                  title="Copy all payment details together"
                                >
                                  <Copy className="w-2.5 h-2.5" /> Copy all ({paymentLines.length})
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Linked Social Accounts (Read-Only for Admin) */}
                      <td className="px-4 py-4">
                        <div className="space-y-1.5">
                          {socials.length === 0 ? (
                            <span className="text-neutral-400 text-xs italic">No accounts linked</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {socials.map((sa) => (
                                <div
                                  key={sa.id}
                                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-neutral-100 border border-neutral-200 text-xs text-neutral-800"
                                >
                                  {getPlatformIcon(sa.platform)}
                                  <span className="font-medium font-mono">{sa.handle}</span>
                                  {(sa.views > 0 || sa.money > 0) && (
                                    <span
                                      className="text-[10px] font-mono text-neutral-600 bg-white px-1.5 py-0.5 rounded border border-neutral-200"
                                      title="Platform stats"
                                    >
                                      👁 {Number(sa.views).toLocaleString()} • {Number(sa.money).toFixed(2)} ETB
                                    </span>
                                  )}
                                  <button
                                    onClick={() => onCopy(sa.handle, `${sa.platform} handle`)}
                                    className="text-neutral-400 hover:text-neutral-600 ml-0.5"
                                    title="Copy handle"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Unencrypted Passwords Column */}
                      <td className="px-4 py-4">
                        {socials.length === 0 ? (
                          <span className="text-neutral-400 text-xs italic">None</span>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {socials.map((sa) => {
                              const isRevealed = showAllPasswords || revealedIds.has(sa.id);
                              const passValue = sa.password || '';

                              return (
                                <div
                                  key={sa.id}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition border ${
                                    isRevealed
                                      ? 'password-unmasked'
                                      : 'bg-neutral-50 border-neutral-200 text-neutral-600'
                                  }`}
                                >
                                  <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-sans">
                                    {sa.platform}:
                                  </span>
                                  <span className="tracking-wide select-all">
                                    {isRevealed ? passValue || <i className="text-neutral-400">empty</i> : '••••••••'}
                                  </span>
                                  <div className="flex items-center gap-1 ml-auto">
                                    <button
                                      onClick={() => togglePassword(sa.id)}
                                      className="text-neutral-400 hover:text-neutral-700 p-0.5 rounded transition"
                                      title={isRevealed ? 'Hide' : 'View unencrypted'}
                                    >
                                      {isRevealed ? (
                                        <EyeOff className="w-3.5 h-3.5 text-brand-600" />
                                      ) : (
                                        <Eye className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                    <button
                                      onClick={() => onCopy(passValue, `${sa.platform} password`)}
                                      className="text-neutral-400 hover:text-success-600 p-0.5 rounded transition"
                                      title="Copy unencrypted password"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* Stats */}
                      <td className="px-4 py-4 text-right">
                        <div className="font-mono font-semibold text-brand-600 text-xs">
                          {Number(u.views || 0).toLocaleString()} <span className="text-neutral-500 font-normal">views</span>
                        </div>
                        <div className="font-mono font-bold text-paid-600 text-xs">
                          {Number(u.money || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                        </div>
                      </td>

                      {/* Clips Count */}
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => onViewSubmissions(u)}
                          className="px-2.5 py-1 rounded-full bg-neutral-100 hover:bg-brand-50 hover:text-brand-700 text-neutral-800 font-semibold text-xs border border-neutral-200 transition"
                          title="View only this user's clips"
                        >
                          {u.submission_count || 0}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onSendMessage(u)}
                            className="px-2.5 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold border border-brand-200 transition flex items-center gap-1 shadow-sm"
                            title="Send direct Telegram message through the bot"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>DM</span>
                          </button>
                          <button
                            onClick={() => onViewSubmissions(u)}
                            className="px-2.5 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-sm transition"
                            title="Filter and inspect only this user's clips"
                          >
                            Clips
                          </button>
                          <button
                            onClick={() => onDeleteUser(u)}
                            className="p-1.5 rounded-lg bg-white hover:bg-error-50 text-neutral-400 hover:text-error-600 border border-neutral-200 transition"
                            title="Delete Clipper"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 bg-neutral-50 border-t border-neutral-200 text-xs text-neutral-500 flex items-center justify-between">
          <span>Showing {filteredUsers.length} of {users.length} clippers</span>
          <span className="text-neutral-500">🔒 Usernames, bank details &amp; handles are locked by clippers</span>
        </div>
      </div>
    </section>
  );
}
