import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, ExternalLink, GripVertical, Shield, Check, Loader2 } from 'lucide-react';
import { useSsoApplications, type SsoApplicationFormData } from '../../hooks/useSsoApplications';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';

const emptyForm: SsoApplicationFormData = {
  name: '',
  url: '',
  app_identifier: '',
  icon_url: '',
  sort_order: 0,
};

export default function Applications() {
  const { applications, loading, saveApplication, deleteApplication } = useSsoApplications();
  const { activeCompany } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SsoApplicationFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [accessAppId, setAccessAppId] = useState<string | null>(null);
  const [accessAppName, setAccessAppName] = useState('');
  const [accessMembers, setAccessMembers] = useState<Array<{ user_id: string; role: string; profile: { username: string | null; full_name: string | null; email: string | null; avatar_url: string | null } | null }>>([]);
  const [accessGranted, setAccessGranted] = useState<Set<string>>(new Set());
  const [accessInitial, setAccessInitial] = useState<Set<string>>(new Set());
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessSaving, setAccessSaving] = useState(false);

  const openAccessModal = useCallback(async (appId: string, appName: string) => {
    if (!activeCompany) return;
    setAccessAppId(appId);
    setAccessAppName(appName);
    setAccessLoading(true);

    const [membersRes, permissionsRes] = await Promise.all([
      supabase
        .from('company_memberships')
        .select(`user_id, role, profiles:user_id (username, full_name, email, avatar_url)`)
        .eq('company_id', activeCompany.id)
        .eq('status', 'active'),
      supabase
        .from('user_permissions')
        .select('user_id')
        .eq('company_id', activeCompany.id)
        .eq('permission_type', 'sso_application')
        .eq('resource_id', appId)
    ]);

    const nonAdmins = (membersRes.data || [])
      .filter((m: any) => m.role !== 'Admin')
      .map((m: any) => ({ user_id: m.user_id, role: m.role, profile: m.profiles }));

    setAccessMembers(nonAdmins);
    const granted = new Set((permissionsRes.data || []).map((p: any) => p.user_id));
    setAccessGranted(granted);
    setAccessInitial(new Set(granted));
    setAccessLoading(false);
  }, [activeCompany]);

  const handleAccessSave = async () => {
    if (!activeCompany || !accessAppId) return;
    setAccessSaving(true);

    const toAdd = [...accessGranted].filter(id => !accessInitial.has(id));
    const toRemove = [...accessInitial].filter(id => !accessGranted.has(id));

    if (toRemove.length > 0) {
      await supabase
        .from('user_permissions')
        .delete()
        .eq('company_id', activeCompany.id)
        .eq('permission_type', 'sso_application')
        .eq('resource_id', accessAppId)
        .in('user_id', toRemove);
    }

    if (toAdd.length > 0) {
      await supabase.from('user_permissions').insert(
        toAdd.map(userId => ({
          user_id: userId,
          company_id: activeCompany.id,
          permission_type: 'sso_application',
          resource_id: accessAppId,
          access_level: 'access',
        }))
      );
    }

    setAccessSaving(false);
    setAccessAppId(null);
  };

  const accessHasChanges = (() => {
    if (accessGranted.size !== accessInitial.size) return true;
    for (const id of accessGranted) {
      if (!accessInitial.has(id)) return true;
    }
    return false;
  })();

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm, sort_order: applications.length });
    setError(null);
    setShowModal(true);
  };

  const openEdit = (app: typeof applications[0]) => {
    setEditingId(app.id);
    setForm({
      name: app.name,
      url: app.url,
      app_identifier: app.app_identifier,
      icon_url: app.icon_url || '',
      sort_order: app.sort_order,
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.url.trim()) {
      setError('Name and URL are required');
      return;
    }

    setSaving(true);
    const result = await saveApplication(editingId, form);
    setSaving(false);

    if (result.error) {
      setError(result.error);
    } else {
      setShowModal(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteApplication(id);
    setDeleteConfirmId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Applications</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Configure external applications for Quick Switch. Users will see these in the sidebar menu.
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4" />
          Add Application
        </Button>
      </div>

      {applications.length === 0 ? (
        <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center">
          <ExternalLink className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No applications configured yet.</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Add your other Supabase applications to enable seamless Quick Switch login.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-8"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">URL</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Identifier</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                  <td className="px-4 py-3">
                    <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {app.icon_url ? (
                        <img src={app.icon_url} alt="" className="w-5 h-5 rounded object-cover" />
                      ) : (
                        <div className="w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <ExternalLink className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        </div>
                      )}
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{app.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">{app.url}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded font-mono">
                      {app.app_identifier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openAccessModal(app.id, app.name)}
                        className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Manage user access"
                      >
                        <Shield className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openEdit(app)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {deleteConfirmId === app.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(app.id)}
                            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(app.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Application' : 'Add Application'}>
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Application Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Nodal CRM"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Application URL
            </label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://crm.example.com"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">The base URL of the target application (must have /auth/sso route).</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              App Identifier <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={form.app_identifier}
              onChange={(e) => setForm({ ...form, app_identifier: e.target.value })}
              placeholder="e.g. crm, analytics, portal"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">If set, enables SSO. Leave blank to open URL directly.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Icon URL <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="url"
              value={form.icon_url}
              onChange={(e) => setForm({ ...form, icon_url: e.target.value })}
              placeholder="https://example.com/icon.png"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sort Order
            </label>
            <input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
              className="w-24 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.name.trim() || !form.url.trim()}>
              {editingId ? 'Save Changes' : 'Add Application'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!accessAppId} onClose={() => setAccessAppId(null)} title="Application Access" size="md">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Select users who can see <span className="font-medium text-gray-900 dark:text-gray-100">{accessAppName}</span> in Quick Switch
            </span>
          </div>

          {accessLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : accessMembers.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
              No non-admin users in this company. Admin users always have access.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {accessGranted.size} of {accessMembers.length} users selected
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAccessGranted(new Set(accessMembers.map(m => m.user_id)))}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    All
                  </button>
                  <button
                    onClick={() => setAccessGranted(new Set())}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    None
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                {accessMembers.map(member => {
                  const isGranted = accessGranted.has(member.user_id);
                  const name = member.profile?.full_name || member.profile?.username || member.profile?.email || 'Unknown User';
                  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
                  return (
                    <button
                      key={member.user_id}
                      onClick={() => {
                        setAccessGranted(prev => {
                          const next = new Set(prev);
                          if (next.has(member.user_id)) next.delete(member.user_id);
                          else next.add(member.user_id);
                          return next;
                        });
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        isGranted
                          ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isGranted ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {isGranted && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                        {member.profile?.avatar_url ? (
                          <img src={member.profile.avatar_url} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{initials}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{name}</p>
                        {member.profile?.email && member.profile.full_name && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{member.profile.email}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondary" onClick={() => setAccessAppId(null)}>
              Cancel
            </Button>
            <Button onClick={handleAccessSave} loading={accessSaving} disabled={!accessHasChanges}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
