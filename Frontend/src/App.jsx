import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import StatsCards from './components/StatsCards';
import UsersManager from './components/UsersManager';
import SubmissionsManager from './components/SubmissionsManager';
import EditSocialModal from './components/EditSocialModal';
import EditSubmissionModal from './components/EditSubmissionModal';
import RatesModal from './components/RatesModal';
import SendMessageModal from './components/SendMessageModal';
import LoginModal from './components/LoginModal';
import Toast from './components/Toast';
import { AdminAPI } from './api';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('clipper_admin_token') || '');
  const [isLoginOpen, setIsLoginOpen] = useState(!token);
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'submissions'
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('Just now');

  // Single user submission filter state
  const [selectedUserForSubmissions, setSelectedUserForSubmissions] = useState(null);

  // Messaging modal state
  const [messagingTargetUser, setMessagingTargetUser] = useState(null);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);

  // Data states
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [rates, setRates] = useState({ youtube: 60, tiktok: 60, twitter: 45, instagram: 40 });
  const [toasts, setToasts] = useState([]);

  // Modal states
  const [editingUser, setEditingUser] = useState(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  const [editingSocial, setEditingSocial] = useState(null);
  const [socialChatId, setSocialChatId] = useState(null);
  const [isSocialModalOpen, setIsSocialModalOpen] = useState(false);

  const [editingSubmission, setEditingSubmission] = useState(null);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);

  const [isRatesModalOpen, setIsRatesModalOpen] = useState(false);

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
      const [sData, uData, subData, rData] = await Promise.all([
        AdminAPI.getStats(),
        AdminAPI.getUsers(),
        AdminAPI.getSubmissions(),
        AdminAPI.getRates().catch(() => null),
      ]);
      setStats(sData || {});
      setUsers(uData || []);
      setSubmissions(subData || []);
      if (rData?.rates) setRates(rData.rates);
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

  const handleChangePassword = async (currentPassword, newPassword) => {
    const res = await AdminAPI.changePassword(currentPassword, newPassword);
    if (res.success && res.token) {
      localStorage.setItem('clipper_admin_token', res.token);
      setToken(res.token);
      setIsLoginOpen(false);
      addToast('Master admin password updated and portal unlocked!', 'success');
      loadData();
    }
    return res;
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
    addToast(`Submission #${id} updated: ${data.views.toLocaleString()} views, ${data.payment_amount.toFixed(2)} ETB`, 'success');
    loadData();
  };

  const handleDeleteSubmission = async (id) => {
    await AdminAPI.deleteSubmission(id);
    addToast(`Submission #${id} deleted`, 'info');
    loadData();
  };

  // --- TELEGRAM MESSAGING (SINGLE & BROADCAST) ---
  const handleSendMessage = async (payload) => {
    const res = await AdminAPI.sendMessage(payload);
    if (res.target === 'single') {
      addToast('Telegram message delivered successfully!', 'success');
    } else {
      addToast(
        `Broadcast sent: ${res.sent} delivered, ${res.failed} failed out of ${res.total} clippers.`,
        res.failed > 0 ? 'info' : 'success'
      );
    }
  };

  const handleOpenBroadcast = () => {
    setMessagingTargetUser(null);
    setIsMessageModalOpen(true);
  };

  const handleOpenUserMessage = (user) => {
    setMessagingTargetUser(user);
    setIsMessageModalOpen(true);
  };

  const handleViewUserSubmissions = (user) => {
    setSelectedUserForSubmissions(user);
    setActiveTab('submissions');
  };

  const handleSaveRates = async (newRates) => {
    try {
      const res = await AdminAPI.updateRates(newRates);
      if (res?.rates) setRates(res.rates);
      addToast('Platform payout rates updated successfully!', 'success');
    } catch (err) {
      addToast('Failed to update platform rates.', 'error');
      throw err;
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-start bg-page-background text-default-font">
      <Navbar
        onRefresh={loadData}
        onLogout={handleLogout}
        onOpenBroadcast={handleOpenBroadcast}
        onOpenRates={() => setIsRatesModalOpen(true)}
        isRefreshing={isRefreshing}
      />

      <main className="flex w-full flex-col items-start gap-5 px-4 sm:px-12 lg:px-20 py-6">
        {/* KPI Metrics Banner */}
        <StatsCards
          stats={stats}
          onPendingClick={() => {
            setSelectedUserForSubmissions(null);
            setActiveTab('submissions');
          }}
        />

        {/* Tab Bar matching ClipperAdminHub mockup */}
        <div className="flex w-full items-center justify-between border-b border-solid border-neutral-border pb-px">
          <div className="flex items-center gap-6">
            <div
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 pb-3 -mb-px cursor-pointer transition ${
                activeTab === 'users'
                  ? 'border-b-2 border-solid border-brand-primary'
                  : 'hover:text-default-font'
              }`}
            >
              <span
                className={
                  activeTab === 'users'
                    ? 'text-body-bold font-body-bold text-brand-primary'
                    : 'text-body font-body text-neutral-500'
                }
              >
                Clippers &amp; accounts
              </span>
              <div
                className={`flex items-center rounded-full px-2 py-0.5 ${
                  activeTab === 'users' ? 'bg-brand-50' : 'bg-neutral-100'
                }`}
              >
                <span
                  className={
                    activeTab === 'users'
                      ? 'text-caption-bold font-caption-bold text-brand-primary'
                      : 'text-caption font-caption text-neutral-600'
                  }
                >
                  {users.length}
                </span>
              </div>
            </div>

            <div
              onClick={() => setActiveTab('submissions')}
              className={`flex items-center gap-2 pb-3 -mb-px cursor-pointer transition ${
                activeTab === 'submissions'
                  ? 'border-b-2 border-solid border-brand-primary'
                  : 'hover:text-default-font'
              }`}
            >
              <span
                className={
                  activeTab === 'submissions'
                    ? 'text-body-bold font-body-bold text-brand-primary'
                    : 'text-body font-body text-neutral-500'
                }
              >
                Submissions review
              </span>
              <div
                className={`flex items-center rounded-full px-2 py-0.5 ${
                  activeTab === 'submissions' ? 'bg-brand-50' : 'bg-neutral-100'
                }`}
              >
                <span
                  className={
                    activeTab === 'submissions'
                      ? 'text-caption-bold font-caption-bold text-brand-primary'
                      : 'text-caption font-caption text-neutral-600'
                  }
                >
                  {submissions.length}
                </span>
              </div>
              {stats.pending_submissions > 0 && (
                <div
                  className="h-1.5 w-1.5 rounded-full bg-amber-500"
                  title={`${stats.pending_submissions} pending review`}
                />
              )}
              {selectedUserForSubmissions && (
                <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-primary text-caption font-caption border border-brand-200">
                  Filtered: {selectedUserForSubmissions.telegram_username || selectedUserForSubmissions.chat_id}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pb-3">
            <div
              className={`h-2 w-2 rounded-full ${
                autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-neutral-300'
              }`}
            />
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="text-caption font-caption text-subtext-color hover:text-default-font cursor-pointer flex items-center gap-1.5"
              title="Click to toggle auto-refresh"
            >
              <span>{autoRefresh ? 'Auto-refresh every 30s' : 'Auto-refresh paused'}</span>
              <span>·</span>
              <span>updated {lastUpdated}</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Clippers */}
        {activeTab === 'users' && (
          <UsersManager
            users={users}
            onDeleteUser={(user) => {
              if (window.confirm(`Are you sure you want to delete clipper ${user.telegram_username || user.chat_id}? This will also delete their submissions and linked accounts.`)) {
                handleDeleteUser(user.chat_id);
              }
            }}
            onViewSubmissions={handleViewUserSubmissions}
            onSendMessage={handleOpenUserMessage}
            onCopy={copyToClipboard}
          />
        )}

        {/* Tab 2: Submissions */}
        {activeTab === 'submissions' && (
          <SubmissionsManager
            submissions={submissions}
            onEditSubmission={handleEditSubmission}
            onCopy={copyToClipboard}
            selectedUser={selectedUserForSubmissions}
            onClearSelectedUser={() => setSelectedUserForSubmissions(null)}
          />
        )}
      </main>

      {/* MODALS */}
      <LoginModal
        isOpen={isLoginOpen}
        onLogin={handleLogin}
        onChangePassword={handleChangePassword}
      />

      <SendMessageModal
        isOpen={isMessageModalOpen}
        targetUser={messagingTargetUser}
        onClose={() => setIsMessageModalOpen(false)}
        onSend={handleSendMessage}
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
        rates={rates}
        onClose={() => setIsSubModalOpen(false)}
        onSave={handleSaveSubmission}
        onDelete={handleDeleteSubmission}
      />

      <RatesModal
        isOpen={isRatesModalOpen}
        rates={rates}
        onClose={() => setIsRatesModalOpen(false)}
        onSave={handleSaveRates}
      />

      {/* Toast Alerts */}
      <Toast toasts={toasts} />
    </div>
  );
}
