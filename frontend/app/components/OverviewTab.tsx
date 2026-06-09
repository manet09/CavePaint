"use client";

import React, { useState, useEffect } from "react";
import { Project } from "../context/ProjectContext";
import { Search, Compass, Palette, FileText, Mic, Code, Wand2 } from "lucide-react";

interface OverviewTabProps {
  activeProject: Project;
  refreshProjectData: () => Promise<void>;
}

export default function OverviewTab({ activeProject, refreshProjectData }: OverviewTabProps) {
  const [formData, setFormData] = useState({
    research: activeProject.research || "",
    video_concept: activeProject.video_concept || "",
    image_style: activeProject.image_style || "",
    script: activeProject.script || "",
    voice_style: activeProject.voice_style || "",
    scenes_json: activeProject.scenes ? JSON.stringify(activeProject.scenes, null, 2) : "[]",
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData({
      research: activeProject.research || "",
      video_concept: activeProject.video_concept || "",
      image_style: activeProject.image_style || "",
      script: activeProject.script || "",
      voice_style: activeProject.voice_style || "",
      scenes_json: activeProject.scenes ? JSON.stringify(activeProject.scenes, null, 2) : "[]",
    });
  }, [activeProject]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleBlur = async () => {
    setIsSaving(true);
    try {
      let scenesPayload = activeProject.scenes;
      try {
        scenesPayload = JSON.parse(formData.scenes_json);
      } catch {
        // Silent catch for partial auto-saves
      }

      const payload = {
        research: formData.research,
        video_concept: formData.video_concept,
        image_style: formData.image_style,
        script: formData.script,
        voice_style: formData.voice_style,
        scenes: scenesPayload,
      };

      const response = await fetch(`http://localhost:8000/api/projects/${activeProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await refreshProjectData();
      }
    } catch (error) {
      console.error("Error auto-saving project:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Clean CSS assignments using the global styles class
  const baseInputStyle = "flex-1 w-full bg-transparent text-foreground text-xs font-sans outline-none resize-none leading-relaxed placeholder:text-muted-foreground/40 sleek-scroll";
  const jsonInputStyle = "flex-1 w-full p-4 border-t border-border/60 outline-none rounded-b-xl font-mono text-xs bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:border-primary focus:ring-1 focus:ring-primary resize-none transition-colors sleek-scroll";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch w-full h-[calc(100vh-160px)] pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* COLUMN 1 (Left Flank - Research) */}
      <div className="lg:col-span-1 h-full">
        <div className="bg-card rounded-xl border border-border flex flex-col h-full shadow-sm overflow-hidden">
          <div className="bg-zinc-50/70 dark:bg-zinc-900/40 border-b border-border/60 px-5 py-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-card-foreground/80 tracking-wide uppercase">
              <Search size={14} className="text-primary" /> Research & Raw Material
            </label>
          </div>
          <div className="flex-1 p-5 flex flex-col h-full">
            <textarea
              name="research"
              value={formData.research}
              onChange={handleChange}
              onBlur={handleBlur}
              className={baseInputStyle}
              placeholder="Enter crawled reference notes..."
            />
          </div>
        </div>
      </div>

      {/* COLUMN 2 & 3 (Middle Core - Configuration Quad) */}
      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 h-full items-stretch">
        
        {/* Top Left: Video Concept */}
        <div className="bg-card rounded-xl border border-border flex flex-col h-full shadow-sm overflow-hidden">
          <div className="flex items-center justify-between w-full bg-zinc-50/70 dark:bg-zinc-900/40 border-b border-border/60 px-5 py-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-card-foreground/80 tracking-wide uppercase">
              <Compass size={14} className="text-primary" /> Video Concept
            </label>
            <button className="p-1 text-zinc-400 hover:text-primary hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded transition-colors cursor-pointer">
              <Wand2 size={14} />
            </button>
          </div>
          <div className="flex-1 p-5 flex flex-col h-full">
            <textarea
              name="video_concept"
              value={formData.video_concept}
              onChange={handleChange}
              onBlur={handleBlur}
              className={baseInputStyle}
              placeholder="Enter cinematic aesthetic direction..."
            />
          </div>
        </div>

        {/* Top Right: Script */}
        <div className="bg-card rounded-xl border border-border flex flex-col h-full shadow-sm overflow-hidden">
          <div className="flex items-center justify-between w-full bg-zinc-50/70 dark:bg-zinc-900/40 border-b border-border/60 px-5 py-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-card-foreground/80 tracking-wide uppercase">
              <FileText size={14} className="text-primary" /> Narrative Script (Khmer)
            </label>
            <button className="p-1 text-zinc-400 hover:text-primary hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded transition-colors cursor-pointer">
              <Wand2 size={14} />
            </button>
          </div>
          <div className="flex-1 p-5 flex flex-col h-full">
            <textarea
              name="script"
              value={formData.script}
              onChange={handleChange}
              onBlur={handleBlur}
              className={baseInputStyle}
              placeholder="Enter the full written script stream..."
            />
          </div>
        </div>

        {/* Bottom Left: Image Style */}
        <div className="bg-card rounded-xl border border-border flex flex-col h-full shadow-sm overflow-hidden">
          <div className="flex items-center justify-between w-full bg-zinc-50/70 dark:bg-zinc-900/40 border-b border-border/60 px-5 py-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-card-foreground/80 tracking-wide uppercase">
              <Palette size={14} className="text-primary" /> Illustration Style
            </label>
            <button className="p-1 text-zinc-400 hover:text-primary hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded transition-colors cursor-pointer">
              <Wand2 size={14} />
            </button>
          </div>
          <div className="flex-1 p-5 flex flex-col h-full">
            <textarea
              name="image_style"
              value={formData.image_style}
              onChange={handleChange}
              onBlur={handleBlur}
              className={baseInputStyle}
              placeholder="Sync the shared prompt style configuration..."
            />
          </div>
        </div>

        {/* Bottom Right: Voice Style */}
        <div className="bg-card rounded-xl border border-border flex flex-col h-full shadow-sm overflow-hidden">
          <div className="flex items-center justify-between w-full bg-zinc-50/70 dark:bg-zinc-900/40 border-b border-border/60 px-5 py-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-card-foreground/80 tracking-wide uppercase">
              <Mic size={14} className="text-primary" /> Vocal Parameters
            </label>
            <button className="p-1 text-zinc-400 hover:text-primary hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded transition-colors cursor-pointer">
              <Wand2 size={14} />
            </button>
          </div>
          <div className="flex-1 p-5 flex flex-col h-full">
            <textarea
              name="voice_style"
              value={formData.voice_style}
              onChange={handleChange}
              onBlur={handleBlur}
              className={baseInputStyle}
              placeholder="Sync acoustic instructions..."
            />
          </div>
        </div>

      </div>

      {/* COLUMN 4 (Right Flank - JSON Output Panel) */}
      <div className="lg:col-span-1 h-full">
        <div className="bg-card rounded-xl border border-border flex flex-col h-full shadow-sm overflow-hidden">
          <div className="flex items-center justify-between w-full bg-zinc-50/70 dark:bg-zinc-900/40 px-5 py-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-card-foreground/80 tracking-wide uppercase">
              <Code size={14} className="text-primary" /> Structured Script & Scene (JSON)
            </label>
            <button className="p-1 text-zinc-400 hover:text-primary hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded transition-colors cursor-pointer">
              <Wand2 size={14} />
            </button>
          </div>
          <textarea
            name="scenes_json"
            value={formData.scenes_json}
            onChange={handleChange}
            onBlur={handleBlur}
            className={jsonInputStyle}
            placeholder="[ { ... } ]"
            spellCheck={false}
          />
        </div>
      </div>

    </div>
  );
}