import React, { useState } from 'react';
import {
  Search,
  Eye,
  EyeOff,
  Copy,
  Edit2,
  Plus,
  Send,
  ExternalLink,
  CreditCard,
  X,
  Share2
} from 'lucide-react';

export default function UsersManager({
  users,
  onEditUser,
  onEditSocial,
  onAddSocial,
  onViewSubmissions,
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
    if (p === 'tiktok') return <i className="fa-brands fa-tiktok text-slate-100"></i>;
    if (p === 'youtube') return <i className="fa-brands fa-youtube text-red-500"></i>;
    if (p === 'twitter') return <i className="fa-brands fa-x-twitter text-slate-200"></i>;
    if (p === 'instagram') return <i className="fa-brands fa-instagram text-pink-400"></i>;
    return <Share2 className="w-3 h-3 text-slate-400" />;
  };

  return (
    <section className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clippers by @username, Chat ID, bank info, or handle..."
            className="w-full pl-10 pr-10 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
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
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-medium text-slate-200 focus:outline-none focus:border-indigo-500"
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
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                : 'bg-slate-800 hover:bg-slate-700 text-indigo-300 border-indigo-500/30'
            }`}
          >
            {showAllPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showAllPasswords ? 'Hide All Passwords' : 'Show All Passwords'}</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Clipper</th>
                <th className="px-4 py-3.5 font-semibold">Bank / Payment Details</th>
                <th className="px-4 py-3.5 font-semibold">Linked Social Accounts</th>
                <th className="px-4 py-3.5 font-semibold">
                  <span className="flex items-center gap-1.5">
                    Account Passwords
                    <span className="text-[10px] lowercase font-normal px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      unencrypted
                    </span>
                  </span>
                </th>
                <th className="px-4 py-3.5 font-semibold text-right">Approved Stats</th>
                <th className="px-4 py-3.5 font-semibold text-center">Clips</th>
                <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
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
                    <tr key={u.id} className="hover:bg-slate-800/40 transition">
                      {/* Clipper Username & Chat ID */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs uppercase">
                            {cleanUsername ? cleanUsername[0] : 'U'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              {tgLink ? (
                                <a
                                  href={tgLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-semibold text-white hover:text-indigo-400 transition"
                                >
                                  {rawUsername || 'Anonymous'}
                                </a>
                              ) : (
                                <span className="font-semibold text-white">{rawUsername || 'Anonymous'}</span>
                              )}
                              {tgLink && <i className="fa-brands fa-telegram text-indigo-400 text-xs"></i>}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">ID: {u.chat_id}</div>
                          </div>
                        </div>
                      </td>

                      {/* Bank / Payment Info */}
                      <td className="px-4 py-4">
                        {u.payment_details && u.payment_details.trim().length > 0 ? (
                          <div className="flex items-start gap-1.5 max-w-[220px]">
                            <span className="font-mono text-xs text-emerald-400/90 break-words">{u.payment_details}</span>
                            <button
                              onClick={() => onCopy(u.payment_details, 'Bank Details')}
                              className="text-slate-500 hover:text-slate-300 shrink-0 mt-0.5"
                              title="Copy"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onEditUser(u)}
                              className="text-slate-500 hover:text-indigo-400 shrink-0 mt-0.5"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 text-xs italic">Not provided</span>
                            <button
                              onClick={() => onEditUser(u)}
                              className="text-indigo-400 hover:underline text-xs flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Add
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Linked Social Accounts */}
                      <td className="px-4 py-4">
                        <div className="space-y-1.5">
                          {socials.length === 0 ? (
                            <span className="text-slate-600 text-xs italic">No accounts linked</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {socials.map((sa) => (
                                <div
                                  key={sa.id}
                                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200"
                                >
                                  {getPlatformIcon(sa.platform)}
                                  <span className="font-medium font-mono">{sa.handle}</span>
                                  <button
                                    onClick={() => onEditSocial(sa, u.chat_id)}
                                    className="text-slate-500 hover:text-indigo-400 ml-0.5"
                                    title="Edit account & password"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div>
                            <button
                              onClick={() => onAddSocial(u.chat_id)}
                              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Link another account
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Unencrypted Passwords Column */}
                      <td className="px-4 py-4">
                        {socials.length === 0 ? (
                          <span className="text-slate-600 text-xs italic">None</span>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {socials.map((sa) => {
                              const isRevealed = showAllPasswords || revealedIds.has(sa.id);
                              const passValue = sa.password || '';

                              return (
                                <div
                                  key={sa.id}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono transition ${
                                    isRevealed ? 'password-unmasked' : 'text-slate-400'
                                  }`}
                                >
                                  <span className="text-[11px] uppercase tracking-wider text-slate-500 font-sans">
                                    {sa.platform}:
                                  </span>
                                  <span className="tracking-wide select-all">
                                    {isRevealed ? passValue || <i className="text-slate-600">empty</i> : '••••••••'}
                                  </span>
                                  <div className="flex items-center gap-1 ml-auto">
                                    <button
                                      onClick={() => togglePassword(sa.id)}
                                      className="text-slate-400 hover:text-white p-0.5 rounded transition"
                                      title={isRevealed ? 'Hide' : 'View unencrypted'}
                                    >
                                      {isRevealed ? (
                                        <EyeOff className="w-3.5 h-3.5 text-indigo-400" />
                                      ) : (
                                        <Eye className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                    <button
                                      onClick={() => onCopy(passValue, `${sa.platform} password`)}
                                      className="text-slate-400 hover:text-emerald-400 p-0.5 rounded transition"
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
                        <div className="font-mono font-semibold text-cyan-400 text-xs">
                          {Number(u.views || 0).toLocaleString()} <span className="text-slate-500 font-normal">views</span>
                        </div>
                        <div className="font-mono font-bold text-emerald-400 text-xs">
                          ${Number(u.money || 0).toFixed(2)}
                        </div>
                      </td>

                      {/* Clips Count */}
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => onViewSubmissions(rawUsername)}
                          className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition"
                          title="View user submissions"
                        >
                          {u.submission_count || 0}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onEditUser(u)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition flex items-center gap-1"
                            title="Edit User Data & Bank Info"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => onViewSubmissions(rawUsername)}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium border border-indigo-500/30 transition"
                          >
                            Clips
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

        <div className="px-5 py-3 bg-slate-900/50 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
          <span>Showing {filteredUsers.length} of {users.length} clippers</span>
          <span className="text-slate-500">Unencrypted passwords viewable & editable by admin</span>
        </div>
      </div>
    </section>
  );
}
