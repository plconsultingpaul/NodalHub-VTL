import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, AlertCircle, Users } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { logActivity } from '../../lib/activityLog';
import type { EmailConfiguration } from '../../types/database';

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

interface EmailCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  csvContent: string;
  filename: string;
  cellTitle: string;
}

function TeamMemberPicker({
  members,
  contacts,
  onSelect,
  currentValue,
}: {
  members: TeamMember[];
  contacts: ContactEntry[];
  onSelect: (emails: string[]) => void;
  currentValue: string;
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

  const currentEmails = currentValue
    .split(/[,;]\s*/)
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  const toggleMember = (email: string) => {
    const lower = email.toLowerCase();
    if (currentEmails.includes(lower)) {
      onSelect(currentEmails.filter(e => e !== lower));
    } else {
      onSelect([...currentEmails, lower]);
    }
  };

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
                  {members.map(m => {
                    const isChecked = currentEmails.includes(m.email.toLowerCase());
                    return (
                      <label
                        key={m.user_id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleMember(m.email)}
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
                  {contacts.map(c => {
                    const isChecked = currentEmails.includes(c.email.toLowerCase());
                    return (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleMember(c.email)}
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

export default function EmailCsvModal({ isOpen, onClose, csvContent, filename, cellTitle }: EmailCsvModalProps) {
  const { activeCompany } = useAuth();
  const [emailConfig, setEmailConfig] = useState<EmailConfiguration | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [contacts, setContacts] = useState<ContactEntry[]>([]);

  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSubject(`Re: ${cellTitle} - ${filename}`);
      setError(null);
      setSuccess(false);
      fetchDefaultEmailConfig();
      fetchTeamMembers();
    }
  }, [isOpen, cellTitle, filename]);

  const fetchDefaultEmailConfig = async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('email_configurations')
      .select('*')
      .eq('company_id', activeCompany.id)
      .eq('is_configured', true)
      .order('is_default', { ascending: false })
      .limit(1)
      .maybeSingle();

    setEmailConfig(data);
    setLoading(false);
  };

  const fetchTeamMembers = async () => {
    if (!activeCompany?.id) return;
    const { data } = await supabase
      .from('company_memberships')
      .select(`
        user_id,
        profiles:user_id (email, full_name, username)
      `)
      .eq('company_id', activeCompany.id);

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

    const { data: contactData } = await supabase
      .from('contacts')
      .select('id, name, email')
      .eq('company_id', activeCompany.id)
      .order('name');

    if (contactData) setContacts(contactData);
  };

  const handleSend = async () => {
    if (!to.trim()) {
      setError('To field is required');
      return;
    }
    if (!emailConfig) {
      setError('No email configuration found');
      return;
    }

    setSending(true);
    setError(null);

    const { data, error: fnError } = await supabase.functions.invoke('send-csv-email', {
      body: {
        configId: emailConfig.id,
        to: to.trim(),
        cc: cc.trim() || undefined,
        bcc: bcc.trim() || undefined,
        subject,
        message,
        csvContent,
        filename,
      },
    });

    setSending(false);

    if (fnError || data?.error) {
      setError(fnError?.message || data?.error || 'Failed to send email');
      return;
    }

    setSuccess(true);
    if (activeCompany) {
      logActivity('csv_email', activeCompany.id, cellTitle, undefined, { to: to.trim() });
    }
    setTimeout(() => {
      onClose();
      setTo('');
      setCc('');
      setBcc('');
      setMessage('');
      setSuccess(false);
    }, 1500);
  };

  const handleMemberSelect = (field: 'to' | 'cc' | 'bcc', emails: string[]) => {
    const joined = emails.join(', ');
    if (field === 'to') setTo(joined);
    else if (field === 'cc') setCc(joined);
    else setBcc(joined);
  };

  const fileSizeKb = Math.round((csvContent.length) / 1024);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Email Report" size="lg">
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-gray-900 dark:border-white border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !emailConfig ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <AlertCircle className="w-10 h-10 text-amber-500" />
          <p className="text-sm text-gray-700 dark:text-gray-300">No email configuration found.</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Configure an email provider in Settings &gt; Email to use this feature.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">From</label>
            <input
              type="text"
              value={emailConfig.send_from_email}
              disabled
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">To <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@example.com"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <TeamMemberPicker
                members={teamMembers}
                contacts={contacts}
                currentValue={to}
                onSelect={(emails) => handleMemberSelect('to', emails)}
              />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Separate multiple emails with a comma</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">CC</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="cc@example.com"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <TeamMemberPicker
                  members={teamMembers}
                  contacts={contacts}
                  currentValue={cc}
                  onSelect={(emails) => handleMemberSelect('cc', emails)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">BCC</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="bcc@example.com"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <TeamMemberPicker
                  members={teamMembers}
                  contacts={contacts}
                  currentValue={bcc}
                  onSelect={(emails) => handleMemberSelect('bcc', emails)}
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Attached</label>
            <div className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              <Paperclip className="w-3.5 h-3.5 text-gray-500" />
              <span>{filename}</span>
              <span className="text-xs text-gray-400 ml-auto">{fileSizeKb} KB</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Optional message body..."
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-md">
              <span>Email sent successfully!</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !to.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}