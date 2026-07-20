import { useState, useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';
import { Mail, X, Users, Paperclip, Braces, Table, ChevronUp, ChevronDown, Pencil } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import CustomDropdown from '../../../components/ui/CustomDropdown';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import type { PulseEmailStepConfig, PulseInputVariable } from '../../../types/database';

interface EmailConfigPanelProps {
  config: PulseEmailStepConfig | null;
  onChange: (config: PulseEmailStepConfig) => void;
  upstreamNodes?: { id: string; label: string; queryId?: string }[];
  inputVariables?: PulseInputVariable[];
}

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

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

function VariableInsertButton({
  variables,
  targetRef,
  onInsert,
}: {
  variables: PulseInputVariable[];
  targetRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  onInsert: (newValue: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const insertVariable = (varName: string) => {
    const el = targetRef.current;
    const token = `{{${varName}}}`;
    if (el) {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? start;
      const before = el.value.slice(0, start);
      const after = el.value.slice(end);
      const newVal = before + token + after;
      onInsert(newVal);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      onInsert(token);
    }
    setOpen(false);
  };

  if (!variables.length) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors"
        title="Insert variable"
      >
        <Braces className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50">
          <div className="px-2 py-1.5 border-b border-gray-100 dark:border-gray-700">
            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Insert Variable</p>
          </div>
          {variables.map((v) => (
            <button
              key={v.name}
              type="button"
              onClick={() => insertVariable(v.name)}
              className="w-full text-left px-2 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex items-center justify-between gap-2"
            >
              <span className="text-[11px] font-mono text-indigo-700 dark:text-indigo-300 truncate">{`{{${v.name}}}`}</span>
              <span className="text-[9px] text-gray-400 dark:text-gray-500 flex-shrink-0">{v.dataType}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CompactChipsInput({
  label,
  values,
  onChange,
  teamMembers,
  contacts,
  availableColumns,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  teamMembers: TeamMember[];
  contacts: ContactEntry[];
  availableColumns?: string[];
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const fieldPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker]);

  useEffect(() => {
    if (!showFieldPicker) return;
    const handler = (e: MouseEvent) => {
      if (fieldPickerRef.current && !fieldPickerRef.current.contains(e.target as Node)) {
        setShowFieldPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFieldPicker]);

  const isFieldToken = (val: string) => /^\{\{.+\}\}$/.test(val.trim());

  const commit = () => {
    const trimmed = draft.trim().replace(/,$/, '');
    if (!trimmed) { setDraft(''); return; }
    if (!isFieldToken(trimmed) && !isValidEmail(trimmed)) { setError('Invalid email'); return; }
    if (values.includes(trimmed)) { setDraft(''); return; }
    onChange([...values, trimmed]);
    setDraft('');
    setError(null);
  };

  const insertField = (col: string) => {
    const token = `{{${col}}}`;
    if (!values.includes(token)) {
      onChange([...values, token]);
    }
    setShowFieldPicker(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      if (draft.trim()) { e.preventDefault(); commit(); }
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
      <div className="flex items-center justify-between mb-0.5">
        <label className="text-[10px] font-medium text-gray-600 dark:text-gray-400">{label}</label>
        <div className="flex items-center gap-0.5">
          {availableColumns && availableColumns.length > 0 && (
            <div className="relative" ref={fieldPickerRef}>
              <button
                type="button"
                onClick={() => setShowFieldPicker(!showFieldPicker)}
                className="p-0.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors"
                title="Insert query field"
              >
                <Braces className="w-3 h-3" />
              </button>
              {showFieldPicker && (
                <div className="absolute right-0 top-full mt-1 w-52 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50">
                  <div className="px-2 py-1.5 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Query Field</p>
                  </div>
                  {availableColumns.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => insertField(col)}
                      className="w-full text-left px-2 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-[11px] font-mono text-gray-800 dark:text-gray-200 truncate"
                    >
                      {col}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="relative" ref={pickerRef}>
            <button
              type="button"
              onClick={() => setShowPicker(!showPicker)}
              className="p-0.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors"
            >
              <Users className="w-3 h-3" />
            </button>
          {showPicker && (
            <div className="absolute right-0 top-full mt-1 w-56 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50">
              {teamMembers.length === 0 && contacts.length === 0 ? (
                <div className="px-2 py-1.5 text-[10px] text-gray-500">No members found</div>
              ) : (
                <>
                  {teamMembers.map(m => (
                    <label key={m.user_id} className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={values.map(v => v.toLowerCase()).includes(m.email.toLowerCase())}
                        onChange={() => toggleMember(m.email)}
                        className="w-3 h-3 rounded border-gray-300 dark:border-gray-600 text-blue-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-gray-900 dark:text-white truncate">{m.full_name || m.username || m.email}</p>
                      </div>
                    </label>
                  ))}
                  {contacts.map(c => (
                    <label key={c.id} className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={values.map(v => v.toLowerCase()).includes(c.email.toLowerCase())}
                        onChange={() => toggleMember(c.email)}
                        className="w-3 h-3 rounded border-gray-300 dark:border-gray-600 text-blue-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-gray-900 dark:text-white truncate">{c.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{c.email}</p>
                      </div>
                    </label>
                  ))}
                </>
              )}
            </div>
          )}
          </div>
        </div>
      </div>
      <div className={`flex flex-wrap items-center gap-1 min-h-[28px] px-1.5 py-1 border rounded-md bg-white dark:bg-gray-700 ${
        error ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
      }`}>
        {values.map(email => {
          const isToken = /^\{\{.+\}\}$/.test(email);
          return (
            <span key={email} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] ${
              isToken
                ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-mono'
                : 'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-100'
            }`}>
              {email}
              <button type="button" onClick={() => onChange(values.filter(v => v !== email))} className="hover:text-red-600">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          );
        })}
        <input
          type="text"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); if (error) setError(null); }}
          onKeyDown={handleKeyDown}
          onBlur={() => draft && commit()}
          placeholder={values.length === 0 ? 'email@example.com' : ''}
          className="flex-1 min-w-[80px] px-0.5 py-0.5 bg-transparent text-[11px] text-gray-900 dark:text-white outline-none"
        />
      </div>
      {error && <p className="text-[10px] text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}

function ResultsTableModal({
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

  const formatOptions = [
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

    const lastKnown = (query.last_known_columns || []) as string[];
    if (lastKnown.length > 0) {
      setColumns(lastKnown);
      if (initialSelected.length === 0) {
        setSelected(lastKnown);
      }
      setLoading(false);
      return;
    }

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
    <Modal isOpen onClose={onClose} title="Insert Results Table" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Select the columns to include in the HTML table embedded in the email body.
        </p>

        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rtm-includeHeader"
              checked={includeHeader}
              onChange={(e) => setIncludeHeader(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <label htmlFor="rtm-includeHeader" className="text-sm text-gray-700 dark:text-gray-300">
              Include Header Row
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rtm-useAliases"
              checked={useAliases}
              onChange={(e) => setUseAliases(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <label htmlFor="rtm-useAliases" className="text-sm text-gray-700 dark:text-gray-300">
              Column Aliases
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rtm-useFormats"
              checked={useFormats}
              onChange={(e) => setUseFormats(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <label htmlFor="rtm-useFormats" className="text-sm text-gray-700 dark:text-gray-300">
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
            No columns available. Run a test in the Query Manager first, or ensure the API spec has response fields defined.
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

export default function EmailConfigPanel({ config, onChange, upstreamNodes, inputVariables }: EmailConfigPanelProps) {
  const { activeCompany } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [showCc, setShowCc] = useState(!!config?.ccRecipients?.length);
  const [showBcc, setShowBcc] = useState(!!config?.bccRecipients?.length);
  const [showTableModal, setShowTableModal] = useState(false);
  const [recipientColumns, setRecipientColumns] = useState<string[]>([]);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const baseConfig: PulseEmailStepConfig = {
    stepType: 'email',
    name: '',
    toRecipients: [],
    subject: '{pulse_name} - {date}',
    bodyType: 'plain',
    body: '',
    onlySendIfResults: true,
    ...config,
  };
  const current: PulseEmailStepConfig = {
    ...baseConfig,
    toRecipients: baseConfig.toRecipients || [],
    ccRecipients: baseConfig.ccRecipients || [],
    bccRecipients: baseConfig.bccRecipients || [],
  };

  const dataSourceQueryId = (() => {
    if (!current.dataSource || !upstreamNodes) return null;
    const node = upstreamNodes.find(n => n.id === current.dataSource);
    return node?.queryId || null;
  })();

  const upstreamQueryIds = (upstreamNodes || [])
    .map(n => n.queryId)
    .filter((id): id is string => !!id);

  useEffect(() => {
    if (upstreamQueryIds.length === 0) { setRecipientColumns([]); return; }
    (async () => {
      const allCols: string[] = [];
      for (const qId of upstreamQueryIds) {
        const { data: query } = await supabase
          .from('queries')
          .select('last_known_columns, api_endpoints(id)')
          .eq('id', qId)
          .maybeSingle();
        if (!query) continue;
        const raw = (query.last_known_columns || []) as string[];
        if (raw.length === 0) {
          const ep = query.api_endpoints as { id: string } | null;
          if (ep) {
            const { data: fields } = await supabase
              .from('api_endpoint_fields')
              .select('field_name')
              .eq('endpoint_id', ep.id)
              .eq('field_type', 'response')
              .order('field_name');
            for (const f of (fields || [])) { if (!allCols.includes(f.field_name)) allCols.push(f.field_name); }
          }
          continue;
        }
        // Handle two storage formats:
        // 1. Clean: ["COL_A", "COL_B"]
        // 2. Corrupted fragments of JSON objects that need rejoining
        const firstEl = raw[0];
        if (firstEl.startsWith('[') || firstEl.includes('"name"')) {
          try {
            const joined = raw.join(',');
            const parsed = JSON.parse(joined) as { name: string }[];
            for (const item of parsed) { if (item.name && !allCols.includes(item.name)) allCols.push(item.name); }
          } catch {
            // Try extracting "name":"VALUE" patterns via regex
            const joined = raw.join(',');
            const matches = joined.matchAll(/"name"\s*:\s*"([^"]+)"/g);
            for (const m of matches) { if (!allCols.includes(m[1])) allCols.push(m[1]); }
          }
        } else {
          for (const c of raw) { if (!allCols.includes(c)) allCols.push(c); }
        }
      }
      setRecipientColumns(allCols);
    })();
  }, [upstreamQueryIds.join(',')])

  const resultsTableColumns = current.resultsTableColumns || [];
  const hasResultsTable = resultsTableColumns.length > 0 || current.body?.includes('{results_table}');

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

  const emit = (updates: Partial<PulseEmailStepConfig>) => {
    onChange({ ...current, ...updates });
  };

  const handleInsertResultsTable = (
    columns: string[],
    aliases: Record<string, string>,
    includeHeader: boolean,
    formats: Record<string, string>
  ) => {
    const token = '{results_table}';
    let newBody = current.body || '';
    if (!newBody.includes(token)) {
      newBody = newBody ? newBody + '\n' + token : token;
    }
    emit({
      body: newBody,
      resultsTableColumns: columns,
      columnAliases: aliases,
      columnFormats: formats,
      includeHeaderRow: includeHeader,
    });
    setShowTableModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-3 border-b border-gray-200 dark:border-gray-700">
        <div className="w-7 h-7 rounded-md bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
          <Mail className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-900 dark:text-white">Email</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">Delivery Configuration</p>
        </div>
      </div>

      {/* Step Name */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
          Step Name
        </label>
        <input
          type="text"
          value={current.name}
          onChange={(e) => emit({ name: e.target.value })}
          placeholder="e.g. Send Report"
          className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Recipients */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Recipients
          </label>
          <div className="flex items-center gap-1">
            {!showCc && (
              <button type="button" onClick={() => setShowCc(true)} className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline">
                +CC
              </button>
            )}
            {!showBcc && (
              <button type="button" onClick={() => setShowBcc(true)} className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline">
                +BCC
              </button>
            )}
          </div>
        </div>

        <CompactChipsInput
          label="To"
          values={current.toRecipients}
          onChange={(vals) => emit({ toRecipients: vals })}
          teamMembers={teamMembers}
          contacts={contacts}
          availableColumns={recipientColumns}
        />

        {showCc && (
          <CompactChipsInput
            label="CC"
            values={current.ccRecipients || []}
            onChange={(vals) => emit({ ccRecipients: vals })}
            teamMembers={teamMembers}
            contacts={contacts}
            availableColumns={recipientColumns}
          />
        )}

        {showBcc && (
          <CompactChipsInput
            label="BCC"
            values={current.bccRecipients || []}
            onChange={(vals) => emit({ bccRecipients: vals })}
            teamMembers={teamMembers}
            contacts={contacts}
            availableColumns={recipientColumns}
          />
        )}
      </div>

      {/* Subject */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Subject
          </label>
          {inputVariables && inputVariables.length > 0 && (
            <VariableInsertButton
              variables={inputVariables}
              targetRef={subjectRef}
              onInsert={(val) => emit({ subject: val })}
            />
          )}
        </div>
        <input
          ref={subjectRef}
          type="text"
          value={current.subject}
          onChange={(e) => emit({ subject: e.target.value })}
          placeholder="{pulse_name} - {date}"
          className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <p className="text-[10px] text-gray-400 mt-0.5">Variables: {'{pulse_name}'}, {'{date}'}, {'{time}'}</p>
      </div>

      {/* Body */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Body
          </label>
          <div className="flex items-center gap-1">
            {inputVariables && inputVariables.length > 0 && (
              <VariableInsertButton
                variables={inputVariables}
                targetRef={bodyRef}
                onInsert={(val) => emit({ body: val })}
              />
            )}
            <CustomDropdown
              value={current.bodyType}
              onChange={(val) => emit({ bodyType: val as 'html' | 'plain' })}
              options={[
                { value: 'html', label: 'HTML' },
                { value: 'plain', label: 'Plain' },
              ]}
            />
          </div>
        </div>
        <textarea
          ref={bodyRef}
          value={current.body}
          onChange={(e) => emit({ body: e.target.value })}
          placeholder={current.bodyType === 'html' ? '<p>Hello,</p>\n<p>Please find attached...</p>\n{results_table}' : 'Hello,\n\nPlease find attached...'}
          rows={4}
          className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
        />
        <p className="text-[10px] text-gray-400 mt-0.5">
          Use <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{results_table}'}</code> to embed query results.
        </p>
      </div>

      {/* Results Table */}
      <div className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Table className="w-3 h-3 text-gray-500 dark:text-gray-400" />
            <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
              Results Table
            </span>
          </div>
          {hasResultsTable && (
            <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
              {resultsTableColumns.length} columns
            </span>
          )}
        </div>

        {!current.dataSource ? (
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            Select a data source below to configure results table columns.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setShowTableModal(true)}
            className="w-full px-2.5 py-2 text-[11px] font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-md transition-colors flex items-center justify-center gap-1.5"
          >
            <Table className="w-3 h-3" />
            {hasResultsTable ? 'Edit Results Table Columns' : 'Insert Results Table'}
          </button>
        )}

        {upstreamNodes && upstreamNodes.length > 0 && (
          <div>
            <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">Data Source</label>
            <CustomDropdown
              value={current.dataSource || ''}
              onChange={(val) => emit({ dataSource: val, resultsTableColumns: [], columnAliases: {}, columnFormats: {} })}
              options={upstreamNodes.map(n => ({ value: n.id, label: n.label }))}
              placeholder="Select upstream query..."
            />
          </div>
        )}
      </div>

      {/* Attachment */}
      <div className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Paperclip className="w-3 h-3 text-gray-500 dark:text-gray-400" />
            <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
              Attachment
            </span>
          </div>
          <button
            type="button"
            onClick={() => emit({ includeAttachment: !current.includeAttachment })}
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
              current.includeAttachment ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
              current.includeAttachment ? 'translate-x-[14px]' : 'translate-x-[2px]'
            }`} />
          </button>
        </div>

        {current.includeAttachment && (
          <>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">Format</label>
              <CustomDropdown
                value={current.attachmentFormat || 'csv'}
                onChange={(val) => emit({ attachmentFormat: val as 'csv' | 'xlsx' | 'json' })}
                options={[
                  { value: 'csv', label: 'CSV' },
                  { value: 'xlsx', label: 'Excel (XLSX)' },
                  { value: 'json', label: 'JSON' },
                ]}
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">Filename</label>
              <input
                type="text"
                value={current.attachmentFilename || ''}
                onChange={(e) => emit({ attachmentFilename: e.target.value })}
                placeholder="report_{date}.csv"
                className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </>
        )}
      </div>

      {/* Options */}
      <div className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
        <span className="text-[10px] text-gray-600 dark:text-gray-300">Only send if data exists</span>
        <button
          type="button"
          onClick={() => emit({ onlySendIfResults: !current.onlySendIfResults })}
          className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
            current.onlySendIfResults ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
            current.onlySendIfResults ? 'translate-x-[14px]' : 'translate-x-[2px]'
          }`} />
        </button>
      </div>

      {/* Input Variables Reference */}
      {inputVariables && inputVariables.length > 0 && (
        <div className="p-3 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800 rounded-lg">
          <p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">
            Input Variables
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">
            Use these in subject/body to reference data from the triggering action:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {inputVariables.map((v) => (
              <span
                key={v.name}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-[10px] font-mono cursor-default"
                title={`${v.label || v.name} (${v.dataType})`}
              >
                {`{{${v.name}}}`}
                <span className="text-indigo-400 dark:text-indigo-500 text-[9px] font-sans">{v.dataType}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {showTableModal && (
        <ResultsTableModal
          queryId={dataSourceQueryId}
          selectedColumns={current.resultsTableColumns || []}
          initialAliases={current.columnAliases || {}}
          initialFormats={current.columnFormats || {}}
          initialIncludeHeader={current.includeHeaderRow !== false}
          onInsert={handleInsertResultsTable}
          onClose={() => setShowTableModal(false)}
        />
      )}
    </div>
  );
}
