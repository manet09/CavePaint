"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProjectContext } from "../../../context/ProjectContext";

export default function OutputRedirectPage() {
  const router = useRouter();
  const { activeProject } = useProjectContext();

  useEffect(() => {
    if (activeProject?.id) {
      router.replace(`/projects/${activeProject.id}/assembly`);
    }
  }, [activeProject?.id, router]);

  return null;
}
