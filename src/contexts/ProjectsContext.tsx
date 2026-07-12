import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { Project, Dashboard, ProjectWithDashboards, ProjectType } from '../types/database';

interface ProjectsContextValue {
  projects: ProjectWithDashboards[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createProject: (name: string, color?: string, type?: ProjectType) => Promise<{ data?: Project; error?: string }>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<{ error: string | null }>;
  deleteProject: (id: string) => Promise<{ error: string | null }>;
  createDashboard: (name: string, projectId: string) => Promise<{ data?: Dashboard; error?: string }>;
  updateDashboard: (id: string, updates: Partial<Dashboard>) => Promise<{ error: string | null }>;
  deleteDashboard: (id: string) => Promise<{ error: string | null }>;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { activeCompany, user } = useAuth();
  const [projects, setProjects] = useState<ProjectWithDashboards[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!activeCompany) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('company_id', activeCompany.id)
        .order('sort_order', { ascending: true });

      if (projectsError) throw projectsError;

      const { data: dashboardsData, error: dashboardsError } = await supabase
        .from('dashboards')
        .select('*')
        .eq('company_id', activeCompany.id)
        .order('created_at', { ascending: true });

      if (dashboardsError) throw dashboardsError;

      const { data: pulsesData, error: pulsesError } = await supabase
        .from('pulses')
        .select('*')
        .eq('company_id', activeCompany.id)
        .order('created_at', { ascending: true });

      if (pulsesError) throw pulsesError;

      const projectsWithDashboards: ProjectWithDashboards[] = (projectsData || []).map(project => ({
        ...project,
        dashboards: (dashboardsData || []).filter(d => d.project_id === project.id),
        pulses: (pulsesData || []).filter(p => p.project_id === project.id)
      }));

      setProjects(projectsWithDashboards);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  }, [activeCompany]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = async (name: string, color: string = '#3B82F6', type: ProjectType = 'dashboards') => {
    if (!activeCompany || !user) return { error: 'Not authenticated' };

    const projectsOfType = projects.filter(p => p.type === type);
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name,
        color,
        type,
        company_id: activeCompany.id,
        created_by: user.id,
        sort_order: projectsOfType.length
      })
      .select()
      .single();

    if (error) return { error: error.message };

    await fetchProjects();
    return { data };
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    const { error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id);

    if (error) return { error: error.message };

    await fetchProjects();
    return { error: null };
  };

  const deleteProject = async (id: string) => {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) return { error: error.message };

    await fetchProjects();
    return { error: null };
  };

  const createDashboard = async (name: string, projectId: string) => {
    if (!activeCompany || !user) return { error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('dashboards')
      .insert({
        name,
        project_id: projectId,
        company_id: activeCompany.id,
        created_by: user.id
      })
      .select()
      .single();

    if (error) return { error: error.message };

    await fetchProjects();
    return { data };
  };

  const updateDashboard = async (id: string, updates: Partial<Dashboard>) => {
    const { error } = await supabase
      .from('dashboards')
      .update(updates)
      .eq('id', id);

    if (error) return { error: error.message };

    await fetchProjects();
    return { error: null };
  };

  const deleteDashboard = async (id: string) => {
    const { error } = await supabase
      .from('dashboards')
      .delete()
      .eq('id', id);

    if (error) return { error: error.message };

    await fetchProjects();
    return { error: null };
  };

  return (
    <ProjectsContext.Provider
      value={{
        projects,
        loading,
        error,
        refetch: fetchProjects,
        createProject,
        updateProject,
        deleteProject,
        createDashboard,
        updateDashboard,
        deleteDashboard
      }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectsContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectsProvider');
  }
  return context;
}
