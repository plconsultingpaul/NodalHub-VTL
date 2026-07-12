import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/activityLog';
import Button from '../../components/ui/Button';
import CustomDropdown from '../../components/ui/CustomDropdown';
import Modal from '../../components/ui/Modal';
import PermissionsPanel, { PermissionEntry } from '../../components/PermissionsPanel';
import { UserPlus, Send, Pencil, Link2, Shield, Trash2, Clock, Mail, ClipboardList, Eye, RotateCcw, Check, UserX, UserCheck } from 'lucide-react';

interface Member {
  id: string;
  user_id: string;
  role: 'Admin' | 'User';
  status: 'active' | 'inactive';
  invitation_sent_at: string | null;
  invitation_sent_count: number;
  created_at: string;
  profile: {
    username: string | null;
    full_name: string;
    email: string;
    avatar_url: string | null;
    last_login_at: string | null;
  };
}

interface EmailTemplate {
  id: string;
  template_name: string;
  template_type: string;
  subject: string;
  body_html: string;
  description: string;
  is_default: boolean;
  company_id: string | null;
}

type WizardStep = 1 | 2 | 3;

export default function TeamMembers() {
  const { activeCompany, companies, user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Add User Wizard state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteIsAdmin, setInviteIsAdmin] = useState(false);
  const [inviteCompanyId, setInviteCompanyId] = useState<string>('');
  const [invitePermissions, setInvitePermissions] = useState<PermissionEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);

  // Edit User state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Member | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Permissions Modal state
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [permissionsTarget, setPermissionsTarget] = useState<Member | null>(null);
  const [editPermissions, setEditPermissions] = useState<PermissionEntry[]>([]);
  const [permissionsSaving, setPermissionsSaving] = useState(false);

  // Password Modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<Member | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);
  const [deletingMember, setDeletingMember] = useState<string | null>(null);

  // Template state
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateHtml, setTemplateHtml] = useState('');
  const [templateSaving, setTemplateSaving] = useState(false);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);

  const adminCompanies = companies.filter(c => c.role === 'Admin');

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('invitation_email_templates')
      .select('*')
      .is('company_id', null)
      .order('template_type');
    if (data) setTemplates(data);
  };

  const openTemplateEditor = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setTemplateSubject(template.subject);
    setTemplateHtml(template.body_html);
    setShowTemplateEditor(true);
  };

  const handleTemplateSave = async () => {
    if (!editingTemplate) return;
    setTemplateSaving(true);
    await supabase
      .from('invitation_email_templates')
      .update({
        subject: templateSubject,
        body_html: templateHtml,
        is_default: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingTemplate.id);
    setShowTemplateEditor(false);
    setEditingTemplate(null);
    await fetchTemplates();
    setTemplateSaving(false);
  };

  const handleTemplateReset = async () => {
    if (!editingTemplate) return;
    setTemplateSaving(true);
    const defaults: Record<string, { subject: string; body_html: string }> = {
      admin_invitation: {
        subject: 'You have been invited to {{company_name}}',
        body_html: '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;margin:0;padding:0;background:#f4f7fa"><div style="max-width:600px;margin:40px auto;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.08);overflow:hidden"><div style="background:#1e293b;padding:32px;text-align:center"><h1 style="color:#fff;margin:0;font-size:24px">Welcome to {{company_name}}</h1></div><div style="padding:32px"><p style="color:#334155;line-height:1.6;margin:0 0 16px">Hello {{name}},</p><p style="color:#334155;line-height:1.6;margin:0 0 16px">You have been invited to join <strong>{{company_name}}</strong>. Your username is: <strong>{{username}}</strong></p><p style="color:#334155;line-height:1.6;margin:0 0 16px">Please click the button below to set your password and activate your account:</p><p style="text-align:center"><a href="{{reset_link}}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;margin:16px 0">Set Your Password</a></p><p style="color:#334155;line-height:1.6;margin:0 0 16px">This link will expire in {{expiration_hours}} hours.</p><p style="color:#334155;line-height:1.6;margin:0 0 16px">If you did not expect this invitation, you can safely ignore this email.</p></div><div style="padding:24px 32px;background:#f8fafc;text-align:center;font-size:12px;color:#64748b"><p style="margin:0">This is an automated message. Please do not reply directly to this email.</p></div></div></body></html>',
      },
      forgot_username: {
        subject: 'Your username reminder',
        body_html: '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;margin:0;padding:0;background:#f4f7fa"><div style="max-width:600px;margin:40px auto;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.08);overflow:hidden"><div style="background:#1e293b;padding:32px;text-align:center"><h1 style="color:#fff;margin:0;font-size:24px">Username Reminder</h1></div><div style="padding:32px"><p style="color:#334155;line-height:1.6;margin:0 0 16px">Hello,</p><p style="color:#334155;line-height:1.6;margin:0 0 16px">You requested a reminder of your username. Here it is:</p><div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:16px;text-align:center;margin:16px 0"><span style="font-size:20px;font-weight:700;color:#1e293b">{{username}}</span></div><p style="color:#334155;line-height:1.6;margin:0 0 16px">You can use this username to log in to your account.</p><p style="color:#334155;line-height:1.6;margin:0 0 16px">If you did not request this, you can safely ignore this email.</p></div><div style="padding:24px 32px;background:#f8fafc;text-align:center;font-size:12px;color:#64748b"><p style="margin:0">This is an automated message. Please do not reply directly to this email.</p></div></div></body></html>',
      },
      reset_password: {
        subject: 'Reset your password',
        body_html: '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;margin:0;padding:0;background:#f4f7fa"><div style="max-width:600px;margin:40px auto;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.08);overflow:hidden"><div style="background:#1e293b;padding:32px;text-align:center"><h1 style="color:#fff;margin:0;font-size:24px">Password Reset</h1></div><div style="padding:32px"><p style="color:#334155;line-height:1.6;margin:0 0 16px">Hello,</p><p style="color:#334155;line-height:1.6;margin:0 0 16px">We received a request to reset your password. Click the button below to choose a new password:</p><p style="text-align:center"><a href="{{reset_link}}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;margin:16px 0">Reset Password</a></p><p style="color:#334155;line-height:1.6;margin:0 0 16px">If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p></div><div style="padding:24px 32px;background:#f8fafc;text-align:center;font-size:12px;color:#64748b"><p style="margin:0">This is an automated message. Please do not reply directly to this email.</p></div></div></body></html>',
      },
    };
    const defaultData = defaults[editingTemplate.template_type];
    if (defaultData) {
      setTemplateSubject(defaultData.subject);
      setTemplateHtml(defaultData.body_html);
      await supabase
        .from('invitation_email_templates')
        .update({ subject: defaultData.subject, body_html: defaultData.body_html, is_default: true, updated_at: new Date().toISOString() })
        .eq('id', editingTemplate.id);
      await fetchTemplates();
    }
    setTemplateSaving(false);
  };

  const getPreviewHtml = (html: string) => {
    const sampleVars: Record<string, string> = {
      '{{name}}': 'John Smith',
      '{{username}}': 'jsmith',
      '{{reset_link}}': '#',
      '{{company_name}}': activeCompany?.name || 'Your Company',
      '{{expiration_hours}}': '48',
    };
    let result = html;
    for (const [key, value] of Object.entries(sampleVars)) {
      result = result.replaceAll(key, value);
    }
    return result;
  };

  const fetchMembers = async () => {
    if (!activeCompany) return;
    const { data } = await supabase
      .from('company_memberships')
      .select(`
        id, user_id, role, status, invitation_sent_at, invitation_sent_count, created_at,
        profiles:user_id (username, full_name, email, avatar_url, last_login_at)
      `)
      .eq('company_id', activeCompany.id);

    if (data) {
      setMembers(data.map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role === 'Admin' ? 'Admin' : 'User',
        status: m.status || 'active',
        invitation_sent_at: m.invitation_sent_at,
        invitation_sent_count: m.invitation_sent_count || 0,
        created_at: m.created_at,
        profile: m.profiles,
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
    fetchTemplates();
  }, [activeCompany]);

  // ========== Wizard Handlers ==========

  const resetWizard = () => {
    setWizardStep(1);
    setInviteEmail('');
    setInviteUsername('');
    setInviteName('');
    setInviteIsAdmin(false);
    setInviteCompanyId('');
    setInvitePermissions([]);
    setError('');
  };

  const handleWizardNext = () => {
    if (wizardStep === 1) {
      if (inviteIsAdmin) {
        setWizardStep(3);
      } else {
        setWizardStep(2);
      }
    } else if (wizardStep === 2) {
      setWizardStep(3);
    }
  };

  const handleWizardBack = () => {
    if (wizardStep === 3) {
      setWizardStep(inviteIsAdmin ? 1 : 2);
    } else if (wizardStep === 2) {
      setWizardStep(1);
    }
  };

  const handleInvite = async () => {
    if (!inviteCompanyId || !inviteEmail.trim()) return;
    setSaving(true);
    setError('');

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setError('You must be logged in to invite users');
      setSaving(false);
      return;
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          username: inviteUsername.trim() || undefined,
          fullName: inviteName.trim() || undefined,
          companyId: inviteCompanyId,
          role: inviteIsAdmin ? 'Admin' : 'User',
          permissions: inviteIsAdmin ? [] : invitePermissions,
          redirectUrl: window.location.origin,
        }),
      }
    );

    const result = await response.json();
    if (!response.ok) {
      setError(result.error || 'Failed to invite user');
      setSaving(false);
      return;
    }

    setShowInviteModal(false);
    resetWizard();
    await fetchMembers();
    setSaving(false);
  };

  const resendInvite = async (memberId: string) => {
    if (!activeCompany) return;
    setSendingInvite(memberId);
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) { setSendingInvite(null); return; }

    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          companyId: activeCompany.id,
          membershipId: memberId,
          resend: true,
          redirectUrl: window.location.origin,
        }),
      }
    );
    await fetchMembers();
    setSendingInvite(null);
  };

  // ========== Edit User ==========

  const openEditModal = (member: Member) => {
    setEditTarget(member);
    setEditUsername(member.profile.username || '');
    setEditName(member.profile.full_name || '');
    setEditEmail(member.profile.email || '');
    setEditIsAdmin(member.role === 'Admin');
    setEditError('');
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    setEditError('');

    const profileUpdates: Record<string, string> = {};
    if (editUsername.trim() !== (editTarget.profile.username || '')) profileUpdates.username = editUsername.trim();
    if (editName.trim() !== (editTarget.profile.full_name || '')) profileUpdates.full_name = editName.trim();
    if (editEmail.trim() !== editTarget.profile.email) profileUpdates.email = editEmail.trim().toLowerCase();

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabase.from('profiles').update(profileUpdates).eq('id', editTarget.user_id);
      if (profileError) { setEditError(profileError.message); setEditSaving(false); return; }
    }

    const newRole = editIsAdmin ? 'Admin' : 'User';
    if (newRole !== editTarget.role) {
      const { error: roleError } = await supabase.from('company_memberships').update({ role: newRole }).eq('id', editTarget.id);
      if (roleError) { setEditError(roleError.message); setEditSaving(false); return; }
    }

    setShowEditModal(false);
    setEditTarget(null);
    await fetchMembers();
    setEditSaving(false);
  };

  // ========== Permissions Modal ==========

  const openPermissionsModal = async (member: Member) => {
    setPermissionsTarget(member);
    const { data } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', member.user_id)
      .eq('company_id', activeCompany!.id);

    setEditPermissions((data || []).map(p => ({
      permission_type: p.permission_type as PermissionEntry['permission_type'],
      resource_id: p.resource_id,
      access_level: p.access_level as PermissionEntry['access_level'],
    })));
    setShowPermissionsModal(true);
  };

  const handlePermissionsSave = async () => {
    if (!permissionsTarget || !activeCompany) return;
    setPermissionsSaving(true);

    await supabase
      .from('user_permissions')
      .delete()
      .eq('user_id', permissionsTarget.user_id)
      .eq('company_id', activeCompany.id);

    if (editPermissions.length > 0) {
      await supabase.from('user_permissions').insert(
        editPermissions.map(p => ({
          user_id: permissionsTarget.user_id,
          company_id: activeCompany.id,
          permission_type: p.permission_type,
          resource_id: p.resource_id,
          access_level: p.access_level,
        }))
      );
    }

    setShowPermissionsModal(false);
    setPermissionsTarget(null);
    setPermissionsSaving(false);
  };

  // ========== Password & Delete ==========

  const handleSetPassword = async () => {
    if (!passwordTarget || !newPassword.trim()) return;
    setSettingPassword(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) { setSettingPassword(false); return; }

    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ user_id: passwordTarget.user_id, new_password: newPassword }),
      }
    );
    setShowPasswordModal(false);
    setPasswordTarget(null);
    setNewPassword('');
    setSettingPassword(false);
  };

  const removeMember = async (memberId: string) => {
    setDeletingMember(memberId);
  };

  const confirmDelete = async () => {
    if (!deletingMember) return;
    await supabase.from('company_memberships').delete().eq('id', deletingMember);
    setDeletingMember(null);
    await fetchMembers();
  };

  const toggleMemberStatus = async (member: Member) => {
    if (!activeCompany) return;
    const newStatus = member.status === 'active' ? 'inactive' : 'active';
    await supabase
      .from('company_memberships')
      .update({ status: newStatus })
      .eq('id', member.id);
    await logActivity(
      newStatus === 'inactive' ? 'user_deactivated' : 'user_activated',
      activeCompany.id,
      member.profile.full_name || member.profile.email,
      member.user_id,
      { target_email: member.profile.email }
    );
    await fetchMembers();
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
      + ',\n' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  };

  const formatInvitation = (member: Member) => {
    if (!member.invitation_sent_at || member.invitation_sent_count === 0) return { text: 'Not sent', sub: '' };
    const count = member.invitation_sent_count;
    const date = new Date(member.invitation_sent_at);
    const dateStr = date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
      + ',\n' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
    return { text: `Sent ${count}x`, sub: dateStr };
  };

  // ========== Wizard Step Indicator ==========

  const WizardSteps = () => (
    <div className="flex items-center justify-center gap-0 mb-6">
      {[
        { num: 1, label: 'User Details' },
        { num: 2, label: 'Permissions' },
        { num: 3, label: 'Invite' },
      ].map((step, i) => (
        <div key={step.num} className="flex items-center">
          {i > 0 && <div className={`w-12 h-0.5 ${wizardStep >= step.num ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-600'}`} />}
          <div className="flex items-center gap-1.5">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              wizardStep > step.num ? 'bg-green-500 text-white' :
              wizardStep === step.num ? 'bg-blue-600 text-white' :
              'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
            }`}>
              {wizardStep > step.num ? <Check className="w-3.5 h-3.5" /> : step.num}
            </div>
            <span className={`text-xs font-medium ${
              wizardStep === step.num ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
            }`}>
              {step.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* Email Templates Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-6">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Email Templates</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Customize email templates sent to users</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.map((template) => (
              <div key={template.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                    <Mail className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <button onClick={() => openTemplateEditor(template)} title="Edit Template" className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
                    <ClipboardList className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{template.template_name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{template.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User Management Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">User Management</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Create and manage user accounts and their permissions</p>
          </div>
          <Button onClick={() => { setShowInviteModal(true); setInviteCompanyId(activeCompany?.id || ''); }}>
            <UserPlus className="w-4 h-4" />
            Add User
          </Button>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="w-6 h-6 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Username</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Invitation</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Login</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {members.map((member) => {
                  const invitation = formatInvitation(member);
                  const isSelf = member.user_id === user?.id;
                  return (
                    <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                      <td className="px-4 py-3"><span className="font-medium text-gray-900 dark:text-white italic">{member.profile.username || '-'}</span></td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{member.profile.full_name || '-'}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{member.profile.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${
                          member.role === 'Admin'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {member.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                          member.status === 'active'
                            ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {member.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {invitation.text === 'Not sent' ? (
                            <span className="text-gray-400 dark:text-gray-500 italic">Not sent</span>
                          ) : (
                            <div className="flex items-start gap-1">
                              <Clock className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="font-medium text-gray-600 dark:text-gray-300">{invitation.text}</span>
                                <div className="text-gray-400 dark:text-gray-500 whitespace-pre-line leading-tight">{invitation.sub}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-line leading-tight">{formatDateTime(member.profile.last_login_at)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => resendInvite(member.id)} disabled={sendingInvite === member.id} title="Send Invite" className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors disabled:opacity-50">
                            {sendingInvite === member.id ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                          </button>
                          <button onClick={() => openEditModal(member)} title="Edit User Info" className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => { setPasswordTarget(member); setShowPasswordModal(true); }} title="Reset Password" className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded transition-colors">
                            <Link2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openPermissionsModal(member)}
                            disabled={member.role === 'Admin'}
                            title={member.role === 'Admin' ? 'Admins have full access' : 'Manage Permissions'}
                            className={`p-1.5 rounded transition-colors ${
                              member.role === 'Admin' ? 'text-green-500 opacity-30 cursor-not-allowed' : 'text-green-500 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20'
                            }`}
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => !isSelf && toggleMemberStatus(member)}
                            disabled={isSelf}
                            title={isSelf ? 'Cannot deactivate yourself' : member.status === 'active' ? 'Deactivate User' : 'Activate User'}
                            className={`p-1.5 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                              member.status === 'active'
                                ? 'text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                : 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                            }`}
                          >
                            {member.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => !isSelf && removeMember(member.id)}
                            disabled={isSelf}
                            title={isSelf ? 'Cannot delete yourself' : 'Delete User'}
                            className={`p-1.5 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {members.length === 0 && (
              <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">No users found. Click "Add User" to invite someone.</div>
            )}
          </div>
        )}
      </div>

      {/* 3-Step Add User Wizard */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => { setShowInviteModal(false); resetWizard(); }}
        title=""
        size="lg"
      >
        <div>
          <WizardSteps />

          {wizardStep === 1 && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add New User</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Step 1: Create user account</p>
              </div>
              {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-md text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                <input type="text" value={inviteUsername} onChange={(e) => setInviteUsername(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Enter username" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address <span className="text-red-500">*</span></label>
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="user@company.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Full name" />
              </div>
              {adminCompanies.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company <span className="text-red-500">*</span></label>
                  <CustomDropdown value={inviteCompanyId} onChange={(val) => setInviteCompanyId(val)} options={adminCompanies.map((c) => ({ value: c.id, label: c.name }))} placeholder="Select a company..." />
                </div>
              )}
              <label className="flex items-center gap-3 px-3 py-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <input type="checkbox" checked={inviteIsAdmin} onChange={(e) => setInviteIsAdmin(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Administrator</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Full access to all features and settings</p>
                </div>
              </label>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="secondary" onClick={() => { setShowInviteModal(false); resetWizard(); }}>Cancel</Button>
                <Button onClick={handleWizardNext} disabled={!inviteEmail.trim() || !inviteCompanyId}>
                  {inviteIsAdmin ? 'Next: Send Invite' : 'Next: Set Permissions'}
                </Button>
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Set Permissions</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Step 2: Configure access for {inviteUsername || inviteEmail}</p>
              </div>
              <PermissionsPanel
                companyId={inviteCompanyId}
                permissions={invitePermissions}
                onChange={setInvitePermissions}
              />
              <div className="flex justify-between pt-4">
                <Button variant="secondary" onClick={handleWizardBack}>Back</Button>
                <Button onClick={handleWizardNext}>Next: Send Invite</Button>
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Send Invitation</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Step 3: Review and send invite</p>
              </div>
              {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-md text-sm">{error}</div>}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Email:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{inviteEmail}</span>
                </div>
                {inviteUsername && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Username:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{inviteUsername}</span>
                  </div>
                )}
                {inviteName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Name:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{inviteName}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Role:</span>
                  <span className={`font-medium ${inviteIsAdmin ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                    {inviteIsAdmin ? 'Admin' : 'User'}
                  </span>
                </div>
                {!inviteIsAdmin && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Permissions:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{invitePermissions.length} configured</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between pt-4">
                <Button variant="secondary" onClick={handleWizardBack}>Back</Button>
                <Button onClick={handleInvite} loading={saving}>
                  <Send className="w-4 h-4" />
                  Send Invitation
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditTarget(null); setEditError(''); }} title="Edit User">
        <div className="space-y-4">
          {editError && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-md text-sm">{editError}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
            <input type="text" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Username" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Full name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
            <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Email" />
          </div>
          <label className="flex items-center gap-3 px-3 py-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <input type="checkbox" checked={editIsAdmin} onChange={(e) => setEditIsAdmin(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">Administrator</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">Full access to all features and settings</p>
            </div>
          </label>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setShowEditModal(false); setEditTarget(null); setEditError(''); }}>Cancel</Button>
            <Button onClick={handleEditSave} loading={editSaving}>Save Changes</Button>
          </div>
        </div>
      </Modal>

      {/* Manage Permissions Modal */}
      <Modal
        isOpen={showPermissionsModal}
        onClose={() => { setShowPermissionsModal(false); setPermissionsTarget(null); }}
        title={`Manage Permissions - ${permissionsTarget?.profile.username || permissionsTarget?.profile.full_name || ''}`}
        size="lg"
      >
        <div className="space-y-4">
          <PermissionsPanel
            companyId={activeCompany?.id || ''}
            permissions={editPermissions}
            onChange={setEditPermissions}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setShowPermissionsModal(false); setPermissionsTarget(null); }}>Cancel</Button>
            <Button onClick={handlePermissionsSave} loading={permissionsSaving}>Update Permissions</Button>
          </div>
        </div>
      </Modal>

      {/* Set Password Modal */}
      <Modal isOpen={showPasswordModal} onClose={() => { setShowPasswordModal(false); setPasswordTarget(null); setNewPassword(''); }} title="Reset Password">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Set a new password for <span className="font-medium text-gray-900 dark:text-white">{passwordTarget?.profile.username || passwordTarget?.profile.email}</span>
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Enter new password" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setShowPasswordModal(false); setPasswordTarget(null); setNewPassword(''); }}>Cancel</Button>
            <Button onClick={handleSetPassword} loading={settingPassword} disabled={!newPassword.trim()}>Set Password</Button>
          </div>
        </div>
      </Modal>

      {/* Template Editor Modal */}
      <Modal isOpen={showTemplateEditor} onClose={() => { setShowTemplateEditor(false); setEditingTemplate(null); }} title={`Edit Template: ${editingTemplate?.template_name || ''}`} size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject Line</label>
            <input type="text" value={templateSubject} onChange={(e) => setTemplateSubject(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">HTML Body</label>
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <span>Variables:</span>
                {editingTemplate?.template_type === 'admin_invitation' && <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{{name}} {{username}} {{reset_link}} {{company_name}} {{expiration_hours}}'}</span>}
                {editingTemplate?.template_type === 'forgot_username' && <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{{username}}'}</span>}
                {editingTemplate?.template_type === 'reset_password' && <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{{reset_link}}'}</span>}
              </div>
            </div>
            <textarea value={templateHtml} onChange={(e) => setTemplateHtml(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-xs leading-relaxed" rows={16} />
          </div>
          <div className="flex items-center justify-between pt-4">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowTemplatePreview(true)}><Eye className="w-4 h-4" />Preview</Button>
              <Button variant="secondary" onClick={handleTemplateReset} loading={templateSaving}><RotateCcw className="w-4 h-4" />Reset to Default</Button>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => { setShowTemplateEditor(false); setEditingTemplate(null); }}>Cancel</Button>
              <Button onClick={handleTemplateSave} loading={templateSaving}>Save Template</Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Template Preview Modal */}
      <Modal isOpen={showTemplatePreview} onClose={() => setShowTemplatePreview(false)} title="Email Preview">
        <div className="space-y-3">
          <div className="text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">Subject: </span>
            <span className="text-gray-600 dark:text-gray-400">{getPreviewHtml(templateSubject)}</span>
          </div>
          <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
            <iframe srcDoc={getPreviewHtml(templateHtml)} className="w-full h-[400px] bg-white" sandbox="" title="Email preview" />
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowTemplatePreview(false)}>Close</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deletingMember} onClose={() => setDeletingMember(null)} title="Confirm Delete">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to remove this user from the company? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeletingMember(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete}>Delete</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
