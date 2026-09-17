/* eslint-disable */
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import type { Project, SceneData } from "./types";

const API_BASE = "http://localhost:8000";

interface ProjectDataContextType {
  activeProject: Project | null;
  isLoading: boolean;
  error: string | null;
  selectProject: (id: number) => Promise<void>;
  refreshActive: () => Promise<void>;
  updateActiveProject: (fields: Partial<Project>) => Promise<void>;
  updateSingleScene: (sceneId: number, fields: Partial<SceneData>) => Promise<void>;
}

const ProjectDataContext = createContext<ProjectDataContextType | undefined>(undefined);

export const ProjectDataProvider = ({ children }: { children: ReactNode }) => {
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<number | null>(null);

  const loadProject = useCallback(async (id: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/projects/${id}`);
      if (response.ok) {
        const data: Project = await response.json();
        setActiveProject(data);
        setLoadedId(id);
        if (typeof window !== "undefined") {
          localStorage.setItem("activeProjectId", String(id));
        }
      } else if (response.status === 404) {
        setActiveProject(null);
        setLoadedId(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("activeProjectId");
        }
        setError("Project not found");
      } else {
        setError("Failed to load project details");
      }
    } catch (err) {
      console.error(err);
      setError("Error loading project details");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectProject = useCallback(
    async (id: number) => {
      if (loadedId === id && activeProject) {
        return;
      }
      await loadProject(id);
    },
    [loadedId, activeProject, loadProject]
  );

  const refreshActive = useCallback(async () => {
    if (!activeProject) return;
    try {
      const response = await fetch(`${API_BASE}/api/projects/${activeProject.id}`);
      if (response.ok) {
        const data: Project = await response.json();
        setActiveProject(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, [activeProject]);

  const updateActiveProject = async (fields: Partial<Project>) => {
    if (!activeProject) return;

    setActiveProject((prev) => (prev ? { ...prev, ...fields } : null));

    try {
      const response = await fetch(`${API_BASE}/api/projects/${activeProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!response.ok) {
        console.error("Failed to sync project update to backend");
        await refreshActive();
      }
    } catch (err) {
      console.error("Error updating project:", err);
      await refreshActive();
    }
  };

  const updateSingleScene = async (sceneId: number, fields: Partial<SceneData>) => {
    setActiveProject((prev) => {
      if (!prev) return prev;
      
      const newScenes = prev.scenes.map((scene) =>
        scene.id === sceneId ? { ...scene, ...fields } : scene
      );
      
      const cleanJsonArray = newScenes.map((scene) => ({
        scene_number: scene.scene_number,
        narration_khmer: scene.narration_khmer,
        image_prompt_english: scene.image_prompt_english,
        negative_prompt: scene.negative_prompt,
        image_path: scene.image_path,
        audio_path: scene.audio_path,
        character_id: scene.character_id,
        character_name: scene.character_name,
      }));

      return {
        ...prev,
        scenes: newScenes,
        structured_json_data: JSON.stringify(cleanJsonArray, null, 2),
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

  return (
    <ProjectDataContext.Provider
      value={{
        activeProject,
        isLoading,
        error,
        selectProject,
        refreshActive,
        updateActiveProject,
        updateSingleScene,
      }}
    >
      {children}
    </ProjectDataContext.Provider>
  );
};

export const useProjectDataContext = () => {
  const ctx = useContext(ProjectDataContext);
  if (!ctx) throw new Error("useProjectDataContext must be used within a ProjectDataProvider");
  return ctx;
};
