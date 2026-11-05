import React from 'react';
import { 
  Users, 
  ShieldCheck, 
  FolderLock, 
  FileText, 
  PlusCircle, 
  UploadCloud, 
  FolderPlus, 
  Clock, 
  Calendar,
  ArrowRight
} from 'lucide-react';

export default function DashboardMetrics({ 
  users, 
  documents = [], 
  folders = [],
  currentUser,
  onOpenRegister, 
  onOpenUpload, 
  onOpenCreateFolder,
  setCurrentTab 
}) {
  const isSuperadmin = currentUser?.role === 'superadmin';
  const totalUsers = users.length;
  const totalDocs = documents.length;
  const totalFolders = folders.length;

  const expiringCount = documents.filter(d => {
    if (!d.renewal_date) return false;
    const diffDays = Math.ceil((new Date(d.renewal_date) - new Date()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  }).length;

  const statCards = [
    {
      title: 'Secured Documents',
      value: totalDocs,
      desc: 'All file types preserved in vault',
      icon: FolderLock,
      bg: 'bg-blue-50 text-blue-600 border-blue-200',
      badge: 'Protected'
    },
    {
      title: 'Active Folders',
      value: totalFolders,
      desc: 'Vault repositories & categories',
      icon: FolderPlus,
      bg: 'bg-amber-50 text-amber-600 border-amber-200',
      badge: `${totalFolders} Active`
    },
    {
      title: 'Renewals Due (30d)',
      value: expiringCount,
      desc: 'Contracts & licenses nearing renewal',
      icon: Clock,
      bg: 'bg-rose-50 text-rose-600 border-rose-200',
      badge: expiringCount > 0 ? 'Action Needed' : 'All Clear'
    },
    {
      title: 'Registered Users',
      value: totalUsers,
      desc: 'Users with vault access',
      icon: Users,
      bg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      badge: 'Active Accounts'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-50/80 via-white to-blue-50/50 border border-indigo-100 p-6 sm:p-8 shadow-sm">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            DocVault Enterprise Document Vault
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Hello, {currentUser?.name || 'Vault User'}
          </h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Welcome to your centralized Document Vault. You can upload any document type (PDF, Office, Images, Archives), create organized folders, track renewal dates, and view or download files anytime.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenUpload}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-sm shadow-indigo-600/20 transition-all"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Document</span>
            </button>
            <button
              onClick={onOpenCreateFolder}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm border border-slate-200 transition-all shadow-2xs"
            >
              <FolderPlus className="w-4 h-4 text-amber-500" />
              <span>Create Folder</span>
            </button>
            {isSuperadmin && (
              <button
                onClick={onOpenRegister}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-indigo-700 font-semibold text-xs sm:text-sm border border-indigo-200 transition-all"
              >
                <PlusCircle className="w-4 h-4 text-indigo-600" />
                <span>Register User</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {card.title}
                </span>
                <div className={`p-2.5 rounded-xl border ${card.bg}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {card.value}
                </span>
                <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-semibold">
                  {card.badge}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 truncate">{card.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Vault Preview & Recent Documents */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">Recent Vault Activity</h3>
            <span className="text-xs text-slate-400 font-mono">Latest 5 Files</span>
          </div>
          <button
            onClick={() => setCurrentTab('vault')}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1"
          >
            <span>Open Document Vault</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            No documents uploaded yet. Click "Upload Document" to secure your first file.
          </div>
        ) : (
          <div className="space-y-2">
            {documents.slice(0, 5).map((doc) => (
              <div
                key={doc.id}
                className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between hover:bg-slate-50 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{doc.name}</p>
                    <p className="text-[11px] text-slate-500 font-mono truncate">
                      {doc.original_filename} • {doc.doc_type}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  {doc.renewal_date && (
                    <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1 font-mono font-medium">
                      <Calendar className="w-3 h-3 text-amber-500" /> {doc.renewal_date}
                    </span>
                  )}
                  <span className="text-slate-400 hidden sm:inline text-xs">by {doc.uploader_name}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
