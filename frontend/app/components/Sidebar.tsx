"use client";

import React, { useState } from "react";
import { FolderOpen, Sun, Moon, Plus } from "lucide-react";
import { useProjectContext } from "../context/ProjectContext";

export default function Sidebar() {
  const { projectsList, activeProject, setActiveProject, theme, setTheme, refreshProjects } = useProjectContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectTopic, setNewProjectTopic] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectTopic.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch("http://localhost:8000/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: newProjectTopic,
        }),
      });

      if (response.ok) {
        await refreshProjects();
        setNewProjectTopic("");
        setIsModalOpen(false);
      } else {
        console.error("Failed to create project");
      }
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
    <div className="w-64 h-full flex flex-col bg-card border-r border-border text-card-foreground">
      {/* Top section: New Project */}
      <div className="p-4 border-b border-border">
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary-hover px-4 py-2 rounded-md transition-colors font-medium"
        >
          <Plus size={18} />
          New Project
        </button>
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <h3 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-3">
          Past Projects
        </h3>
        {projectsList.length === 0 ? (
          <p className="text-sm text-foreground/50 text-center py-4">No projects yet</p>
        ) : (
          projectsList.map((project) => (
            <button
              key={project.id}
              onClick={() => setActiveProject(project)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all text-left ${
                activeProject?.id === project.id
                  ? "bg-foreground/10 font-medium"
                  : "hover:bg-foreground/5 text-foreground/80 hover:text-foreground"
              }`}
            >
              <FolderOpen size={16} className="shrink-0 opacity-70" />
              <span className="truncate text-sm">{project.topic || project.name || "Untitled"}</span>
            </button>
          ))
        )}
      </div>

      {/* Bottom section: Theme Toggle */}
      <div className="p-4 border-t border-border">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-foreground/5 transition-colors text-left text-sm text-foreground/80 hover:text-foreground"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          <span>Toggle Theme</span>
        </button>
      </div>

      {/* New Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border p-6 rounded-lg w-full max-w-md shadow-lg">
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
                  className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                  placeholder="e.g., The History of Rome"
                  autoFocus
                  required
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium hover:bg-foreground/5 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newProjectTopic.trim()}
                  className="px-4 py-2 bg-primary text-white hover:opacity-90 rounded-md transition-colors text-sm font-medium disabled:opacity-50"
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
