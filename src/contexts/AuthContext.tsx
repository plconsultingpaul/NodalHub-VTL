import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import type { Profile, CompanyWithRole } from '../types/database';

export type PermissionType = 'dashboard' | 'dashboard_edit' | 'pulse' | 'settings_tab' | 'save_templates' | 'edit_grid_layout' | 'view_logs' | 'sso_application';

export interface UserPermission {
  id: string;
  user_id: string;
  company_id: string;
  permission_type: PermissionType;
  resource_id: string | null;
  access_level: 'view' | 'edit' | 'access';
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  companies: CompanyWithRole[];
  activeCompany: CompanyWithRole | null;
  loading: boolean;
  permissions: UserPermission[];
  isAdmin: boolean;
  hasPermission: (type: PermissionType, resourceId?: string) => boolean;
  getDashboardAccess: (dashboardId: string) => 'none' | 'view' | 'edit';
  refreshPermissions: () => Promise<void>;
  signIn: (emailOrUsername: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, username?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  setActiveCompany: (company: CompanyWithRole) => void;
  refreshCompanies: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACTIVE_COMPANY_KEY = 'kpi_dashboard_active_company';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [companies, setCompanies] = useState<CompanyWithRole[]>([]);
  const [activeCompany, setActiveCompanyState] = useState<CompanyWithRole | null>(null);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = activeCompany?.role === 'Admin';

  const fetchPermissions = useCallback(async (userId: string, companyId: string) => {
    const { data } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId)
      .eq('company_id', companyId);
    setPermissions(data || []);
  }, []);

  const refreshPermissions = useCallback(async () => {
    if (user && activeCompany) {
      await fetchPermissions(user.id, activeCompany.id);
    }
  }, [user, activeCompany, fetchPermissions]);

  const hasPermission = useCallback((type: PermissionType, resourceId?: string): boolean => {
    if (isAdmin) return true;
    if (resourceId) {
      return permissions.some(p => p.permission_type === type && p.resource_id === resourceId);
    }
    return permissions.some(p => p.permission_type === type);
  }, [isAdmin, permissions]);

  const getDashboardAccess = useCallback((dashboardId: string): 'none' | 'view' | 'edit' => {
    if (isAdmin) return 'edit';
    const canView = permissions.some(p => p.permission_type === 'dashboard' && p.resource_id === dashboardId);
    if (!canView) return 'none';
    const canEdit = permissions.some(p => p.permission_type === 'dashboard_edit');
    return canEdit ? 'edit' : 'view';
  }, [isAdmin, permissions]);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    return data;
  };

  const fetchCompanies = async (userId: string): Promise<CompanyWithRole[]> => {
    console.log('=== Fetching companies for user:', userId);
    const { data: memberships } = await supabase
      .from('company_memberships')
      .select('company_id, role')
      .eq('user_id', userId)
      .eq('status', 'active');

    console.log('Memberships:', memberships);

    if (!memberships || memberships.length === 0) return [];

    const companyIds = memberships.map(m => m.company_id);
    const { data: companiesData } = await supabase
      .from('companies')
      .select('*')
      .in('id', companyIds);

    console.log('Companies data:', companiesData);

    if (!companiesData) return [];

    const companiesWithRoles = companiesData.map(company => {
      const membership = memberships.find(m => m.company_id === company.id);
      return {
        ...company,
        role: membership?.role || 'User'
      };
    });

    console.log('Companies with roles:', companiesWithRoles);
    return companiesWithRoles;
  };

  const refreshCompanies = async () => {
    if (!user) return;
    const companiesData = await fetchCompanies(user.id);
    console.log('=== Refresh Companies ===');
    console.log('Companies data:', companiesData);
    setCompanies(companiesData);

    if (companiesData.length > 0) {
      const savedCompanyId = localStorage.getItem(ACTIVE_COMPANY_KEY);
      console.log('Saved company ID from localStorage:', savedCompanyId);
      const savedCompany = companiesData.find(c => c.id === savedCompanyId);
      console.log('Found saved company:', savedCompany);
      if (savedCompany) {
        console.log('Setting active company to saved company:', savedCompany);
        setActiveCompanyState(savedCompany);
      } else if (!activeCompany) {
        console.log('Setting active company to first company:', companiesData[0]);
        setActiveCompanyState(companiesData[0]);
        localStorage.setItem(ACTIVE_COMPANY_KEY, companiesData[0].id);
      }
    }
  };

  useEffect(() => {
    console.log('=== Active Company Changed ===', activeCompany);
    if (user && activeCompany) {
      fetchPermissions(user.id, activeCompany.id);
    } else {
      setPermissions([]);
    }
  }, [activeCompany, user, fetchPermissions]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).then(setProfile);
        fetchCompanies(session.user.id).then(companiesData => {
          setCompanies(companiesData);
          if (companiesData.length > 0) {
            const savedCompanyId = localStorage.getItem(ACTIVE_COMPANY_KEY);
            const savedCompany = companiesData.find(c => c.id === savedCompanyId);
            setActiveCompanyState(savedCompany || companiesData[0]);
            if (!savedCompany) {
              localStorage.setItem(ACTIVE_COMPANY_KEY, companiesData[0].id);
            }
          }
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (_event === 'SIGNED_IN' && session?.user) {
        supabase.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', session.user.id).then();
      }
      if (session?.user) {
        fetchProfile(session.user.id).then(setProfile);
        fetchCompanies(session.user.id).then(companiesData => {
          setCompanies(companiesData);
          if (companiesData.length > 0) {
            const savedCompanyId = localStorage.getItem(ACTIVE_COMPANY_KEY);
            const savedCompany = companiesData.find(c => c.id === savedCompanyId);
            setActiveCompanyState(savedCompany || companiesData[0]);
            if (_event === 'SIGNED_IN') {
              const company = savedCompany || companiesData[0];
              logActivity('login', company.id);
            }
          }
        });
      } else {
        setProfile(null);
        setCompanies([]);
        setActiveCompanyState(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (emailOrUsername: string, password: string) => {
    let email = emailOrUsername.trim();

    if (!email.includes('@')) {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/username-to-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ username: email }),
          },
        );

        if (!response.ok) {
          return { error: new Error('Invalid login credentials') };
        }

        const data = await response.json();
        email = data.email;
      } catch {
        return { error: new Error('Invalid login credentials') };
      }
    }

    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };

    const { data: activeMemberships } = await supabase
      .from('company_memberships')
      .select('id')
      .eq('user_id', signInData.user.id)
      .eq('status', 'active')
      .limit(1);

    if (!activeMemberships || activeMemberships.length === 0) {
      await supabase.auth.signOut();
      return { error: new Error('Your account has been deactivated. Please contact your administrator.') };
    }

    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string, username?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });

    if (error) return { error };

    if (data.session && data.user) {
      if (username && username.trim()) {
        const { error: usernameError } = await supabase
          .from('profiles')
          .update({ username: username.trim() })
          .eq('id', data.user.id);
        if (usernameError) return { error: usernameError };
      }

      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({ name: `${fullName}'s Company` })
        .select()
        .single();

      if (companyError) return { error: companyError };

      const { error: membershipError } = await supabase
        .from('company_memberships')
        .insert({
          user_id: data.user.id,
          company_id: company.id,
          role: 'Admin'
        });

      if (membershipError) return { error: membershipError };
    }

    return { error: null };
  };

  const resetPasswordForEmail = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(ACTIVE_COMPANY_KEY);
  };

  const setActiveCompany = (company: CompanyWithRole) => {
    setActiveCompanyState(company);
    localStorage.setItem(ACTIVE_COMPANY_KEY, company.id);
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      session,
      companies,
      activeCompany,
      loading,
      permissions,
      isAdmin,
      hasPermission,
      getDashboardAccess,
      refreshPermissions,
      signIn,
      signUp,
      signOut,
      resetPasswordForEmail,
      updatePassword,
      setActiveCompany,
      refreshCompanies
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
