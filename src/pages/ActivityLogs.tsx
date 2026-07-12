import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Trash2, Filter, ScrollText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

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
  csv_export: { label: 'CSV Export', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  csv_email: { label: 'CSV Emailed', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
};

export default function ActivityLogs() {
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

  const fetchLogs = useCallback(async () => {
    if (!activeCompany) return;

    let query = supabase
      .from('activity_logs')
      .select('*')
      .eq('company_id', activeCompany.id)
      .order('created_at', { ascending: false })
      .limit(500);

    if (filterUser) {
      query = query.eq('user_id', filterUser);
    }
    if (filterDateFrom) {
      query = query.gte('created_at', `${filterDateFrom}T00:00:00`);
    }
    if (filterDateTo) {
      query = query.lte('created_at', `${filterDateTo}T23:59:59`);
    }
    if (filterDashboard) {
      query = query.eq('resource_id', filterDashboard);
    }

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

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <ScrollText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Activity Logs</h1>
          {!loading && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
            </span>
          )}
        </div>
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
      <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
        <Filter className="w-4 h-4 text-gray-400" />
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">User</label>
          <select
            value={filterUser}
            onChange={e => setFilterUser(e.target.value)}
            className="text-sm border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
          >
            <option value="">All Users</option>
            {teamMembers.map(m => (
              <option key={m.id} value={m.id}>{m.username || m.full_name || m.id.slice(0, 8)}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">From</label>
          <input
            type="date"
            value={filterDateFrom}
            onChange={e => setFilterDateFrom(e.target.value)}
            className="text-sm border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">To</label>
          <input
            type="date"
            value={filterDateTo}
            onChange={e => setFilterDateTo(e.target.value)}
            className="text-sm border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Dashboard</label>
          <select
            value={filterDashboard}
            onChange={e => setFilterDashboard(e.target.value)}
            className="text-sm border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
          >
            <option value="">All</option>
            {dashboards.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
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
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {logs.map(log => {
                const event = EVENT_LABELS[log.event_type] || { label: log.event_type, color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' };
                return (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-2.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatTime(log.created_at)}</td>
                    <td className="px-4 py-2.5 text-gray-800 dark:text-gray-200 font-medium">{getUserDisplay(log)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${event.color}`}>
                        {event.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{log.resource_name || '-'}</td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs max-w-[200px] truncate">
                      {log.metadata && Object.keys(log.metadata).length > 0
                        ? Object.entries(log.metadata).map(([k, v]) => `${k}: ${v}`).join(', ')
                        : '-'
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
            <input
              type="date"
              value={purgeDate}
              onChange={e => setPurgeDate(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowPurgeModal(false)}>Cancel</Button>
            <Button onClick={handlePurge} loading={purging} className="bg-red-600 hover:bg-red-700 text-white">
              Purge Logs
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
