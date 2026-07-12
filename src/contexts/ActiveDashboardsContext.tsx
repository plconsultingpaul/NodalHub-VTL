import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Dashboard } from '../types/database';

interface OpenDashboard {
  dashboard: Dashboard;
  scrollPosition?: number;
  expandedRows?: Set<string>;
  viewOnly?: boolean;
}

interface ActiveDashboardsContextType {
  openDashboards: OpenDashboard[];
  activeDashboardId: string | null;
  openDashboard: (dashboard: Dashboard, viewOnly?: boolean) => void;
  closeDashboard: (dashboardId: string) => void;
  setActiveDashboard: (dashboardId: string) => void;
  updateDashboardState: (dashboardId: string, state: Partial<Omit<OpenDashboard, 'dashboard'>>) => void;
  isBuilderOpen: boolean;
  builderProjectId: string | null;
  builderDashboardId: string | null;
  builderInitialName: string | null;
  openBuilder: (projectId: string, dashboardId?: string, initialName?: string) => void;
  closeBuilder: () => void;
  isPulseBuilderOpen: boolean;
  pulseBuilderProjectId: string | null;
  pulseBuilderPulseId: string | null;
  openPulseBuilder: (projectId: string, pulseId?: string) => void;
  closePulseBuilder: () => void;
}

const ActiveDashboardsContext = createContext<ActiveDashboardsContextType | null>(null);

export function ActiveDashboardsProvider({ children }: { children: ReactNode }) {
  const [openDashboards, setOpenDashboards] = useState<OpenDashboard[]>([]);
  const [activeDashboardId, setActiveDashboardIdState] = useState<string | null>(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [builderProjectId, setBuilderProjectId] = useState<string | null>(null);
  const [builderDashboardId, setBuilderDashboardId] = useState<string | null>(null);
  const [builderInitialName, setBuilderInitialName] = useState<string | null>(null);
  const [isPulseBuilderOpen, setIsPulseBuilderOpen] = useState(false);
  const [pulseBuilderProjectId, setPulseBuilderProjectId] = useState<string | null>(null);
  const [pulseBuilderPulseId, setPulseBuilderPulseId] = useState<string | null>(null);

  const openDashboard = useCallback((dashboard: Dashboard, viewOnly?: boolean) => {
    setOpenDashboards(prev => {
      const existing = prev.find(d => d.dashboard.id === dashboard.id);
      if (existing) {
        return prev.map(d =>
          d.dashboard.id === dashboard.id ? { ...d, viewOnly } : d
        );
      }
      return [...prev, { dashboard, viewOnly }];
    });
    setActiveDashboardIdState(dashboard.id);
    setIsBuilderOpen(false);
    setIsPulseBuilderOpen(false);
  }, []);

  const closeDashboard = useCallback((dashboardId: string) => {
    setOpenDashboards(prev => {
      const filtered = prev.filter(d => d.dashboard.id !== dashboardId);
      if (activeDashboardId === dashboardId && filtered.length > 0) {
        setActiveDashboardIdState(filtered[filtered.length - 1].dashboard.id);
      } else if (filtered.length === 0) {
        setActiveDashboardIdState(null);
      }
      return filtered;
    });
  }, [activeDashboardId]);

  const setActiveDashboard = useCallback((dashboardId: string) => {
    setActiveDashboardIdState(dashboardId);
    setIsBuilderOpen(false);
    setIsPulseBuilderOpen(false);
  }, []);

  const updateDashboardState = useCallback((
    dashboardId: string,
    state: Partial<Omit<OpenDashboard, 'dashboard'>>
  ) => {
    setOpenDashboards(prev =>
      prev.map(d =>
        d.dashboard.id === dashboardId ? { ...d, ...state } : d
      )
    );
  }, []);

  const openBuilder = useCallback((projectId: string, dashboardId?: string, initialName?: string) => {
    setBuilderProjectId(projectId);
    setBuilderDashboardId(dashboardId || null);
    setBuilderInitialName(initialName || null);
    setIsBuilderOpen(true);
    setIsPulseBuilderOpen(false);
    setActiveDashboardIdState(null);
  }, []);

  const closeBuilder = useCallback(() => {
    setIsBuilderOpen(false);
    setBuilderProjectId(null);
    setBuilderDashboardId(null);
    setBuilderInitialName(null);
    if (openDashboards.length > 0) {
      setActiveDashboardIdState(openDashboards[openDashboards.length - 1].dashboard.id);
    }
  }, [openDashboards]);

  const openPulseBuilder = useCallback((projectId: string, pulseId?: string) => {
    setPulseBuilderProjectId(projectId);
    setPulseBuilderPulseId(pulseId || null);
    setIsPulseBuilderOpen(true);
    setIsBuilderOpen(false);
    setActiveDashboardIdState(null);
  }, []);

  const closePulseBuilder = useCallback(() => {
    setIsPulseBuilderOpen(false);
    setPulseBuilderProjectId(null);
    setPulseBuilderPulseId(null);
    if (openDashboards.length > 0) {
      setActiveDashboardIdState(openDashboards[openDashboards.length - 1].dashboard.id);
    }
  }, [openDashboards]);

  return (
    <ActiveDashboardsContext.Provider
      value={{
        openDashboards,
        activeDashboardId,
        openDashboard,
        closeDashboard,
        setActiveDashboard,
        updateDashboardState,
        isBuilderOpen,
        builderProjectId,
        builderDashboardId,
        builderInitialName,
        openBuilder,
        closeBuilder,
        isPulseBuilderOpen,
        pulseBuilderProjectId,
        pulseBuilderPulseId,
        openPulseBuilder,
        closePulseBuilder
      }}
    >
      {children}
    </ActiveDashboardsContext.Provider>
  );
}

export function useActiveDashboards() {
  const context = useContext(ActiveDashboardsContext);
  if (!context) {
    throw new Error('useActiveDashboards must be used within ActiveDashboardsProvider');
  }
  return context;
}
