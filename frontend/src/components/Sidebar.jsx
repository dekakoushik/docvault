import React from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Activity, 
  FileText, 
  LogOut, 
  X, 
  ChevronRight,
  Database,
  FolderLock,
  UploadCloud,
  FolderPlus
} from 'lucide-react';

export default function Sidebar({ 
  currentTab, 
  setCurrentTab, 
  isOpen, 
  setIsOpen, 
  user, 
  onLogout,
  onOpenUpload,
  onOpenCreateFolder
}) {
  const isSuperadmin = user?.role === 'superadmin';

  const navItems = [
    { id: 'vault', label: 'Document Vault', icon: FolderLock },
    { id: 'dashboard', label: 'Overview & Metrics', icon: Activity },
    ...(isSuperadmin ? [
      { id: 'users', label: 'User Directory', icon: Users },
      { id: 'register', label: 'Register New User', icon: UserPlus },
      { id: 'logs', label: 'Security & Audit Logs', icon: FileText },
    ] : [])
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-white border-r border-slate-200/90 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Area */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-600/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-bold text-base text-slate-900 tracking-tight flex items-center gap-2">
                DocVault
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                  isSuperadmin 
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {isSuperadmin ? 'ADMIN' : 'VAULT'}
                </span>
              </div>
              <p className="text-xs text-slate-500">Document Management</p>
            </div>
          </div>
          
          {/* Close button for mobile */}
          <button 
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Card */}
        <div className="px-5 py-4 mx-3 my-3 rounded-xl bg-slate-50 border border-slate-200/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm border border-indigo-200">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{user?.name || 'User'}</p>
              <p className="text-[11px] text-slate-500 truncate font-mono">{user?.email}</p>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1.5 capitalize font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {user?.role}
            </span>
            <span className="text-slate-400 font-mono text-[10px]">{user?.department || 'General'}</span>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="px-4 py-2 space-y-2">
          <button
            onClick={() => {
              onOpenUpload();
              setIsOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Document</span>
          </button>

          <button
            onClick={() => {
              onOpenCreateFolder();
              setIsOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 hover:border-slate-300 transition-all"
          >
            <FolderPlus className="w-4 h-4 text-amber-500" />
            <span>New Folder</span>
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Management & Vault
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentTab(item.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/70 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {active && <ChevronRight className="w-4 h-4 text-indigo-500" />}
              </button>
            );
          })}
        </div>

        {/* Footer Area */}
        <div className="p-4 border-t border-slate-100 space-y-2">
          <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/60 text-[11px] text-slate-600">
            <div className="flex items-center gap-2 text-slate-800 font-semibold mb-0.5">
              <Database className="w-3.5 h-3.5 text-indigo-600" />
              <span>DocVault Backend</span>
            </div>
            <p className="text-[10px] text-slate-400">Port 5000 • .agent log active</p>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out Session</span>
          </button>
        </div>
      </aside>
    </>
  );
}
