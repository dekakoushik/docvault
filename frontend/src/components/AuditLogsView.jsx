import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  RefreshCw, 
  Clock, 
  Terminal
} from 'lucide-react';
import { api } from '../services/api';

export default function AuditLogsView({ token }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getLogs(token);
      if (res.success) {
        setLogs(res.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Security Audit & Activity Logs</h2>
            <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
              Live Auditing
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time tracking synchronized with <code className="text-indigo-600 font-mono">.agent/audit.log</code> and database records.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all flex items-center gap-2 text-xs font-semibold self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          <span>Refresh Audit Feed</span>
        </button>
      </div>

      {/* Directory indicator info card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 text-xs text-slate-600 shadow-2xs">
        <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
          <Terminal className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <span className="text-slate-400">File Log Target: </span>
          <span className="font-mono text-indigo-600 font-bold">D:\Projects\DocVault\.agent\audit.log</span>
          <span className="text-slate-400 ml-2">(Appends all superadmin and system operations)</span>
        </div>
      </div>

      {/* Table of logs */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-indigo-600" />
            <p className="text-sm">Retrieving recorded actions...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileText className="w-8 h-8 mx-auto mb-3 text-slate-300" />
            <p className="text-base font-semibold text-slate-700">No activity logged yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">Timestamp</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Actor</th>
                  <th className="py-3.5 px-4">Details</th>
                  <th className="py-3.5 px-4">Origin IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-mono">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6 text-slate-500">
                      <div className="flex items-center gap-1.5 font-sans">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[11px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-800 font-semibold font-sans">
                      {log.user_email || 'SYSTEM'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate font-sans">
                      {log.details}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {log.ip_address}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
