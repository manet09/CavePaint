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
    <header className="h-14 min-h-[56px] border-b border-border bg-card px-6 flex items-center justify-between z-10 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-panel-text text-[13px] font-medium tracking-tight">Projects</span>
        <span className="text-panel-text/40 text-xs">/</span>
        <h1 className="text-[13.5px] font-semibold tracking-tight text-foreground truncate max-w-[240px]">
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
              className={`flex items-center gap-2 px-3.5 h-14 relative text-[13px] font-medium tracking-tight transition-colors ${
                isActive
                  ? "text-foreground"
                  : "text-panel-text hover:text-foreground"
              }`}
            >
              <Icon size={14} strokeWidth={isActive ? 2 : 1.75} className={isActive ? "opacity-100" : "opacity-60"} />
              <span>{tab.label}</span>
              {isActive && (
                <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-foreground rounded-t-full" />
              )}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
