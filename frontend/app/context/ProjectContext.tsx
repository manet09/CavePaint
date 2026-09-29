 
"use client";

import { useProjectsListContext } from "./ProjectsListContext";
import { useProjectDataContext } from "./ProjectDataContext";
import { useUIContext } from "./UIContext";
import type { Project, SceneData } from "./types";
import type { ProjectSummary, CreatedProject } from "./ProjectsListContext";

export type { Project, SceneData, ProjectSummary, CreatedProject };

export interface ProjectContextType {
  projects: ProjectSummary[];
  projectsList: ProjectSummary[];
  activeProject: Project | null;
  isLoading: boolean;
  error: string | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;

  refreshProjects: () => Promise<void>;
  refreshActiveProject: () => Promise<void>;
  selectProject: (id: number) => Promise<void>;
  setActiveProject: (project: Project | null) => void;
  createNewProject: (title?: string) => Promise<CreatedProject | null>;
  updateActiveProject: (fields: Partial<Project>) => Promise<void>;
  updateProject: (id: number, fields: Partial<ProjectSummary>) => Promise<void>;
  updateSingleScene: (sceneId: number, fields: Partial<SceneData>) => Promise<void>;
  reorderScenes: (newSceneIds: number[]) => Promise<void>;
  deleteExistingProject: (id: number) => Promise<void>;
  duplicateProject: (id: number) => Promise<CreatedProject | null>;
}

/**
 * Unified facade hook. Composes the three split contexts (UI, ProjectsList, ProjectData).
 * Prefer the individual hooks in new code:
 *   - useUIContext()
 *   - useProjectsListContext()
 *   - useProjectDataContext()
 */
export const useProjectContext = (): ProjectContextType => {
  const ui = useUIContext();
  const list = useProjectsListContext();
  const data = useProjectDataContext();

  const setActiveProject = (project: Project | null) => {
    if (project) {
      data.selectProject(project.id);
    } else {
      if (typeof window !== "undefined") localStorage.removeItem("activeProjectId");
    }
  };

  return {
    projects: list.projects,
    projectsList: list.projectsList,
    activeProject: data.activeProject,
    isLoading: list.isLoading || data.isLoading,
    error: list.error ?? data.error,
    activeTab: ui.activeTab,
    setActiveTab: ui.setActiveTab,
    theme: ui.theme,
    setTheme: ui.setTheme,

    refreshProjects: list.refreshList,
    refreshActiveProject: data.refreshActive,
    selectProject: data.selectProject,
    setActiveProject,
    createNewProject: list.createNewProject,
    updateActiveProject: data.updateActiveProject,
    updateProject: list.updateProject,
    updateSingleScene: data.updateSingleScene,
    reorderScenes: data.reorderScenes,
    deleteExistingProject: list.deleteExistingProject,
    duplicateProject: list.duplicateProject,
  };
};

export { useUIContext } from "./UIContext";
export { useProjectsListContext } from "./ProjectsListContext";
export { useProjectDataContext } from "./ProjectDataContext";
export { UIProvider } from "./UIContext";
export { ProjectsListProvider } from "./ProjectsListContext";
export { ProjectDataProvider } from "./ProjectDataContext";
