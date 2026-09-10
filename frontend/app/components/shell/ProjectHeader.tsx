 
"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lightbulb, Sparkles, Mic, Film } from "lucide-react";

const tabs = [
  { id: "brainstorming", label: "Brainstorming", icon: Lightbulb },
  { id: "images", label: "Images", icon: Sparkles },
  { id: "voice", label: "Voice", icon: Mic },
  { id: "output", label: "Output", icon: Film },
];

export default function ProjectHeader({ projectId, title }: { projectId: string; title: string }) {
  const pathname = usePathname();

  return (
    <header className="h-14 min-h-[56px] border-b border-zinc-200/60 dark:border-zinc-800/40 bg-card/80 backdrop-blur-md px-6 flex items-center justify-between z-10 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-panel-text text-[13px] font-medium tracking-tight">Projects</span>
        <span className="text-panel-text opacity-50 text-sm">/</span>
        <h1 className="text-[14px] font-semibold tracking-tight text-panel-icon truncate max-w-[200px]">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-1 h-full">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const href = `/projects/${projectId}/${tab.id}`;
          const isActive = pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <Link
              key={tab.id}
              href={href}
              className={`flex items-center gap-2 px-3 h-14 relative text-[13px] font-medium tracking-tight transition-all ${
                isActive
                  ? "text-panel-icon"
                  : "text-panel-text hover:text-panel-icon"
              }`}
            >
              <Icon size={14} className={isActive ? "opacity-100" : "opacity-60"} />
              <span>{tab.label}</span>
              {isActive && (
                <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-panel-icon rounded-t-full" />
              )}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
