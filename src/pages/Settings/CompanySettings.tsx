import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Building2, Save, Plus, Check, Pencil, Trash2, AlertTriangle } from 'lucide-react';

export default function CompanySettings() {
  const { user, activeCompany, companies, setActiveCompany, refreshCompanies } = useAuth();
  const [name, setName] = useState(activeCompany?.name || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [showNewCompanyModal, setShowNewCompanyModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [creating, setCreating] = useState(false);

  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const isAdmin = activeCompany?.role === 'Admin';
  const canDelete = companies.length > 1;

  useEffect(() => {
    setName(activeCompany?.name || '');
  }, [activeCompany]);

  const handleSave = async () => {
    if (!activeCompany || !isAdmin) return;

    setSaving(true);
    setSuccess(false);

    const { error } = await supabase
      .from('companies')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', activeCompany.id);

    setSaving(false);

    if (!error) {
      setSuccess(true);
      await refreshCompanies();
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim() || !user) return;

    setCreating(true);

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({ name: newCompanyName.trim() })
      .select()
      .single();

    if (companyError || !company) {
      setCreating(false);
      return;
    }

    const { error: membershipError } = await supabase
      .from('company_memberships')
      .insert({
        user_id: user.id,
        company_id: company.id,
        role: 'Admin'
      });

    setCreating(false);

    if (!membershipError) {
      setShowNewCompanyModal(false);
      setNewCompanyName('');
      await refreshCompanies();
      setActiveCompany({ ...company, role: 'Admin' });
    }
  };

  const openRename = (id: string, currentName: string) => {
    setRenameTarget({ id, name: currentName });
    setRenameValue(currentName);
  };

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;

    setRenaming(true);

    const { error } = await supabase
      .from('companies')
      .update({ name: renameValue.trim(), updated_at: new Date().toISOString() })
      .eq('id', renameTarget.id);

    setRenaming(false);

    if (!error) {
      await refreshCompanies();
      setRenameTarget(null);
      setRenameValue('');
    }
  };

  const openDelete = (id: string, companyName: string) => {
    setDeleteTarget({ id, name: companyName });
    setDeleteConfirm('');
    setDeleteError('');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    if (companies.length <= 1) {
      setDeleteError('You must have at least one company.');
      return;
    }

    if (deleteConfirm !== deleteTarget.name) {
      setDeleteError('Company name does not match.');
      return;
    }

    setDeleting(true);
    setDeleteError('');

    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      setDeleting(false);
      setDeleteError(error.message);
      return;
    }

    if (activeCompany?.id === deleteTarget.id) {
      const remaining = companies.find((c) => c.id !== deleteTarget.id);
      if (remaining) setActiveCompany(remaining);
    }

    await refreshCompanies();
    setDeleting(false);
    setDeleteTarget(null);
    setDeleteConfirm('');
  };

  return (
    <>
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Company Information</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Update your company's basic information
            </p>
          </div>

          <div className="p-6 space-y-6">
            <div className="flex items-start gap-6">
              <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">
                {activeCompany?.logo_url ? (
                  <img
                    src={activeCompany.logo_url}
                    alt={activeCompany.name}
                    className="w-full h-full object-contain rounded-xl"
                  />
                ) : (
                  <Building2 className="w-10 h-10 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent disabled:bg-gray-50 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter company name"
                />
                {!isAdmin && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Only administrators can edit company settings
                  </p>
                )}
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button onClick={handleSave} loading={saving} disabled={!name.trim()}>
                  <Save className="w-4 h-4" />
                  Save Changes
                </Button>
                {success && (
                  <span className="text-sm text-green-600 font-medium">
                    Changes saved successfully
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your Companies</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Manage your companies
              </p>
            </div>
            <Button onClick={() => setShowNewCompanyModal(true)}>
              <Plus className="w-4 h-4" />
              New Company
            </Button>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {companies.map((company) => {
              const isActive = company.id === activeCompany?.id;
              const isCompanyAdmin = company.role === 'Admin';
              return (
                <div
                  key={company.id}
                  className={`flex items-center justify-between px-6 py-4 ${
                    isActive ? 'bg-gray-50 dark:bg-gray-700' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                      {company.logo_url ? (
                        <img
                          src={company.logo_url}
                          alt={company.name}
                          className="w-full h-full object-contain rounded-lg"
                        />
                      ) : (
                        <Building2 className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{company.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{company.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <div className="flex items-center gap-1.5 text-sm text-green-600 font-medium mr-2">
                        <Check className="w-4 h-4" />
                        Active
                      </div>
                    )}
                    {isCompanyAdmin && (
                      <button
                        onClick={() => openRename(company.id, company.name)}
                        className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors"
                        title="Rename"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {isCompanyAdmin && (
                      <button
                        onClick={() => openDelete(company.id, company.name)}
                        disabled={!canDelete}
                        className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-500"
                        title={canDelete ? 'Delete' : 'You must have at least one company'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Modal
        isOpen={showNewCompanyModal}
        onClose={() => setShowNewCompanyModal(false)}
        title="Create New Company"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Company Name
            </label>
            <input
              type="text"
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter company name"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowNewCompanyModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCompany} loading={creating} disabled={!newCompanyName.trim()}>
              Create Company
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        title="Rename Company"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Company Name
            </label>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && renameValue.trim()) handleRename();
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              loading={renaming}
              disabled={!renameValue.trim() || renameValue.trim() === renameTarget?.name}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => (deleting ? null : setDeleteTarget(null))}
        title="Delete Company"
      >
        <div className="space-y-4">
          <div className="flex gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700 dark:text-red-300">
              This will permanently delete <span className="font-semibold">{deleteTarget?.name}</span> along
              with all its dashboards, queries, projects, API endpoints, and team memberships. This action
              cannot be undone.
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type <span className="font-semibold">{deleteTarget?.name}</span> to confirm
            </label>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              autoFocus
            />
          </div>
          {deleteError && (
            <div className="text-sm text-red-600 dark:text-red-400">{deleteError}</div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleting}
              disabled={deleteConfirm !== deleteTarget?.name}
            >
              <Trash2 className="w-4 h-4" />
              Delete Company
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
