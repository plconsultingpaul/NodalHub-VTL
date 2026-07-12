import { useAuth } from '../../contexts/AuthContext';
import { Building2, Check, LogOut, ExternalLink } from 'lucide-react';
import Dropdown, { DropdownItem, DropdownDivider, DropdownLabel } from '../ui/Dropdown';
import { useSidebar } from '../../contexts/SidebarContext';
import { useSsoApplications } from '../../hooks/useSsoApplications';
import { supabase } from '../../lib/supabase';

interface CompanySwitcherProps {
  iconOnly?: boolean;
}

export default function CompanySwitcher({ iconOnly = false }: CompanySwitcherProps = {}) {
  const { profile, companies, activeCompany, setActiveCompany, signOut, isAdmin, hasPermission } = useAuth();
  const { collapsed } = useSidebar();
  const { applications } = useSsoApplications();
  const compact = iconOnly || collapsed;

  const visibleApps = isAdmin
    ? applications
    : applications.filter(app => hasPermission('sso_application', app.id));

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Admin':
        return 'bg-black text-white';
      default:
        return 'bg-gray-200 text-gray-700';
    }
  };

  const trigger = (
    <div className={`flex items-center gap-3 rounded-lg transition-colors cursor-pointer ${compact ? 'justify-center p-1' : 'p-2'}`}>
      <div className={`rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 bg-white/10 text-white ${compact ? 'w-8 h-8 text-xs' : 'w-9 h-9'}`}>
        {profile?.full_name ? getInitials(profile.full_name) : 'U'}
      </div>
      {!compact && (
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-white">
            {profile?.full_name || 'User'}
          </p>
          <p className="text-xs truncate text-slate-400">
            {profile?.email}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <Dropdown trigger={trigger} align="left" width="w-72" openUp>
      <div className="py-2">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-medium">
              {profile?.full_name ? getInitials(profile.full_name) : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {profile?.full_name || 'User'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {profile?.email}
              </p>
            </div>
          </div>
        </div>

        {activeCompany && (
          <>
            <DropdownLabel>Current Account</DropdownLabel>
            <div className="px-4 py-2 flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{activeCompany.name}</p>
              </div>
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${getRoleBadgeColor(activeCompany.role)}`}>
                {activeCompany.role}
              </span>
            </div>
          </>
        )}

        {companies.length > 1 && (
          <>
            <DropdownDivider />
            <DropdownLabel>Switch Account</DropdownLabel>
            {companies.map((company) => (
              <DropdownItem
                key={company.id}
                onClick={() => setActiveCompany(company)}
                active={company.id === activeCompany?.id}
              >
                <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{company.name}</p>
                  <p className="text-xs text-gray-500">{company.role}</p>
                </div>
                {company.id === activeCompany?.id && (
                  <Check className="w-4 h-4 text-black flex-shrink-0" />
                )}
              </DropdownItem>
            ))}
          </>
        )}

        {visibleApps.length > 0 && (
          <>
            <DropdownDivider />
            <DropdownLabel>Quick Switch</DropdownLabel>
            {visibleApps.map((app) => (
              <DropdownItem
                key={app.id}
                onClick={() => {
                  if (!app.app_identifier) {
                    window.open(app.url, '_blank');
                  } else {
                    const newTab = window.open('about:blank', '_blank');
                    supabase.functions.invoke('create-sso-token', {
                      body: { targetUrl: app.url, appIdentifier: app.app_identifier },
                    }).then(({ data, error }) => {
                      if (!error && data?.redirectUrl && newTab) {
                        newTab.location.href = data.redirectUrl;
                      } else if (newTab) {
                        newTab.close();
                      }
                    });
                  }
                }}
              >
                {app.icon_url ? (
                  <img src={app.icon_url} alt="" className="w-4 h-4 rounded object-cover flex-shrink-0" />
                ) : (
                  <ExternalLink className="w-4 h-4 flex-shrink-0" />
                )}
                {app.name}
              </DropdownItem>
            ))}
          </>
        )}

        <DropdownDivider />
        <DropdownItem onClick={signOut} danger>
          <LogOut className="w-4 h-4" />
          Sign Out
        </DropdownItem>
      </div>
    </Dropdown>
  );
}
