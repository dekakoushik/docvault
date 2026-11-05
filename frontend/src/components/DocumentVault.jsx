import React, { useState } from 'react';
import { 
  Folder, 
  FolderPlus, 
  UploadCloud, 
  FileText, 
  Search, 
  Eye, 
  Download, 
  Trash2, 
  Calendar, 
  Tag, 
  Clock, 
  AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';

export default function DocumentVault({ 
  token, 
  currentUser, 
  folders, 
  documents, 
  loading, 
  onRefresh, 
  onOpenUpload, 
  onOpenCreateFolder 
}) {
  const [selectedFolder, setSelectedFolder] = useState('ALL');
  const [selectedDocType, setSelectedDocType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [deletingFolderId, setDeletingFolderId] = useState(null);

  const isSuperadmin = currentUser?.role === 'superadmin';

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileBadgeColor = (mime, type) => {
    if (mime?.includes('pdf')) return 'bg-rose-50 text-rose-600 border-rose-200';
    if (mime?.includes('image')) return 'bg-emerald-50 text-emerald-600 border-emerald-200';
    if (mime?.includes('word') || mime?.includes('document')) return 'bg-blue-50 text-blue-600 border-blue-200';
    if (mime?.includes('sheet') || mime?.includes('excel')) return 'bg-teal-50 text-teal-600 border-teal-200';
    return 'bg-indigo-50 text-indigo-600 border-indigo-200';
  };

  const isExpiringSoon = (dateStr) => {
    if (!dateStr) return false;
    const diffTime = new Date(dateStr) - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  };

  const isExpired = (dateStr) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesFolder = selectedFolder === 'ALL' || String(doc.folder_id) === String(selectedFolder);
    const matchesType = selectedDocType === 'ALL' || doc.doc_type === selectedDocType;
    const matchesSearch = 
      doc.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.original_filename?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.uploader_name?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFolder && matchesType && matchesSearch;
  });

  const handleDelete = async (doc) => {
    if (confirm(`Are you sure you want to delete "${doc.name}" from the Vault?`)) {
      setDeletingId(doc.id);
      try {
        await api.deleteDocument(token, doc.id);
        onRefresh();
      } catch (err) {
        alert('Failed to delete document: ' + err.message);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleDeleteFolder = async (e, folder) => {
    e.stopPropagation();
    if (!isSuperadmin) {
      alert('Only Superadmin can delete folders.');
      return;
    }

    if (confirm(`Are you sure you want to delete folder "${folder.name}"? Documents in this folder will be kept safely in the root Vault.`)) {
      setDeletingFolderId(folder.id);
      try {
        const res = await api.deleteFolder(token, folder.id);
        if (!res.success) {
          throw new Error(res.message || 'Failed to delete folder');
        }
        if (selectedFolder === folder.id) {
          setSelectedFolder('ALL');
        }
        onRefresh();
      } catch (err) {
        alert('Failed to delete folder: ' + err.message);
      } finally {
        setDeletingFolderId(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Enterprise Document Vault</h2>
            <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2.5 py-0.5 rounded-full border border-indigo-200">
              {documents.length} secured files
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Centralized document repository for Superadmin & authorized users. Categorize, track renewal dates, and view any file.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={onOpenCreateFolder}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold border border-slate-200 transition-all shadow-2xs"
          >
            <FolderPlus className="w-4 h-4 text-amber-500" />
            <span>Create Folder</span>
          </button>

          <button
            onClick={onOpenUpload}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-sm shadow-indigo-600/20 transition-all"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* Folders Bar */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
            <Folder className="w-3.5 h-3.5 text-amber-500" />
            <span>Vault Folders</span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">{folders.length} Folders Available</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <button
            onClick={() => setSelectedFolder('ALL')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              selectedFolder === 'ALL'
                ? 'bg-indigo-50/70 border-indigo-300 text-indigo-900 shadow-xs'
                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <Folder className={`w-5 h-5 ${selectedFolder === 'ALL' ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-semibold">
                {documents.length}
              </span>
            </div>
            <p className="text-xs font-bold mt-2 truncate">All Vault Files</p>
          </button>

          {folders.map((folder) => {
            const isSelected = String(selectedFolder) === String(folder.id);
            const isDeletingThisFolder = deletingFolderId === folder.id;

            return (
              <div
                key={folder.id}
                onClick={() => setSelectedFolder(folder.id)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative group ${
                  isSelected
                    ? 'bg-amber-50/70 border-amber-300 text-amber-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Folder className={`w-5 h-5 ${isSelected ? 'text-amber-600' : 'text-amber-500'}`} />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-semibold">
                      {folder.doc_count || 0}
                    </span>
                    {/* Superadmin Delete Folder Button */}
                    {isSuperadmin && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteFolder(e, folder)}
                        disabled={isDeletingThisFolder}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-rose-500 hover:text-white hover:bg-rose-500 transition-all"
                        title="Delete folder (Superadmin)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs font-bold mt-2 truncate">{folder.name}</p>
                {folder.description ? (
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{folder.description}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-2xs">
        <div className="relative w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents, file names, notes..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedDocType}
            onChange={(e) => setSelectedDocType(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 flex-1 sm:flex-none"
          >
            <option value="ALL">All Categories</option>
            <option value="Contract">Contract</option>
            <option value="Agreement">Agreement / NDA</option>
            <option value="Policy / Compliance">Policy / Compliance</option>
            <option value="License / Certificate">License / Certificate</option>
            <option value="Invoice / Financial">Invoice / Financial</option>
            <option value="Identity / KYC">Identity / KYC</option>
            <option value="Technical Spec">Technical Spec</option>
            <option value="General">General</option>
          </select>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading documents from Vault...</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileText className="w-8 h-8 mx-auto mb-3 text-slate-300" />
            <p className="text-base font-semibold text-slate-700">No documents found in this view</p>
            <p className="text-xs text-slate-500 mt-1">
              Upload a document or choose a different folder/filter above.
            </p>
            <button
              onClick={onOpenUpload}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs"
            >
              <UploadCloud className="w-4 h-4" />
              Upload Now
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">Document Details</th>
                  <th className="py-3.5 px-4">Type & Folder</th>
                  <th className="py-3.5 px-4">Renewal Date</th>
                  <th className="py-3.5 px-4">Uploaded By</th>
                  <th className="py-3.5 px-4">Size</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredDocuments.map((doc) => {
                  const expiring = isExpiringSoon(doc.renewal_date);
                  const expired = isExpired(doc.renewal_date);
                  const canDelete = currentUser?.role === 'superadmin' || doc.uploaded_by === currentUser?.id;
                  const isDeleting = deletingId === doc.id;

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Name & Original file */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${getFileBadgeColor(doc.mime_type, doc.doc_type)}`}>
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-2">
                              {doc.name}
                            </div>
                            <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                              <span>{doc.original_filename}</span>
                            </div>
                            {doc.description && (
                              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 italic">
                                "{doc.description}"
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Type & Folder */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            <Tag className="w-3 h-3 text-slate-400" />
                            {doc.doc_type}
                          </span>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Folder className="w-3 h-3 text-amber-500" />
                            <span>{doc.folder_name || 'Root Vault'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Renewal Date */}
                      <td className="py-3.5 px-4">
                        {doc.renewal_date ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-700">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>{doc.renewal_date}</span>
                            </div>
                            {expired ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                <AlertTriangle className="w-3 h-3" /> Expired
                              </span>
                            ) : expiring ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                <Clock className="w-3 h-3" /> Due Soon
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">Valid</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">None set</span>
                        )}
                      </td>

                      {/* Uploaded By */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs text-slate-800 font-medium">
                          {doc.uploader_name || 'User'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </div>
                      </td>

                      {/* File Size */}
                      <td className="py-3.5 px-4 text-xs font-mono text-slate-500">
                        {formatFileSize(doc.file_size)}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View document inline */}
                          <a
                            href={api.getViewUrl(doc.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                            title="View / Preview Document"
                          >
                            <Eye className="w-4 h-4" />
                          </a>

                          {/* Download document file */}
                          <a
                            href={api.getDownloadUrl(doc.id)}
                            className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors"
                            title="Download Document"
                          >
                            <Download className="w-4 h-4" />
                          </a>

                          {/* Delete Document */}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(doc)}
                              disabled={isDeleting}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-colors disabled:opacity-50"
                              title="Delete Document"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
