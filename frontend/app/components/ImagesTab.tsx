/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect } from "react";
import { Project } from "../context/ProjectContext";
import { Image as ImageIcon, Sparkles, Trash2, X, Check, Loader2, Cpu, WandSparkles } from "lucide-react";

interface ImagesTabProps {
  activeProject: Project;
  refreshProjectData: () => Promise<void>;
}

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
  [key: string]: unknown;
}

export default function ImagesTab({ activeProject, refreshProjectData }: ImagesTabProps) {
  const [globalImageStyle, setGlobalImageStyle] = useState(activeProject.image_style || "");
  const [isSavingStyle, setIsSavingStyle] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Modal / Detail state
  const [selectedScene, setSelectedScene] = useState<SceneData | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [refinementInput, setRefinementInput] = useState("");
  const [countdown, setCountdown] = useState(15);
  const [promptText, setPromptText] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Keep global style in sync if project changes
  useEffect(() => {
    setGlobalImageStyle(activeProject.image_style || "");
  }, [activeProject.image_style]);

  // Update promptText when scene is selected
  useEffect(() => {
    if (selectedScene) {
      setPromptText(selectedScene.image_prompt_english || "");
      setRefinementInput("");
    }
  }, [selectedScene]);

  // Countdown timer logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRendering && countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    } else if (countdown === 0 && isRendering) {
      // Refresh project to check if image is ready
      refreshProjectData();
      setIsRendering(false);
      setCountdown(15);
    }
    return () => clearTimeout(timer);
  }, [isRendering, countdown, refreshProjectData]);

  // Update selectedScene locally when activeProject changes (e.g. after refresh)
  useEffect(() => {
    if (selectedScene && activeProject.scenes) {
      const updatedScene = activeProject.scenes.find((s: unknown) => (s as SceneData).id === selectedScene.id) as SceneData | undefined;
      if (updatedScene) {
        // Only update if something changed (like image_path or image_status)
        if (
          updatedScene.image_path !== selectedScene.image_path ||
          updatedScene.image_status !== selectedScene.image_status ||
          updatedScene.image_prompt_english !== selectedScene.image_prompt_english
        ) {
          setSelectedScene(updatedScene);
          if (updatedScene.image_prompt_english !== selectedScene.image_prompt_english && !isRefining) {
             setPromptText(updatedScene.image_prompt_english || "");
          }
        }
      }
    }
  }, [activeProject.scenes, selectedScene, isRefining]);

  const handleSaveStyle = async () => {
    setIsSavingStyle(true);
    setSaveSuccess(false);
    try {
      const response = await fetch(`http://localhost:8000/api/projects/${activeProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_style: globalImageStyle }),
      });
      if (response.ok) {
        await refreshProjectData();
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (error) {
      console.error("Error saving global style:", error);
    } finally {
      setIsSavingStyle(false);
    }
  };

  const handleRefinePrompt = async () => {
    if (!selectedScene || !refinementInput.trim()) return;
    setIsRefining(true);
    try {
      const response = await fetch(`http://localhost:8000/api/scenes/${selectedScene.id}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_instruction: refinementInput }),
      });
      if (response.ok) {
        const data = await response.json();
        setPromptText(data.refined_prompt || "");
        setRefinementInput("");
        await refreshProjectData();
      }
    } catch (error) {
      console.error("Error refining prompt:", error);
    } finally {
      setIsRefining(false);
    }
  };

  const handleGenerateFrame = async () => {
    if (!selectedScene) return;
    setIsRendering(true);
    setCountdown(15);
    try {
      const response = await fetch(`http://localhost:8000/api/scenes/${selectedScene.id}/generate-image`, {
        method: "POST",
      });
      if (response.ok) {
        await refreshProjectData();
      }
    } catch (error) {
      console.error("Error generating frame:", error);
      setIsRendering(false);
    }
  };

  const handleDiscardImage = async () => {
    if (!selectedScene) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`http://localhost:8000/api/scenes/${selectedScene.id}/image`, {
        method: "DELETE",
      });
      if (response.ok) {
        await refreshProjectData();
      }
    } catch (error) {
      console.error("Error deleting image:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const getImageUrl = (path: string) => {
    if (!path) return "";
    // If backend returns absolute path, we might need to rely on static mount
    // Assuming backend mounts a static folder or path is relative to static
    const filename = path.split("/").pop() || path.split("\\").pop();
    return `http://localhost:8000/static/${filename}`;
  };

  const handlePromptBlur = async () => {
    if (!selectedScene || promptText === selectedScene.image_prompt_english) return;
    // We could potentially save manual prompt edits directly if there's an endpoint.
    // Since there's no direct PUT /api/scenes/{id} mentioned, we might rely on refine endpoint or skip manual save.
  };

  return (
    <div className="flex flex-col gap-8 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* Global Style Sync Bar */}
      <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
        <label className="flex items-center gap-2 text-sm font-semibold mb-3 text-card-foreground">
          <Sparkles size={16} className="text-primary" /> Global Image Style Configuration
        </label>
        <div className="flex gap-4 items-center">
          <input
            type="text"
            value={globalImageStyle}
            onChange={(e) => setGlobalImageStyle(e.target.value)}
            onBlur={handleSaveStyle}
            className="flex-1 p-3 bg-background text-foreground border border-border bg-opacity-50 font-sans focus:border-primary focus:ring-1 focus:ring-primary outline-none rounded-md"
            placeholder="e.g. Cinematic lighting, hyper-realistic, 8k resolution, Unreal Engine 5"
          />
          <div className="flex items-center justify-center w-24">
            {isSavingStyle ? (
              <span className="text-xs text-foreground/50 italic flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" /> Saving...
              </span>
            ) : saveSuccess ? (
              <span className="text-xs text-green-500 flex items-center gap-1 font-medium">
                <Check size={14} /> Saved
              </span>
            ) : (
              <span className="text-xs text-foreground/30">Synced</span>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Scene Grid Layout */}
      <div>
        <h3 className="text-lg font-bold mb-4 text-card-foreground">Scene Sequence</h3>
        {(!activeProject.scenes || activeProject.scenes.length === 0) ? (
          <div className="text-center p-12 border border-dashed border-border rounded-lg text-foreground/50">
            No scenes available. Parse the script in the Overview tab first.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeProject.scenes.map((scene: unknown, index: number) => {
              const sceneData = scene as SceneData;
              return (
              <div 
                key={sceneData.id || index}
                onClick={() => setSelectedScene(sceneData)}
                className="bg-card rounded-lg border border-border overflow-hidden cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group flex flex-col h-72"
              >
                <div className="p-3 border-b border-border bg-background/50 flex justify-between items-center">
                  <span className="font-bold text-sm tracking-wide text-card-foreground">
                    Scene #{String(sceneData.scene_number || index + 1).padStart(2, '0')}
                  </span>
                  {sceneData.image_path ? (
                    <span className="flex items-center gap-1 text-xs text-green-500 font-medium bg-green-500/10 px-2 py-1 rounded">
                      <Check size={12} /> Rendered
                    </span>
                  ) : sceneData.image_status === "pending" || sceneData.image_status === "rendering" ? (
                    <span className="flex items-center gap-1 text-xs text-yellow-500 font-medium bg-yellow-500/10 px-2 py-1 rounded">
                      <Loader2 size={12} className={sceneData.image_status === "rendering" ? "animate-spin" : ""} /> Pending
                    </span>
                  ) : null}
                </div>
                
                <div className="flex-1 bg-neutral-900 dark:bg-black relative overflow-hidden flex items-center justify-center">
                  {sceneData.image_path ? (
                    <img 
                      src={getImageUrl(sceneData.image_path)} 
                      alt={`Scene ${sceneData.scene_number}`}
                      className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-foreground/30 gap-2 p-4 text-center">
                      <ImageIcon size={32} className="opacity-20 mb-1" />
                      <span className="text-xs font-medium uppercase tracking-wider">Awaiting Generation</span>
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-border bg-card h-24 overflow-hidden">
                  <p className="text-xs text-foreground/70 line-clamp-3 leading-relaxed">
                    {sceneData.narration_khmer || "No script available for this scene."}
                  </p>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>

      {/* Scene Detail Expansion Modal / Focus Overlay */}
      {selectedScene && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 sm:p-8">
          <div className="bg-card w-full max-w-6xl h-full max-h-[90vh] rounded-xl border border-border shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex justify-between items-center bg-background/50">
              <h2 className="text-xl font-bold flex items-center gap-2">
                Scene #{String(selectedScene.scene_number).padStart(2, '0')} Detail
              </h2>
              <button 
                onClick={() => setSelectedScene(null)}
                className="p-2 hover:bg-foreground/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body: Dual Column */}
            <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
              
              {/* LEFT CONTROL COLUMN: Prompt Architecture */}
              <div className="flex-1 p-6 md:p-8 overflow-y-auto border-r border-border flex flex-col gap-6 bg-card">
                
                <div>
                  <label className="text-sm font-semibold mb-2 block text-card-foreground">
                    Interactive Core Prompt
                  </label>
                  <textarea
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    onBlur={handlePromptBlur}
                    className="w-full h-48 p-4 bg-background text-foreground border border-border bg-opacity-50 font-sans focus:border-primary focus:ring-1 focus:ring-primary outline-none rounded-lg resize-y leading-relaxed"
                    placeholder="Enter or edit the visual prompt here..."
                  />
                </div>

                <div className="bg-background rounded-lg border border-border p-5">
                  <label className="text-sm font-semibold mb-3 block text-card-foreground">
                    AI Refinement Control
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={refinementInput}
                      onChange={(e) => setRefinementInput(e.target.value)}
                      placeholder="Instruct AI to detail this prompt..."
                      className="flex-1 p-3 bg-card border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none rounded-md text-sm"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRefinePrompt(); }}
                    />
                    <button
                      onClick={handleRefinePrompt}
                      disabled={isRefining || !refinementInput.trim()}
                      className="px-5 py-3 bg-card border border-border hover:bg-foreground/5 text-foreground rounded-md transition-colors font-medium flex items-center justify-center gap-2 text-sm whitespace-nowrap disabled:opacity-50"
                    >
                      {isRefining ? <Loader2 size={16} className="animate-spin" /> : <WandSparkles size={16} className="text-primary" />}
                      AI Refine
                    </button>
                  </div>
                </div>

                <div className="mt-auto pt-6 border-t border-border flex gap-4">
                  <button
                    onClick={handleGenerateFrame}
                    disabled={isRendering || isDeleting || isRefining}
                    className="flex-1 bg-primary text-white hover:bg-primary-hover hover:opacity-90 py-3 rounded-lg font-medium flex justify-center items-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {isRendering ? <Loader2 size={18} className="animate-spin" /> : <Cpu size={18} />}
                    {isRendering ? "Queued..." : "Generate Frame"}
                  </button>
                  
                  {selectedScene.image_path && (
                    <button
                      onClick={handleDiscardImage}
                      disabled={isDeleting || isRendering}
                      className="px-5 bg-neutral-800 hover:bg-red-900/50 text-red-400 py-3 rounded-lg font-medium flex justify-center items-center gap-2 transition-colors disabled:opacity-50 border border-red-900/30"
                    >
                      {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                      Discard
                    </button>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: Real-Time Live Render Canvas Frame */}
              <div className="flex-1 p-6 md:p-8 bg-background/50 flex flex-col items-center justify-center relative min-h-[400px]">
                <div className="w-full max-w-sm aspect-[9/16] bg-neutral-900 dark:bg-black rounded-xl border border-border overflow-hidden shadow-2xl relative flex items-center justify-center">
                  
                  {isRendering ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
                      <div className="relative w-20 h-20 flex items-center justify-center mb-6">
                        <div className="absolute inset-0 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                        <Cpu size={32} className="text-primary animate-pulse" />
                      </div>
                      <h3 className="text-lg font-bold mb-2">Rendering Frame</h3>
                      <p className="text-foreground/50 text-sm mb-6">Synthesizing visual assets via local engine...</p>
                      
                      <div className="text-3xl font-mono font-bold text-primary tabular-nums">
                        00:{String(countdown).padStart(2, '0')}
                      </div>
                      <div className="mt-4 w-full h-1 bg-foreground/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-1000 ease-linear"
                          style={{ width: `${(15 - countdown) / 15 * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ) : selectedScene.image_path ? (
                    <img 
                      src={getImageUrl(selectedScene.image_path)} 
                      alt="Rendered scene" 
                      className="w-full h-full object-cover animate-in fade-in zoom-in-95 duration-500"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-foreground/30 p-8 text-center">
                      <ImageIcon size={48} className="opacity-20 mb-4" />
                      <p className="text-sm font-medium">9:16 Canvas Frame</p>
                      <p className="text-xs mt-2 opacity-60">Awaiting generation trigger</p>
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
