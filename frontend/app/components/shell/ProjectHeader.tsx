"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lightbulb, Sparkles, Mic, Film, Pencil } from "lucide-react";
import { useProjectsListContext } from "../../context/ProjectsListContext";

const tabs = [
  { id: "brainstorming", label: "Brainstorming", icon: Lightbulb },
  { id: "images", label: "Images", icon: Sparkles },
  { id: "voice", label: "Voice", icon: Mic },
  { id: "assembly", label: "Assembly", icon: Film },
];

export default function ProjectHeader({ projectId, title }: { projectId: string; title: string }) {
  const pathname = usePathname();
  const { updateProject } = useProjectsListContext();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditTitle(title);
  }, [title]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    setIsEditing(false);
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== title) {
      const pid = parseInt(projectId, 10);
      if (!Number.isNaN(pid)) {
        await updateProject(pid, { title: trimmed });
      }
    } else {
      setEditTitle(title);
    }
  };

  return (
    <header className="h-14 min-h-[56px] border-b border-border bg-card px-6 flex items-center justify-between z-10 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-panel-text text-[13px] font-medium tracking-tight">Projects</span>
        <span className="text-panel-text/40 text-xs">/</span>
        {isEditing ? (
          <input
            ref={inputRef}
            className="text-[13.5px] font-semibold tracking-tight text-foreground bg-background border border-primary/50 rounded px-1.5 py-0.5 outline-none max-w-[240px]"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                setEditTitle(title);
                setIsEditing(false);
              }
            }}
          />
        ) : (
          <div className="flex items-center gap-1.5 group/header-title min-w-0">
            <h1
              className="text-[13.5px] font-semibold tracking-tight text-foreground truncate max-w-[240px] cursor-pointer hover:underline decoration-zinc-400 dark:decoration-zinc-600 underline-offset-4"
              onClick={() => setIsEditing(true)}
              title="Click to rename project"
            >
              {title}
            </h1>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="opacity-0 group-hover/header-title:opacity-100 p-1 text-panel-text hover:text-foreground transition-opacity rounded cursor-pointer"
              title="Rename project"
            >
              <Pencil size={12} />
            </button>
          </div>
        )}
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
