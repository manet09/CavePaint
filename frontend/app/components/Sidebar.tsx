/* eslint-disable */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { FolderOpen, Sun, Moon, Plus, PanelLeftClose, PanelLeftOpen, Settings, MoreVertical } from "lucide-react";
import { useProjectContext } from "../context/ProjectContext";

export default function Sidebar() {
  const { projectsList, activeProject, setActiveProject, theme, setTheme, refreshProjects, createNewProject } = useProjectContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectTopic, setNewProjectTopic] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("sidebarCollapsed");
    if (stored !== null) {
      setIsCollapsed(stored === "true");
    }
  }, []);

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("sidebarCollapsed", String(newState));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectTopic.trim()) return;

    setIsCreating(true);
    try {
      await createNewProject(newProjectTopic);
      setNewProjectTopic("");
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error creating project:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div 
      className={`relative h-full flex flex-col bg-card border-r border-zinc-200/60 dark:border-zinc-800/40 text-card-foreground transition-all duration-300 ease-in-out z-20 overflow-hidden ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* 1. Brand Header Bar */}
      <div className="h-14 flex items-center shrink-0 border-b border-zinc-200/50 dark:border-zinc-800/50 w-full px-3 justify-between">
        <span className={`text-lg font-semibold tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-600 dark:from-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent transition-all duration-200 whitespace-nowrap overflow-hidden ${
          isCollapsed ? "opacity-0 w-0 pointer-events-none" : "opacity-100 w-auto"
        }`}>
          Studio
        </span>
        <button
          onClick={toggleCollapse}
          className="w-10 h-10 flex items-center justify-center text-zinc-500 hover:text-panel-icon dark:text-zinc-400 hover:bg-panel-header transition-colors rounded-xl shrink-0"
          title={isCollapsed ? "Open sidebar" : "Close sidebar"}
        >
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* 2. Symmetrical New Project Trigger */}
      <div className="px-3 mt-4 shrink-0 w-full">
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full h-10 flex items-center rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-panel-header hover:text-panel-icon transition-all group overflow-hidden px-0 shrink-0"
          title="New Project"
        >
          <div className="w-10 h-10 flex items-center justify-center shrink-0">
            <div className="w-6 h-6 rounded-full border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-zinc-500 dark:text-zinc-400 group-hover:border-panel-icon group-hover:text-panel-icon transition-colors">
              <Plus size={14} />
            </div>
          </div>
          <span className={`text-[14px] font-medium tracking-tight transition-all duration-300 whitespace-nowrap ${
            isCollapsed ? "opacity-0 translate-x-[-10px] pointer-events-none" : "opacity-100 translate-x-0"
          }`}>
            New Project
          </span>
        </button>
      </div>

      {/* 3. Symmetrical Project Timeline Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 custom-scrollbar overflow-x-hidden w-full flex flex-col">
        {/* Jitter-Free Header Field */}
        <h3 className={`text-[11px] font-semibold text-panel-text uppercase tracking-wider px-3 mb-2 mt-4 transition-opacity duration-200 select-none whitespace-nowrap ${
          isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100 delay-150"
        }`}>
          Past Projects
        </h3>
        
        {projectsList.length === 0 ? (
          !isCollapsed && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 px-3 py-2 italic animate-in fade-in duration-150">
              No projects yet
            </p>
          )
        ) : (
          projectsList.map((project) => {
            const isActive = activeProject?.id === project.id;
            return (
              <div key={project.id} className="relative group shrink-0 w-full flex">
                <button
                  onClick={() => setActiveProject(project)}
                  className={`w-full h-10 flex items-center rounded-xl transition-all text-left relative overflow-hidden px-0 shrink-0 ${
                    isActive
                      ? "bg-panel-header text-panel-icon font-semibold shadow-2xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-panel-header/50 hover:text-panel-text"
                  }`}
                  title={isCollapsed ? (project.title || project.slug || "Untitled") : undefined}
                >
                  {/* Perfect Symmetrical Base Grid Anchor */}
                  <div className={`w-10 h-10 flex items-center justify-center shrink-0 transition-colors ${
                    isActive ? "text-panel-icon" : "opacity-60 group-hover:opacity-100"
                  }`}>
                    <FolderOpen size={16} />
                  </div>
                  
                  <span className={`truncate text-[13.5px] flex-1 transition-all duration-300 whitespace-nowrap pr-6 ${
                    isCollapsed ? "opacity-0 translate-x-[-10px] pointer-events-none" : "opacity-100 translate-x-0"
                  }`}>
                    {project.title || project.slug || "Untitled"}
                  </span>

                  {!isCollapsed && (
                    <div 
                      className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === project.id ? null : project.id);
                      }}
                    >
                      <MoreVertical size={14} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors" />
                    </div>
                  )}
                </button>

                {/* Dropdown Menu Overlay */}
                {openMenuId === project.id && !isCollapsed && (
                  <div 
                    ref={menuRef}
                    className="absolute right-3 top-9 z-50 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-1 w-32 text-[13px] animate-in fade-in zoom-in-95 duration-100"
                  >
                    <div 
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-lg px-2.5 py-1.5 cursor-pointer text-zinc-700 dark:text-zinc-300"
                      onClick={() => setOpenMenuId(null)}
                    >
                      Rename
                    </div>
                    <div 
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-lg px-2.5 py-1.5 cursor-pointer text-zinc-700 dark:text-zinc-300"
                      onClick={() => setOpenMenuId(null)}
                    >
                      Duplicate
                    </div>
                    <div 
                      className="text-red-600 hover:bg-red-50/60 dark:hover:bg-red-950/20 rounded-lg px-2.5 py-1.5 cursor-pointer font-medium"
                      onClick={() => setOpenMenuId(null)}
                    >
                      Delete
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 4. Symmetrical Footer Actions */}
      <div className="p-3 border-t border-zinc-200/50 dark:border-zinc-800/50 flex flex-col gap-0.5 shrink-0 w-full">
        <button
          className="w-full h-10 flex items-center rounded-xl text-[13.5px] text-zinc-600 dark:text-zinc-400 hover:bg-panel-header hover:text-panel-text transition-colors px-0 shrink-0"
          title="Settings"
        >
          <div className="w-10 h-10 flex items-center justify-center shrink-0">
            <Settings size={16} className="opacity-70" />
          </div>
          <span className={`transition-all duration-300 whitespace-nowrap ${
            isCollapsed ? "opacity-0 translate-x-[-10px] pointer-events-none" : "opacity-100 translate-x-0"
          }`}>
            Settings
          </span>
        </button>
        
        <button
          onClick={toggleTheme}
          className="w-full h-10 flex items-center rounded-xl text-[13.5px] text-zinc-600 dark:text-zinc-400 hover:bg-panel-header hover:text-panel-text transition-colors px-0 shrink-0"
          title="Toggle Theme"
        >
          <div className="w-10 h-10 flex items-center justify-center shrink-0">
            {theme === "dark" ? <Sun size={16} className="opacity-70" /> : <Moon size={16} className="opacity-70" />}
          </div>
          <span className={`transition-all duration-300 whitespace-nowrap ${
            isCollapsed ? "opacity-0 translate-x-[-10px] pointer-events-none" : "opacity-100 translate-x-0"
          }`}>
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </span>
        </button>
      </div>

      {/* New Project Creator Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-card border border-zinc-200/80 dark:border-zinc-800/80 p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h2 className="text-lg font-semibold mb-4 tracking-tight text-card-foreground">Create New Project</h2>
            <form onSubmit={handleCreateProject}>
              <div className="mb-4">
                <label htmlFor="topic" className="block text-xs font-medium mb-2 text-zinc-500 uppercase tracking-wider">
                  Topic Name
                </label>
                <input
                  type="text"
                  id="topic"
                  value={newProjectTopic}
                  onChange={(e) => setNewProjectTopic(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-primary text-sm text-foreground placeholder:text-zinc-400"
                  placeholder="e.g., The History of Rome"
                  autoFocus
                  required
                />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors text-zinc-600 dark:text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newProjectTopic.trim()}
                  className="px-4 py-2 bg-primary text-white hover:bg-primary-hover transition-colors font-medium rounded-xl text-sm disabled:opacity-40"
                >
                  {isCreating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}