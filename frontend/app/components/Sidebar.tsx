"use client";

import React, { useState, useEffect, useRef } from "react";
import { FolderOpen, Sun, Moon, Plus, ChevronLeft, ChevronRight, Settings, MoreVertical } from "lucide-react";
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
      className={`relative h-full flex flex-col bg-card border-r border-zinc-200/80 dark:border-zinc-800/40 text-card-foreground transition-all duration-300 ease-in-out z-20 ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Collapse Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-8 bg-card border border-zinc-200 dark:border-zinc-700 text-foreground rounded-full p-1 shadow-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-30"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Top section: New Project */}
      <div className="p-4 flex justify-center border-b border-zinc-200/50 dark:border-zinc-800/50">
        <button
          onClick={() => setIsModalOpen(true)}
          className={`flex items-center justify-center transition-all duration-300 border border-zinc-200 dark:border-zinc-800 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 font-medium ${
            isCollapsed 
              ? "w-10 h-10 p-0 rounded-full" 
              : "w-full gap-2 px-4 py-2 rounded-xl shadow-sm"
          }`}
        >
          <Plus size={isCollapsed ? 20 : 18} />
          {!isCollapsed && <span className="truncate">New Project</span>}
        </button>
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 relative">
        {!isCollapsed && (
          <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3 px-2">
            Past Projects
          </h3>
        )}
        
        {projectsList.length === 0 ? (
          !isCollapsed && <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center py-4">No projects yet</p>
        ) : (
          projectsList.map((project) => {
            const isActive = activeProject?.id === project.id;
            return (
              <div key={project.id} className="relative group w-full">
                <button
                  onClick={() => setActiveProject(project)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-left relative overflow-hidden ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-zinc-100"
                  } ${isCollapsed ? "justify-center px-0" : ""}`}
                  title={isCollapsed ? (project.title || project.slug || "Untitled") : undefined}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {isActive && !isCollapsed && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                    )}
                    <div className={`shrink-0 z-10 ${isActive ? "text-primary" : "opacity-70 group-hover:opacity-100"}`}>
                       <FolderOpen size={18} />
                    </div>
                    {!isCollapsed && (
                      <span className="truncate text-sm z-10 flex-1 text-left">
                        {project.title || project.slug || "Untitled"}
                      </span>
                    )}
                  </div>

                  {!isCollapsed && (
                    <div 
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 shrink-0 ml-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === project.id ? null : project.id);
                      }}
                    >
                      <MoreVertical size={16} className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors" />
                    </div>
                  )}
                </button>

                {/* Dropdown Menu */}
                {openMenuId === project.id && !isCollapsed && (
                  <div 
                    ref={menuRef}
                    className="absolute right-4 top-10 z-50 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl p-1 w-36 text-sm animate-in fade-in zoom-in-95 duration-150"
                  >
                    <div 
                      className="hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded px-2 py-1.5 cursor-pointer text-zinc-700 dark:text-zinc-300"
                      onClick={() => setOpenMenuId(null)}
                    >
                      Rename
                    </div>
                    <div 
                      className="hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded px-2 py-1.5 cursor-pointer text-zinc-700 dark:text-zinc-300"
                      onClick={() => setOpenMenuId(null)}
                    >
                      Duplicate
                    </div>
                    <div 
                      className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded px-2 py-1.5 cursor-pointer"
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

      {/* Bottom section: Settings & Theme */}
      <div className={`p-4 border-t border-zinc-200/50 dark:border-zinc-800/50 flex flex-col gap-2 ${
        isCollapsed ? "items-center" : "items-stretch"
      }`}>
        <button
          className={`flex items-center gap-3 p-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors ${
            isCollapsed ? "justify-center" : "w-full text-left"
          }`}
          title="Settings"
        >
          <Settings size={18} className="shrink-0" />
          {!isCollapsed && <span>Settings</span>}
        </button>
        <button
          onClick={toggleTheme}
          className={`flex items-center gap-3 p-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors ${
            isCollapsed ? "justify-center" : "w-full text-left"
          }`}
          title="Toggle Theme"
        >
          {theme === "dark" ? <Sun size={18} className="shrink-0" /> : <Moon size={18} className="shrink-0" />}
          {!isCollapsed && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
        </button>
      </div>

      {/* New Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border p-6 rounded-2xl w-full max-w-md shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-semibold mb-4 text-card-foreground">Create New Project</h2>
            <form onSubmit={handleCreateProject}>
              <div className="mb-4">
                <label htmlFor="topic" className="block text-sm font-medium mb-2 text-card-foreground/80">
                  Topic Name
                </label>
                <input
                  type="text"
                  id="topic"
                  value={newProjectTopic}
                  onChange={(e) => setNewProjectTopic(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                  placeholder="e.g., The History of Rome"
                  autoFocus
                  required
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium hover:bg-foreground/5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newProjectTopic.trim()}
                  className="px-4 py-2 bg-primary text-white hover:opacity-90 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                  style={{ backgroundColor: "var(--color-primary)" }}
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
