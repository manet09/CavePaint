"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface Scene {
  id?: string;
  [key: string]: unknown;
}

export interface Project {
  id: string;
  name: string;
  topic: string;
  research: string;
  script: string;
  video_concept: string;
  image_style: string;
  voice_style: string;
  status: string;
  scenes: Scene[];
}

interface ProjectContextType {
  activeProject: Project | null;
  setActiveProject: (project: Project | null) => void;
  projectsList: Project[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;
  refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const refreshProjects = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/projects");
      if (response.ok) {
        const data = await response.json();
        setProjectsList(data);
      } else {
        console.error("Failed to fetch projects");
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
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
        activeProject,
        setActiveProject,
        projectsList,
        activeTab,
        setActiveTab,
        theme,
        setTheme,
        refreshProjects,
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
