"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

const API_BASE = "http://localhost:8000";

export interface SceneData {
  id: number;
  project_id: number;
  scene_number: number;
  narration_khmer: string | null;
  image_prompt_english: string | null;
  negative_prompt: string | null;
  user_refinement_prompt: string | null;
  image_path: string | null;
  image_status: string;
  audio_path: string | null;
  audio_status: string;
}

export interface Project {
  id: number;
  title: string;
  slug: string;
  raw_research: string | null;
  script_narrative: string | null;
  video_concept: string | null;
  illustration_style: string | null;
  global_voice_style: string | null;
  structured_json_data: string | object | null;
  scenes: SceneData[];
}

interface ProjectContextType {
  projects: Project[];
  projectsList: Project[]; // Backward compatibility alias
  activeProject: Project | null;
  isLoading: boolean;
  error: string | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;
  
  // Abstraction Layers
  refreshProjects: () => Promise<void>;
  selectProject: (id: number) => Promise<void>;
  setActiveProject: (project: Project | null) => void; // Backward compatibility alias
  createNewProject: (title: string) => Promise<void>;
  updateActiveProject: (fields: Partial<Project>) => Promise<void>;
  updateSingleScene: (sceneId: number, fields: Partial<SceneData>) => Promise<void>;
  deleteExistingProject: (id: number) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProjectState] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [theme, setThemeState] = useState<"dark" | "light">("dark");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme === "dark" || savedTheme === "light") {
        setThemeState(savedTheme);
      }
    }
  }, []);

  const setTheme = (newTheme: "dark" | "light") => {
    setThemeState(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", newTheme);
    }
  };

  const refreshProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/projects`);
      if (response.ok) {
        const data = await response.json();
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
  };

  const selectProject = async (id: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/projects/${id}`);
      if (response.ok) {
        const data = await response.json();
        setActiveProjectState(data);
      } else {
        setError("Failed to load project details");
      }
    } catch (err) {
      console.error(err);
      setError("Error loading project details");
    } finally {
      setIsLoading(false);
    }
  };

  const setActiveProject = (project: Project | null) => {
    if (project) {
      selectProject(project.id);
    } else {
      setActiveProjectState(null);
    }
  };

  const createNewProject = async (title: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (response.ok) {
        const newProject = await response.json();
        await refreshProjects();
        setActiveProjectState(newProject);
      } else {
        setError("Failed to create project");
      }
    } catch (err) {
      console.error(err);
      setError("Error creating project");
    } finally {
      setIsLoading(false);
    }
  };

  const updateActiveProject = async (fields: Partial<Project>) => {
    if (!activeProject) return;
    
    // Optimistic update
    setActiveProjectState((prev) => prev ? { ...prev, ...fields } : null);
    
    try {
      const response = await fetch(`${API_BASE}/api/projects/${activeProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!response.ok) {
        console.error("Failed to sync project update to backend");
      }
    } catch (err) {
      console.error("Error updating project:", err);
    }
  };

  const updateSingleScene = async (sceneId: number, fields: Partial<SceneData>) => {
    if (!activeProject || !activeProject.scenes) return;

    // Optimistic mirror
    setActiveProjectState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        scenes: prev.scenes.map((scene) => 
          scene.id === sceneId ? { ...scene, ...fields } : scene
        )
      };
    });

    try {
      const response = await fetch(`${API_BASE}/api/scenes/${sceneId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!response.ok) {
        console.error("Failed to sync scene update to backend");
      }
    } catch (err) {
      console.error("Error updating scene:", err);
    }
  };

  const deleteExistingProject = async (id: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/projects/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        if (activeProject?.id === id) {
          setActiveProjectState(null);
        }
        await refreshProjects();
      } else {
        setError("Failed to delete project");
      }
    } catch (err) {
      console.error(err);
      setError("Error deleting project");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshProjects();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        projectsList: projects,
        activeProject,
        isLoading,
        error,
        activeTab,
        setActiveTab,
        theme,
        setTheme,
        refreshProjects,
        selectProject,
        setActiveProject,
        createNewProject,
        updateActiveProject,
        updateSingleScene,
        deleteExistingProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProjectContext = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProjectContext must be used within a ProjectProvider");
  }
  return context;
};
