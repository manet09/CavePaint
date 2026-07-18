 
"use client";

import React from "react";
import OverviewTab from "../../../components/tabs/OverviewTab";
import { useProjectContext } from "../../../context/ProjectContext";

export default function OverviewPage() {
  const { activeProject, refreshActiveProject } = useProjectContext();
  if (!activeProject) return null;
  return <OverviewTab activeProject={activeProject} refreshProjectData={refreshActiveProject} />;
}
