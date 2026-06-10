/* eslint-disable */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useProjectContext, SceneData } from "../context/ProjectContext";
import { CornerDownLeft, Image as ImageIcon, SlidersHorizontal, Wand2, Trash2, Loader2, Check, Maximize2, X, CheckCircle2, Palette } from "lucide-react";

interface ImagesTabProps {
  activeProject?: any;
  refreshProjectData?: any;
}

export default function ImagesTab(props: ImagesTabProps) {
  const { activeProject, updateSingleScene, refreshProjects } = useProjectContext();
  
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [refinementInput, setRefinementInput] = useState("");
  const refinementRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (refinementRef.current) {
      refinementRef.current.style.height = "auto";
      refinementRef.current.style.height = `${Math.min(refinementRef.current.scrollHeight, 84)}px`;
    }
  }, [refinementInput]);
  
  const [aspectRatioValue, setAspectRatioValue] = useState("16:9");
  const [inferenceSteps, setInferenceSteps] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [cacheBuster, setCacheBuster] = useState(Date.now());
  
  const [localPositive, setLocalPositive] = useState("");
  const [localNegative, setLocalNegative] = useState("");
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("idle");
  const [isZoomed, setIsZoomed] = useState(false);

  const scenes = activeProject?.scenes || [];
  const activeScene = scenes[activeSceneIndex] || null;

  const [localIllustrationStyle, setLocalIllustrationStyle] = useState("");
  
  useEffect(() => {
    if (activeProject) {
      setLocalIllustrationStyle(activeProject.illustration_style || "");
    }
  }, [activeProject?.illustration_style]);

  useEffect(() => {
    if (activeScene) {
      setLocalPositive(activeScene.image_prompt_english || "");
      setLocalNegative(activeScene.negative_prompt || "");
    } else {
      setLocalPositive("");
      setLocalNegative("");
    }
  }, [activeScene]);

  const handleIllustrationStyleBlur = async () => {
    if (localIllustrationStyle === (activeProject?.illustration_style || "")) return;
    try {
      await fetch(`http://localhost:8000/api/projects/${activeProject?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ illustration_style: localIllustrationStyle }),
      });
      if (props.refreshProjectData) await props.refreshProjectData();
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeScene && activeScene.image_status === "processing") {
      setIsGenerating(true);
      interval = setInterval(() => {
        if (props.refreshProjectData) props.refreshProjectData();
      }, 1500);
    } else {
      if (isGenerating) {
        setCacheBuster(Date.now());
      }
      setIsGenerating(false);
    }
    return () => clearInterval(interval);
  }, [activeScene, refreshProjects, isGenerating]);

  const handleBlur = async () => {
    if (!activeScene) return;
    
    // Skip if unchanged
    if (localPositive === (activeScene.image_prompt_english || "") && 
        localNegative === (activeScene.negative_prompt || "")) {
      return;
    }
    
    setSavingState("saving");
    try {
      await updateSingleScene(activeScene.id, {
        image_prompt_english: localPositive,
        negative_prompt: localNegative,
      });
      setSavingState("saved");
      setTimeout(() => setSavingState("idle"), 2000);
    } catch (err) {
      console.error(err);
      setSavingState("idle");
    }
  };

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
        if (props.refreshProjectData) await props.refreshProjectData();
      }
    } catch (error) {
      console.error("Error refining prompt:", error);
    }
  };

  const handleGenerate = async () => {
    if (!activeScene) return;
    setIsGenerating(true);

    const payload = {
      aspect_ratio: aspectRatioValue,
      guidance_scale: 7.5,
      inference_steps: inferenceSteps
    };

    try {
      const response = await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        if (props.refreshProjectData) await props.refreshProjectData();
      } else {
        setIsGenerating(false);
      }
    } catch (error) {
      console.error("Error triggering generation:", error);
      setIsGenerating(false);
    }
  };

  const handleStop = async () => {
    if (!activeScene) return;
    try {
      const response = await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/stop`, {
        method: "POST",
      });
      if (response.ok) {
        if (props.refreshProjectData) await props.refreshProjectData();
      }
    } catch (error) {
      console.error("Error stopping generation:", error);
    }
  };

  const handleTrash = async () => {
    if (!activeScene) return;
    try {
      const response = await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/image`, {
        method: "DELETE",
      });
      if (response.ok) {
        if (props.refreshProjectData) await props.refreshProjectData();
      }
    } catch (error) {
      console.error("Error deleting image:", error);
    }
  };

  if (!activeProject) return null;

  return (
    <div className="h-[calc(100vh-160px)] pb-12 overflow-hidden animate-in fade-in duration-500 relative">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch w-full h-full">
        
        {/* Column 1: Left List Panel */}
        <div className="lg:col-span-3 h-full flex flex-col overflow-hidden">
          {/* Top Card (Image Style Box) */}
          <div className="bg-card rounded-xl border border-border flex flex-col h-40 overflow-hidden shrink-0">
            <div className="bg-zinc-50/70 dark:bg-zinc-900/40 px-4 py-2 border-b border-border/60 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-card-foreground">
              <Palette size={14} className="text-primary" /> Illustration Style
            </div>
            <textarea
              value={localIllustrationStyle}
              onChange={(e) => setLocalIllustrationStyle(e.target.value)}
              onBlur={handleIllustrationStyleBlur}
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
                    <div className="text-xs font-bold mb-1 flex items-center gap-2">
                      Scene #{String(scene.scene_number || idx + 1).padStart(3, '0')}
                      {scene.image_path && <CheckCircle2 size={14} className="text-emerald-500" />}
                    </div>
                    <div className="text-xs text-foreground/60 line-clamp-2 leading-relaxed">
                      {scene.image_prompt_english || "No prompt available"}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Ensure graceful fallback for Columns 2 and 3 if activeScene is not found */}
        {!activeScene ? (
          <div className="lg:col-span-3 h-full flex items-center justify-center bg-card rounded-xl border border-border shadow-sm text-foreground/50 text-sm">
            <div className="flex flex-col items-center">
              <ImageIcon size={32} className="mb-3 opacity-20" />
              <p>Project is empty. Add a scene to begin editing.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Column 2: Center Workspace Editor */}
            <div className="lg:col-span-4 h-full flex flex-col overflow-hidden">
              <form 
                onSubmit={handleRefineSubmit}
                className="bg-card rounded-xl border border-border flex flex-col h-full overflow-hidden relative"
              >
                {/* Block A - Narrative Fragment */}
                <div className="border-b border-border p-4 bg-background/50 flex justify-between items-start">
                  <div>
                    <label className="text-xs font-semibold tracking-wide uppercase text-foreground/50 mb-2 block">
                      Scene Script Segment
                    </label>
                    <div className="text-sm text-foreground/80 leading-relaxed font-serif">
                      {activeScene.narration_khmer || "No script segment attached to this scene."}
                    </div>
                  </div>
                  {savingState === "saving" && <span className="text-[10px] text-primary flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Saving...</span>}
                  {savingState === "saved" && <span className="text-[10px] text-green-500 flex items-center gap-1"><Check size={10} /> Saved</span>}
                </div>

                {/* Block B - Current Positive Prompt */}
                <div className="flex-1 flex flex-col p-4 border-b border-border min-h-0">
                  <label className="text-xs font-semibold tracking-wide uppercase text-foreground/50 mb-2 block">
                    Engine Prompt Configuration
                  </label>
                  <textarea
                    value={localPositive}
                    onChange={(e) => setLocalPositive(e.target.value)}
                    onBlur={handleBlur}
                    className="flex-1 w-full bg-transparent resize-none outline-none text-xs font-sans text-foreground leading-relaxed sleek-scroll"
                    placeholder="Describe the image you want to generate..."
                  />
                </div>

                {/* Block C - Negative Prompt */}
                <div className="h-45 flex flex-col p-4 border-b border-border shrink-0">
                  <label className="text-xs font-semibold tracking-wide uppercase text-foreground/50 mb-2 block">
                    Acoustic / Negative Constraints
                  </label>
                  <textarea
                    value={localNegative}
                    onChange={(e) => setLocalNegative(e.target.value)}
                    onBlur={handleBlur}
                    className="flex-1 w-full bg-transparent resize-none outline-none text-xs font-sans text-foreground/70 sleek-scroll"
                    placeholder="Enter elements to exclude (e.g. text, watermark, bad anatomy)..."
                  />
                </div>

                {/* Block D - User Iteration Bar */}
                <div className="p-4 bg-background/30 shrink-0 border-t border-border">
                  <div className="relative flex items-center">
                    <textarea
                      ref={refinementRef}
                      rows={1}
                      value={refinementInput}
                      onChange={(e) => setRefinementInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (refinementInput.trim()) {
                            handleRefineSubmit(e as any);
                          }
                        }
                      }}
                      placeholder="Refine prompt instructions..."
                      className="w-full pl-4 pr-12 py-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none sleek-scroll"
                    />
                    <button 
                      type="submit"
                      className="absolute right-2 p-1.5 text-primary hover:bg-primary/10 rounded-md transition-colors"
                    >
                      <CornerDownLeft size={16} />
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Column 3: Right Operations Board */}
            <div className="lg:col-span-5 h-full flex flex-col overflow-hidden">
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
                    <div className="flex justify-between text-xs text-foreground/70 mb-2">
                      <span>Aspect Ratio</span>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {["1:1", "4:3", "16:9", "9:16", "2:3"].map((ratio) => {
                        const getDimensions = (r: string) => {
                          switch (r) {
                            case "1:1": return { width: 14, height: 14 };
                            case "4:3": return { width: 16, height: 12 };
                            case "16:9": return { width: 18, height: 10 };
                            case "9:16": return { width: 10, height: 18 };
                            case "2:3": return { width: 12, height: 18 };
                            default: return { width: 14, height: 14 };
                          }
                        };
                        return (
                          <button
                            key={ratio}
                            type="button"
                            onClick={() => setAspectRatioValue(ratio)}
                            className={`py-2 flex flex-col items-center justify-center gap-1.5 text-[10px] font-mono rounded border transition-all ${
                              aspectRatioValue === ratio 
                                ? "bg-primary/5 border-primary text-primary" 
                                : "bg-background border-border/50 text-foreground/70 hover:border-primary/40 hover:text-foreground"
                            }`}
                          >
                            <div className={`border-2 rounded-sm ${aspectRatioValue === ratio ? 'border-primary' : 'border-current'}`} style={getDimensions(ratio)} />
                            <span>{ratio}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-foreground/70">
                      <span>Inference Steps</span>
                      <span className="font-mono">{inferenceSteps}</span>
                    </div>
                    <input type="range" min="5" max="30" value={inferenceSteps} onChange={(e) => setInferenceSteps(parseInt(e.target.value, 10))} className="w-full accent-primary h-1 bg-border rounded-lg appearance-none cursor-pointer" />
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
                      <p className="text-xs uppercase tracking-widest font-medium">Synthesizing frame via local Draw Things pipeline...</p>
                    </div>
                  ) : activeScene?.image_path ? (
                    <div className="w-full h-full relative group">
                      <img 
                        src={`http://localhost:8000/static/${activeProject.slug}/scene_${String(activeScene.scene_number).padStart(3, '0')}.png?t=${cacheBuster}`} 
                        alt={`Scene ${activeScene.scene_number}`} 
                        className="w-full h-full object-contain"
                      />
                      <button 
                        onClick={() => setIsZoomed(true)}
                        className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                      >
                        <Maximize2 size={18} />
                      </button>
                    </div>
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
                {activeScene.image_status === "processing" ? (
                  <button 
                    type="button"
                    onClick={handleStop}
                    className="flex-1 bg-red-600 text-white hover:bg-red-700 py-3 rounded-xl text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    <X size={16} />
                    Stop Rendering
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={handleGenerate}
                    disabled={isGenerating || !activeScene}
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 py-3 rounded-xl text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    {isGenerating ? "Generating..." : "Generate"}
                  </button>
                )}
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
          </>
        )}
      </div>

      {/* Lightbox Modal Overlay */}
      {isZoomed && activeScene?.image_path && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-8 animate-in fade-in duration-200"
          onClick={() => setIsZoomed(false)}
        >
          <button 
            className="absolute top-6 right-6 p-3 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            onClick={() => setIsZoomed(false)}
          >
            <X size={24} />
          </button>
          <img 
            src={`http://localhost:8000/static/${activeProject.slug}/scene_${String(activeScene.scene_number).padStart(3, '0')}.png?t=${cacheBuster}`} 
            alt={`Scene ${activeScene.scene_number} Zoomed`} 
            className="max-w-full max-h-full object-contain shadow-2xl rounded-sm"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
