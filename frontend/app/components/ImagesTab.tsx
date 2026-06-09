"use client";

import React, { useState, useEffect } from "react";
import { Project } from "../context/ProjectContext";
import { CornerDownLeft, Image as ImageIcon, SlidersHorizontal, Wand2, Trash2, Loader2 } from "lucide-react";

interface ImagesTabProps {
  activeProject: Project;
  refreshProjectData: () => Promise<void>;
}

// Ensure SceneData interface matches the shape used throughout the app
interface SceneData {
  id: number;
  scene_number: number;
  narration_khmer?: string;
  image_prompt_english?: string;
  user_refinement_prompt?: string;
  audio_path?: string;
  image_path?: string;
  audio_status?: string;
  image_status?: string;
  negative_prompt?: string;
  [key: string]: unknown;
}

export default function ImagesTab({ activeProject, refreshProjectData }: ImagesTabProps) {
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [refinementInput, setRefinementInput] = useState("");
  
  const [aspectRatioValue, setAspectRatioValue] = useState("3");
  const [guidanceScale, setGuidanceScale] = useState(7.5);
  const [inferenceSteps, setInferenceSteps] = useState(30);
  const [isGenerating, setIsGenerating] = useState(false);
  const [cacheBuster, setCacheBuster] = useState(Date.now());
  
  const scenes = (activeProject?.scenes || []) as unknown as SceneData[];
  const activeScene = scenes[activeSceneIndex] || null;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeScene && (activeScene.image_status === "pending" || activeScene.image_status === "rendering")) {
      setIsGenerating(true);
      interval = setInterval(() => {
        refreshProjectData();
      }, 3000);
    } else {
      if (isGenerating) {
        setCacheBuster(Date.now());
      }
      setIsGenerating(false);
    }
    return () => clearInterval(interval);
  }, [activeScene, refreshProjectData, isGenerating]);

  const handleRefineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeScene || !refinementInput.trim()) return;

    try {
      const response = await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_instruction: refinementInput }),
      });
      if (response.ok) {
        setRefinementInput("");
        await refreshProjectData();
      }
    } catch (error) {
      console.error("Error refining prompt:", error);
    }
  };

  const getAspectRatioLabel = (val: string) => {
    const map: Record<string, string> = { "1": "1:1", "2": "4:3", "3": "16:9", "4": "9:16", "5": "3:4" };
    return map[val] || "16:9";
  };

  const handleGenerate = async () => {
    if (!activeScene) return;
    setIsGenerating(true);

    const payload = {
      aspect_ratio: getAspectRatioLabel(aspectRatioValue),
      guidance_scale: guidanceScale,
      inference_steps: inferenceSteps
    };

    try {
      const response = await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        await refreshProjectData();
      } else {
        setIsGenerating(false);
      }
    } catch (error) {
      console.error("Error triggering generation:", error);
      setIsGenerating(false);
    }
  };

  const handleTrash = async () => {
    if (!activeScene) return;
    try {
      const response = await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/image`, {
        method: "DELETE",
      });
      if (response.ok) {
        await refreshProjectData();
      }
    } catch (error) {
      console.error("Error deleting image:", error);
    }
  };

  return (
    <div className="h-[calc(100vh-160px)] pb-12 overflow-hidden animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch w-full h-full">
        
        {/* Column 1: Left List Panel */}
        <div className="lg:col-span-1 h-full flex flex-col overflow-hidden">
          {/* Top Card (Image Style Box) */}
          <div className="bg-card rounded-xl border border-border flex flex-col h-40 overflow-hidden shrink-0">
            <div className="bg-zinc-50/70 dark:bg-zinc-900/40 px-4 py-2 border-b border-border/60 text-xs font-semibold tracking-wide uppercase text-card-foreground">
              Style Reference
            </div>
            <textarea
              readOnly
              value={activeProject?.image_style || ""}
              className="flex-1 w-full p-3 bg-transparent resize-none outline-none text-xs font-sans text-foreground/80 sleek-scroll"
              placeholder="No global style defined."
            />
          </div>

          {/* Bottom Card (Prompts Navigation Deck) */}
          <div className="flex-1 bg-card rounded-xl border border-border flex flex-col overflow-hidden mt-4">
            <div className="bg-zinc-50/70 dark:bg-zinc-900/40 px-4 py-2 border-b border-border/60 text-xs font-semibold tracking-wide uppercase text-card-foreground">
              Parsed Scenes & Prompts
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 sleek-scroll">
              {scenes.length === 0 ? (
                <div className="text-xs text-foreground/50 p-2 text-center">No scenes available.</div>
              ) : (
                scenes.map((scene, idx) => (
                  <button
                    key={scene.id || idx}
                    onClick={() => setActiveSceneIndex(idx)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      activeSceneIndex === idx 
                        ? "bg-primary/5 border-primary shadow-sm" 
                        : "bg-background border-border/50 hover:border-primary/30"
                    }`}
                  >
                    <div className="text-xs font-bold mb-1">Scene #{String(scene.scene_number || idx + 1).padStart(2, '0')}</div>
                    <div className="text-xs text-foreground/60 line-clamp-2 leading-relaxed">
                      {scene.image_prompt_english || "No prompt available"}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Column 2: Center Workspace Editor */}
        <div className="lg:col-span-2 h-full flex flex-col overflow-hidden">
          <form 
            onSubmit={handleRefineSubmit}
            className="bg-card rounded-xl border border-border flex flex-col h-full overflow-hidden relative"
          >
            {activeScene ? (
              <>
                {/* Block A - Narrative Fragment */}
                <div className="border-b border-border p-4 bg-background/50">
                  <label className="text-xs font-semibold tracking-wide uppercase text-foreground/50 mb-2 block">
                    Scene Script Segment
                  </label>
                  <div className="text-sm text-foreground/80 leading-relaxed font-serif">
                    {activeScene.narration_khmer || "No script segment attached to this scene."}
                  </div>
                </div>

                {/* Block B - Current Positive Prompt */}
                <div className="flex-1 flex flex-col p-4 border-b border-border min-h-0">
                  <label className="text-xs font-semibold tracking-wide uppercase text-foreground/50 mb-2 block">
                    Engine Prompt Configuration
                  </label>
                  <textarea
                    defaultValue={activeScene.image_prompt_english || ""}
                    className="flex-1 w-full bg-transparent resize-none outline-none text-xs font-sans text-foreground leading-relaxed sleek-scroll"
                    placeholder="Describe the image you want to generate..."
                  />
                </div>

                {/* Block C - Negative Prompt */}
                <div className="h-32 flex flex-col p-4 border-b border-border shrink-0">
                  <label className="text-xs font-semibold tracking-wide uppercase text-foreground/50 mb-2 block">
                    Acoustic / Negative Constraints
                  </label>
                  <textarea
                    defaultValue={activeScene.negative_prompt || ""}
                    className="flex-1 w-full bg-transparent resize-none outline-none text-xs font-sans text-foreground/70 sleek-scroll"
                    placeholder="Enter elements to exclude (e.g. text, watermark, bad anatomy)..."
                  />
                </div>

                {/* Block D - User Iteration Bar */}
                <div className="p-4 bg-background/30 shrink-0 border-t border-border">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={refinementInput}
                      onChange={(e) => setRefinementInput(e.target.value)}
                      placeholder="Refine prompt instructions..."
                      className="w-full pl-4 pr-12 py-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    />
                    <button 
                      type="submit"
                      className="absolute right-2 p-1.5 text-primary hover:bg-primary/10 rounded-md transition-colors"
                    >
                      <CornerDownLeft size={16} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-foreground/40 text-sm">
                Select a scene from the left panel to begin editing.
              </div>
            )}
          </form>
        </div>

        {/* Column 3: Right Operations Board */}
        <div className="lg:col-span-1 h-full flex flex-col overflow-hidden">
          {/* Top Card (Configuration Panel) */}
          <div className="bg-card rounded-xl border border-border p-4 shrink-0">
            <div className="flex items-center gap-2 mb-4">
              <SlidersHorizontal size={14} className="text-primary" />
              <h3 className="text-xs font-semibold tracking-wide uppercase text-card-foreground">
                Python Engine Parameters
              </h3>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-foreground/70">
                  <span>Aspect Ratio</span>
                  <span className="font-mono">{getAspectRatioLabel(aspectRatioValue)}</span>
                </div>
                <input type="range" min="1" max="5" value={aspectRatioValue} onChange={(e) => setAspectRatioValue(e.target.value)} className="w-full accent-primary h-1 bg-border rounded-lg appearance-none cursor-pointer" />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-foreground/70">
                  <span>Guidance Scale</span>
                  <span className="font-mono">{guidanceScale}</span>
                </div>
                <input type="range" min="1" max="20" step="0.1" value={guidanceScale} onChange={(e) => setGuidanceScale(parseFloat(e.target.value))} className="w-full accent-primary h-1 bg-border rounded-lg appearance-none cursor-pointer" />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-foreground/70">
                  <span>Inference Steps</span>
                  <span className="font-mono">{inferenceSteps}</span>
                </div>
                <input type="range" min="10" max="100" value={inferenceSteps} onChange={(e) => setInferenceSteps(parseInt(e.target.value, 10))} className="w-full accent-primary h-1 bg-border rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>
          </div>

          {/* Bottom Card (Canvas Output Display) */}
          <div className="flex-1 mt-4 bg-card rounded-xl border border-border flex flex-col overflow-hidden relative">
            <div className="bg-zinc-50/70 dark:bg-zinc-900/40 px-4 py-2 border-b border-border/60 text-xs font-semibold tracking-wide uppercase text-card-foreground absolute top-0 w-full z-10">
              Render Output Frame
            </div>
            
            <div className="flex-1 flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 overflow-hidden relative pt-8">
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center text-primary p-6">
                  <Loader2 size={32} className="mb-3 animate-spin opacity-80" />
                  <p className="text-xs uppercase tracking-widest font-medium">Synthesizing Visual...</p>
                </div>
              ) : activeScene?.image_path ? (
                <img 
                  src={`http://localhost:8000/static/${activeScene.image_path.split('/').pop()}?t=${cacheBuster}`} 
                  alt={`Scene ${activeScene.scene_number}`} 
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-foreground/30 text-center p-6">
                  <ImageIcon size={32} className="mb-3 opacity-20" />
                  <p className="text-xs uppercase tracking-widest font-medium">No Render Output</p>
                  <p className="text-[10px] mt-1 max-w-[150px] leading-relaxed">Run engine parameters to synthesize visual.</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex gap-3 mt-4 shrink-0">
            <button 
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !activeScene}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 py-3 rounded-xl text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
              {isGenerating ? "Generating..." : "Generate"}
            </button>
            <button 
              type="button"
              onClick={handleTrash}
              disabled={isGenerating || !activeScene || !activeScene.image_path}
              className="bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-500/10 dark:hover:bg-red-500/20 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center disabled:opacity-50"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
