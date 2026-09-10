"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function LegacyOverviewRedirect() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id;

  useEffect(() => {
    if (id) {
      router.replace(`/projects/${id}/brainstorming`);
    }
  }, [id, router]);

  return null;
}
