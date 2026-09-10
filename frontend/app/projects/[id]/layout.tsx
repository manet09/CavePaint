 
"use client";

import React, { use, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import ProjectHeader from "../../components/shell/ProjectHeader";
import { ProjectDataProvider, useProjectDataContext, useUIContext } from "../../context/ProjectContext";

function ProjectLayoutInner({ children, id }: { children: React.ReactNode; id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { activeProject, selectProject, isLoading } = useProjectDataContext();
  const { setActiveTab } = useUIContext();

  useEffect(() => {
    const parsedId = parseInt(id, 10);
    if (!Number.isNaN(parsedId)) {
      selectProject(parsedId);
    }
  }, [id, selectProject]);

  useEffect(() => {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    const tab = segments[2];
    if (tab && ["brainstorming", "overview", "images", "voice", "output"].includes(tab)) {
      setActiveTab(tab === "overview" ? "brainstorming" : tab);
    }
  }, [pathname, setActiveTab]);

  useEffect(() => {
    if (!isLoading && activeProject && activeProject.id !== parseInt(id, 10)) {
      router.replace("/");
    }
  }, [isLoading, activeProject, id, router]);

  if (!activeProject || activeProject.id !== parseInt(id, 10)) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="h-14 min-h-[56px] border-b border-zinc-200/60 dark:border-zinc-800/40 bg-card/80 shrink-0" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm text-panel-text">Loading project...</div>
        </div>
      </div>
    );
  }

  const title = activeProject.title || activeProject.slug || "Untitled Project";

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <ProjectHeader projectId={id} title={title} />
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">{children}</div>
    </div>
  );
}

export default function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ProjectDataProvider>
      <ProjectLayoutInner id={id}>{children}</ProjectLayoutInner>
    </ProjectDataProvider>
  );
}
