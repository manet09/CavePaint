"use client";

import React from "react";
import AssemblyTab from "../../../components/tabs/AssemblyTab";
import { useProjectContext } from "../../../context/ProjectContext";

export default function AssemblyPage() {
  const { activeProject, refreshActiveProject } = useProjectContext();
  if (!activeProject) return null;
  return <AssemblyTab activeProject={activeProject} refreshProjectData={refreshActiveProject} />;
}
