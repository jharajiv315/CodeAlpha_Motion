import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Workspace, Project, WorkspaceMember } from '../types/index.ts';
import { api } from '../lib/api.ts';
import { useAuth } from './AuthContext.tsx';

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  setCurrentWorkspace: (workspace: Workspace) => void;
  projects: Project[];
  currentProject: Project | null;
  setCurrentProject: (project: Project) => void;
  workspaceMembers: WorkspaceMember[];
  loadingWorkspaces: boolean;
  loadingProjects: boolean;
  reloadWorkspaces: () => Promise<void>;
  reloadProjects: () => Promise<void>;
  reloadMembers: () => Promise<void>;
  createWorkspace: (name: string) => Promise<Workspace>;
  createProject: (name: string, description?: string) => Promise<Project>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const reloadWorkspaces = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      return;
    }
    setLoadingWorkspaces(true);
    try {
      const res = await api.workspaces.list();
      setWorkspaces(res.workspaces);
      if (res.workspaces.length > 0) {
        // Keep current workspace if still in list, else default to first
        setCurrentWorkspace((prev) => {
          if (prev) {
            const found = res.workspaces.find((w) => w.id === prev.id);
            if (found) return found;
          }
          return res.workspaces[0];
        });
      } else {
        setCurrentWorkspace(null);
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    } finally {
      setLoadingWorkspaces(false);
    }
  }, [user]);

  const reloadMembers = useCallback(async () => {
    if (!currentWorkspace) {
      setWorkspaceMembers([]);
      return;
    }
    try {
      const res = await api.workspaces.members(currentWorkspace.id);
      setWorkspaceMembers(res.members);
    } catch (err) {
      console.error('Failed to load workspace members:', err);
    }
  }, [currentWorkspace]);

  const reloadProjects = useCallback(async () => {
    if (!currentWorkspace) {
      setProjects([]);
      setCurrentProject(null);
      return;
    }
    setLoadingProjects(true);
    try {
      const res = await api.projects.list(currentWorkspace.id);
      setProjects(res.projects);
      if (res.projects.length > 0) {
        setCurrentProject((prev) => {
          if (prev) {
            const found = res.projects.find((p) => p.id === prev.id);
            if (found) return found;
          }
          return res.projects[0];
        });
      } else {
        setCurrentProject(null);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    reloadWorkspaces();
  }, [reloadWorkspaces]);

  useEffect(() => {
    if (currentWorkspace) {
      reloadProjects();
      reloadMembers();
    }
  }, [currentWorkspace, reloadProjects, reloadMembers]);

  const createWorkspace = async (name: string): Promise<Workspace> => {
    const res = await api.workspaces.create(name);
    await reloadWorkspaces();
    setCurrentWorkspace(res.workspace);
    return res.workspace;
  };

  const createProject = async (name: string, description?: string): Promise<Project> => {
    if (!currentWorkspace) throw new Error('No workspace selected');
    const res = await api.projects.create(currentWorkspace.id, name, description);
    await reloadProjects();
    setCurrentProject(res.project);
    return res.project;
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        setCurrentWorkspace,
        projects,
        currentProject,
        setCurrentProject,
        workspaceMembers,
        loadingWorkspaces,
        loadingProjects,
        reloadWorkspaces,
        reloadProjects,
        reloadMembers,
        createWorkspace,
        createProject,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextType {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
