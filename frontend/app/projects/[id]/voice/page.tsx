 
"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useProjectContext } from "../../../context/ProjectContext";

const VoiceTab = dynamic(() => import("../../../components/tabs/VoiceTab"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 text-sm text-panel-text">
      Loading voice studio...
    </div>
  ),
});

export default function VoicePage() {
  const { activeProject, refreshProjects } = useProjectContext();
  if (!activeProject) return null;
  return <VoiceTab activeProject={activeProject} refreshProjectData={refreshProjects} />;
}
