 
"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import WelcomeScreen from "./components/shell/WelcomeScreen";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedId = localStorage.getItem("activeProjectId");
    if (savedId) {
      const parsed = parseInt(savedId, 10);
      if (!Number.isNaN(parsed)) {
        router.replace(`/projects/${parsed}/overview`);
      }
    }
  }, [router]);

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-zinc-50/50 dark:bg-background">
      <WelcomeScreen />
    </main>
  );
}
