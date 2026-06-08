"use client";

import React, { useState, useEffect } from "react";
import { Project } from "../context/ProjectContext";
import { Search, Compass, Palette, FileText, Mic, Code, Wand2, Play } from "lucide-react";

interface OverviewTabProps {
  activeProject: Project;
  refreshProjectData: () => Promise<void>;
}

export default function OverviewTab({ activeProject, refreshProjectData }: OverviewTabProps) {
  // Local input tracking state
  const [formData, setFormData] = useState({
    research: activeProject.research || "",
    video_concept: activeProject.video_concept || "",
    image_style: activeProject.image_style || "",
    script: activeProject.script || "",
    voice_style: activeProject.voice_style || "",
    scenes_json: activeProject.scenes ? JSON.stringify(activeProject.scenes, null, 2) : "[]",
  });

  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Copy active project configuration fields immediately on mount or when activeProject changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      // Build payload; attempt to parse scenes_json if valid
      let scenesPayload = activeProject.scenes;
      try {
        scenesPayload = JSON.parse(formData.scenes_json);
      } catch {
        // If invalid JSON, we just send the existing scenes or ignore it.
        // It's a raw code editor block, so we silently handle parse errors on auto-save
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
      } else {
        console.error("Failed to auto-save project.");
      }
    } catch (error) {
      console.error("Error auto-saving project:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleParseScript = async () => {
    setIsParsing(true);
    try {
      const response = await fetch(`http://localhost:8000/api/projects/${activeProject.id}/parse`, {
        method: "POST",
      });

      if (response.ok) {
        await refreshProjectData();
      } else {
        console.error("Failed to parse script to scenes.");
      }
    } catch (error) {
      console.error("Error parsing script:", error);
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Control Header Panel */}
      <div className="bg-card rounded-lg border border-border p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold mb-1 text-card-foreground">Project Generation Status</h2>
          <p className="text-foreground/60 text-sm flex items-center gap-2">
            Status: <span className="font-semibold text-primary">{activeProject.status || "Draft"}</span>
            {isSaving && <span className="text-xs ml-2 opacity-70 italic">(Saving...)</span>}
          </p>
        </div>
        <button
          onClick={handleParseScript}
          disabled={isParsing}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary-hover rounded-md transition-colors font-medium shadow-sm disabled:opacity-50"
        >
          {isParsing ? <Wand2 size={18} className="animate-spin" /> : <Play size={18} />}
          {isParsing ? "Parsing..." : "AI Parse Script to Scenes"}
        </button>
      </div>

      {/* Split-screen 2-column grid layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* --- COLUMN 1 (Visual & Conceptual Direction) --- */}
        <div className="flex flex-col gap-6">
          <div className="bg-card rounded-lg border border-border p-5">
            <label className="flex items-center gap-2 text-sm font-semibold mb-3 text-card-foreground">
              <Search size={16} className="text-primary" /> Research & Raw Material
            </label>
            <textarea
              name="research"
              value={formData.research}
              onChange={handleChange}
              onBlur={handleBlur}
              className="w-full h-32 p-3 bg-background text-foreground border border-border bg-opacity-50 font-sans focus:border-primary focus:ring-1 focus:ring-primary outline-none rounded-md resize-y"
              placeholder="Enter crawled reference notes..."
            />
          </div>

          <div className="bg-card rounded-lg border border-border p-5">
            <label className="flex items-center gap-2 text-sm font-semibold mb-3 text-card-foreground">
              <Compass size={16} className="text-primary" /> Video Concept & Directorial Vision
            </label>
            <textarea
              name="video_concept"
              value={formData.video_concept}
              onChange={handleChange}
              onBlur={handleBlur}
              className="w-full h-32 p-3 bg-background text-foreground border border-border bg-opacity-50 font-sans focus:border-primary focus:ring-1 focus:ring-primary outline-none rounded-md resize-y"
              placeholder="Enter cinematic aesthetic direction..."
            />
          </div>

          <div className="bg-card rounded-lg border border-border p-5">
            <label className="flex items-center gap-2 text-sm font-semibold mb-3 text-card-foreground">
              <Palette size={16} className="text-primary" /> Global Illustration Style Guidelines
            </label>
            <textarea
              name="image_style"
              value={formData.image_style}
              onChange={handleChange}
              onBlur={handleBlur}
              className="w-full h-32 p-3 bg-background text-foreground border border-border bg-opacity-50 font-sans focus:border-primary focus:ring-1 focus:ring-primary outline-none rounded-md resize-y"
              placeholder="Sync the shared prompt style configuration..."
            />
          </div>
        </div>

        {/* --- COLUMN 2 (Narrative & Execution Output) --- */}
        <div className="flex flex-col gap-6">
          <div className="bg-card rounded-lg border border-border p-5">
            <label className="flex items-center gap-2 text-sm font-semibold mb-3 text-card-foreground">
              <FileText size={16} className="text-primary" /> Voiceover Narrative Script (Khmer)
            </label>
            <textarea
              name="script"
              value={formData.script}
              onChange={handleChange}
              onBlur={handleBlur}
              className="w-full h-32 p-3 bg-background text-foreground border border-border bg-opacity-50 font-sans focus:border-primary focus:ring-1 focus:ring-primary outline-none rounded-md resize-y"
              placeholder="Enter the full written script stream..."
            />
          </div>

          <div className="bg-card rounded-lg border border-border p-5">
            <label className="flex items-center gap-2 text-sm font-semibold mb-3 text-card-foreground">
              <Mic size={16} className="text-primary" /> Vocal Delivery Style Parameters
            </label>
            <textarea
              name="voice_style"
              value={formData.voice_style}
              onChange={handleChange}
              onBlur={handleBlur}
              className="w-full h-32 p-3 bg-background text-foreground border border-border bg-opacity-50 font-sans focus:border-primary focus:ring-1 focus:ring-primary outline-none rounded-md resize-y"
              placeholder="Sync acoustic instructions..."
            />
          </div>

          <div className="bg-card rounded-lg border border-border p-5">
            <label className="flex items-center gap-2 text-sm font-semibold mb-3 text-card-foreground">
              <Code size={16} className="text-primary" /> Structured Script and Scene (JSON Generation Block)
            </label>
            <textarea
              name="scenes_json"
              value={formData.scenes_json}
              onChange={handleChange}
              onBlur={handleBlur}
              className="w-full h-72 p-3 border border-border outline-none rounded-md resize-y font-mono text-sm bg-neutral-950 dark:bg-black text-neutral-200 focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="[ { ... } ]"
              spellCheck={false}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
