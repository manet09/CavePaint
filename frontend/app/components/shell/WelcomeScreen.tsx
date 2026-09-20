"use client";

import React, { useState } from "react";
import { Film, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useProjectsListContext } from "../../context/ProjectContext";

export default function WelcomeScreen() {
  const router = useRouter();
  const { createNewProject } = useProjectsListContext();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateProject = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const created = await createNewProject();
      if (created) {
        router.push(`/projects/${created.id}/brainstorming`);
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
        onClick={handleCreateProject}
        disabled={isCreating}
        className="h-8.5 px-4 rounded-lg bg-zinc-100 hover:bg-zinc-200/85 text-zinc-800 hover:text-zinc-950 border border-zinc-200/90 dark:bg-zinc-800/90 dark:hover:bg-zinc-750 dark:text-zinc-200 dark:hover:text-zinc-100 dark:border-zinc-700/80 text-[13px] font-medium flex items-center gap-2 shadow-2xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
      >
        <Plus size={14} strokeWidth={2} />
        <span>{isCreating ? "Creating..." : "New Project"}</span>
      </button>
    </div>
  );
}
