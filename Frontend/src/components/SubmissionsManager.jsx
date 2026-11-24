import React, { useState } from 'react';
import { Search, X, Copy, PenSquare, Share2 } from 'lucide-react';

export default function SubmissionsManager({
  submissions,
  onEditSubmission,
  onCopy,
  selectedUser = null,
  onClearSelectedUser,
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Pre-filter submissions by selected user if active
  const userScopedSubs = selectedUser
    ? submissions.filter((s) => {
        const targetChatId = selectedUser.chat_id;
        const targetUname = (selectedUser.telegram_username || '').replace(/^@/, '').toLowerCase();
        const subUname = (s.telegram_username || '').replace(/^@/, '').toLowerCase();

        return (
          (targetChatId && s.chat_id === targetChatId) ||
          (targetUname && subUname === targetUname)
        );
      })
    : submissions;

  // Status counts based on the active user scope
  const counts = {
    all: userScopedSubs.length,
    pending: userScopedSubs.filter((s) => s.status === 'pending').length,
    under_review: userScopedSubs.filter((s) => s.status === 'under_review').length,
    approved: userScopedSubs.filter((s) => s.status === 'approved').length,
    rejected: userScopedSubs.filter((s) => s.status === 'rejected').length,
  };

  const filteredSubs = userScopedSubs.filter((s) => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (platformFilter !== 'all' && (s.platform || '').toLowerCase() !== platformFilter.toLowerCase()) return false;

    const q = search.trim().toLowerCase();
    if (q) {
      const uname = (s.telegram_username || '').toLowerCase();
      const link = (s.link || '').toLowerCase();
      const caption = (s.caption || '').toLowerCase();
      const handle = (s.handle || '').toLowerCase();
      const id = String(s.id || '');
      return uname.includes(q) || link.includes(q) || caption.includes(q) || handle.includes(q) || id.includes(q);
    }
    return true;
  });

  const getPlatformIcon = (platform) => {
    const p = (platform || '').toLowerCase();
    if (p === 'tiktok') return <i className="fa-brands fa-tiktok text-neutral-800"></i>;
    if (p === 'youtube') return <i className="fa-brands fa-youtube text-red-600"></i>;
    if (p === 'twitter') return <i className="fa-brands fa-x-twitter text-neutral-800"></i>;
    if (p === 'instagram') return <i className="fa-brands fa-instagram text-pink-600"></i>;
    return <Share2 className="w-3 h-3 text-neutral-400" />;
  };

  const getStatusBadge = (status) => {
    const map = {
      pending: (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-warning-100 text-warning-800 border border-warning-200">
          Pending
        </span>
      ),
      under_review: (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200">
          Under Review
        </span>
      ),
      approved: (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-success-100 text-success-800 border border-success-200">
          Approved
        </span>
      ),
      rejected: (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-error-100 text-error-800 border border-error-200">
          Rejected
        </span>
      ),
    };
    return map[status] || <span className="px-2 py-0.5 rounded text-xs">{status}</span>;
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '-';
    try {
      return new Date(isoStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <section className="space-y-4">
      {/* Active Single User Scope Banner */}
      {selectedUser && (
        <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-brand-50 border border-brand-200 text-brand-900 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-pulse"></span>
            <span className="text-xs font-medium">
              Showing exclusively clips for clipper:{' '}
              <strong className="text-brand-700 font-bold">
                {selectedUser.telegram_username || `Chat ID: ${selectedUser.chat_id}`}
              </strong>{' '}
              <span className="text-neutral-500 font-normal">({filteredSubs.length} clips found)</span>
            </span>
          </div>
          <button
            onClick={onClearSelectedUser}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-neutral-700 text-xs font-semibold border border-brand-200 shadow-sm transition flex items-center gap-1.5"
            title="Clear filter to view all clippers' submissions"
          >
            <X className="w-3.5 h-3.5 text-neutral-500" />
            <span>Clear Filter &amp; View All Clips</span>
          </button>
        </div>
      )}

      {/* Toolbar & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm space-y-3">
        {/* Status Pills */}
        <div className="flex items-center flex-wrap gap-2">
          <span className="text-xs font-semibold text-neutral-500 mr-1 uppercase tracking-wider">Status:</span>
          {[
            { id: 'all', label: 'All', color: 'text-neutral-700' },
            { id: 'pending', label: 'Pending Review', color: 'text-warning-700' },
            { id: 'under_review', label: 'Under Review', color: 'text-brand-700' },
            { id: 'approved', label: 'Approved', color: 'text-success-700' },
            { id: 'rejected', label: 'Rejected', color: 'text-error-700' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setStatusFilter(pill.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === pill.id
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-600 border border-neutral-200'
              }`}
            >
              <span className={statusFilter === pill.id ? 'text-white' : pill.color}>{pill.label}</span> (
              {counts[pill.id] || 0})
            </button>
          ))}
        </div>

        {/* Search & Platform */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-1 border-t border-neutral-200">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by clipper username, video link, caption, or handle..."
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

          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 font-medium">Platform:</span>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-700 focus:outline-none focus:border-brand-500"
            >
              <option value="all">All Platforms</option>
              <option value="tiktok">TikTok</option>
              <option value="youtube">YouTube</option>
              <option value="twitter">Twitter / X</option>
              <option value="instagram">Instagram</option>
            </select>
          </div>
        </div>
      </div>

      {/* Submissions Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-900">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500 border-b border-neutral-200">
              <tr>
                <th className="px-4 py-3.5 font-semibold">ID / Date</th>
                <th className="px-4 py-3.5 font-semibold">Clipper</th>
                <th className="px-4 py-3.5 font-semibold">Platform &amp; Account</th>
                <th className="px-4 py-3.5 font-semibold">Video Link</th>
                <th className="px-4 py-3.5 font-semibold">Caption</th>
                <th className="px-4 py-3.5 font-semibold text-right">Views</th>
                <th className="px-4 py-3.5 font-semibold text-right">Payment (ETB)</th>
                <th className="px-4 py-3.5 font-semibold text-center">Status</th>
                <th className="px-5 py-3.5 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredSubs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-neutral-400">
                    No submissions found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredSubs.map((sub) => (
                  <tr key={sub.id} className="hover:bg-neutral-50/80 transition">
                    {/* ID & Date */}
                    <td className="px-4 py-3.5">
                      <div className="font-mono font-bold text-neutral-800 text-xs">#{sub.id}</div>
                      <div className="text-[11px] text-neutral-500">{formatDate(sub.submitted_at)}</div>
                    </td>

                    {/* Clipper */}
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-neutral-900 text-xs">{sub.telegram_username}</div>
                      <div className="text-[10px] text-neutral-500 font-mono">Chat ID: {sub.chat_id}</div>
                    </td>

                    {/* Platform & Account */}
                    <td className="px-4 py-3.5">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-neutral-100 border border-neutral-200 text-xs text-neutral-800">
                        {getPlatformIcon(sub.platform)}
                        <span className="font-medium font-mono">{sub.handle || sub.platform}</span>
                      </div>
                    </td>

                    {/* Video Link */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 max-w-[200px]">
                        <a
                          href={sub.link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-600 hover:text-brand-700 font-mono text-xs truncate underline"
                          title={sub.link}
                        >
                          {sub.link}
                        </a>
                        <button
                          onClick={() => onCopy(sub.link, 'Video Link')}
                          className="text-neutral-400 hover:text-neutral-600 shrink-0"
                          title="Copy Link"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Caption */}
                    <td className="px-4 py-3.5">
                      <div className="max-w-[200px] text-xs text-neutral-700 truncate" title={sub.caption || ''}>
                        {sub.caption ? <span className="italic">"{sub.caption}"</span> : <span className="text-neutral-400 italic">None</span>}
                      </div>
                    </td>

                    {/* Views */}
                    <td className="px-4 py-3.5 text-right font-mono font-semibold text-brand-600 text-xs">
                      {Number(sub.views || 0).toLocaleString()}
                    </td>

                    {/* Payment (ETB) - Paid: #6366F1 */}
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-paid-600 text-xs">
                      {Number(sub.payment_amount || 0).toFixed(2)} ETB
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3.5 text-center">{getStatusBadge(sub.status)}</td>

                    {/* Action */}
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => onEditSubmission(sub)}
                        className="px-3 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-500 text-brand-700 hover:text-white text-xs font-semibold border border-brand-200 hover:border-brand-500 transition flex items-center gap-1.5 ml-auto shadow-sm"
                      >
                        <PenSquare className="w-3.5 h-3.5" />
                        <span>Edit Views &amp; Pay</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 bg-neutral-50 border-t border-neutral-200 text-xs text-neutral-500 flex items-center justify-between">
          <span>Showing {filteredSubs.length} of {submissions.length} submissions</span>
          <span className="text-neutral-500">Edit views, payouts, captions, or status with instant bot notification</span>
        </div>
      </div>
    </section>
  );
}
