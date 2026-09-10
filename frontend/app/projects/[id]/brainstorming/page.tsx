"use client";

import React from "react";
import BrainstormingTab from "../../../components/tabs/BrainstormingTab";
import { useProjectContext } from "../../../context/ProjectContext";

export default function BrainstormingPage() {
  const { activeProject, refreshActiveProject } = useProjectContext();
  if (!activeProject) return null;
  return <BrainstormingTab activeProject={activeProject} refreshProjectData={refreshActiveProject} />;
}
