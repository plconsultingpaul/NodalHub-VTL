import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  Plus,
  Settings,
  HelpCircle,
  LayoutDashboard,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  Play,
  Copy,
  Folder,
  ScrollText,
  Database,
  GripVertical
} from 'lucide-react';
import { useSidebar } from '../../contexts/SidebarContext';
import { useAuth } from '../../contexts/AuthContext';
import { useActiveDashboards } from '../../contexts/ActiveDashboardsContext';
import { useProjects } from '../../hooks/useProjects';
import { usePulses } from '../../hooks/usePulses';
import { logActivity } from '../../lib/activityLog';
import CompanySwitcher from './CompanySwitcher';
import Dropdown, { DropdownItem, DropdownDivider } from '../ui/Dropdown';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import CustomDropdown from '../ui/CustomDropdown';
import type { ProjectType, Dashboard, Pulse } from '../../types/database';

const PROJECT_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#84CC16', '#22C55E', '#10B981', '#14B8A6',
  '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1',
  '#8B5CF6', '#A855F7', '#D946EF', '#EC4899'
];

export default function Sidebar() {
  const { collapsed, setCollapsed, toggle } = useSidebar();
  const { activeCompany, hasPermission, isAdmin, getDashboardAccess } = useAuth();
  const { projects, createProject, createDashboard, updateProject, deleteProject, updateDashboard, deleteDashboard, reorderDashboards, reorderPulses, reorderProjects, refetch: refetchProjects } = useProjects();
  const { deletePulse, updatePulse, duplicatePulse, refetch: refetchPulses } = usePulses();
  const {
    openDashboards,
    activeDashboardId,
    openDashboard,
    closeDashboard,
    setActiveDashboard,
    isBuilderOpen,
    openBuilder,
    isPulseBuilderOpen,
    pulseBuilderPulseId,
    openPulseBuilder
  } = useActiveDashboards();
  const navigate = useNavigate();
  const location = useLocation();

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showNewDashboardModal, setShowNewDashboardModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<{ type: 'project' | 'dashboard' | 'pulse'; id: string; name: string; color?: string; projectId?: string } | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#3B82F6');
  const [newProjectType, setNewProjectType] = useState<ProjectType>('dashboards');
  const [newDashboardName, setNewDashboardName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [saving, setSaving] = useState(false);
  const [draggedDashboardId, setDraggedDashboardId] = useState<string | null>(null);
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);
  const [sortOrderItems, setSortOrderItems] = useState<{ id: string; name: string }[]>([]);
  const dragSortRef = useRef<number | null>(null);
  const dragSortOverRef = useRef<number | null>(null);
  const [showReorderFoldersModal, setShowReorderFoldersModal] = useState(false);
  const [reorderFolderType, setReorderFolderType] = useState<'dashboards' | 'pulse'>('dashboards');
  const [folderOrder, setFolderOrder] = useState<{ id: string; name: string; color: string }[]>([]);
  const dragFolderRef = useRef<number | null>(null);
  const dragFolderOverRef = useRef<number | null>(null);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [namePromptValue, setNamePromptValue] = useState('');
  const [namePromptProjectId, setNamePromptProjectId] = useState<string | null>(null);

  const dashboardProjects = projects.filter(p => p.type === 'dashboards');
  const pulseProjects = projects.filter(p => p.type === 'pulse');

  const isLight = false;

  const handleHomeClick = () => {
    navigate('/');
  };

  const toggleProjectExpanded = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const toggleAllFolders = (projectList: typeof projects) => {
    const allExpanded = projectList.every(p => expandedProjects.has(p.id));
    const newExpanded = new Set(expandedProjects);
    if (allExpanded) {
      projectList.forEach(p => newExpanded.delete(p.id));
    } else {
      projectList.forEach(p => newExpanded.add(p.id));
    }
    setExpandedProjects(newExpanded);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setSaving(true);
    const result = await createProject(newProjectName.trim(), newProjectColor, newProjectType);
    setSaving(false);
    if (!result.error) {
      setShowNewProjectModal(false);
      setNewProjectName('');
      setNewProjectColor('#3B82F6');
    }
  };

  const openReorderFoldersModal = (type: 'dashboards' | 'pulse') => {
    setReorderFolderType(type);
    const folders = projects.filter(p => p.type === type).map(p => ({ id: p.id, name: p.name, color: p.color }));
    setFolderOrder(folders);
    setShowReorderFoldersModal(true);
  };

  const handleSaveReorderFolders = async () => {
    setSaving(true);
    await reorderProjects(folderOrder.map(f => f.id));
    setSaving(false);
    setShowReorderFoldersModal(false);
  };

  const openNewProjectModal = (type: ProjectType) => {
    setNewProjectType(type);
    setShowNewProjectModal(true);
  };

  const handleCreateDashboard = async () => {
    if (!newDashboardName.trim() || !selectedProjectId) return;
    setSaving(true);
    const result = await createDashboard(newDashboardName.trim(), selectedProjectId);
    setSaving(false);
    if (!result.error && result.data) {
      setShowNewDashboardModal(false);
      setNewDashboardName('');
      setSelectedProjectId('');
      setExpandedProjects(prev => new Set(prev).add(selectedProjectId));
      navigate(`/dashboard/${result.data.id}`);
    }
  };

  const openNewDashboardModal = (type: ProjectType) => {
    const projectsOfType = type === 'dashboards' ? dashboardProjects : pulseProjects;
    if (projectsOfType.length > 0) {
      setSelectedProjectId(projectsOfType[0].id);
      setNewProjectType(type);
      setShowNewDashboardModal(true);
    }
  };

  const handleEditItem = async () => {
    if (!editingItem || !editingItem.name.trim()) return;
    setSaving(true);
    if (editingItem.type === 'project') {
      await updateProject(editingItem.id, { name: editingItem.name, color: editingItem.color });
      const project = projects.find(p => p.id === editingItem.id);
      if (project) {
        const dashboardIds = sortOrderItems.filter(item => 
          (project.dashboards || []).some(d => d.id === item.id)
        ).map(item => item.id);
        const pulseIds = sortOrderItems.filter(item => 
          (project.pulses || []).some(p => p.id === item.id)
        ).map(item => item.id);
        if (dashboardIds.length > 0) await reorderDashboards(dashboardIds);
        if (pulseIds.length > 0) await reorderPulses(pulseIds);
      }
    } else if (editingItem.type === 'pulse') {
      await updatePulse(editingItem.id, { name: editingItem.name });
      await refetchProjects();
    } else {
      await updateDashboard(editingItem.id, { name: editingItem.name });
    }
    setSaving(false);
    setShowEditModal(false);
    setEditingItem(null);
  };

  const getProjectItemCount = (projectId: string): number => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return 0;
    return project.type === 'pulse' ? project.pulses.length : project.dashboards.length;
  };

  const canDeleteProject = (projectId: string): boolean => {
    return getProjectItemCount(projectId) === 0;
  };

  const handleDeleteItem = async () => {
    if (!editingItem) return;
    if (editingItem.type === 'project' && !canDeleteProject(editingItem.id)) {
      return;
    }
    setSaving(true);
    if (editingItem.type === 'project') {
      await deleteProject(editingItem.id);
    } else if (editingItem.type === 'pulse') {
      await deletePulse(editingItem.id);
      await refetchProjects();
    } else {
      await deleteDashboard(editingItem.id);
      closeDashboard(editingItem.id);
      if (activeDashboardId === editingItem.id) {
        navigate('/');
      }
    }
    setSaving(false);
    setShowEditModal(false);
    setEditingItem(null);
  };

  const handleDragStart = (e: React.DragEvent, dashboardId: string) => {
    setDraggedDashboardId(dashboardId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedDashboardId(null);
    setDragOverProjectId(null);
  };

  const handleDragOver = (e: React.DragEvent, projectId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverProjectId !== projectId) {
      setDragOverProjectId(projectId);
    }
  };

  const handleDragLeave = () => {
    setDragOverProjectId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetProjectId: string) => {
    e.preventDefault();
    if (!draggedDashboardId) return;
    const dashboard = projects
      .flatMap(p => p.dashboards)
      .find(d => d.id === draggedDashboardId);
    if (dashboard && dashboard.project_id !== targetProjectId) {
      await updateDashboard(draggedDashboardId, { project_id: targetProjectId });
      setExpandedProjects(prev => new Set(prev).add(targetProjectId));
    }
    setDraggedDashboardId(null);
    setDragOverProjectId(null);
  };

  const openEditModal = (type: 'project' | 'dashboard' | 'pulse', id: string, name: string, color?: string, projectId?: string) => {
    setEditingItem({ type, id, name, color, projectId });
    setShowEditModal(true);
    if (type === 'project') {
      const project = projects.find(p => p.id === id);
      if (project) {
        const dashboardItems = (project.dashboards || []).map(d => ({ id: d.id, name: d.name }));
        const pulseItems = (project.pulses || []).map(p => ({ id: p.id, name: p.name }));
        setSortOrderItems([...dashboardItems, ...pulseItems]);
      }
    } else {
      setSortOrderItems([]);
    }
  };

  const isHomeActive = location.pathname === '/' && !activeDashboardId && !isBuilderOpen && !isPulseBuilderOpen;

  const handleAddItemToFolder = (projectId: string, type: ProjectType) => {
    if (type === 'dashboards') {
      setNamePromptProjectId(projectId);
      setNamePromptValue('');
      setShowNamePrompt(true);
    } else {
      openPulseBuilder(projectId);
      navigate('/');
    }
  };

  const handleNamePromptSubmit = () => {
    if (!namePromptValue.trim() || !namePromptProjectId) return;
    openBuilder(namePromptProjectId, undefined, namePromptValue.trim());
    setShowNamePrompt(false);
    setNamePromptValue('');
    setNamePromptProjectId(null);
    navigate('/');
  };

  const handleDashboardPlay = (dashboard: Dashboard) => {
    openDashboard(dashboard, true);
    if (activeCompany) {
      logActivity('dashboard_open', activeCompany.id, dashboard.name, dashboard.id);
    }
    navigate('/');
  };

  const handleDashboardEdit = (dashboard: Dashboard) => {
    openBuilder(dashboard.project_id, dashboard.id);
    navigate('/');
  };

  const handlePulseEdit = (pulse: Pulse) => {
    openPulseBuilder(pulse.project_id, pulse.id);
    navigate('/');
  };

  const openEditPulseModal = (pulse: Pulse) => {
    setEditingItem({ type: 'pulse', id: pulse.id, name: pulse.name, projectId: pulse.project_id });
    setShowEditModal(true);
  };

  const handleDuplicatePulse = async (pulse: Pulse) => {
    const result = await duplicatePulse(pulse.id);
    if (!result.error) {
      await refetchProjects();
      setExpandedProjects((prev) => new Set(prev).add(pulse.project_id));
    }
  };

  const renderFolderItems = (projectList: typeof projects, type: ProjectType) => {
    return (
      <div className="mt-1 space-y-0.5">
        {projectList.map((project) => {
          const isExpanded = expandedProjects.has(project.id);
          const isDropTarget = dragOverProjectId === project.id && draggedDashboardId !== null;
          return (
            <div key={project.id}>
              <div
                className={`flex items-center group transition-all rounded-lg ${isDropTarget ? 'ring-2 ring-cyan-400/50 bg-cyan-400/10' : ''}`}
                onDragOver={(e) => handleDragOver(e, project.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, project.id)}
              >
                <button
                  onClick={() => toggleProjectExpanded(project.id)}
                  className={`flex items-center gap-2 flex-1 px-3 py-1 transition-colors rounded-lg ${
                    isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                  )}
                  <Folder className="w-4 h-4 flex-shrink-0" style={{ color: project.color }} />
                  <span className="text-sm truncate flex-1 text-left">{project.name}</span>
                  <span className="text-[10px] tabular-nums opacity-50 flex-shrink-0">{getProjectItemCount(project.id)}</span>
                </button>
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleAddItemToFolder(project.id, type)}
                    className={`p-1.5 rounded transition-colors ${isLight ? 'text-green-600 hover:bg-green-50' : 'text-green-400 hover:bg-green-900/20'}`}
                    title={`Add ${type === 'dashboards' ? 'Dashboard' : 'Pulse'}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => openEditModal('project', project.id, project.name, project.color)}
                    className={`p-1.5 rounded transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/10'}`}
                    title="Edit folder"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {isExpanded && type === 'dashboards' && (
                <div className="ml-5 mt-0.5 space-y-0">
                  {project.dashboards.filter(d => isAdmin || getDashboardAccess(d.id) !== 'none').map((dashboard) => {
                    const isActive = activeDashboardId === dashboard.id;
                    const isDragging = draggedDashboardId === dashboard.id;
                    const canEdit = isAdmin || getDashboardAccess(dashboard.id) === 'edit';
                    return (
                      <div
                        key={dashboard.id}
                        className={`flex items-center group ${isDragging ? 'opacity-50' : ''}`}
                        draggable={canEdit}
                        onDragStart={(e) => canEdit && handleDragStart(e, dashboard.id)}
                        onDragEnd={handleDragEnd}
                      >
                        <button
                          onClick={() => handleDashboardPlay(dashboard)}
                          className={`flex items-center gap-2 flex-1 px-3 py-0.5 rounded-lg text-sm cursor-pointer transition-all duration-200 ${
                            isActive
                              ? (isLight ? 'sidebar-active-glow-light text-blue-700' : 'sidebar-active-glow text-white')
                              : (isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-300 hover:text-white')
                          }`}
                        >
                          <span className="truncate flex-1 text-left">{dashboard.name}</span>
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => handleDashboardEdit(dashboard)}
                            className={`p-1 opacity-0 group-hover:opacity-100 transition-opacity rounded ${
                              isLight ? 'text-slate-400 hover:bg-slate-100' : 'text-slate-500 hover:bg-white/10'
                            }`}
                            title="Edit Dashboard"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                        {canEdit && (
                          <Dropdown
                            trigger={
                              <div className={`p-1 opacity-0 group-hover:opacity-100 transition-opacity rounded ${
                                isLight ? 'text-slate-400' : 'text-slate-500'
                              }`}>
                                <MoreHorizontal className="w-3 h-3" />
                              </div>
                            }
                            align="right"
                            width="w-40"
                          >
                            <DropdownItem onClick={() => openEditModal('dashboard', dashboard.id, dashboard.name, undefined, dashboard.project_id)}>
                              <Pencil className="w-4 h-4" />
                              Rename
                            </DropdownItem>
                            <DropdownDivider />
                            <DropdownItem onClick={() => openEditModal('dashboard', dashboard.id, dashboard.name, undefined, dashboard.project_id)} danger>
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </DropdownItem>
                          </Dropdown>
                        )}
                      </div>
                    );
                  })}
                  {project.dashboards.filter(d => isAdmin || getDashboardAccess(d.id) !== 'none').length === 0 && (
                    <p className={`px-3 py-2 text-xs ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>No dashboards yet</p>
                  )}
                </div>
              )}

              {isExpanded && type === 'pulse' && (
                <div className="ml-5 mt-0.5 space-y-0">
                  {project.pulses.map((pulse) => {
                    const isActive = isPulseBuilderOpen && pulseBuilderPulseId === pulse.id;
                    return (
                      <div key={pulse.id} className="flex items-center group">
                        <button
                          onClick={() => handlePulseEdit(pulse)}
                          className={`flex items-center gap-2 flex-1 px-3 py-0.5 rounded-lg text-sm cursor-pointer transition-all duration-200 ${
                            isActive
                              ? (isLight ? 'sidebar-active-glow-light text-blue-700' : 'sidebar-active-glow text-white')
                              : (isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-300 hover:text-white')
                          }`}
                        >
                          <span className="truncate flex-1 text-left">{pulse.name}</span>
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${pulse.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
                        </button>
                        <Dropdown
                          trigger={
                            <div className={`p-1 opacity-0 group-hover:opacity-100 transition-opacity rounded ${
                              isLight ? 'text-slate-400' : 'text-slate-500'
                            }`}>
                              <MoreHorizontal className="w-3 h-3" />
                            </div>
                          }
                          align="right"
                          width="w-40"
                        >
                          <DropdownItem onClick={() => openEditPulseModal(pulse)}>
                            <Pencil className="w-4 h-4" />
                            Rename
                          </DropdownItem>
                          <DropdownItem onClick={() => handleDuplicatePulse(pulse)}>
                            <Copy className="w-4 h-4" />
                            Duplicate
                          </DropdownItem>
                          <DropdownDivider />
                          <DropdownItem onClick={() => openEditPulseModal(pulse)} danger>
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </DropdownItem>
                        </Dropdown>
                      </div>
                    );
                  })}
                  {project.pulses.length === 0 && (
                    <p className={`px-3 py-2 text-xs ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>No pulses yet</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {projectList.length === 0 && (
          <p className={`px-3 py-2 text-xs ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>No folders yet</p>
        )}
      </div>
    );
  };

  return (
    <>
      <aside
        className={`fixed top-0 left-0 h-screen flex flex-col sidebar-transition ${
          collapsed ? 'w-[72px]' : 'w-64'
        } ${isLight ? 'sidebar-bg-light border-r border-slate-200' : 'sidebar-bg border-r border-slate-700/50'}`}
      >
        {/* Header */}
        <div className={`${collapsed ? 'px-2 py-3 flex items-center justify-center' : 'px-4 py-3'} border-b ${isLight ? 'border-slate-200' : 'border-slate-700/30'}`}>
          {collapsed ? (
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isLight ? 'bg-blue-100' : 'bg-white/10'}`}>
              <LayoutDashboard className={`w-5 h-5 ${isLight ? 'text-blue-600' : 'text-white'}`} />
            </div>
          ) : (
            <>
              <span className={`font-bold text-lg truncate block ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {activeCompany?.name || 'Nodal Hub'}
              </span>
              <p className={`text-[10px] mt-0.5 uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                Powered by Nodal Hub
              </p>
            </>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin py-3">
          <nav className="px-2">
            {/* Home / Dashboard nav item */}
            <div className="mb-1">
              <div
                onClick={handleHomeClick}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-200 ${
                  collapsed ? 'justify-center' : ''
                } ${
                  isHomeActive
                    ? (isLight ? 'sidebar-active-glow-light text-blue-700' : 'sidebar-active-glow text-white')
                    : (isLight ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' : 'text-slate-400 hover:text-white')
                }`}
              >
                <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span className="text-sm font-medium">Dashboard</span>}
              </div>
            </div>

            {/* Dashboards section */}
            {!collapsed && (
              <div className="mt-5">
                <div className="flex items-center justify-between px-3 mb-1">
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    Dashboards
                  </span>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => toggleAllFolders(dashboardProjects)}
                      className={`p-0.5 rounded transition-colors ${isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-white'}`}
                      title={dashboardProjects.every(p => expandedProjects.has(p.id)) ? 'Collapse All' : 'Expand All'}
                    >
                      <ChevronsUpDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openReorderFoldersModal('dashboards')}
                      className={`p-0.5 rounded transition-colors ${isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-white'}`}
                      title="Reorder Folders"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openNewProjectModal('dashboards')}
                      className={`p-0.5 rounded transition-colors ${isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-white'}`}
                      title="New Folder"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {renderFolderItems(dashboardProjects, 'dashboards')}
              </div>
            )}

            {/* Pulse section */}
            {!collapsed && (isAdmin || hasPermission('pulse')) && (
              <div className="mt-5">
                <div className="flex items-center justify-between px-3 mb-1">
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    Pulse
                  </span>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => toggleAllFolders(pulseProjects)}
                      className={`p-0.5 rounded transition-colors ${isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-white'}`}
                      title={pulseProjects.every(p => expandedProjects.has(p.id)) ? 'Collapse All' : 'Expand All'}
                    >
                      <ChevronsUpDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openReorderFoldersModal('pulse')}
                      className={`p-0.5 rounded transition-colors ${isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-white'}`}
                      title="Reorder Folders"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openNewProjectModal('pulse')}
                      className={`p-0.5 rounded transition-colors ${isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-white'}`}
                      title="New Folder"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {renderFolderItems(pulseProjects, 'pulse')}
              </div>
            )}

            {/* Active Dashboards */}
            {openDashboards.length > 0 && !collapsed && (
              <div className={`pt-4 mt-4 border-t ${isLight ? 'border-slate-200' : 'border-slate-700/30'}`}>
                <div className="px-3 mb-1">
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    Active Dashboards
                  </span>
                </div>
                <div className="space-y-0.5">
                  {openDashboards.map(({ dashboard }) => {
                    const isActive = activeDashboardId === dashboard.id;
                    return (
                      <div key={dashboard.id} className="flex items-center group">
                        <button
                          onClick={() => {
                            setActiveDashboard(dashboard.id);
                            navigate('/');
                          }}
                          className={`flex items-center gap-2 flex-1 px-3 py-1.5 rounded-lg text-sm transition-all duration-200 ${
                            isActive
                              ? (isLight ? 'sidebar-active-glow-light text-blue-700' : 'sidebar-active-glow text-white')
                              : (isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-500 hover:text-white')
                          }`}
                        >
                          <Play className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate flex-1 text-left">{dashboard.name}</span>
                        </button>
                        <button
                          onClick={() => closeDashboard(dashboard.id)}
                          className={`p-1 opacity-0 group-hover:opacity-100 transition-opacity rounded ${
                            isLight ? 'text-slate-400 hover:bg-slate-100' : 'text-slate-500 hover:bg-white/10'
                          }`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </nav>
        </div>

        {/* Bottom icons */}
        <div className={`border-t ${isLight ? 'border-slate-200' : 'border-slate-700/30'}`}>
          {collapsed ? (
            <div className="flex justify-center p-2">
              <CompanySwitcher iconOnly />
            </div>
          ) : (
            <div className="flex items-center justify-around px-2 py-2">
              <CompanySwitcher iconOnly />
              <NavLink
                to="/settings"
                className={({ isActive }) => `flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-slate-500 hover:text-white hover:bg-white/10'
                }`}
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </NavLink>
              {(isAdmin || hasPermission('settings_tab', 'queries')) && (
                <NavLink
                  to="/queries"
                  className={({ isActive }) => `flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-slate-500 hover:text-white hover:bg-white/10'
                  }`}
                  title="Query Manager"
                >
                  <Database className="w-5 h-5" />
                </NavLink>
              )}
              {(isAdmin || hasPermission('view_logs')) && (
                <NavLink
                  to="/logs"
                  className={({ isActive }) => `flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-slate-500 hover:text-white hover:bg-white/10'
                  }`}
                  title="Activity Logs"
                >
                  <ScrollText className="w-5 h-5" />
                </NavLink>
              )}
              <a
                href="#"
                className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors text-slate-500 hover:text-white hover:bg-white/10"
                title="Help"
              >
                <HelpCircle className="w-5 h-5" />
              </a>
            </div>
          )}

          <button
            onClick={toggle}
            className={`w-full flex items-center justify-center p-2 transition-colors border-t ${
              isLight ? 'border-slate-200 text-slate-400 hover:text-slate-700' : 'border-slate-700/30 text-slate-500 hover:text-white'
            }`}
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>
      </aside>

      {/* Dashboard Name Prompt Modal */}
      <Modal
        isOpen={showNamePrompt}
        onClose={() => { setShowNamePrompt(false); setNamePromptValue(''); setNamePromptProjectId(null); }}
        title="New Dashboard"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dashboard Name</label>
            <input
              type="text"
              value={namePromptValue}
              onChange={(e) => setNamePromptValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleNamePromptSubmit(); }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="Enter dashboard name..."
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setShowNamePrompt(false); setNamePromptValue(''); setNamePromptProjectId(null); }}>
              Cancel
            </Button>
            <Button onClick={handleNamePromptSubmit} disabled={!namePromptValue.trim()}>
              Create
            </Button>
          </div>
        </div>
      </Modal>

      {/* New Project Modal */}
      <Modal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        title={`Create New ${newProjectType === 'dashboards' ? 'Dashboard' : 'Pulse'} Folder`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Folder Name</label>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="My Folder"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewProjectColor(color)}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    newProjectColor === color ? 'ring-2 ring-offset-2 ring-cyan-500 scale-110' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowNewProjectModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} loading={saving} disabled={!newProjectName.trim()}>
              Create Folder
            </Button>
          </div>
        </div>
      </Modal>

      {/* New Dashboard Modal */}
      <Modal
        isOpen={showNewDashboardModal}
        onClose={() => setShowNewDashboardModal(false)}
        title="Create New Dashboard"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dashboard Name</label>
            <input
              type="text"
              value={newDashboardName}
              onChange={(e) => setNewDashboardName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="My Dashboard"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project</label>
            <CustomDropdown
              value={selectedProjectId}
              onChange={(val) => setSelectedProjectId(val)}
              options={(newProjectType === 'dashboards' ? dashboardProjects : pulseProjects).map((project) => ({
                value: project.id,
                label: project.name
              }))}
              placeholder="Select a project..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowNewDashboardModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDashboard} loading={saving} disabled={!newDashboardName.trim() || !selectedProjectId}>
              Create Dashboard
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reorder Folders Modal */}
      <Modal
        isOpen={showReorderFoldersModal}
        onClose={() => setShowReorderFoldersModal(false)}
        title={`Reorder ${reorderFolderType === 'dashboards' ? 'Dashboard' : 'Pulse'} Folders`}
      >
        <div className="space-y-4">
          <div className="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
            {folderOrder.map((folder, index) => (
              <div
                key={folder.id}
                draggable
                onDragStart={() => { dragFolderRef.current = index; }}
                onDragEnter={() => { dragFolderOverRef.current = index; }}
                onDragOver={(e) => e.preventDefault()}
                onDragEnd={() => {
                  if (dragFolderRef.current === null || dragFolderOverRef.current === null) return;
                  const reordered = [...folderOrder];
                  const [removed] = reordered.splice(dragFolderRef.current, 1);
                  reordered.splice(dragFolderOverRef.current, 0, removed);
                  setFolderOrder(reordered);
                  dragFolderRef.current = null;
                  dragFolderOverRef.current = null;
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-white dark:bg-slate-700 border-b border-slate-100 dark:border-slate-600 last:border-b-0 cursor-grab active:cursor-grabbing hover:bg-slate-50 dark:hover:bg-slate-600"
              >
                <GripVertical className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: folder.color }} />
                <span className="text-slate-700 dark:text-slate-200 truncate">{folder.name}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowReorderFoldersModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveReorderFolders} loading={saving}>
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setEditingItem(null); }}
        title={editingItem?.type === 'project' ? 'Edit Project' : editingItem?.type === 'pulse' ? 'Edit Pulse' : 'Edit Dashboard'}
      >
        {editingItem && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
              <input
                type="text"
                value={editingItem.name}
                onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                autoFocus
              />
            </div>
            {editingItem.type === 'project' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {PROJECT_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditingItem({ ...editingItem, color })}
                      className={`w-8 h-8 rounded-full transition-transform ${
                        editingItem.color === color ? 'ring-2 ring-offset-2 ring-cyan-500 scale-110' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            )}
            {editingItem.type === 'project' && sortOrderItems.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Item Order</label>
                <div className="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  {sortOrderItems.map((item, index) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => { dragSortRef.current = index; }}
                      onDragEnter={() => { dragSortOverRef.current = index; }}
                      onDragOver={(e) => e.preventDefault()}
                      onDragEnd={() => {
                        if (dragSortRef.current === null || dragSortOverRef.current === null) return;
                        const reordered = [...sortOrderItems];
                        const [removed] = reordered.splice(dragSortRef.current, 1);
                        reordered.splice(dragSortOverRef.current, 0, removed);
                        setSortOrderItems(reordered);
                        dragSortRef.current = null;
                        dragSortOverRef.current = null;
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white dark:bg-slate-700 border-b border-slate-100 dark:border-slate-600 last:border-b-0 cursor-grab active:cursor-grabbing hover:bg-slate-50 dark:hover:bg-slate-600"
                    >
                      <GripVertical className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="text-slate-700 dark:text-slate-200 truncate">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {editingItem.type === 'project' && !canDeleteProject(editingItem.id) && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Cannot delete this folder because it contains {getProjectItemCount(editingItem.id)} item(s). Move or delete all items first.
                </p>
              </div>
            )}
            <div className="flex justify-between pt-4">
              <Button
                variant="danger"
                onClick={handleDeleteItem}
                loading={saving}
                disabled={editingItem.type === 'project' && !canDeleteProject(editingItem.id)}
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => { setShowEditModal(false); setEditingItem(null); }}>
                  Cancel
                </Button>
                <Button onClick={handleEditItem} loading={saving} disabled={!editingItem.name.trim()}>
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
