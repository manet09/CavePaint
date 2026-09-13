"use client";

import React, { useState } from "react";
import { Film, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useProjectsListContext } from "../../context/ProjectContext";

export default function WelcomeScreen() {
  const router = useRouter();
  const { createNewProject } = useProjectsListContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsCreating(true);
    try {
      const created = await createNewProject(topic.trim());
      setTopic("");
      setIsModalOpen(false);
      if (created && typeof created === "object" && "id" in created) {
        router.push(`/projects/${(created as { id: number }).id}/brainstorming`);
      }
    } catch (error) {
      console.error("Error creating project:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-200">
      <div className="w-12 h-12 mb-4 rounded-xl border border-border bg-card flex items-center justify-center shadow-xs text-foreground">
        <Film size={22} strokeWidth={1.8} />
      </div>
      <h2 className="text-[17px] font-semibold mb-1.5 tracking-tight text-foreground">
        Welcome to Studio
      </h2>
      <p className="text-[13px] text-panel-text max-w-sm leading-relaxed mb-6">
        Select a project from the sidebar to continue, or create a new project to get started.
      </p>
      <button
        onClick={() => setIsModalOpen(true)}
        className="h-8.5 px-4 rounded-lg bg-zinc-100 hover:bg-zinc-200/85 text-zinc-800 hover:text-zinc-950 border border-zinc-200/90 dark:bg-zinc-800/90 dark:hover:bg-zinc-750 dark:text-zinc-200 dark:hover:text-zinc-100 dark:border-zinc-700/80 text-[13px] font-medium flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
      >
        <Plus size={14} strokeWidth={2} />
        <span>New Project</span>
      </button>

      {/* New Project Modal */}
      {isModalOpen && (
        <div 
          onClick={() => setIsModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 text-left cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border p-5 rounded-xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-150 cursor-default"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Create New Project</h2>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="text-panel-text hover:text-foreground p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div className="mb-5">
                <label htmlFor="welcome-topic" className="block text-[11px] font-medium mb-1.5 text-panel-text uppercase tracking-wider">
                  Project Topic / Title
                </label>
                <input
                  type="text"
                  id="welcome-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 text-[13px] text-foreground placeholder:text-panel-text/40"
                  placeholder="e.g. The History of Rome"
                  autoFocus
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 text-[13px] font-medium border border-border hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-panel-text hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !topic.trim()}
                  className="px-3.5 py-1.5 bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors font-medium rounded-lg text-[13px] disabled:opacity-40 shadow-xs cursor-pointer"
                >
                  {isCreating ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
