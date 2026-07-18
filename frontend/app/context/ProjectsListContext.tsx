/* eslint-disable */
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export interface ProjectSummary {
  id: number;
  title: string;
  slug: string;
  status: string;
  scene_count: number;
  scenes_with_images: number;
  scenes_with_audio: number;
}

export interface CreatedProject {
  id: number;
  title: string;
  slug: string;
}

const API_BASE = "http://localhost:8000";

interface ProjectsListContextType {
  projects: ProjectSummary[];
  projectsList: ProjectSummary[];
  isLoading: boolean;
  error: string | null;
  refreshList: () => Promise<void>;
  createNewProject: (title: string) => Promise<CreatedProject | null>;
  updateProject: (id: number, fields: Partial<ProjectSummary>) => Promise<void>;
  deleteExistingProject: (id: number) => Promise<void>;
  duplicateProject: (id: number) => Promise<CreatedProject | null>;
}

const ProjectsListContext = createContext<ProjectsListContextType | undefined>(undefined);

export const ProjectsListProvider = ({ children }: { children: ReactNode }) => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/projects/summary`);
      if (response.ok) {
        const data: ProjectSummary[] = await response.json();
        setProjects(data);
      } else {
        setError("Failed to fetch projects");
      }
    } catch (err) {
      console.error(err);
      setError("Error fetching projects");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createNewProject = async (title: string): Promise<CreatedProject | null> => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (response.ok) {
        const newProject: CreatedProject = await response.json();
        setProjects((prev) => [
          {
            id: newProject.id,
            title: newProject.title,
            slug: newProject.slug,
            status: "draft",
            scene_count: 1,
            scenes_with_images: 0,
            scenes_with_audio: 0,
          },
          ...prev,
        ]);
        return newProject;
      }
      setError("Failed to create project");
    } catch (err) {
      console.error(err);
      setError("Error creating project");
    }
    return null;
  };

  const updateProject = async (id: number, fields: Partial<ProjectSummary>) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...fields } : p)));
    try {
      const response = await fetch(`${API_BASE}/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!response.ok) {
        setError("Failed to update project");
        await refreshList();
      }
    } catch (err) {
      console.error(err);
      setError("Error updating project");
      await refreshList();
    }
  };

  const deleteExistingProject = async (id: number) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    try {
      const response = await fetch(`${API_BASE}/api/projects/${id}`, { method: "DELETE" });
      if (!response.ok) {
        setError("Failed to delete project");
        await refreshList();
      }
    } catch (err) {
      console.error(err);
      setError("Error deleting project");
      await refreshList();
    }
  };

  const duplicateProject = async (id: number): Promise<CreatedProject | null> => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/projects/${id}/duplicate`, { method: "POST" });
      if (response.ok) {
        const newProject: CreatedProject = await response.json();
        await refreshList();
        return newProject;
      }
      setError("Failed to duplicate project");
    } catch (err) {
      console.error(err);
      setError("Error duplicating project");
    }
    return null;
  };

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  return (
    <ProjectsListContext.Provider
      value={{
        projects,
        projectsList: projects,
        isLoading,
        error,
        refreshList,
        createNewProject,
        updateProject,
        deleteExistingProject,
        duplicateProject,
      }}
    >
      {children}
    </ProjectsListContext.Provider>
  );
};

export const useProjectsListContext = () => {
  const ctx = useContext(ProjectsListContext);
  if (!ctx) throw new Error("useProjectsListContext must be used within a ProjectsListProvider");
  return ctx;
};
