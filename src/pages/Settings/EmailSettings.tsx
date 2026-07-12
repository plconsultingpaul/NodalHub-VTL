import { useState } from 'react';
import { Mail, Plus, Pencil, Trash2, Send, AlertCircle, ExternalLink, Eye, EyeOff, CheckCircle, Play, Loader2, BookUser } from 'lucide-react';
import { useEmailConfigs, type EmailConfigFormData } from '../../hooks/useEmailConfigs';
import { useContacts, type Contact } from '../../hooks/useContacts';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import Button from '../../components/ui/Button';
import CustomDropdown from '../../components/ui/CustomDropdown';
import Modal from '../../components/ui/Modal';
import type { EmailConfiguration, EmailProvider, O365Credentials, GmailCredentials } from '../../types/database';

const PROVIDER_OPTIONS = [
  { value: 'office365', label: 'Office 365' },
  { value: 'gmail', label: 'Gmail (OAuth)' },
];

const emptyO365: O365Credentials = { tenant_id: '', client_id: '', client_secret: '' };
const emptyGmail: GmailCredentials = { client_id: '', client_secret: '', refresh_token: '' };

function getDefaultCredentials(provider: EmailProvider): O365Credentials | GmailCredentials {
  return provider === 'office365' ? { ...emptyO365 } : { ...emptyGmail };
}

export default function EmailSettings() {
  const { configs, loading, saveConfig, deleteConfig, setDefault } = useEmailConfigs();
  const { contacts, loading: contactsLoading, createContact, updateContact, deleteContact: removeContact } = useContacts();
  const { activeCompany } = useAuth();
  const { isDark } = useTheme();
  const [editingConfig, setEditingConfig] = useState<EmailConfiguration | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const [contactModal, setContactModal] = useState<{ mode: 'add' | 'edit'; contact?: Contact } | null>(null);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const [contactError, setContactError] = useState('');

  const isAdmin = activeCompany?.role === 'Admin';

  if (!isAdmin) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Access Restricted</h3>
        <p className="text-gray-500 dark:text-gray-400">Only administrators can manage email settings.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 flex justify-center">
        <div className="w-6 h-6 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleEdit = (config: EmailConfiguration) => {
    setEditingConfig(config);
    setIsAdding(false);
    setError('');
    setTestResult(null);
  };

  const handleAdd = () => {
    setEditingConfig(null);
    setIsAdding(true);
    setError('');
    setTestResult(null);
  };

  const handleTest = async (config: EmailConfiguration) => {
    setTestingId(config.id);
    setTestResult(null);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-email`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ configId: config.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ id: config.id, success: true, message: data.message });
      } else {
        setTestResult({ id: config.id, success: false, message: data.error || 'Test failed' });
      }
    } catch (err) {
      setTestResult({ id: config.id, success: false, message: err instanceof Error ? err.message : 'Network error' });
    }
    setTestingId(null);
  };

  const handleClose = () => {
    setEditingConfig(null);
    setIsAdding(false);
    setError('');
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const result = await deleteConfig(deletingId);
    if (result.error) {
      setError(result.error);
    }
    setDeletingId(null);
  };

  const handleSetDefault = async (id: string) => {
    await setDefault(id);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Email Configuration</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Configure email providers for sending notifications and reports
              </p>
            </div>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4" />
            Add Configuration
          </Button>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {configs.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Email Configurations</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Add an email configuration to enable sending emails from your pulses.
              </p>
              <Button onClick={handleAdd}>
                <Plus className="w-4 h-4" />
                Add Configuration
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {configs.map((config) => (
                <ConfigCard
                  key={config.id}
                  config={config}
                  onEdit={() => handleEdit(config)}
                  onDelete={() => setDeletingId(config.id)}
                  onSetDefault={() => handleSetDefault(config.id)}
                  onTest={() => handleTest(config)}
                  testing={testingId === config.id}
                  testResult={testResult?.id === config.id ? testResult : null}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Contacts Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
              <BookUser className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Contacts</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manage external email recipients for pulse notifications
              </p>
            </div>
          </div>
          <Button onClick={() => { setContactModal({ mode: 'add' }); setContactError(''); }}>
            <Plus className="w-4 h-4" />
            Add Contact
          </Button>
        </div>

        <div className="p-6">
          {contactsLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookUser className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Contacts</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Add contacts to quickly select external email recipients in your pulses.
              </p>
              <Button onClick={() => { setContactModal({ mode: 'add' }); setContactError(''); }}>
                <Plus className="w-4 h-4" />
                Add Contact
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {contact.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {contact.email}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-4">
                    <button
                      onClick={() => { setContactModal({ mode: 'edit', contact }); setContactError(''); }}
                      title="Edit"
                      className="p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingContactId(contact.id)}
                      title="Delete"
                      className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {contactModal && (
        <ContactModal
          mode={contactModal.mode}
          contact={contactModal.contact}
          error={contactError}
          onSave={async (name, email) => {
            setContactError('');
            let result;
            if (contactModal.mode === 'edit' && contactModal.contact) {
              result = await updateContact(contactModal.contact.id, name, email);
            } else {
              result = await createContact(name, email);
            }
            if (result.error) {
              setContactError(result.error);
            } else {
              setContactModal(null);
            }
          }}
          onClose={() => setContactModal(null)}
        />
      )}

      {deletingContactId && (
        <Modal isOpen onClose={() => setDeletingContactId(null)} title="Delete Contact">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            Are you sure you want to delete this contact? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeletingContactId(null)}>Cancel</Button>
            <Button variant="danger" onClick={async () => {
              await removeContact(deletingContactId);
              setDeletingContactId(null);
            }}>Delete</Button>
          </div>
        </Modal>
      )}

      {(isAdding || editingConfig) && (
        <ConfigModal
          config={editingConfig}
          isDark={isDark}
          saving={saving}
          onSave={async (formData) => {
            setSaving(true);
            setError('');
            const result = await saveConfig(editingConfig?.id || null, formData);
            setSaving(false);
            if (result.error) {
              setError(result.error);
            } else {
              handleClose();
            }
          }}
          onClose={handleClose}
        />
      )}

      {deletingId && (
        <Modal isOpen onClose={() => setDeletingId(null)} title="Delete Configuration">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            Are you sure you want to delete this email configuration? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ConfigCard({
  config,
  onEdit,
  onDelete,
  onSetDefault,
  onTest,
  testing,
  testResult,
}: {
  config: EmailConfiguration;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  onTest: () => void;
  testing: boolean;
  testResult: { success: boolean; message: string } | null;
}) {
  const creds = config.credentials as Record<string, string>;
  const providerLabel = config.provider === 'office365' ? 'Office365' : 'Gmail';
  const tenantPreview = config.provider === 'office365' && creds.tenant_id
    ? creds.tenant_id.slice(0, 8) + '...'
    : null;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {config.name || 'Untitled'}
            </h3>
            {config.is_default && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                Default
              </span>
            )}
            {!config.is_configured && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                Incomplete
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>Provider: {providerLabel}</span>
            {tenantPreview && <span>Tenant ID: {tenantPreview}</span>}
            {config.send_from_email && <span>From: {config.send_from_email}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-4">
          {config.is_configured && (
            <button
              onClick={onTest}
              disabled={testing}
              title="Send test email"
              className="p-2 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20 rounded-lg transition-colors disabled:opacity-50"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            </button>
          )}
          {!config.is_default && config.is_configured && (
            <button
              onClick={onSetDefault}
              title="Set as default"
              className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onEdit}
            title="Edit"
            className="p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            title="Delete"
            className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {testResult && (
        <div className={`mt-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${
          testResult.success
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
        }`}>
          {testResult.success ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
          <span className="truncate">{testResult.message}</span>
        </div>
      )}
    </div>
  );
}

function ConfigModal({
  config,
  isDark,
  saving,
  onSave,
  onClose,
}: {
  config: EmailConfiguration | null;
  isDark: boolean;
  saving: boolean;
  onSave: (formData: EmailConfigFormData) => void;
  onClose: () => void;
}) {
  const isEdit = !!config;
  const initialProvider: EmailProvider = (config?.provider as EmailProvider) || 'office365';
  const initialCredentials = config?.credentials
    ? (config.credentials as unknown as O365Credentials | GmailCredentials)
    : getDefaultCredentials(initialProvider);

  const [name, setName] = useState(config?.name || '');
  const [provider, setProvider] = useState<EmailProvider>(initialProvider);
  const [sendFromEmail, setSendFromEmail] = useState(config?.send_from_email || '');
  const [credentials, setCredentials] = useState<O365Credentials | GmailCredentials>(initialCredentials);
  const [isDefault, setIsDefault] = useState(config?.is_default || false);
  const [showSecrets, setShowSecrets] = useState(false);

  const handleProviderChange = (newProvider: string) => {
    const p = newProvider as EmailProvider;
    setProvider(p);
    setCredentials(getDefaultCredentials(p));
  };

  const updateCredField = (field: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    onSave({ name, provider, send_from_email: sendFromEmail, credentials, is_default: isDefault });
  };

  return (
    <Modal isOpen onClose={onClose} title={isEdit ? 'Edit Email Configuration' : 'Add Email Configuration'}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Configuration Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            placeholder="e.g., Production Office 365"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Provider <span className="text-red-500">*</span>
          </label>
          <CustomDropdown
            value={provider}
            onChange={handleProviderChange}
            options={PROVIDER_OPTIONS}
            placeholder="Select provider..."
            dark={isDark}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Send From Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={sendFromEmail}
            onChange={(e) => setSendFromEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            placeholder="noreply@yourdomain.com"
          />
        </div>

        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Credentials</h4>
            <button
              type="button"
              onClick={() => setShowSecrets(!showSecrets)}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {showSecrets ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showSecrets ? 'Hide' : 'Show'} secrets
            </button>
          </div>

          {provider === 'office365' ? (
            <O365Fields
              credentials={credentials as O365Credentials}
              showSecrets={showSecrets}
              onChange={updateCredField}
            />
          ) : (
            <GmailFields
              credentials={credentials as GmailCredentials}
              showSecrets={showSecrets}
              onChange={updateCredField}
            />
          )}
        </div>

        <SetupInstructions provider={provider} />

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="is_default"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          <label htmlFor="is_default" className="text-sm text-gray-700 dark:text-gray-300">
            Set as default email configuration
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving} disabled={!name || !sendFromEmail}>
            {isEdit ? 'Save Changes' : 'Add Configuration'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function O365Fields({
  credentials,
  showSecrets,
  onChange,
}: {
  credentials: O365Credentials;
  showSecrets: boolean;
  onChange: (field: string, value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tenant ID</label>
        <input
          type={showSecrets ? 'text' : 'password'}
          value={credentials.tenant_id}
          onChange={(e) => onChange('tenant_id', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Client ID</label>
        <input
          type={showSecrets ? 'text' : 'password'}
          value={credentials.client_id}
          onChange={(e) => onChange('client_id', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Client Secret</label>
        <input
          type={showSecrets ? 'text' : 'password'}
          value={credentials.client_secret}
          onChange={(e) => onChange('client_secret', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
          placeholder="Enter client secret"
        />
      </div>
    </div>
  );
}

function GmailFields({
  credentials,
  showSecrets,
  onChange,
}: {
  credentials: GmailCredentials;
  showSecrets: boolean;
  onChange: (field: string, value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Client ID</label>
        <input
          type={showSecrets ? 'text' : 'password'}
          value={credentials.client_id}
          onChange={(e) => onChange('client_id', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
          placeholder="xxxxxxxxxxxx.apps.googleusercontent.com"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Client Secret</label>
        <input
          type={showSecrets ? 'text' : 'password'}
          value={credentials.client_secret}
          onChange={(e) => onChange('client_secret', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
          placeholder="Enter client secret"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Refresh Token</label>
        <input
          type={showSecrets ? 'text' : 'password'}
          value={credentials.refresh_token}
          onChange={(e) => onChange('refresh_token', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
          placeholder="Enter refresh token"
        />
      </div>
    </div>
  );
}

function SetupInstructions({ provider }: { provider: EmailProvider }) {
  if (provider === 'office365') {
    return (
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
        <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-1.5">Office 365 Setup</h4>
        <ol className="text-xs text-gray-600 dark:text-gray-300 space-y-0.5 list-decimal list-inside">
          <li>Register an application in Azure Active Directory</li>
          <li>Add Mail.Send permission under Microsoft Graph API</li>
          <li>Create a client secret for the application</li>
          <li>Grant admin consent for the permissions</li>
        </ol>
        <a
          href="https://learn.microsoft.com/en-us/graph/auth-register-app-v2"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mt-2"
        >
          View Microsoft documentation
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
      <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-1.5">Gmail OAuth Setup</h4>
      <ol className="text-xs text-gray-600 dark:text-gray-300 space-y-0.5 list-decimal list-inside">
        <li>Create a project in Google Cloud Console</li>
        <li>Enable the Gmail API</li>
        <li>Create OAuth 2.0 credentials (Web application type)</li>
        <li>Generate a refresh token using the OAuth playground or consent flow</li>
      </ol>
      <a
        href="https://developers.google.com/gmail/api/quickstart/js"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mt-2"
      >
        View Google documentation
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}

function ContactModal({
  mode,
  contact,
  error,
  onSave,
  onClose,
}: {
  mode: 'add' | 'edit';
  contact?: Contact;
  error: string;
  onSave: (name: string, email: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(contact?.name || '');
  const [email, setEmail] = useState(contact?.email || '');

  const isValid = name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <Modal isOpen onClose={onClose} title={mode === 'edit' ? 'Edit Contact' : 'Add Contact'}>
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            placeholder="John Doe"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            placeholder="john@example.com"
          />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(name, email)} disabled={!isValid}>
            {mode === 'edit' ? 'Save Changes' : 'Add Contact'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
