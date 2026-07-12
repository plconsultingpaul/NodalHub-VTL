import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { X, Table2, Pencil, ChevronUp, ChevronDown, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import CustomDropdown from '../../components/ui/CustomDropdown';
import type { PulseEmail } from '../../types/database';

interface EmailTabProps {
  draft: Partial<PulseEmail>;
  onChange: (updates: Partial<PulseEmail>) => void;
  exportEnabled: boolean;
  queryId: string | null;
}

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

interface TeamMember {
  user_id: string;
  email: string;
  full_name: string | null;
  username: string | null;
}

interface ContactEntry {
  id: string;
  name: string;
  email: string;
}

interface ChipsInputProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  teamMembers: TeamMember[];
  contacts: ContactEntry[];
}

function TeamMemberDropdown({
  members,
  contacts,
  selectedEmails,
  onToggle,
}: {
  members: TeamMember[];
  contacts: ContactEntry[];
  selectedEmails: string[];
  onToggle: (email: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const hasEntries = members.length > 0 || contacts.length > 0;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
        title="Select team members & contacts"
      >
        <Users className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 max-h-64 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50">
          {!hasEntries ? (
            <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">No team members or contacts found</div>
          ) : (
            <>
              {members.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-750 sticky top-0">
                    Team Members
                  </div>
                  {members.map((m) => {
                    const isChecked = selectedEmails.includes(m.email.toLowerCase());
                    return (
                      <label
                        key={m.user_id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => onToggle(m.email)}
                          className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-900 dark:text-white truncate">
                            {m.full_name || m.username || m.email}
                          </div>
                          {(m.full_name || m.username) && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{m.email}</div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </>
              )}
              {contacts.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-750 sticky top-0">
                    Contacts
                  </div>
                  {contacts.map((c) => {
                    const isChecked = selectedEmails.includes(c.email.toLowerCase());
                    return (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => onToggle(c.email)}
                          className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-900 dark:text-white truncate">
                            {c.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{c.email}</div>
                        </div>
                      </label>
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ChipsInput({ label, values, onChange, disabled, teamMembers, contacts }: ChipsInputProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    const trimmed = draft.trim().replace(/,$/, '');
    if (!trimmed) {
      setDraft('');
      return;
    }
    if (!isValidEmail(trimmed)) {
      setError('Not a valid email address');
      return;
    }
    if (values.includes(trimmed)) {
      setDraft('');
      return;
    }
    onChange([...values, trimmed]);
    setDraft('');
    setError(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      if (draft.trim()) {
        e.preventDefault();
        commit();
      }
    } else if (e.key === 'Backspace' && !draft && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  const toggleMember = (email: string) => {
    const lower = email.toLowerCase();
    if (values.map(v => v.toLowerCase()).includes(lower)) {
      onChange(values.filter(v => v.toLowerCase() !== lower));
    } else {
      onChange([...values, email]);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        <TeamMemberDropdown
          members={teamMembers}
          contacts={contacts}
          selectedEmails={values.map(v => v.toLowerCase())}
          onToggle={toggleMember}
        />
      </div>
      <div
        className={`flex flex-wrap items-center gap-1.5 min-h-[42px] px-2 py-1.5 border rounded-md bg-white dark:bg-gray-700 ${
          error ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
        } ${disabled ? 'opacity-50' : ''}`}
      >
        {values.map((email) => (
          <span
            key={email}
            className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-100"
          >
            {email}
            <button
              type="button"
              onClick={() => onChange(values.filter((v) => v !== email))}
              className="hover:text-red-600"
              disabled={disabled}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => draft && commit()}
          disabled={disabled}
          placeholder={values.length === 0 ? 'name@example.com' : ''}
          className="flex-1 min-w-[160px] px-1 py-1 bg-transparent text-sm text-gray-900 dark:text-white outline-none"
        />
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
    </div>
  );
}

export default function EmailTab({ draft, onChange, exportEnabled, queryId }: EmailTabProps) {
  const { activeCompany } = useAuth();
  const enabled = draft.enabled ?? false;
  const to = draft.to_recipients || [];
  const cc = draft.cc_recipients || [];
  const bcc = draft.bcc_recipients || [];
  const subject = draft.subject_template || '{pulse_name} – {date}';
  const body = draft.body_template || '';
  const attachExport = (draft.attach_export ?? true) && exportEnabled;
  const onlyIfResults = draft.only_send_if_results ?? true;
  const resultsTableColumns: string[] = draft.results_table_columns || [];
  const columnAliases: Record<string, string> = draft.column_aliases || {};
  const columnFormats: Record<string, string> = draft.column_formats || {};
  const includeHeaderRow = draft.include_header_row ?? true;

  const [showTableModal, setShowTableModal] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!activeCompany?.id) return;
    supabase
      .from('company_memberships')
      .select('user_id, profiles:user_id (email, full_name, username)')
      .eq('company_id', activeCompany.id)
      .then(({ data }) => {
        if (data) {
          const members: TeamMember[] = data
            .map((m: any) => ({
              user_id: m.user_id,
              email: m.profiles?.email || '',
              full_name: m.profiles?.full_name || null,
              username: m.profiles?.username || null,
            }))
            .filter((m: TeamMember) => m.email);
          setTeamMembers(members);
        }
      });
    supabase
      .from('contacts')
      .select('id, name, email')
      .eq('company_id', activeCompany.id)
      .order('name')
      .then(({ data }) => {
        if (data) setContacts(data);
      });
  }, [activeCompany?.id]);

  const handleInsertToken = (columns: string[], aliases: Record<string, string>, includeHeader: boolean, formats: Record<string, string>) => {
    onChange({
      results_table_columns: columns,
      column_aliases: aliases,
      column_formats: formats,
      include_header_row: includeHeader,
      include_results_table: true,
    });

    const textarea = bodyRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = body.slice(0, start);
      const after = body.slice(end);
      const token = '{results_table}';
      if (!body.includes(token)) {
        onChange({ body_template: before + token + after });
      }
    } else if (!body.includes('{results_table}')) {
      onChange({ body_template: body + '\n{results_table}' });
    }
    setShowTableModal(false);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">Send email</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Sends a notification with a summary and optional attachment.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ enabled: !enabled })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div className={enabled ? 'space-y-6' : 'space-y-6 opacity-50 pointer-events-none'}>
        <div className="space-y-4">
          <ChipsInput label="To" values={to} onChange={(v) => onChange({ to_recipients: v })} teamMembers={teamMembers} contacts={contacts} />
          <ChipsInput label="CC" values={cc} onChange={(v) => onChange({ cc_recipients: v })} teamMembers={teamMembers} contacts={contacts} />
          <ChipsInput label="BCC" values={bcc} onChange={(v) => onChange({ bcc_recipients: v })} teamMembers={teamMembers} contacts={contacts} />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Type an email and press <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-[10px] font-mono">Enter</kbd> or <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-[10px] font-mono">,</kbd> to add it. Use the <Users className="w-3 h-3 inline" /> button to pick from team members and contacts.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => onChange({ subject_template: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            placeholder="{pulse_name} – {date}"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Body</label>
            <button
              type="button"
              onClick={() => setShowTableModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md transition-colors border border-blue-200 dark:border-blue-800"
            >
              <Table2 className="w-3.5 h-3.5" />
              Insert Results Table
            </button>
          </div>
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => onChange({ body_template: e.target.value })}
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm font-mono"
            placeholder={'Hi team,\n\nResults for {pulse_name} on {date} are attached.\n\n{results_table}'}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Tokens: <code className="font-mono">{'{pulse_name}'}</code>{' '}
            <code className="font-mono">{'{date}'}</code>{' '}
            <code className="font-mono">{'{row_count}'}</code>{' '}
            <code className="font-mono">{'{group}'}</code>{' '}
            <code className="font-mono bg-blue-50 dark:bg-blue-900/30 px-1 rounded">{'{results_table}'}</code>
          </p>
        </div>

        <div className="space-y-3">
          <div
            className={`flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700 ${
              !exportEnabled ? 'opacity-50' : ''
            }`}
          >
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Attach export file</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {exportEnabled
                  ? 'Attach the CSV/XLSX produced by the Export tab.'
                  : 'Enable export on the Export tab to attach files.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChange({ attach_export: !attachExport })}
              disabled={!exportEnabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                attachExport ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  attachExport ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Only send if there are results</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Skip the email when the query returns zero rows.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChange({ only_send_if_results: !onlyIfResults })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                onlyIfResults ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  onlyIfResults ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {showTableModal && (
        <InsertResultsTableModal
          queryId={queryId}
          selectedColumns={resultsTableColumns}
          initialAliases={columnAliases}
          initialFormats={columnFormats}
          initialIncludeHeader={includeHeaderRow}
          onInsert={handleInsertToken}
          onClose={() => setShowTableModal(false)}
        />
      )}
    </div>
  );
}

function InsertResultsTableModal({
  queryId,
  selectedColumns: initialSelected,
  initialAliases,
  initialFormats,
  initialIncludeHeader,
  onInsert,
  onClose,
}: {
  queryId: string | null;
  selectedColumns: string[];
  initialAliases: Record<string, string>;
  initialFormats: Record<string, string>;
  initialIncludeHeader: boolean;
  onInsert: (columns: string[], aliases: Record<string, string>, includeHeader: boolean, formats: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [columns, setColumns] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [aliases, setAliases] = useState<Record<string, string>>(initialAliases);
  const [formats, setFormats] = useState<Record<string, string>>(initialFormats);
  const [useAliases, setUseAliases] = useState(Object.keys(initialAliases).length > 0);
  const [useFormats, setUseFormats] = useState(Object.keys(initialFormats).length > 0);
  const [includeHeader, setIncludeHeader] = useState(initialIncludeHeader);
  const [editingAlias, setEditingAlias] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const formatOptions: { value: string; label: string }[] = [
    { value: '', label: 'Raw (no format)' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
    { value: 'DD-MMM-YYYY', label: 'DD-MMM-YYYY' },
    { value: 'D MMMM YYYY', label: 'D MMMM YYYY' },
    { value: 'MMMM D, YYYY', label: 'MMMM D, YYYY' },
    { value: 'DD/MM/YY', label: 'DD/MM/YY' },
    { value: 'MM/DD/YY', label: 'MM/DD/YY' },
    { value: 'DD-MMM-YY', label: 'DD-MMM-YY' },
    { value: 'YYYY-MM-DD HH:mm', label: 'YYYY-MM-DD HH:mm' },
    { value: 'DD/MM/YYYY HH:mm', label: 'DD/MM/YYYY HH:mm' },
    { value: 'MM/DD/YYYY h:mm a', label: 'MM/DD/YYYY h:mm a' },
  ];

  useEffect(() => {
    fetchColumns();
  }, [queryId]);

  const fetchColumns = async () => {
    if (!queryId) {
      setColumns([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: query } = await supabase
      .from('queries')
      .select('*, api_endpoints(*)')
      .eq('id', queryId)
      .maybeSingle();

    if (!query) {
      setColumns([]);
      setLoading(false);
      return;
    }

    // Try last_known_columns first (most reliable - populated by test runs)
    const lastKnown = (query.last_known_columns || []) as string[];
    if (lastKnown.length > 0) {
      setColumns(lastKnown);
      if (initialSelected.length === 0) {
        setSelected(lastKnown);
      }
      setLoading(false);
      return;
    }

    // Fallback: api_endpoint_fields
    if (query.api_endpoints) {
      const endpointId = (query.api_endpoints as { id: string }).id;
      const { data: fields } = await supabase
        .from('api_endpoint_fields')
        .select('field_name')
        .eq('endpoint_id', endpointId)
        .eq('field_type', 'response')
        .order('field_name');

      const cols = (fields || []).map((f) => f.field_name);
      setColumns(cols);
      if (initialSelected.length === 0 && cols.length > 0) {
        setSelected(cols);
      }
    }

    setLoading(false);
  };

  const toggleColumn = (col: string) => {
    setSelected((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const selectAll = () => setSelected([...columns]);
  const deselectAll = () => setSelected([]);

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...selected];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setSelected(next);
  };

  const moveDown = (idx: number) => {
    if (idx === selected.length - 1) return;
    const next = [...selected];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setSelected(next);
  };

  const updateAlias = (col: string, alias: string) => {
    setAliases(prev => {
      if (!alias.trim()) {
        const next = { ...prev };
        delete next[col];
        return next;
      }
      return { ...prev, [col]: alias.trim() };
    });
  };

  const handleInsert = () => {
    const finalAliases = useAliases ? aliases : {};
    const finalFormats = useFormats ? formats : {};
    onInsert(selected, finalAliases, includeHeader, finalFormats);
  };

  return (
    <Modal isOpen onClose={onClose} title="Insert Results Table">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Select the columns to include in the HTML table embedded in the email body.
        </p>

        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="includeHeader"
              checked={includeHeader}
              onChange={(e) => setIncludeHeader(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <label htmlFor="includeHeader" className="text-sm text-gray-700 dark:text-gray-300">
              Include Header Row
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useAliases"
              checked={useAliases}
              onChange={(e) => setUseAliases(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <label htmlFor="useAliases" className="text-sm text-gray-700 dark:text-gray-300">
              Column Aliases
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useFormats"
              checked={useFormats}
              onChange={(e) => setUseFormats(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <label htmlFor="useFormats" className="text-sm text-gray-700 dark:text-gray-300">
              Date Formats
            </label>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
          </div>
        ) : columns.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            No columns available. Run a test in the Query tab first, or ensure the API spec has response fields defined.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded transition-colors"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={deselectAll}
                className="px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              >
                Deselect All
              </button>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-72 overflow-y-auto">
              {/* Header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 sticky top-0">
                <div className="w-5" />
                <span className="flex-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Column</span>
                {useAliases && (
                  <span className="w-36 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Alias</span>
                )}
                {useFormats && (
                  <span className="w-40 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Format</span>
                )}
                <div className="w-14" />
              </div>
              {columns.map((col) => {
                const isSelected = selected.includes(col);
                const selectedIdx = selected.indexOf(col);
                const isEditing = editingAlias === col;
                return (
                  <div
                    key={col}
                    className={`flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                      isSelected ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleColumn(col)}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    <span className="flex-1 text-sm text-gray-900 dark:text-white font-mono truncate">
                      {col}
                    </span>
                    {useAliases && (
                      <div className="w-36 flex items-center gap-1">
                        {isEditing ? (
                          <input
                            type="text"
                            autoFocus
                            defaultValue={aliases[col] || ''}
                            onBlur={(e) => {
                              updateAlias(col, e.target.value);
                              setEditingAlias(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                updateAlias(col, (e.target as HTMLInputElement).value);
                                setEditingAlias(null);
                              } else if (e.key === 'Escape') {
                                setEditingAlias(null);
                              }
                            }}
                            className="w-full px-2 py-1 text-xs border border-blue-400 dark:border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Display name..."
                          />
                        ) : (
                          <>
                            <span className="flex-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                              {aliases[col] || ''}
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingAlias(col)}
                              className="p-0.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                              title="Edit alias"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    {useFormats && (
                      <div className="w-40">
                        <CustomDropdown
                          value={formats[col] || ''}
                          onChange={(v) => setFormats(prev => {
                            if (!v) {
                              const next = { ...prev };
                              delete next[col];
                              return next;
                            }
                            return { ...prev, [col]: v };
                          })}
                          options={formatOptions}
                          placeholder="None"
                          size="sm"
                        />
                      </div>
                    )}
                    {isSelected && (
                      <div className="flex items-center gap-0.5 w-14 justify-end">
                        <button
                          type="button"
                          onClick={() => moveUp(selectedIdx)}
                          disabled={selectedIdx === 0}
                          className="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveDown(selectedIdx)}
                          disabled={selectedIdx === selected.length - 1}
                          className="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    {!isSelected && <div className="w-14" />}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleInsert} disabled={selected.length === 0 && columns.length > 0}>
            Insert
          </Button>
        </div>
      </div>
    </Modal>
  );
}
