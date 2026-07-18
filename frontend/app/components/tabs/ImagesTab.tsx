/* eslint-disable */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useProjectContext } from "../context/ProjectContext";
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
  const [isRefining, setIsRefining] = useState(false);
  const [refineAbortController, setRefineAbortController] = useState<AbortController | null>(null);
  const [activeProvider, setActiveProvider] = useState<string>("gemini");

  useEffect(() => {
    fetch("http://localhost:8000/api/settings")
      .then(res => res.json())
      .then(data => setActiveProvider(data.active_provider || "gemini"))
      .catch(console.error);
  }, []);

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

  const handleRefineSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeScene || !refinementInput.trim() || isRefining) return;

    setIsRefining(true);
    const controller = new AbortController();
    setRefineAbortController(controller);

    try {
      const response = await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_instruction: refinementInput }),
        signal: controller.signal,
      });
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          // Dynamically update form state textareas instantly
          setLocalPositive(data.image_prompt_english);
          setLocalNegative(data.negative_prompt_english);
        }
        setRefinementInput("");
        if (props.refreshProjectData) await props.refreshProjectData();
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Refinement aborted');
      } else {
        console.error("Error refining prompt:", error);
      }
    } finally {
      setIsRefining(false);
      setRefineAbortController(null);
    }
  };

  const handleStopRefine = () => {
    if (refineAbortController) {
      refineAbortController.abort();
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

  const textInputStyle = "w-full h-full p-4 bg-transparent text-zinc-800 dark:text-zinc-200 text-[13px] font-normal outline-none resize-none leading-relaxed placeholder:text-zinc-400/30 custom-scrollbar";

  return (
    <div className="h-[calc(100vh-56px-48px-24px)] pb-4 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300 relative select-none">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch w-full h-full">
        
        {/* Column 1: Left Navigation Deck */}
        <div className="lg:col-span-3 h-full flex flex-col gap-4 overflow-hidden">
          {/* Top Style Box */}
          <div className="bg-card rounded-xl border border-border flex flex-col h-60 overflow-hidden shrink-0 shadow-2xs">
            <div className="h-10 shrink-0 bg-panel-header border-b border-border px-4 flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase text-panel-text">
              <Palette size={13} className="text-panel-icon" /> Illustration Style
            </div>
            <textarea
              value={localIllustrationStyle}
              onChange={(e) => setLocalIllustrationStyle(e.target.value)}
              onBlur={handleIllustrationStyleBlur}
              className="flex-1 w-full p-4 bg-transparent resize-none outline-none text-[13px] text-zinc-800 dark:text-zinc-200 leading-relaxed placeholder:text-zinc-400/30 custom-scrollbar"
              placeholder="No global style defined."
            />
          </div>

          {/* Scenes Card Deck */}
          <div className="flex-1 min-h-0 bg-card rounded-xl border border-border flex flex-col overflow-hidden shadow-2xs">
            <div className="h-10 shrink-0 bg-panel-header border-b border-border px-4 flex items-center text-[11px] font-semibold tracking-wider uppercase text-panel-text">
              Parsed Scenes & Prompts
            </div>
            <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar">
              {scenes.length === 0 ? (
                <div className="text-xs text-zinc-400 dark:text-zinc-500 p-4 text-center italic">No scenes available.</div>
              ) : (
                scenes.map((scene, idx) => {
                  const isCurrent = activeSceneIndex === idx;
                  return (
                    <button
                      key={scene.id || idx}
                      onClick={() => setActiveSceneIndex(idx)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        isCurrent 
                          ? "bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 shadow-2xs" 
                          : "bg-transparent border-transparent hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30"
                      }`}
                    >
                      <div className="text-[12px] font-bold mb-1 flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                        Scene #{String(scene.scene_number || idx + 1).padStart(3, '0')}
                        {scene.image_path && <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />}
                      </div>
                      <div className="text-[12px] text-zinc-400 dark:text-zinc-500 line-clamp-2 leading-relaxed">
                        {scene.image_prompt_english || "No prompt available"}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Canvas Area Fallback */}
        {!activeScene ? (
          <div className="lg:col-span-9 h-full flex items-center justify-center bg-card rounded-xl border border-border shadow-2xs text-zinc-400 dark:text-zinc-500 text-sm">
            <div className="flex flex-col items-center">
              <ImageIcon size={28} className="mb-3 opacity-20" />
              <p className="tracking-tight">Project is empty. Add a scene to begin editing.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Column 2: Center Workspace Field */}
            <div className="lg:col-span-4 h-full flex flex-col overflow-hidden">
              <div className="bg-card rounded-xl border border-border flex flex-col h-full overflow-hidden shadow-2xs relative">
                
                {/* Script Fragment Row */}
                <div className="border-b border-border p-4 bg-panel-header flex justify-between items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <label className="text-[11px] font-semibold tracking-wider uppercase text-panel-text mb-1.5 block">
                      Scene Script Segment
                    </label>
                    <div className="text-[13.5px] text-zinc-800 dark:text-zinc-200 leading-relaxed truncate-3-lines">
                      {activeScene.narration_khmer || "No script segment attached to this scene."}
                    </div>
                  </div>
                  <div className="shrink-0 h-4 flex items-center">
                    {savingState === "saving" && <span className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> Saving</span>}
                    {savingState === "saved" && <span className="text-[10px] text-emerald-500 flex items-center gap-1.5"><Check size={11} /> Saved</span>}
                  </div>
                </div>

                {/* Positive System Prompt Box */}
                <div className="flex-1 min-h-0 flex flex-col border-b border-border">
                  <label className="text-[11px] font-semibold tracking-wider uppercase text-panel-text px-4 pt-4 block">
                    Engine Prompt Configuration
                  </label>
                  <textarea
                    value={localPositive}
                    onChange={(e) => setLocalPositive(e.target.value)}
                    onBlur={handleBlur}
                    className={textInputStyle}
                    placeholder="Describe the image you want to generate..."
                  />
                </div>

                {/* Negative Tuning Configuration Box */}
                <div className="h-50 shrink-0 flex flex-col border-b border-border bg-zinc-50/[0.05]">
                  <label className="text-[11px] font-semibold tracking-wider uppercase text-panel-text px-4 pt-4 block">
                    Negative Constraints
                  </label>
                  <textarea
                    value={localNegative}
                    onChange={(e) => setLocalNegative(e.target.value)}
                    onBlur={handleBlur}
                    className={textInputStyle}
                    placeholder="Enter elements to exclude (e.g. text, watermark, bad anatomy)..."
                  />
                </div>

                {/* Live Instruction Bar */}
                <div className="p-3 shrink-0 bg-panel-header border-t border-border relative">
                  {isRefining && (
                    <div className="absolute -top-7 right-3 flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full text-[10px] font-medium shadow-sm animate-in fade-in">
                      <Loader2 size={10} className="animate-spin" />
                      Refining with {activeProvider}...
                    </div>
                  )}
                  <div className="relative flex items-center">
                    <textarea
                      ref={refinementRef}
                      rows={1}
                      value={refinementInput}
                      onChange={(e) => setRefinementInput(e.target.value)}
                      disabled={isRefining}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (refinementInput.trim()) {
                            handleRefineSubmit();
                          }
                        }
                      }}
                      placeholder="Refine prompt instructions..."
                      className="w-full pl-4 pr-12 py-2.5 bg-background border border-border rounded-xl text-[13.5px] text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary transition-all resize-none custom-scrollbar placeholder:text-zinc-400/40 disabled:opacity-50"
                    />
                    {isRefining ? (
                      <button 
                        type="button"
                        onClick={handleStopRefine}
                        className="absolute right-2 p-1.5 text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
                        title="Stop Request"
                      >
                        <X size={15} />
                      </button>
                    ) : (
                      <button 
                        type="button"
                        onClick={(e) => handleRefineSubmit(e as any)}
                        disabled={!refinementInput.trim()}
                        className="absolute right-2 p-1.5 text-zinc-500 hover:text-primary dark:text-zinc-400 dark:hover:text-primary-hover disabled:opacity-30 rounded-lg transition-colors cursor-pointer"
                      >
                        <CornerDownLeft size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3: Right Composition Control Board */}
            <div className="lg:col-span-5 h-full flex flex-col gap-4 overflow-hidden">
              {/* Configuration Matrix Module */}
              <div className="bg-card rounded-xl border border-border p-4 shrink-0 shadow-2xs">
                <div className="flex items-center gap-2 mb-4 h-5">
                  <SlidersHorizontal size={13} className="text-panel-icon" />
                  <h3 className="text-[11px] font-semibold tracking-wider uppercase text-panel-text">
                    Engine Generation Parameters
                  </h3>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-[12px] font-medium text-zinc-600 dark:text-zinc-400">Aspect Ratio</span>
                    <div className="grid grid-cols-5 gap-1.5">
                      {["1:1", "4:3", "16:9", "9:16", "2:3"].map((ratio) => {
                        const getDimensions = (r: string) => {
                          switch (r) {
                            case "1:1": return { width: 12, height: 12 };
                            case "4:3": return { width: 15, height: 11 };
                            case "16:9": return { width: 18, height: 10 };
                            case "9:16": return { width: 10, height: 18 };
                            case "2:3": return { width: 11, height: 15 };
                            default: return { width: 12, height: 12 };
                          }
                        };
                        const isActive = aspectRatioValue === ratio;
                        return (
                          <button
                            key={ratio}
                            type="button"
                            onClick={() => setAspectRatioValue(ratio)}
                            className={`py-2.5 flex flex-col items-center justify-center gap-1.5 text-[10px] font-mono rounded-xl border transition-all ${
                              isActive 
                                ? "bg-zinc-100 dark:bg-zinc-900 border-zinc-400 dark:border-zinc-700 text-zinc-950 dark:text-zinc-50 shadow-2xs" 
                                : "bg-transparent border-border/60 text-zinc-400 dark:text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-800"
                            }`}
                          >
                            <div className={`border-[1.5px] rounded-xs transition-colors ${isActive ? 'border-zinc-800 dark:border-zinc-200' : 'border-zinc-300 dark:border-zinc-700'}`} style={getDimensions(ratio)} />
                            <span>{ratio}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[12px] font-medium text-zinc-600 dark:text-zinc-400">
                      <span>Inference Steps</span>
                      <span className="font-mono text-xs text-zinc-900 dark:text-zinc-100 font-semibold">{inferenceSteps}</span>
                    </div>
                    <input 
                      type="range" 
                      min="5" 
                      max="30" 
                      value={inferenceSteps} 
                      onChange={(e) => setInferenceSteps(parseInt(e.target.value, 10))} 
                      className="w-full accent-zinc-800 dark:accent-zinc-200 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer" 
                    />
                  </div>
                </div>
              </div>

              {/* Live Canvas Viewfinder Card */}
              <div className="flex-1 bg-card rounded-xl border border-border flex flex-col overflow-hidden relative shadow-2xs">
                <div className="h-10 bg-panel-header border-b border-border px-4 flex items-center text-[11px] font-semibold tracking-wider uppercase text-panel-text absolute top-0 w-full z-10">
                  Render Output Frame
                </div>
                
                <div className="flex-1 flex items-center justify-center bg-zinc-50/30 dark:bg-zinc-950/20 overflow-hidden relative pt-10">
                  {isGenerating ? (
                    <div className="flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400 p-6 text-center select-none">
                      <Loader2 size={24} className="mb-3 animate-spin opacity-70 text-primary" />
                      <p className="text-[11px] uppercase tracking-widest font-semibold">Synthesizing layer via local Draw Things pipeline...</p>
                    </div>
                  ) : activeScene?.image_path ? (
                    <div className="w-full h-full relative group p-4">
                      <img 
                        src={`http://localhost:8000/static/${activeProject.slug}/scene_${String(activeScene.scene_number).padStart(3, '0')}.png?t=${cacheBuster}`} 
                        alt={`Scene ${activeScene.scene_number}`} 
                        className="w-full h-full object-contain rounded-lg shadow-xs"
                      />
                      <button 
                        type="button"
                        onClick={() => setIsZoomed(true)}
                        className="absolute top-6 right-6 p-2 bg-white/80 dark:bg-zinc-900/80 hover:bg-white dark:hover:bg-zinc-950 text-zinc-800 dark:text-zinc-200 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md shadow-xs border border-border"
                      >
                        <Maximize2 size={15} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-zinc-300 dark:text-zinc-700 text-center p-6 select-none">
                      <ImageIcon size={28} className="mb-2.5 opacity-60" />
                      <p className="text-[11px] uppercase tracking-widest font-semibold text-zinc-400 dark:text-zinc-500">No Render Output</p>
                      <p className="text-[10px] mt-1 max-w-[160px] leading-relaxed text-zinc-400/70 dark:text-zinc-500/70">Execute framework variables to compile canvas visual asset.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button Strip */}
              <div className="flex gap-3 shrink-0 h-11">
                {activeScene.image_status === "processing" ? (
                  <button 
                    type="button"
                    onClick={handleStop}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[13.5px] font-medium shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <X size={15} />
                    <span>Stop Rendering</span>
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={handleGenerate}
                    disabled={isGenerating || !activeScene}
                    className="flex-1 bg-primary hover:bg-primary-hover text-white rounded-xl text-[13.5px] font-medium shadow-2xs transition-all flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
                  >
                    {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                    <span>{isGenerating ? "Generating..." : "Generate Frame"}</span>
                  </button>
                )}
                <button 
                  type="button"
                  onClick={handleTrash}
                  disabled={isGenerating || !activeScene || !activeScene.image_path}
                  className="bg-zinc-100 dark:bg-zinc-900 border border-border hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 px-4 rounded-xl text-zinc-500 dark:text-zinc-400 transition-all flex items-center justify-center disabled:opacity-40 cursor-pointer"
                  title="Delete Frame"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Lightbox Modal Window Backdrop */}
      {isZoomed && activeScene?.image_path && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#09090d]/95 backdrop-blur-md p-6 animate-in fade-in duration-200"
          onClick={() => setIsZoomed(false)}
        >
          <button 
            type="button"
            className="absolute top-6 right-6 p-2.5 bg-white/5 border border-white/10 text-zinc-400 hover:text-zinc-100 rounded-full transition-colors backdrop-blur-md"
            onClick={() => setIsZoomed(false)}
          >
            <X size={20} />
          </button>
          <img 
            src={`http://localhost:8000/static/${activeProject.slug}/scene_${String(activeScene.scene_number).padStart(3, '0')}.png?t=${cacheBuster}`} 
            alt={`Scene ${activeScene.scene_number} Full Window`} 
            className="max-w-full max-h-full object-contain shadow-2xl rounded-xl border border-white/5 select-none"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}