import { useState } from 'react';
import { Plus, Pencil, Trash2, ScanLine, ChevronRight, Check, X, Zap, Loader2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import CustomDropdown from '../../components/ui/CustomDropdown';
import Modal from '../../components/ui/Modal';
import { useImagingVendors, type ImagingVendorFormData } from '../../hooks/useImagingVendors';
import { useAuth } from '../../contexts/AuthContext';
import type { ImagingVendor, ImagingDocumentType } from '../../types/database';

const VENDOR_TYPE_OPTIONS = [{ value: 'parse_it', label: 'Parse-It' }];

const emptyForm: ImagingVendorFormData = {
  name: '',
  vendor_type: 'parse_it',
  supabase_url: '',
  anon_key: '',
  default_bucket_id: '',
  notes: '',
  send_api_key: '',
  send_bucket_id: '',
  send_default_document_type_id: '',
};

export default function ImagingVendors() {
  const { activeCompany } = useAuth();
  const canEdit = activeCompany?.role === 'Admin';
  const {
    vendors,
    documentTypes,
    loading,
    saveVendor,
    deleteVendor,
    saveDocumentType,
    deleteDocumentType,
  } = useImagingVendors();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ImagingVendorFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [managingVendorId, setManagingVendorId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { status: 'testing' | 'success' | 'error'; message: string }>>({});

  const testConnection = async (v: ImagingVendor) => {
    setTestResults((prev) => ({ ...prev, [v.id]: { status: 'testing', message: 'Contacting vendor...' } }));
    if (!v.supabase_url || !v.anon_key) {
      setTestResults((prev) => ({ ...prev, [v.id]: { status: 'error', message: 'Missing URL or anon key' } }));
      return;
    }
    const proxyUrl = `${v.supabase_url.replace(/\/$/, '')}/functions/v1/imaging-proxy`;
    try {
      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${v.anon_key}`,
          'apikey': v.anon_key,
        },
        body: JSON.stringify({ action: 'list' }),
      });
      let bodyText = '';
      try { bodyText = await res.text(); } catch { /* ignore */ }
      let bodyJson: unknown = null;
      try { bodyJson = bodyText ? JSON.parse(bodyText) : null; } catch { /* not json */ }
      if (res.status === 401 || res.status === 403) {
        setTestResults((prev) => ({ ...prev, [v.id]: { status: 'error', message: `Auth failed (HTTP ${res.status}) — check anon key` } }));
        return;
      }
      if (res.status === 404) {
        setTestResults((prev) => ({ ...prev, [v.id]: { status: 'error', message: 'Endpoint not found — check Supabase URL' } }));
        return;
      }
      if (res.status >= 500) {
        setTestResults((prev) => ({ ...prev, [v.id]: { status: 'error', message: `Vendor server error (HTTP ${res.status})` } }));
        return;
      }
      const isReachable = res.status === 400 || (res.status >= 200 && res.status < 300);
      if (isReachable) {
        const detail = (bodyJson as { error?: string } | null)?.error ?? '';
        const summary = res.status === 400 && detail
          ? 'Reachable (validation responded as expected)'
          : 'Connection OK';
        setTestResults((prev) => ({ ...prev, [v.id]: { status: 'success', message: summary } }));
        return;
      }
      setTestResults((prev) => ({ ...prev, [v.id]: { status: 'error', message: `Unexpected response (HTTP ${res.status})` } }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResults((prev) => ({ ...prev, [v.id]: { status: 'error', message: `Network error: ${msg.slice(0, 80)}` } }));
    }
  };

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError('');
    setShowModal(true);
  };

  const openEdit = (v: ImagingVendor) => {
    setForm({
      name: v.name,
      vendor_type: v.vendor_type,
      supabase_url: v.supabase_url,
      anon_key: v.anon_key,
      default_bucket_id: v.default_bucket_id || '',
      notes: v.notes || '',
      send_api_key: v.send_api_key || '',
      send_bucket_id: v.send_bucket_id || '',
      send_default_document_type_id: v.send_default_document_type_id || '',
    });
    setEditingId(v.id);
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.supabase_url.trim() || !form.anon_key.trim()) {
      setError('Name, Supabase URL, and Anon Key are required');
      return;
    }
    setSaving(true);
    const { error: err } = await saveVendor(editingId, form);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setShowModal(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteVendor(confirmDelete.id);
    setConfirmDelete(null);
  };

  const managingVendor = vendors.find((v) => v.id === managingVendorId) || null;
  const managingDocTypes = documentTypes.filter((d) => d.vendor_id === managingVendorId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Imaging Vendors</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Register document retrieval vendors used by the Imaging workflow step.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreate} size="sm">
            <Plus className="w-4 h-4" />
            Add Vendor
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">Loading vendors...</div>
      ) : vendors.length === 0 ? (
        <div className="border border-dashed border-gray-200 dark:border-gray-700 rounded-lg py-12 flex flex-col items-center justify-center text-center">
          <ScanLine className="w-8 h-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No imaging vendors yet.</p>
          {canEdit && (
            <Button onClick={openCreate} size="sm" className="mt-3">
              <Plus className="w-4 h-4" />
              Add Vendor
            </Button>
          )}
        </div>
      ) : (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vendor</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">URL</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Doc Types</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-48">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {vendors.map((v) => {
                const typeCount = documentTypes.filter((d) => d.vendor_id === v.id).length;
                const testResult = testResults[v.id];
                return (
                  <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{v.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {VENDOR_TYPE_OPTIONS.find((o) => o.value === v.vendor_type)?.label || v.vendor_type}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 font-mono truncate max-w-xs">{v.supabase_url}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{typeCount}</td>
                    <td className="px-4 py-3">
                      {testResult ? (
                        <div
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            testResult.status === 'testing'
                              ? 'text-gray-500 dark:text-gray-400'
                              : testResult.status === 'success'
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                          title={testResult.message}
                        >
                          {testResult.status === 'testing' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          {testResult.status === 'success' && <Check className="w-3.5 h-3.5" />}
                          {testResult.status === 'error' && <X className="w-3.5 h-3.5" />}
                          <span className="max-w-[220px] truncate">{testResult.message}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">Not tested</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => testConnection(v)}
                          disabled={testResult?.status === 'testing'}
                          className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Test Connection"
                        >
                          {testResult?.status === 'testing' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Zap className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => setManagingVendorId(v.id)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Manage Document Types"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <>
                            <button
                              onClick={() => openEdit(v)}
                              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setConfirmDelete({ id: v.id, name: v.name })}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
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

      {/* Add/Edit vendor modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Imaging Vendor' : 'Add Imaging Vendor'} size="lg">
        <div className="space-y-5">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Parse-It Production"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vendor Type</label>
            <CustomDropdown
              value={form.vendor_type}
              onChange={(v) => setForm({ ...form, vendor_type: v })}
              options={VENDOR_TYPE_OPTIONS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Supabase URL</label>
            <input
              type="text"
              value={form.supabase_url}
              onChange={(e) => setForm({ ...form, supabase_url: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
              placeholder="https://xxxxx.supabase.co"
            />
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Shared by Receive and Send.</p>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Receive from Imaging</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Anon Key</label>
                <input
                  type="text"
                  value={form.anon_key}
                  onChange={(e) => setForm({ ...form, anon_key: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                  placeholder="eyJhbGciOi..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Default Bucket ID <span className="text-xs text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.default_bucket_id}
                  onChange={(e) => setForm({ ...form, default_bucket_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Send to Imaging</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Used by the Imaging step when configured in "Send" mode to POST PDFs to <span className="font-mono">/functions/v1/imaging-ingest</span>.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ingest API Key <span className="text-xs text-gray-400">(bearer token)</span>
                </label>
                <input
                  type="text"
                  value={form.send_api_key}
                  onChange={(e) => setForm({ ...form, send_api_key: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                  placeholder="Shared IMAGING_INGEST_API_KEY"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Send Bucket ID <span className="text-xs text-gray-400">(target bucket UUID)</span>
                </label>
                <input
                  type="text"
                  value={form.send_bucket_id}
                  onChange={(e) => setForm({ ...form, send_bucket_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                  placeholder="b1e6...-...-...-...-..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Default Document Type <span className="text-xs text-gray-400">(optional)</span>
                </label>
                {editingId ? (
                  <CustomDropdown
                    value={form.send_default_document_type_id}
                    onChange={(v) => setForm({ ...form, send_default_document_type_id: v })}
                    options={[
                      { value: '', label: 'None' },
                      ...documentTypes
                        .filter((d) => d.vendor_id === editingId)
                        .map((d) => ({ value: d.id, label: d.name })),
                    ]}
                    placeholder="Select document type..."
                  />
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                    Save the vendor first, then add document types to pick a default here.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Imaging Vendor"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Delete <span className="font-semibold">{confirmDelete?.name}</span>? Any workflow steps pointing at it will stop resolving until reconfigured.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete</Button>
          </div>
        </div>
      </Modal>

      {/* Document Types manager */}
      <Modal
        isOpen={!!managingVendor}
        onClose={() => setManagingVendorId(null)}
        title={managingVendor ? `Document Types — ${managingVendor.name}` : 'Document Types'}
        size="lg"
      >
        {managingVendor && (
          <DocumentTypesManager
            vendor={managingVendor}
            documentTypes={managingDocTypes}
            canEdit={canEdit}
            onSave={(id, form) => saveDocumentType(id, managingVendor.id, form)}
            onDelete={deleteDocumentType}
            onClose={() => setManagingVendorId(null)}
          />
        )}
      </Modal>
    </div>
  );
}

interface DocumentTypesManagerProps {
  vendor: ImagingVendor;
  documentTypes: ImagingDocumentType[];
  canEdit: boolean;
  onSave: (id: string | null, form: { remote_id: string; name: string; sort_order: number }) => Promise<{ error: string | null }>;
  onDelete: (id: string) => Promise<{ error: string | null }>;
  onClose: () => void;
}

function DocumentTypesManager({ vendor: _vendor, documentTypes, canEdit, onSave, onDelete, onClose }: DocumentTypesManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRemoteId, setEditRemoteId] = useState('');
  const [editName, setEditName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newRemoteId, setNewRemoteId] = useState('');
  const [newName, setNewName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const startEdit = (dt: ImagingDocumentType) => {
    setEditingId(dt.id);
    setEditRemoteId(dt.remote_id);
    setEditName(dt.name);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await onSave(editingId, { remote_id: editRemoteId, name: editName, sort_order: 0 });
    setEditingId(null);
  };

  const saveNew = async () => {
    if (!newRemoteId.trim() || !newName.trim()) return;
    const nextOrder = (documentTypes[documentTypes.length - 1]?.sort_order ?? 0) + 1;
    await onSave(null, { remote_id: newRemoteId, name: newName, sort_order: nextOrder });
    setNewRemoteId('');
    setNewName('');
    setCreating(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Register the vendor's document type UUIDs so the workflow step can list them by friendly name.
      </p>

      {documentTypes.length === 0 && !creating && (
        <div className="border border-dashed border-gray-200 dark:border-gray-700 rounded p-6 text-center text-sm text-gray-500 dark:text-gray-400">
          No document types yet.
        </div>
      )}

      {documentTypes.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Remote ID</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {documentTypes.map((dt) => (
                <tr key={dt.id}>
                  {editingId === dt.id ? (
                    <>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={editRemoteId}
                          onChange={(e) => setEditRemoteId(e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <button onClick={saveEdit} className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded" title="Save">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Cancel">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{dt.name}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 font-mono">{dt.remote_id}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {canEdit && (
                            <>
                              <button
                                onClick={() => startEdit(dt)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                title="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(dt.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <div className="border border-gray-200 dark:border-gray-700 rounded p-3 space-y-2 bg-gray-50 dark:bg-gray-700/30">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Friendly Name (e.g. Invoice)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="text"
              placeholder="Remote UUID"
              value={newRemoteId}
              onChange={(e) => setNewRemoteId(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => { setCreating(false); setNewName(''); setNewRemoteId(''); }}>Cancel</Button>
            <Button size="sm" onClick={saveNew}>Add</Button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center pt-2">
        {canEdit && !creating && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" />
            Add Document Type
          </Button>
        )}
        <div className="ml-auto">
          <Button size="sm" variant="secondary" onClick={onClose}>Done</Button>
        </div>
      </div>

      <Modal
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        title="Delete Document Type"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">Delete this document type?</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (confirmDeleteId) await onDelete(confirmDeleteId);
                setConfirmDeleteId(null);
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
