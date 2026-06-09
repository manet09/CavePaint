"use client";

import React, { useState, useEffect } from "react";
import { useProjectContext } from "../context/ProjectContext";
import { Search, Compass, Palette, FileText, Mic, Code, Wand2, Loader2, Check } from "lucide-react";

interface OverviewTabProps {
  activeProject?: any;
  refreshProjectData?: any;
}

export default function OverviewTab(props: OverviewTabProps) {
  const { activeProject, updateActiveProject } = useProjectContext();

  const [formData, setFormData] = useState({
    raw_research: "",
    video_concept: "",
    illustration_style: "",
    script_narrative: "",
    global_voice_style: "",
    structured_json_data: "",
  });

  const [savingState, setSavingState] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});

  // Helper to strip internal DB/queue tracking fields from scenes
  const getCleanJson = (project: any) => {
    if (project.structured_json_data) {
      // If there's already a saved string/object, try to parse/clean it if it's an array
      try {
        const parsed = typeof project.structured_json_data === "string" 
          ? JSON.parse(project.structured_json_data) 
          : project.structured_json_data;
          
        if (Array.isArray(parsed)) {
          return JSON.stringify(
            parsed.map((scene: any) => ({
              scene_number: scene.scene_number,
              narration_khmer: scene.narration_khmer,
              image_prompt_english: scene.image_prompt_english,
              negative_prompt: scene.negative_prompt,
            })),
            null,
            2
          );
        }
        return typeof project.structured_json_data === "string" 
          ? project.structured_json_data 
          : JSON.stringify(project.structured_json_data, null, 2);
      } catch (e) {
        return project.structured_json_data;
      }
    } else if (project.scenes && Array.isArray(project.scenes)) {
      // Fallback to cleaning the database scenes array
      return JSON.stringify(
        project.scenes.map((scene: any) => ({
          scene_number: scene.scene_number,
          narration_khmer: scene.narration_khmer,
          image_prompt_english: scene.image_prompt_english,
          negative_prompt: scene.negative_prompt,
        })),
        null,
        2
      );
    }
    return "[]";
  };

  useEffect(() => {
    if (activeProject) {
      setFormData({
        raw_research: activeProject.raw_research || "",
        video_concept: activeProject.video_concept || "",
        illustration_style: activeProject.illustration_style || "",
        script_narrative: activeProject.script_narrative || "",
        global_voice_style: activeProject.global_voice_style || "",
        structured_json_data: getCleanJson(activeProject),
      });
    }
  }, [activeProject]);

  if (!activeProject) return null;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setSavingState((prev) => ({ ...prev, [name]: "idle" }));
  };

  const handleBlur = async (e: React.FocusEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // If JSON field, validate first
    if (name === "structured_json_data" && value.trim() !== "") {
      try {
        JSON.parse(value);
      } catch (err) {
        setSavingState((prev) => ({ ...prev, [name]: "error" }));
        return; // Halt save if invalid JSON
      }
    }

    setSavingState((prev) => ({ ...prev, [name]: "saving" }));
    
    try {
      await updateActiveProject({ [name]: value });
      setSavingState((prev) => ({ ...prev, [name]: "saved" }));
      setTimeout(() => {
        setSavingState((prev) => ({ ...prev, [name]: "idle" }));
      }, 2000);
    } catch (err) {
      setSavingState((prev) => ({ ...prev, [name]: "error" }));
    }
  };

  const renderStatus = (name: string) => {
    const status = savingState[name];
    if (status === "saving") return <span className="text-[10px] text-primary flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Saving...</span>;
    if (status === "saved") return <span className="text-[10px] text-green-500 flex items-center gap-1"><Check size={10} /> Saved</span>;
    if (status === "error") return <span className="text-[10px] text-red-500 font-medium">Invalid JSON</span>;
    return null;
  };

  // Clean CSS assignments using the global styles class
  const baseInputStyle = "flex-1 w-full bg-transparent text-foreground text-xs font-sans outline-none resize-none leading-relaxed placeholder:text-muted-foreground/40 sleek-scroll";
  const jsonInputStyle = "flex-1 w-full p-4 border-t border-border/60 outline-none rounded-b-xl font-mono text-xs bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:border-primary focus:ring-1 focus:ring-primary resize-none transition-colors sleek-scroll";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch w-full h-[calc(100vh-160px)] pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* COLUMN 1 (Left Flank - Research) */}
      <div className="lg:col-span-1 h-full">
        <div className="bg-card rounded-xl border border-border flex flex-col h-full shadow-sm overflow-hidden">
          <div className="bg-zinc-50/70 dark:bg-zinc-900/40 border-b border-border/60 px-5 py-3 flex justify-between items-center">
            <label className="flex items-center gap-2 text-xs font-semibold text-card-foreground/80 tracking-wide uppercase">
              <Search size={14} className="text-primary" /> Research & Raw Material
            </label>
            {renderStatus("raw_research")}
          </div>
          <div className="flex-1 p-5 flex flex-col h-full">
            <textarea
              name="raw_research"
              value={formData.raw_research}
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
            <div className="flex items-center gap-2">
              {renderStatus("video_concept")}
              <button className="p-1 text-zinc-400 hover:text-primary hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded transition-colors cursor-pointer">
                <Wand2 size={14} />
              </button>
            </div>
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
            <div className="flex items-center gap-2">
              {renderStatus("script_narrative")}
              <button className="p-1 text-zinc-400 hover:text-primary hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded transition-colors cursor-pointer">
                <Wand2 size={14} />
              </button>
            </div>
          </div>
          <div className="flex-1 p-5 flex flex-col h-full">
            <textarea
              name="script_narrative"
              value={formData.script_narrative}
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
            <div className="flex items-center gap-2">
              {renderStatus("illustration_style")}
              <button className="p-1 text-zinc-400 hover:text-primary hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded transition-colors cursor-pointer">
                <Wand2 size={14} />
              </button>
            </div>
          </div>
          <div className="flex-1 p-5 flex flex-col h-full">
            <textarea
              name="illustration_style"
              value={formData.illustration_style}
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
            <div className="flex items-center gap-2">
              {renderStatus("global_voice_style")}
              <button className="p-1 text-zinc-400 hover:text-primary hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded transition-colors cursor-pointer">
                <Wand2 size={14} />
              </button>
            </div>
          </div>
          <div className="flex-1 p-5 flex flex-col h-full">
            <textarea
              name="global_voice_style"
              value={formData.global_voice_style}
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
            <div className="flex items-center gap-2">
              {renderStatus("structured_json_data")}
              <button className="p-1 text-zinc-400 hover:text-primary hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded transition-colors cursor-pointer">
                <Wand2 size={14} />
              </button>
            </div>
          </div>
          <textarea
            name="structured_json_data"
            value={formData.structured_json_data}
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