 
"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useProjectContext } from "../../../context/ProjectContext";

const ImagesTab = dynamic(() => import("../../../components/tabs/ImagesTab"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 text-sm text-panel-text">
      Loading images workspace...
    </div>
  ),
});

export default function ImagesPage() {
  const { activeProject, refreshProjects } = useProjectContext();
  if (!activeProject) return null;
  return <ImagesTab activeProject={activeProject} refreshProjectData={refreshProjects} />;
}
