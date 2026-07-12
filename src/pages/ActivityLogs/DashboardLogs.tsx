import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Trash2, Filter, ScrollText, Copy, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import CustomDropdown from '../../components/ui/CustomDropdown';
import DatePicker from '../../components/ui/DatePicker';
import Modal from '../../components/ui/Modal';

interface ActivityLog {
  id: string;
  user_id: string;
  event_type: string;
  resource_name: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface TeamMember {
  id: string;
  full_name: string | null;
  username: string | null;
}

interface DashboardOption {
  id: string;
  name: string;
}

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  login: { label: 'Login', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  dashboard_open: { label: 'Dashboard Opened', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  action_execute: { label: 'Action Executed', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  action_failed: { label: 'Action Failed', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  csv_export: { label: 'CSV Export', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  csv_email: { label: 'CSV Emailed', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
};

export default function DashboardLogs() {
  const { activeCompany, isAdmin } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [dashboards, setDashboards] = useState<DashboardOption[]>([]);

  const today = new Date().toISOString().slice(0, 10);
  const [filterUser, setFilterUser] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>(today);
  const [filterDateTo, setFilterDateTo] = useState<string>(today);
  const [filterDashboard, setFilterDashboard] = useState<string>('');

  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeDate, setPurgeDate] = useState<string>(today);
  const [detailsModal, setDetailsModal] = useState<{ title: string; content: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!activeCompany) return;

    let query = supabase
      .from('activity_logs')
      .select('*')
      .eq('company_id', activeCompany.id)
      .order('created_at', { ascending: false })
      .limit(500);

    if (filterUser) query = query.eq('user_id', filterUser);
    if (filterDateFrom) query = query.gte('created_at', `${filterDateFrom}T00:00:00`);
    if (filterDateTo) query = query.lte('created_at', `${filterDateTo}T23:59:59`);
    if (filterDashboard) query = query.eq('resource_id', filterDashboard);

    const { data } = await query;
    setLogs((data as ActivityLog[]) || []);
  }, [activeCompany, filterUser, filterDateFrom, filterDateTo, filterDashboard]);

  const fetchTeamMembers = useCallback(async () => {
    if (!activeCompany) return;
    const { data: memberships } = await supabase
      .from('company_memberships')
      .select('user_id')
      .eq('company_id', activeCompany.id);
    if (!memberships) return;
    const userIds = memberships.map(m => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, username')
      .in('id', userIds);
    setTeamMembers(profiles || []);
  }, [activeCompany]);

  const fetchDashboards = useCallback(async () => {
    if (!activeCompany) return;
    const { data: projects } = await supabase
      .from('projects')
      .select('id')
      .eq('company_id', activeCompany.id)
      .eq('type', 'dashboards');
    if (!projects) return;
    const { data: dashes } = await supabase
      .from('dashboards')
      .select('id, name')
      .in('project_id', projects.map(p => p.id));
    setDashboards(dashes || []);
  }, [activeCompany]);

  useEffect(() => {
    if (!activeCompany) return;
    fetchTeamMembers();
    fetchDashboards();
  }, [activeCompany, fetchTeamMembers, fetchDashboards]);

  useEffect(() => {
    if (!activeCompany) return;
    setLoading(true);
    fetchLogs().finally(() => setLoading(false));
  }, [activeCompany, fetchLogs]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  };

  const handlePurge = async () => {
    if (!activeCompany) return;
    setPurging(true);
    await supabase
      .from('activity_logs')
      .delete()
      .eq('company_id', activeCompany.id)
      .lte('created_at', `${purgeDate}T23:59:59`);
    setPurging(false);
    setShowPurgeModal(false);
    fetchLogs();
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  const getUserDisplay = (log: ActivityLog) => {
    const member = teamMembers.find(m => m.id === log.user_id);
    if (member?.username) return member.username;
    if (member?.full_name) return member.full_name;
    return log.user_id.slice(0, 8);
  };

  const formatMetadata = (metadata: Record<string, unknown>): string => {
    return Object.entries(metadata).map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: ${v.join('\n')}`;
      if (typeof v === 'object' && v !== null) return `${k}: ${JSON.stringify(v, null, 2)}`;
      return `${k}: ${v}`;
    }).join('\n');
  };

  const handleCopyDetails = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Action bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {!loading && `${logs.length} ${logs.length === 1 ? 'entry' : 'entries'}`}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {isAdmin && (
            <Button variant="secondary" size="sm" onClick={() => setShowPurgeModal(true)} className="text-red-600 hover:text-red-700 dark:text-red-400">
              <Trash2 className="w-4 h-4" />
              Purge
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/50 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">User</label>
          <CustomDropdown
            value={filterUser}
            onChange={v => setFilterUser(v)}
            options={[{ value: '', label: 'All Users' }, ...teamMembers.map(m => ({ value: m.id, label: m.username || m.full_name || m.id.slice(0, 8) }))]}
            size="sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">From</label>
          <div className="w-40">
            <DatePicker value={filterDateFrom} onChange={v => setFilterDateFrom(v)} placeholder="Start date" size="sm" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">To</label>
          <div className="w-40">
            <DatePicker value={filterDateTo} onChange={v => setFilterDateTo(v)} placeholder="End date" size="sm" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Dashboard</label>
          <CustomDropdown
            value={filterDashboard}
            onChange={v => setFilterDashboard(v)}
            options={[{ value: '', label: 'All' }, ...dashboards.map(d => ({ value: d.id, label: d.name }))]}
            size="sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-gray-500">
            <ScrollText className="w-10 h-10 mb-2" />
            <p className="text-sm">No activity logs found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="text-left px-6 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Time</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">User</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Event</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Resource</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {logs.map(log => {
                const event = EVENT_LABELS[log.event_type] || { label: log.event_type, color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' };
                return (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-2.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatTime(log.created_at)}</td>
                    <td className="px-4 py-2.5 text-gray-800 dark:text-gray-200 font-medium">{getUserDisplay(log)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${event.color}`}>
                        {event.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{log.resource_name || '-'}</td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs max-w-[200px]">
                      {log.metadata && Object.keys(log.metadata).length > 0
                        ? (() => {
                            const detailText = formatMetadata(log.metadata);
                            return (
                              <button
                                onClick={() => setDetailsModal({ title: `${event.label} - ${log.resource_name || 'Details'}`, content: detailText })}
                                className="text-left truncate block w-full hover:text-blue-600 dark:hover:text-blue-400 transition-colors group"
                                title="Click to view full details"
                              >
                                <span className="truncate block">{detailText}</span>
                              </button>
                            );
                          })()
                        : <span>-</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Purge Modal */}
      <Modal isOpen={showPurgeModal} onClose={() => setShowPurgeModal(false)} title="Purge Activity Logs" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This will permanently delete all activity logs on or before the selected date.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Delete logs on or before</label>
            <DatePicker value={purgeDate} onChange={v => setPurgeDate(v)} placeholder="Select date" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowPurgeModal(false)}>Cancel</Button>
            <Button onClick={handlePurge} loading={purging} className="bg-red-600 hover:bg-red-700 text-white">
              Purge Logs
            </Button>
          </div>
        </div>
      </Modal>

      {/* Details Modal */}
      <Modal isOpen={!!detailsModal} onClose={() => { setDetailsModal(null); setCopied(false); }} title={detailsModal?.title || 'Details'} size="md">
        <div className="space-y-4">
          <div className="relative">
            <pre className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-sm text-gray-800 dark:text-gray-200 overflow-auto max-h-[400px] whitespace-pre-wrap break-words font-mono">
              {detailsModal?.content}
            </pre>
          </div>
          <div className="flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => detailsModal && handleCopyDetails(detailsModal.content)}
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy to Clipboard'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
