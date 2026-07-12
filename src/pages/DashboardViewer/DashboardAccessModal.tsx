import { useState, useEffect } from 'react';
import { Shield, Check, Loader2 } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';

interface MemberInfo {
  user_id: string;
  role: string;
  profile: {
    username: string | null;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

interface DashboardAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  dashboardId: string;
  dashboardName: string;
  companyId: string;
}

export default function DashboardAccessModal({ isOpen, onClose, dashboardId, dashboardName, companyId }: DashboardAccessModalProps) {
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [grantedUserIds, setGrantedUserIds] = useState<Set<string>>(new Set());
  const [initialGrantedIds, setInitialGrantedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetchData();
  }, [isOpen, dashboardId, companyId]);

  const fetchData = async () => {
    setLoading(true);

    const [membersRes, permissionsRes] = await Promise.all([
      supabase
        .from('company_memberships')
        .select(`
          user_id, role,
          profiles:user_id (username, full_name, email, avatar_url)
        `)
        .eq('company_id', companyId)
        .eq('status', 'active'),
      supabase
        .from('user_permissions')
        .select('user_id')
        .eq('company_id', companyId)
        .eq('permission_type', 'dashboard')
        .eq('resource_id', dashboardId)
    ]);

    const allMembers: MemberInfo[] = (membersRes.data || [])
      .filter((m: any) => m.role !== 'Admin')
      .map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        profile: m.profiles,
      }));

    setMembers(allMembers);

    const granted = new Set((permissionsRes.data || []).map((p: any) => p.user_id));
    setGrantedUserIds(granted);
    setInitialGrantedIds(new Set(granted));
    setLoading(false);
  };

  const toggleUser = (userId: string) => {
    setGrantedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setGrantedUserIds(new Set(members.map(m => m.user_id)));
  };

  const selectNone = () => {
    setGrantedUserIds(new Set());
  };

  const handleSave = async () => {
    setSaving(true);

    const toAdd = [...grantedUserIds].filter(id => !initialGrantedIds.has(id));
    const toRemove = [...initialGrantedIds].filter(id => !grantedUserIds.has(id));

    if (toRemove.length > 0) {
      await supabase
        .from('user_permissions')
        .delete()
        .eq('company_id', companyId)
        .eq('permission_type', 'dashboard')
        .eq('resource_id', dashboardId)
        .in('user_id', toRemove);
    }

    if (toAdd.length > 0) {
      await supabase.from('user_permissions').insert(
        toAdd.map(userId => ({
          user_id: userId,
          company_id: companyId,
          permission_type: 'dashboard',
          resource_id: dashboardId,
          access_level: 'view',
        }))
      );
    }

    setSaving(false);
    onClose();
  };

  const hasChanges = (() => {
    if (grantedUserIds.size !== initialGrantedIds.size) return true;
    for (const id of grantedUserIds) {
      if (!initialGrantedIds.has(id)) return true;
    }
    return false;
  })();

  const getDisplayName = (member: MemberInfo) => {
    if (member.profile?.full_name) return member.profile.full_name;
    if (member.profile?.username) return member.profile.username;
    if (member.profile?.email) return member.profile.email;
    return 'Unknown User';
  };

  const getInitials = (member: MemberInfo) => {
    const name = getDisplayName(member);
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Dashboard Access" size="md">
      <div className="flex flex-col">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
          <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Select users who can view <span className="font-medium text-gray-900 dark:text-gray-100">{dashboardName}</span>
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
            No non-admin users in this company. Admin users always have access.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {grantedUserIds.size} of {members.length} users selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  All
                </button>
                <button
                  onClick={selectNone}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  None
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
              {members.map(member => {
                const isGranted = grantedUserIds.has(member.user_id);
                return (
                  <button
                    key={member.user_id}
                    onClick={() => toggleUser(member.user_id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      isGranted
                        ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isGranted
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {isGranted && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                      {member.profile?.avatar_url ? (
                        <img src={member.profile.avatar_url} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{getInitials(member)}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {getDisplayName(member)}
                      </p>
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
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={!hasChanges}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
