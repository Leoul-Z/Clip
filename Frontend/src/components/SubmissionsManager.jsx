import React, { useState } from 'react';
import { Search, X, Copy, PenSquare, Share2 } from 'lucide-react';

export default function SubmissionsManager({ submissions, onEditSubmission, onCopy }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Status counts
  const counts = {
    all: submissions.length,
    pending: submissions.filter((s) => s.status === 'pending').length,
    under_review: submissions.filter((s) => s.status === 'under_review').length,
    approved: submissions.filter((s) => s.status === 'approved').length,
    rejected: submissions.filter((s) => s.status === 'rejected').length,
  };

  const filteredSubs = submissions.filter((s) => {
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
    if (p === 'tiktok') return <i className="fa-brands fa-tiktok text-neutral-200"></i>;
    if (p === 'youtube') return <i className="fa-brands fa-youtube text-red-500"></i>;
    if (p === 'twitter') return <i className="fa-brands fa-x-twitter text-neutral-200"></i>;
    if (p === 'instagram') return <i className="fa-brands fa-instagram text-pink-400"></i>;
    return <Share2 className="w-3 h-3 text-neutral-400" />;
  };

  const getStatusBadge = (status) => {
    const map = {
      pending: (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-warning-500/15 text-warning-500 border border-warning-500/30">
          Pending
        </span>
      ),
      under_review: (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-500/15 text-brand-400 border border-brand-500/30">
          Under Review
        </span>
      ),
      approved: (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-success-500/15 text-success-500 border border-success-500/30">
          Approved
        </span>
      ),
      rejected: (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-error-500/15 text-error-500 border border-error-500/30">
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
      {/* Toolbar & Filters */}
      <div className="glass-panel p-4 rounded-2xl border border-neutral-800 space-y-3">
        {/* Status Pills */}
        <div className="flex items-center flex-wrap gap-2">
          <span className="text-xs font-semibold text-neutral-400 mr-1 uppercase tracking-wider">Status:</span>
          {[
            { id: 'all', label: 'All', color: 'text-neutral-200' },
            { id: 'pending', label: 'Pending Review', color: 'text-warning-500' },
            { id: 'under_review', label: 'Under Review', color: 'text-brand-400' },
            { id: 'approved', label: 'Approved', color: 'text-success-500' },
            { id: 'rejected', label: 'Rejected', color: 'text-error-500' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setStatusFilter(pill.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                statusFilter === pill.id
                  ? 'bg-brand-500 text-white shadow-md'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border border-neutral-800'
              }`}
            >
              <span className={statusFilter === pill.id ? 'text-white' : pill.color}>{pill.label}</span> (
              {counts[pill.id] || 0})
            </button>
          ))}
        </div>

        {/* Search & Platform */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-1 border-t border-neutral-800">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by clipper username, video link, caption, or handle..."
              className="w-full pl-10 pr-10 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-brand-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400">Platform:</span>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs font-medium text-neutral-200 focus:outline-none focus:border-brand-500"
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
      <div className="glass-panel rounded-2xl border border-neutral-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-200">
            <thead className="bg-neutral-900/90 text-xs uppercase tracking-wider text-neutral-400 border-b border-neutral-800">
              <tr>
                <th className="px-4 py-3.5 font-semibold">ID / Date</th>
                <th className="px-4 py-3.5 font-semibold">Clipper</th>
                <th className="px-4 py-3.5 font-semibold">Platform &amp; Account</th>
                <th className="px-4 py-3.5 font-semibold">Video Link</th>
                <th className="px-4 py-3.5 font-semibold">Caption</th>
                <th className="px-4 py-3.5 font-semibold text-right">Views</th>
                <th className="px-4 py-3.5 font-semibold text-right">Payment ($)</th>
                <th className="px-4 py-3.5 font-semibold text-center">Status</th>
                <th className="px-5 py-3.5 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/80">
              {filteredSubs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-neutral-500">
                    No submissions found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredSubs.map((sub) => (
                  <tr key={sub.id} className="hover:bg-neutral-850/60 transition">
                    {/* ID & Date */}
                    <td className="px-4 py-3.5">
                      <div className="font-mono font-bold text-neutral-200 text-xs">#{sub.id}</div>
                      <div className="text-[11px] text-neutral-500">{formatDate(sub.submitted_at)}</div>
                    </td>

                    {/* Clipper */}
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-white text-xs">{sub.telegram_username}</div>
                      <div className="text-[10px] text-neutral-500 font-mono">Chat ID: {sub.chat_id}</div>
                    </td>

                    {/* Platform & Account */}
                    <td className="px-4 py-3.5">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-200">
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
                          className="text-brand-500 hover:text-brand-400 font-mono text-xs truncate underline"
                          title={sub.link}
                        >
                          {sub.link}
                        </a>
                        <button
                          onClick={() => onCopy(sub.link, 'Video Link')}
                          className="text-neutral-500 hover:text-neutral-300 shrink-0"
                          title="Copy Link"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Caption */}
                    <td className="px-4 py-3.5">
                      <div className="max-w-[200px] text-xs text-neutral-300 truncate" title={sub.caption || ''}>
                        {sub.caption ? <span className="italic">"{sub.caption}"</span> : <span className="text-neutral-600 italic">None</span>}
                      </div>
                    </td>

                    {/* Views */}
                    <td className="px-4 py-3.5 text-right font-mono font-semibold text-brand-400 text-xs">
                      {Number(sub.views || 0).toLocaleString()}
                    </td>

                    {/* Payment ($) - Paid: #6366F1 */}
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-paid-500 text-xs">
                      ${Number(sub.payment_amount || 0).toFixed(2)}
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3.5 text-center">{getStatusBadge(sub.status)}</td>

                    {/* Action */}
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => onEditSubmission(sub)}
                        className="px-3 py-1.5 rounded-xl bg-brand-500/20 hover:bg-brand-500 text-brand-400 hover:text-white text-xs font-semibold border border-brand-500/30 transition flex items-center gap-1.5 ml-auto shadow-sm"
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

        <div className="px-5 py-3 bg-neutral-900/60 border-t border-neutral-800 text-xs text-neutral-400 flex items-center justify-between">
          <span>Showing {filteredSubs.length} of {submissions.length} submissions</span>
          <span className="text-neutral-500">Edit views, payouts, captions, or status with instant bot notification</span>
        </div>
      </div>
    </section>
  );
}
