import React, { useState, useEffect } from 'react';
import { 
  Menu, 
  UserPlus, 
  FolderLock,
  UploadCloud,
  FolderPlus
} from 'lucide-react';
import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import DashboardMetrics from './components/DashboardMetrics';
import DocumentVault from './components/DocumentVault';
import DocumentUploadModal from './components/DocumentUploadModal';
import CreateFolderModal from './components/CreateFolderModal';
import UserDirectory from './components/UserDirectory';
import RegisterUserModal from './components/RegisterUserModal';
import AuditLogsView from './components/AuditLogsView';
import { api } from './services/api';

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [currentTab, setCurrentTab] = useState('vault'); // Default directly into Vault
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Modals state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

  // Data states
  const [usersList, setUsersList] = useState([]);
  const [foldersList, setFoldersList] = useState([]);
  const [documentsList, setDocumentsList] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Initialize auth from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('docvault_token');
    const savedUser = localStorage.getItem('docvault_user');
    if (savedToken && savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(parsed);
      } catch (e) {
        localStorage.clear();
      }
    }
  }, []);

  // Fetch folders & documents
  const fetchVaultData = async () => {
    if (!token) return;
    setLoadingDocs(true);
    try {
      const [foldersRes, docsRes] = await Promise.all([
        api.getFolders(token),
        api.getDocuments(token)
      ]);

      if (foldersRes.success) {
        setFoldersList(foldersRes.folders || []);
      }
      if (docsRes.success) {
        setDocumentsList(docsRes.documents || []);
      }
    } catch (err) {
      console.error('Failed to load vault data:', err);
    } finally {
      setLoadingDocs(false);
    }
  };

  // Fetch users if superadmin
  const fetchUsers = async () => {
    if (!token || user?.role !== 'superadmin') return;
    setLoadingUsers(true);
    try {
      const res = await api.getUsers(token);
      if (res.success) {
        setUsersList(res.users || []);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchVaultData();
      if (user?.role === 'superadmin') {
        fetchUsers();
      }
    }
  }, [token, user]);

  const handleLoginSuccess = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('docvault_token');
    localStorage.removeItem('docvault_user');
    setUser(null);
    setToken(null);
    setUsersList([]);
    setDocumentsList([]);
    setFoldersList([]);
  };

  const handleUserCreated = (newUser) => {
    setUsersList(prev => [newUser, ...prev]);
  };

  const handleDocumentUploaded = (newDoc) => {
    fetchVaultData();
  };

  const handleFolderCreated = (newFolder) => {
    setFoldersList(prev => [...prev, newFolder]);
  };

  if (!token || !user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const isSuperadmin = user.role === 'superadmin';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex">
      {/* Sidebar Component */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          if (tab === 'register') {
            setIsRegisterModalOpen(true);
          } else {
            setCurrentTab(tab);
          }
        }}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        user={user}
        onLogout={handleLogout}
        onOpenUpload={() => setIsUploadModalOpen(true)}
        onOpenCreateFolder={() => setIsFolderModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-72 flex flex-col min-h-screen">
        {/* Top Header Navbar */}
        <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-slate-900">
                DocVault Enterprise
              </span>
              <span className="hidden sm:inline-block text-slate-300">•</span>
              <span className={`hidden sm:inline-block text-xs font-mono px-2.5 py-0.5 rounded-full border ${
                isSuperadmin 
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold' 
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold'
              }`}>
                {isSuperadmin ? 'Superadmin Authority' : 'Authorized User Vault'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm shadow-indigo-600/20 transition-all"
            >
              <UploadCloud className="w-4 h-4" />
              <span className="hidden sm:inline">Upload Document</span>
              <span className="sm:hidden">Upload</span>
            </button>

            {isSuperadmin && (
              <button
                onClick={() => setIsRegisterModalOpen(true)}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200 transition-all shadow-2xs"
              >
                <UserPlus className="w-4 h-4 text-indigo-600" />
                <span>Register User</span>
              </button>
            )}

            <div className="h-6 w-px bg-slate-200 hidden sm:block" />

            {/* Profile Pill */}
            <div className="flex items-center gap-2.5 pl-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                {user.name?.charAt(0) || 'U'}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[120px]">
                  {user.name}
                </div>
                <div className="text-[10px] text-slate-500 capitalize">
                  {user.role}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Main Body Content */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'vault' && (
            <DocumentVault
              token={token}
              currentUser={user}
              folders={foldersList}
              documents={documentsList}
              loading={loadingDocs}
              onRefresh={fetchVaultData}
              onOpenUpload={() => setIsUploadModalOpen(true)}
              onOpenCreateFolder={() => setIsFolderModalOpen(true)}
            />
          )}

          {currentTab === 'dashboard' && (
            <DashboardMetrics
              users={usersList}
              documents={documentsList}
              folders={foldersList}
              currentUser={user}
              onOpenRegister={() => setIsRegisterModalOpen(true)}
              onOpenUpload={() => setIsUploadModalOpen(true)}
              onOpenCreateFolder={() => setIsFolderModalOpen(true)}
              setCurrentTab={setCurrentTab}
            />
          )}

          {currentTab === 'users' && isSuperadmin && (
            <UserDirectory
              users={usersList}
              loading={loadingUsers}
              onRefresh={fetchUsers}
              onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
              token={token}
              currentAdminId={user.id}
            />
          )}

          {currentTab === 'logs' && isSuperadmin && (
            <AuditLogsView token={token} />
          )}
        </main>

        {/* Global Modals */}
        <DocumentUploadModal
          token={token}
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          folders={foldersList}
          onDocumentUploaded={handleDocumentUploaded}
        />

        <CreateFolderModal
          token={token}
          isOpen={isFolderModalOpen}
          onClose={() => setIsFolderModalOpen(false)}
          onFolderCreated={handleFolderCreated}
        />

        {isSuperadmin && (
          <RegisterUserModal
            token={token}
            isOpen={isRegisterModalOpen}
            onClose={() => setIsRegisterModalOpen(false)}
            onUserCreated={handleUserCreated}
          />
        )}
      </div>
    </div>
  );
}
