import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Sparkles, 
  Send, 
  UploadCloud, 
  FolderPlus, 
  Search, 
  FileText, 
  Folder, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ArrowRight,
  Eye,
  Download
} from 'lucide-react';
import { api } from '../services/api';

export default function AIAssistantView({ token, currentUser, onRefreshVault, onSelectFolder }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: `Hello ${currentUser?.name || 'there'}! I am **DocVault AI** — your intelligent document automation copilot.\n\n` +
            `You can talk to me naturally, or drop documents below for **Zero-Click Auto-Organization**:\n` +
            `• *"Create subfolder Invoices 2026 under Finance"*\n` +
            `• *"Search NDA agreements"*\n` +
            `• *"Find contracts expiring soon"*\n` +
            `• **Drag & drop any file**: I will automatically analyze its contents, create categorized folders/subfolders, and set renewal date reminders.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputPrompt.trim() || loading) return;

    const userText = inputPrompt.trim();
    setInputPrompt('');

    const newMsg = {
      id: Date.now(),
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, newMsg]);
    setLoading(true);

    try {
      const res = await api.aiChat(token, userText);
      if (!res.success) {
        throw new Error(res.message || 'AI failed to process request');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: res.reply,
          actions: res.actions || [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

      if (res.actions?.some(a => a.type === 'FOLDER_CREATED')) {
        onRefreshVault();
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: `⚠️ Error: ${err.message}`,
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleDirectFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setUploadStatus({ type: 'info', message: `Analyzing "${file.name}" with AI categorization engine...` });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('prompt', 'Auto-detect category and renewal date');

      const res = await api.aiAutoUpload(token, formData);
      if (!res.success) {
        throw new Error(res.message || 'Auto-upload failed');
      }

      setUploadStatus({
        type: 'success',
        message: res.message,
        analysis: res.aiAnalysis
      });

      // Also append bot message in conversation
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: 'bot',
          text: `🎉 **Document Auto-Organized!**\n\n` +
                `• **File**: \`${res.document.original_filename}\`\n` +
                `• **Category**: **${res.aiAnalysis?.category}**\n` +
                `• **Organized into**: 📁 **${res.aiAnalysis?.folder}**\n` +
                (res.aiAnalysis?.renewalDate ? `• **Renewal Reminder**: 📅 **${res.aiAnalysis.renewalDate}**\n` : '') +
                `\n${res.aiAnalysis?.summary || ''}`,
          document: res.document,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

      onRefreshVault();
    } catch (err) {
      setUploadStatus({ type: 'error', message: err.message });
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-indigo-200 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>DocVault Enterprise Autonomous Copilot</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              AI Vault Organizer & Agent
            </h2>
            <p className="text-sm text-indigo-100/90 leading-relaxed">
              Upload any document directly and let the AI deduce the category, generate subfolders, set renewal dates, or manage vault items via natural commands.
            </p>
          </div>

          {/* Direct AI Upload Trigger */}
          <div className="flex-shrink-0">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleDirectFileUpload} 
              className="hidden" 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-50 text-indigo-900 font-bold text-sm shadow-lg shadow-black/10 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {uploadingFile ? (
                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <UploadCloud className="w-5 h-5 text-indigo-600" />
              )}
              <span>{uploadingFile ? 'AI Organizing...' : 'Upload & Auto-Organize'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Upload Status Card if active */}
      {uploadStatus && (
        <div className={`p-4 rounded-2xl border text-sm flex items-start gap-3 transition-all ${
          uploadStatus.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
          uploadStatus.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
          'bg-indigo-50 border-indigo-200 text-indigo-800'
        }`}>
          {uploadStatus.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : uploadStatus.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          ) : (
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mt-1 flex-shrink-0" />
          )}
          <div className="flex-1">
            <p className="font-semibold">{uploadStatus.message}</p>
            {uploadStatus.analysis && (
              <div className="mt-2 text-xs grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white/70 p-2.5 rounded-xl border border-emerald-100">
                <div><span className="text-slate-400 font-medium">Category:</span> <span className="font-bold text-slate-800">{uploadStatus.analysis.category}</span></div>
                <div><span className="text-slate-400 font-medium">Folder:</span> <span className="font-bold text-slate-800">{uploadStatus.analysis.folder}</span></div>
                <div><span className="text-slate-400 font-medium">Renewal:</span> <span className="font-bold text-slate-800">{uploadStatus.analysis.renewalDate || 'None'}</span></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Chat Interface */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col h-[600px] overflow-hidden">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">DocVault AI Assistant</h3>
              <p className="text-[11px] text-slate-500">Autonomous vault command & search engine</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active & Ready</span>
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'bot' && (
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 text-xs shadow-sm shadow-indigo-600/20">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-2xl rounded-2xl p-4 text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : msg.isError
                  ? 'bg-rose-50 border border-rose-200 text-rose-800'
                  : 'bg-slate-50 border border-slate-200/80 text-slate-800'
              }`}>
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* Render Action Result Items if Search or Create */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-2">
                    {msg.actions.map((act, idx) => (
                      <div key={idx} className="space-y-2">
                        {/* Folders found / created */}
                        {act.folders && act.folders.length > 0 && (
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Folders:</p>
                            <div className="flex flex-wrap gap-2">
                              {act.folders.map(f => (
                                <button
                                  key={f.id}
                                  onClick={() => onSelectFolder && onSelectFolder(f.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold hover:bg-amber-100"
                                >
                                  <Folder className="w-3.5 h-3.5 text-amber-600" />
                                  <span>{f.name} ({f.doc_count || 0})</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Documents found */}
                        {act.documents && act.documents.length > 0 && (
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Documents:</p>
                            <div className="space-y-1.5">
                              {act.documents.map(d => (
                                <div key={d.id} className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 text-xs">
                                  <div className="flex items-center gap-2 truncate pr-2">
                                    <FileText className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                                    <span className="font-semibold text-slate-800 truncate">{d.name}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">({d.doc_type})</span>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <a 
                                      href={api.getViewUrl(d.id)} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      className="p-1 rounded text-indigo-600 hover:bg-indigo-50"
                                      title="View"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </a>
                                    <a 
                                      href={api.getDownloadUrl(d.id)} 
                                      className="p-1 rounded text-blue-600 hover:bg-blue-50"
                                      title="Download"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className={`text-[10px] mt-1.5 ${msg.sender === 'user' ? 'text-indigo-200 text-right' : 'text-slate-400'}`}>
                  {msg.timestamp}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 items-center text-slate-400 text-xs pl-2">
              <div className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" />
              <div className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.2s]" />
              <div className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.4s]" />
              <span className="ml-1 text-slate-500 font-medium">DocVault AI is thinking and organizing...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder="Ask AI: 'Create subfolder 2026 under Invoices', 'Search NDA', 'Show expiring files'..."
            className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
          />
          <button
            type="submit"
            disabled={loading || !inputPrompt.trim()}
            className="p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
