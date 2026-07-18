 
"use client";

import React from "react";
import OutputTab from "../../../components/tabs/OutputTab";
import { useProjectContext } from "../../../context/ProjectContext";

export default function OutputPage() {
  const { activeProject } = useProjectContext();
  if (!activeProject) return null;
  return <OutputTab activeProject={activeProject} />;
}
