import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import StatsCards from './components/StatsCards';
import UsersManager from './components/UsersManager';
import SubmissionsManager from './components/SubmissionsManager';
import EditUserModal from './components/EditUserModal';
import EditSocialModal from './components/EditSocialModal';
import EditSubmissionModal from './components/EditSubmissionModal';
import LoginModal from './components/LoginModal';
import Toast from './components/Toast';
import { AdminAPI } from './api';
import { Users, Video } from 'lucide-react';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('clipper_admin_token') || '');
  const [isLoginOpen, setIsLoginOpen] = useState(!token);
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'submissions'
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('Just now');

  // Data states
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [toasts, setToasts] = useState([]);

  // Modal states
  const [editingUser, setEditingUser] = useState(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  const [editingSocial, setEditingSocial] = useState(null);
  const [socialChatId, setSocialChatId] = useState(null);
  const [isSocialModalOpen, setIsSocialModalOpen] = useState(false);

  const [editingSubmission, setEditingSubmission] = useState(null);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);

  // Toast trigger
  const addToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const copyToClipboard = (text, label = 'Copied') => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      addToast(`${label} copied to clipboard!`, 'info');
    });
  };

  // Load all data
  const loadData = useCallback(async () => {
    if (!localStorage.getItem('clipper_admin_token')) return;
    setIsRefreshing(true);
    try {
      const [sData, uData, subData] = await Promise.all([
        AdminAPI.getStats(),
        AdminAPI.getUsers(),
        AdminAPI.getSubmissions(),
      ]);
      setStats(sData || {});
      setUsers(uData || []);
      setSubmissions(subData || []);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error('Load data error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Listen for 401 unauthorized
  useEffect(() => {
    const handleUnauthorized = () => {
      setToken('');
      setIsLoginOpen(true);
      addToast('Session expired. Please log in again.', 'error');
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  // Initial load
  useEffect(() => {
    if (token) {
      AdminAPI.verifyMe()
        .then(() => {
          setIsLoginOpen(false);
          loadData();
        })
        .catch(() => {
          setIsLoginOpen(true);
        });
    } else {
      setIsLoginOpen(true);
    }
  }, [token, loadData]);

  // Auto refresh timer
  useEffect(() => {
    if (!autoRefresh || !token) return;
    const interval = setInterval(() => {
      loadData();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, token, loadData]);

  // Login handler
  const handleLogin = async (password) => {
    const res = await AdminAPI.login(password);
    if (res.success && res.token) {
      localStorage.setItem('clipper_admin_token', res.token);
      setToken(res.token);
      setIsLoginOpen(false);
      addToast('Admin portal unlocked!', 'success');
      loadData();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('clipper_admin_token');
    setToken('');
    setIsLoginOpen(true);
    addToast('Logged out of admin portal', 'info');
  };

  // --- USER ACTIONS ---
  const handleEditUser = (user) => {
    setEditingUser(user);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (chatId, data) => {
    await AdminAPI.updateUser(chatId, data);
    addToast('User data updated successfully!', 'success');
    loadData();
  };

  const handleDeleteUser = async (chatId) => {
    await AdminAPI.deleteUser(chatId);
    addToast('User deleted from database', 'info');
    loadData();
  };

  // --- SOCIAL ACTIONS ---
  const handleAddSocial = (chatId) => {
    setEditingSocial(null);
    setSocialChatId(chatId);
    setIsSocialModalOpen(true);
  };

  const handleEditSocial = (account, chatId) => {
    setEditingSocial(account);
    setSocialChatId(chatId);
    setIsSocialModalOpen(true);
  };

  const handleSaveSocial = async (data) => {
    if (editingSocial) {
      await AdminAPI.updateSocial(editingSocial.id, data);
      addToast(`Updated ${data.platform} account (${data.handle})`, 'success');
    } else {
      await AdminAPI.addSocial(socialChatId, data);
      addToast(`Added ${data.platform} account (${data.handle})`, 'success');
    }
    loadData();
  };

  const handleDeleteSocial = async (accountId) => {
    await AdminAPI.deleteSocial(accountId);
    addToast('Social account deleted', 'info');
    loadData();
  };

  // --- SUBMISSION ACTIONS ---
  const handleEditSubmission = (sub) => {
    setEditingSubmission(sub);
    setIsSubModalOpen(true);
  };

  const handleSaveSubmission = async (id, data) => {
    await AdminAPI.updateSubmission(id, data);
    addToast(`Submission #${id} updated: ${data.views.toLocaleString()} views, $${data.payment_amount.toFixed(2)}`, 'success');
    loadData();
  };

  const handleDeleteSubmission = async (id) => {
    await AdminAPI.deleteSubmission(id);
    addToast(`Submission #${id} deleted`, 'info');
    loadData();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f19] text-slate-100">
      <Navbar onRefresh={loadData} onLogout={handleLogout} isRefreshing={isRefreshing} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* KPI Metrics Banner */}
        <StatsCards
          stats={stats}
          onPendingClick={() => {
            setActiveTab('submissions');
          }}
        />

        {/* Tab Switcher & Auto-refresh status */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
                activeTab === 'users'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Clippers &amp; Accounts</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-900/60 text-xs">{users.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('submissions')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
                activeTab === 'submissions'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Submissions Review</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-900/60 text-xs">{submissions.length}</span>
              {stats.pending_submissions > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-bold">
                  {stats.pending_submissions}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 self-end sm:self-auto">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
              />
              <span>Auto-refresh (30s)</span>
            </label>
            <span className="text-slate-600">•</span>
            <span>Updated {lastUpdated}</span>
          </div>
        </div>

        {/* Tab 1: Clippers */}
        {activeTab === 'users' && (
          <UsersManager
            users={users}
            onEditUser={handleEditUser}
            onEditSocial={handleEditSocial}
            onAddSocial={handleAddSocial}
            onViewSubmissions={(uname) => {
              setActiveTab('submissions');
            }}
            onCopy={copyToClipboard}
          />
        )}

        {/* Tab 2: Submissions */}
        {activeTab === 'submissions' && (
          <SubmissionsManager
            submissions={submissions}
            onEditSubmission={handleEditSubmission}
            onCopy={copyToClipboard}
          />
        )}
      </main>

      {/* MODALS */}
      <LoginModal isOpen={isLoginOpen} onLogin={handleLogin} />

      <EditUserModal
        isOpen={isUserModalOpen}
        user={editingUser}
        onClose={() => setIsUserModalOpen(false)}
        onSave={handleSaveUser}
        onDelete={handleDeleteUser}
      />

      <EditSocialModal
        isOpen={isSocialModalOpen}
        account={editingSocial}
        chatId={socialChatId}
        onClose={() => setIsSocialModalOpen(false)}
        onSave={handleSaveSocial}
        onDelete={handleDeleteSocial}
      />

      <EditSubmissionModal
        isOpen={isSubModalOpen}
        submission={editingSubmission}
        onClose={() => setIsSubModalOpen(false)}
        onSave={handleSaveSubmission}
        onDelete={handleDeleteSubmission}
      />

      {/* Toast Alerts */}
      <Toast toasts={toasts} />
    </div>
  );
}
