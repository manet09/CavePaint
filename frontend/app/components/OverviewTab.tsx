/* eslint-disable */
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
    
    if (name === "structured_json_data" && value.trim() !== "") {
      try {
        JSON.parse(value);
      } catch (err) {
        setSavingState((prev) => ({ ...prev, [name]: "error" }));
        return;
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
    if (status === "saving") return <span className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> Saving</span>;
    if (status === "saved") return <span className="text-[10px] text-emerald-500 flex items-center gap-1.5"><Check size={11} /> Saved</span>;
    if (status === "error") return <span className="text-[10px] text-red-500 font-medium">Invalid JSON</span>;
    return null;
  };

  const baseInputStyle = "w-full h-full p-4 bg-transparent text-foreground text-[13px] font-normal outline-none resize-none leading-relaxed placeholder:text-zinc-400/30 custom-scrollbar";
  const jsonInputStyle = "w-full h-full p-4 bg-zinc-50/20 dark:bg-zinc-950/20 text-foreground font-mono text-[12px] outline-none resize-none leading-relaxed placeholder:text-zinc-400/30 custom-scrollbar";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 w-full h-[calc(100vh-56px-48px)] pb-4 animate-in fade-in slide-in-from-bottom-2 duration-300 items-stretch overflow-hidden select-none">
      
      {/* COLUMN 1: Research & Assets Flank */}
      <div className="lg:col-span-1 h-full flex flex-col">
        <div className="bg-card rounded-xl border border-border flex flex-col h-full shadow-2xs overflow-hidden">
          <div className="h-10 shrink-0 bg-zinc-50/30 dark:bg-zinc-900/10 border-b border-border px-4 flex justify-between items-center">
            <label className="flex items-center gap-2 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 tracking-wider uppercase">
              <Search size={13} className="opacity-80" /> Research & Raw Material
            </label>
            {renderStatus("raw_research")}
          </div>
          <div className="flex-1 min-h-0 bg-transparent">
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

      {/* COLUMN 2 & 3: Production Parameter Quad */}
      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 h-full items-stretch">
        
        {/* Top Left: Concept Canvas */}
        <div className="bg-card rounded-xl border border-border flex flex-col h-full shadow-2xs overflow-hidden">
          <div className="h-10 shrink-0 bg-zinc-50/30 dark:bg-zinc-900/10 border-b border-border px-4 flex justify-between items-center">
            <label className="flex items-center gap-2 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 tracking-wider uppercase">
              <Compass size={13} className="opacity-80" /> Video Concept
            </label>
            <div className="flex items-center gap-3">
              {renderStatus("video_concept")}
              <button className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer">
                <Wand2 size={13} />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 bg-transparent">
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

        {/* Top Right: Script Narrative */}
        <div className="bg-card rounded-xl border border-border flex flex-col h-full shadow-2xs overflow-hidden">
          <div className="h-10 shrink-0 bg-zinc-50/30 dark:bg-zinc-900/10 border-b border-border px-4 flex justify-between items-center">
            <label className="flex items-center gap-2 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 tracking-wider uppercase">
              <FileText size={13} className="opacity-80" /> Narrative Script (Khmer)
            </label>
            <div className="flex items-center gap-3">
              {renderStatus("script_narrative")}
              <button className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer">
                <Wand2 size={13} />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 bg-transparent">
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

        {/* Bottom Left: Style Direction */}
        <div className="bg-card rounded-xl border border-border flex flex-col h-full shadow-2xs overflow-hidden">
          <div className="h-10 shrink-0 bg-zinc-50/30 dark:bg-zinc-900/10 border-b border-border px-4 flex justify-between items-center">
            <label className="flex items-center gap-2 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 tracking-wider uppercase">
              <Palette size={13} className="opacity-80" /> Illustration Style
            </label>
            <div className="flex items-center gap-3">
              {renderStatus("illustration_style")}
              <button className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer">
                <Wand2 size={13} />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 bg-transparent">
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

        {/* Bottom Right: Vocal Tuning Matrix */}
        <div className="bg-card rounded-xl border border-border flex flex-col h-full shadow-2xs overflow-hidden">
          <div className="h-10 shrink-0 bg-zinc-50/30 dark:bg-zinc-900/10 border-b border-border px-4 flex justify-between items-center">
            <label className="flex items-center gap-2 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 tracking-wider uppercase">
              <Mic size={13} className="opacity-80" /> Vocal Parameters
            </label>
            <div className="flex items-center gap-3">
              {renderStatus("global_voice_style")}
              <button className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer">
                <Wand2 size={13} />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 bg-transparent">
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

      {/* COLUMN 4: Structured Data Timeline Codeboard */}
      <div className="lg:col-span-1 h-full flex flex-col">
        <div className="bg-card rounded-xl border border-border flex flex-col h-full shadow-2xs overflow-hidden">
          <div className="h-10 shrink-0 bg-zinc-50/30 dark:bg-zinc-900/10 border-b border-border px-4 flex justify-between items-center">
            <label className="flex items-center gap-2 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 tracking-wider uppercase">
              <Code size={13} className="opacity-80" /> Structured Scene (JSON)
            </label>
            <div className="flex items-center gap-3">
              {renderStatus("structured_json_data")}
              <button className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer">
                <Wand2 size={13} />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
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

    </div>
  );
}