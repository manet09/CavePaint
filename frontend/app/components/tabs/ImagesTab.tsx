/* eslint-disable */
"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useProjectContext } from "../../context/ProjectContext";
import { 
  Image as ImageIcon, 
  Wand2, 
  Sparkles, 
  Trash2, 
  Loader2, 
  Check, 
  Maximize2, 
  X, 
  Upload, 
  Cpu, 
  Cloud, 
  Pin, 
  Plus, 
  Paperclip, 
  Layers, 
  ChevronLeft, 
  ChevronRight, 
  Volume2
} from "lucide-react";

interface ImagesTabProps {
  activeProject?: any;
  refreshProjectData?: any;
}

// Aspect ratio wireframe icon matching Google Flow UI
function AspectRatioGraphic({ ratio, className = "" }: { ratio: string; className?: string }) {
  switch (ratio) {
    case "16:9":
      return <div className={`w-[18px] h-[10px] rounded-[1.5px] border border-current shrink-0 ${className}`} />;
    case "4:3":
      return <div className={`w-[15px] h-[11px] rounded-[1.5px] border border-current shrink-0 ${className}`} />;
    case "1:1":
      return <div className={`w-[12px] h-[12px] rounded-[1.5px] border border-current shrink-0 ${className}`} />;
    case "3:4":
      return <div className={`w-[11px] h-[15px] rounded-[1.5px] border border-current shrink-0 ${className}`} />;
    case "9:16":
      return <div className={`w-[10px] h-[18px] rounded-[1.5px] border border-current shrink-0 ${className}`} />;
    case "2:3":
      return <div className={`w-[11px] h-[15px] rounded-[1.5px] border border-current shrink-0 ${className}`} />;
    default:
      return <div className={`w-[14px] h-[10px] rounded-[1.5px] border border-current shrink-0 ${className}`} />;
  }
}

// Clean auto-resizing textarea with auto-save on blur
function AutoResizeTextarea({
  defaultValue,
  onBlur,
  className,
  placeholder,
  disabled = false,
}: {
  defaultValue: string;
  onBlur: (val: string) => void;
  className: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [val, setVal] = useState(defaultValue || "");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setVal(defaultValue || "");
  }, [defaultValue]);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = `${Math.max(ref.current.scrollHeight, 24)}px`;
    }
  }, [val]);

  return (
    <textarea
      ref={ref}
      value={val}
      disabled={disabled}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        if (val !== (defaultValue || "")) {
          onBlur(val);
        }
      }}
      placeholder={placeholder}
      className={`${className} overflow-hidden resize-none`}
      rows={1}
    />
  );
}

export default function ImagesTab(props: ImagesTabProps) {
  const { activeProject, updateSingleScene, refreshProjects, updateActiveProject } = useProjectContext();
  
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [copilotInput, setCopilotInput] = useState("");
  const [isCopilotRunning, setIsCopilotRunning] = useState(false);
  const [copilotSummary, setCopilotSummary] = useState<string | null>(null);
  const copilotInputRef = useRef<HTMLTextAreaElement>(null);

  const [aspectRatioValue, setAspectRatioValue] = useState("16:9");
  const [inferenceSteps, setInferenceSteps] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [cacheBuster, setCacheBuster] = useState(Date.now());
  
  // Engine & Model controls
  const [imageProvider, setImageProvider] = useState<"local" | "flow">("flow");
  const [flowModel, setFlowModel] = useState<"nano2" | "nano-pro">("nano2");
  const [imageCount, setImageCount] = useState<number>(1);
  const [flowStatus, setFlowStatus] = useState<{ cli_available: boolean; daemon_running: boolean; authenticated: boolean } | null>(null);

  // Upload & Lightbox states
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingRef, setIsUploadingRef] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  // Exclusions collapsible state
  const [isExclusionsExpanded, setIsExclusionsExpanded] = useState(false);

  // Active Reference Image for Copilot Adjustments (clicked variant or default active frame)
  const [selectedRefImage, setSelectedRefImage] = useState<string | null | undefined>(undefined);

  // Drag & drop highlight state
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Reset selected reference image when switching scenes
  useEffect(() => {
    setSelectedRefImage(undefined);
  }, [activeSceneIndex]);

  // Synchronize aspect ratio with active project
  useEffect(() => {
    if (activeProject?.aspect_ratio) {
      setAspectRatioValue(activeProject.aspect_ratio);
    }
  }, [activeProject?.aspect_ratio]);

  // Load engine settings and poll Flow daemon status
  useEffect(() => {
    fetch("http://localhost:8000/api/settings")
      .then(res => res.json())
      .then(data => {
        if (data.image_provider) {
          setImageProvider(data.image_provider);
        }
      })
      .catch(console.error);

    const fetchFlowStatus = () => {
      fetch("http://localhost:8000/api/flow/status")
        .then(res => res.json())
        .then(data => setFlowStatus(data))
        .catch(console.error);
    };

    fetchFlowStatus();
    const statusInterval = setInterval(fetchFlowStatus, 5000);
    return () => clearInterval(statusInterval);
  }, []);

  const scenes = activeProject?.scenes || [];
  const activeScene = scenes[activeSceneIndex] || scenes[0] || null;

  // Auto-resize copilot input
  useEffect(() => {
    if (copilotInputRef.current) {
      copilotInputRef.current.style.height = "auto";
      copilotInputRef.current.style.height = `${Math.min(copilotInputRef.current.scrollHeight, 100)}px`;
    }
  }, [copilotInput]);

  // Derived variants list for active scene
  const imagesList: string[] = useMemo(() => {
    if (!activeScene?.images_list) {
      return activeScene?.image_path ? [activeScene.image_path] : [];
    }
    try {
      const parsed = typeof activeScene.images_list === "string" ? JSON.parse(activeScene.images_list) : activeScene.images_list;
      const arr = Array.isArray(parsed) ? parsed : [];
      if (activeScene.image_path && !arr.includes(activeScene.image_path)) {
        return [activeScene.image_path, ...arr];
      }
      return arr.length > 0 ? arr : (activeScene.image_path ? [activeScene.image_path] : []);
    } catch {
      return activeScene?.image_path ? [activeScene.image_path] : [];
    }
  }, [activeScene?.images_list, activeScene?.image_path]);

  // Derived reference images list
  const referenceImages: string[] = useMemo(() => {
    if (!activeScene?.reference_images) return [];
    try {
      const parsed = typeof activeScene.reference_images === "string" ? JSON.parse(activeScene.reference_images) : activeScene.reference_images;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [activeScene?.reference_images]);

  // Generated scene count calculation
  const generatedScenesCount = useMemo(() => {
    return scenes.filter((s: any) => !!s.image_path).length;
  }, [scenes]);

  // Generation status polling
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
  }, [activeScene?.image_status, isGenerating]);

  // Toggle engine (Flow MCP vs Draw Things)
  const toggleImageEngine = async () => {
    const nextProvider = imageProvider === "local" ? "flow" : "local";
    setImageProvider(nextProvider);
    try {
      await fetch("http://localhost:8000/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_provider: nextProvider }),
      });
    } catch (err) {
      console.error("Failed to update image provider setting:", err);
    }
  };

  // Talk Directly to Flow (Scene Copilot Handler)
  const handleCopilotSubmit = async (generateImage: boolean = true) => {
    if (!activeScene || !copilotInput.trim() || isCopilotRunning) return;

    setIsCopilotRunning(true);
    setCopilotSummary(null);

    const refToUse = selectedRefImage !== undefined ? selectedRefImage : (activeScene.image_path || null);

    try {
      const response = await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/flow-adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: copilotInput.trim(),
          reference_image: refToUse,
          generate_image: generateImage,
          refine_prompt_text: !generateImage,
          model: flowModel,
          aspect_ratio: aspectRatioValue,
          count: imageCount,
          image_provider: imageProvider
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Only update text fields if user explicitly asked for "Refine Text Only"
        if (!generateImage) {
          await updateSingleScene(activeScene.id, {
            image_prompt_english: data.image_prompt_english,
            narration_khmer: data.narration_khmer,
            negative_prompt: data.negative_prompt_english,
            user_refinement_prompt: copilotInput.trim()
          });
        }

        const refNote = data.referenced_asset_name
          ? ` (ref: @${data.referenced_asset_name})`
          : (refToUse ? ` (ref: ${refToUse.split("/").pop()})` : "");

        setCopilotSummary((data.change_summary || "Flow adjustment applied.") + refNote);
        setCopilotInput("");
        if (data.generating) {
          setIsGenerating(true);
        }
        if (props.refreshProjectData) await props.refreshProjectData();
      } else {
        const err = await response.text();
        console.error("Flow adjust error:", err);
      }
    } catch (err) {
      console.error("Error communicating with Flow Copilot:", err);
    } finally {
      setIsCopilotRunning(false);
    }
  };

  // Standard Generate Frame action
  const handleGenerateFrame = async () => {
    if (!activeScene) return;
    setIsGenerating(true);

    const payload = {
      aspect_ratio: aspectRatioValue,
      guidance_scale: 7.5,
      inference_steps: inferenceSteps,
      model: flowModel,
      count: imageCount,
      image_provider: imageProvider,
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

  // Stop Generation
  const handleStop = async () => {
    if (!activeScene) return;
    try {
      await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/stop`, {
        method: "POST",
      });
      if (props.refreshProjectData) await props.refreshProjectData();
    } catch (error) {
      console.error("Error stopping generation:", error);
    }
  };

  // Clear Active Scene Frame
  const handleTrashAll = async () => {
    if (!activeScene) return;
    try {
      await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/image`, {
        method: "DELETE",
      });
      setCacheBuster(Date.now());
      if (props.refreshProjectData) await props.refreshProjectData();
    } catch (error) {
      console.error("Error deleting image:", error);
    }
  };

  // Set Active Variant (with canonical mirror update)
  const handleSetActiveVariant = async (variantPath: string) => {
    setSelectedRefImage(variantPath);
    if (!activeScene || activeScene.image_path === variantPath) return;
    try {
      const res = await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/set-active-image`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_path: variantPath }),
      });
      if (res.ok) {
        setCacheBuster(Date.now());
        if (props.refreshProjectData) await props.refreshProjectData();
      }
    } catch (err) {
      console.error("Error setting active image:", err);
    }
  };

  // Delete Individual Variant
  const handleDeleteVariant = async (variantPath: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!activeScene) return;
    try {
      const res = await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/image-variant?image_path=${encodeURIComponent(variantPath)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCacheBuster(Date.now());
        if (props.refreshProjectData) await props.refreshProjectData();
      }
    } catch (err) {
      console.error("Error deleting image variant:", err);
    }
  };

  // Upload Reference File
  const handleUploadReference = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeScene) return;
    setIsUploadingRef(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/reference-image`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        if (props.refreshProjectData) await props.refreshProjectData();
      }
    } catch (err) {
      console.error("Error uploading reference:", err);
    } finally {
      setIsUploadingRef(false);
      if (refInputRef.current) refInputRef.current.value = "";
    }
  };

  // Pin variant as reference
  const handlePinVariantAsRef = async (variantPath: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!activeScene) return;
    try {
      const formData = new FormData();
      formData.append("reference_path", variantPath);
      const res = await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/reference-image`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        if (props.refreshProjectData) await props.refreshProjectData();
      }
    } catch (err) {
      console.error("Error adding reference image:", err);
    }
  };

  // Remove Reference
  const handleRemoveReference = async (refItem: string) => {
    if (!activeScene) return;
    try {
      const res = await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/reference-image?reference=${encodeURIComponent(refItem)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (props.refreshProjectData) await props.refreshProjectData();
      }
    } catch (err) {
      console.error("Error removing reference:", err);
    }
  };

  // File Upload directly onto scene
  const handleDirectUpload = async (file: File) => {
    if (!activeScene) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/upload-image`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        setCacheBuster(Date.now());
        if (props.refreshProjectData) await props.refreshProjectData();
      }
    } catch (err) {
      console.error("Error uploading image:", err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleDirectUpload(file);
    }
  };

  if (!activeProject) return null;

  const activeVariantIdx = activeScene?.image_path ? imagesList.findIndex((p: string) => p === activeScene.image_path) : -1;
  const effectiveRef = selectedRefImage !== undefined ? selectedRefImage : (activeScene?.image_path || null);
  const effectiveRefVIdx = effectiveRef ? imagesList.findIndex((p: string) => p === effectiveRef) : -1;
  const refFilename = effectiveRef ? effectiveRef.split("/").pop() : "";

  return (
    <div className="flex flex-col h-[calc(100vh-56px-48px)] max-h-[calc(100vh-56px-48px)] animate-in fade-in duration-200 select-none">
      
      {/* ========================================================= */}
      {/* 3-COLUMN WORKSPACE: SCENES | EDITOR & COPILOT | RENDER     */}
      {/* ========================================================= */}
      <div className="flex gap-4 w-full flex-1 min-h-0 pt-0.5 overflow-hidden">
        
        {/* ======================================================= */}
        {/* COLUMN 1: VERTICAL SCENE NAVIGATOR (~260px)              */}
        {/* ======================================================= */}
        <div className="w-60 xl:w-68 shrink-0 flex flex-col h-full bg-card rounded-xl border border-border/70 shadow-2xs overflow-hidden">
          
          {/* Navigator Header */}
          <div className="h-10 px-3.5 border-b border-border/70 flex items-center justify-between shrink-0 bg-panel-header/60">
            <div className="flex items-center gap-2">
              <Layers size={13} className="text-panel-icon" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                Scenes
              </span>
              <span className="text-[10px] font-mono text-panel-text">
                ({scenes.length})
              </span>
            </div>

            {/* Generated Status Counter */}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Check size={9} strokeWidth={2.5} />
              <span>{generatedScenesCount}/{scenes.length} Ready</span>
            </div>
          </div>

          {/* Vertical Scene List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5 min-h-0">
            {scenes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-4 text-center text-panel-text/60">
                <ImageIcon size={24} className="opacity-30 mb-2" />
                <p className="text-xs">No scenes found.</p>
              </div>
            ) : (
              scenes.map((s: any, idx: number) => {
                const isSelected = activeSceneIndex === idx;
                const hasImage = !!s.image_path;
                const isProcessing = s.image_status === "processing";
                
                // Count variants for this scene
                let vCount = hasImage ? 1 : 0;
                if (s.images_list) {
                  try {
                    const parsed = typeof s.images_list === "string" ? JSON.parse(s.images_list) : s.images_list;
                    if (Array.isArray(parsed) && parsed.length > 0) vCount = parsed.length;
                  } catch {}
                }

                return (
                  <button
                    key={s.id || idx}
                    type="button"
                    onClick={() => setActiveSceneIndex(idx)}
                    className={`w-full text-left p-2 rounded-lg border transition-all cursor-pointer flex flex-col gap-1.5 ${
                      isSelected
                        ? "bg-primary/10 border-primary text-foreground ring-1 ring-primary/30 shadow-2xs"
                        : hasImage
                          ? "bg-card hover:bg-zinc-100/70 dark:hover:bg-zinc-800/60 border-border/70 text-foreground"
                          : "bg-card/40 hover:bg-zinc-100/50 dark:hover:bg-zinc-850/40 border-border/40 text-panel-text"
                    }`}
                  >
                    {/* Scene Top: Number & Status Badge */}
                    <div className="flex items-center justify-between gap-1 w-full">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[11px] font-bold font-mono ${isSelected ? "text-primary" : "text-foreground"}`}>
                          #{String(s.scene_number || idx + 1).padStart(2, "0")}
                        </span>
                        {vCount > 1 && (
                          <span className="px-1 py-0.2 rounded text-[8.5px] font-mono font-medium bg-zinc-200/70 dark:bg-zinc-800 text-panel-text">
                            {vCount}v
                          </span>
                        )}
                      </div>

                      {/* Status indicator badge */}
                      {isProcessing ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                          <Loader2 size={8} className="animate-spin" />
                          <span>Rendering</span>
                        </span>
                      ) : hasImage ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <Check size={8} strokeWidth={2.5} />
                          <span>Ready</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[8.5px] font-medium text-panel-text/70 bg-zinc-100 dark:bg-zinc-800/60 border border-border/40">
                          Empty
                        </span>
                      )}
                    </div>

                    {/* Scene Card Body: Thumbnail & Script Snippet */}
                    <div className="flex items-center gap-2 w-full">
                      {hasImage ? (
                        <img
                          src={`http://localhost:8000/static/${s.image_path}?t=${cacheBuster}`}
                          alt={`Scene ${idx + 1}`}
                          className="w-12 h-8 rounded object-cover border border-border/60 shrink-0 bg-zinc-100 dark:bg-zinc-900"
                        />
                      ) : (
                        <div className="w-12 h-8 rounded border border-dashed border-border/60 bg-zinc-50/50 dark:bg-zinc-900/30 flex items-center justify-center shrink-0">
                          <ImageIcon size={12} className="text-panel-text/30" />
                        </div>
                      )}
                      
                      <p className="text-[10px] text-panel-text line-clamp-2 leading-tight flex-1 select-none">
                        {s.narration_khmer || s.image_prompt_english || "No script yet..."}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

        </div>

        {/* ======================================================= */}
        {/* COLUMN 2: SCENE EDITOR & COPILOT                         */}
        {/* ======================================================= */}
        <div className="flex-1 min-w-[320px] flex flex-col h-full bg-card rounded-xl border border-border/70 p-4 shadow-2xs overflow-hidden min-h-0">
          
          {!activeScene ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-panel-text">
              <ImageIcon size={32} className="opacity-30 mb-2" />
              <p className="text-sm">No scene selected.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between overflow-hidden min-h-0">
              
              {/* Scene Navigation Bar */}
              <div className="flex items-center justify-between pb-3 border-b border-border/40 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-foreground">
                    Scene #{String(activeScene?.scene_number || activeSceneIndex + 1).padStart(2, "0")}
                  </span>
                  {activeScene.image_path ? (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Active Frame Ready
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-zinc-100 dark:bg-zinc-800 text-panel-text border border-border/40">
                      No Frame Rendered
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={activeSceneIndex <= 0}
                    onClick={() => setActiveSceneIndex(prev => Math.max(0, prev - 1))}
                    className="p-1 rounded border border-border/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-panel-text hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title="Previous scene"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <button
                    type="button"
                    disabled={activeSceneIndex >= scenes.length - 1}
                    onClick={() => setActiveSceneIndex(prev => Math.min(scenes.length - 1, prev + 1))}
                    className="p-1 rounded border border-border/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-panel-text hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title="Next scene"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>

              {/* Scrollable Upper Content: Voiceover, Visual Prompt, Exclusions, References */}
              <div className="overflow-y-auto custom-scrollbar space-y-3 py-3 pr-1 flex-1 min-h-0">
                
                {/* 1. Voiceover (Khmer) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[9.5px] font-semibold text-panel-text uppercase tracking-wider flex items-center gap-1.5">
                      <Volume2 size={11} className="text-panel-icon" />
                      Voiceover (Khmer)
                    </label>
                  </div>
                  <AutoResizeTextarea
                    defaultValue={activeScene.narration_khmer || ""}
                    onBlur={(val) => updateSingleScene(activeScene.id, { narration_khmer: val })}
                    placeholder="Khmer voiceover narration..."
                    className="w-full bg-transparent text-[13px] text-foreground leading-relaxed outline-none border-b border-border/40 focus:border-primary transition-colors py-1"
                  />
                </div>

                {/* 2. Visual Prompt (English) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[9.5px] font-semibold text-panel-text uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={11} className="text-panel-icon" />
                      Visual Prompt (English)
                    </label>
                  </div>
                  <AutoResizeTextarea
                    defaultValue={activeScene.image_prompt_english || ""}
                    onBlur={(val) => updateSingleScene(activeScene.id, { image_prompt_english: val })}
                    placeholder="Visual prompt in English..."
                    className="w-full bg-transparent font-mono text-[11px] text-foreground/90 leading-relaxed outline-none border-b border-border/40 focus:border-primary transition-colors py-1"
                  />
                </div>

                {/* 3. Exclusions / Negative Constraints (Collapsible) */}
                <div className="pt-1 border-t border-border/30">
                  <button
                    type="button"
                    onClick={() => setIsExclusionsExpanded(prev => !prev)}
                    className="flex items-center gap-1.5 text-[10px] font-medium text-panel-text hover:text-foreground cursor-pointer transition-colors py-0.5 w-full text-left"
                  >
                    <ChevronRight 
                      size={11} 
                      className={`text-panel-text transition-transform duration-150 shrink-0 ${
                        isExclusionsExpanded ? "rotate-90 text-primary" : ""
                      }`} 
                    />
                    <span className="uppercase tracking-wider text-[9px] font-semibold">
                      Exclusions (Negative)
                    </span>
                    {!isExclusionsExpanded && activeScene.negative_prompt && (
                      <span className="text-[9.5px] font-mono text-panel-text/60 truncate flex-1 ml-1">
                        — {activeScene.negative_prompt}
                      </span>
                    )}
                  </button>

                  {isExclusionsExpanded && (
                    <div className="pt-1.5 animate-in fade-in duration-100">
                      <AutoResizeTextarea
                        defaultValue={activeScene.negative_prompt || ""}
                        onBlur={(val) => updateSingleScene(activeScene.id, { negative_prompt: val })}
                        placeholder="e.g. text, watermark, bad anatomy, 3D render..."
                        className="w-full bg-zinc-100/60 dark:bg-zinc-900/60 p-2 rounded-lg font-mono text-[10px] text-foreground leading-relaxed outline-none border border-border/60 focus:border-primary transition-colors"
                      />
                    </div>
                  )}
                </div>

                {/* 4. Reference Images Shelf */}
                <div className="pt-1 border-t border-border/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-panel-text flex items-center gap-1">
                      <Paperclip size={10} className="text-panel-icon" />
                      Reference Images ({referenceImages.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => refInputRef.current?.click()}
                      disabled={isUploadingRef}
                      className="text-[10px] font-medium text-primary hover:text-primary-hover flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {isUploadingRef ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                      <span>Add Ref</span>
                    </button>
                    <input 
                      ref={refInputRef} 
                      type="file" 
                      accept="image/*" 
                      onChange={handleUploadReference} 
                      className="hidden" 
                    />
                  </div>

                  {referenceImages.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {referenceImages.map((refItem, idx) => {
                        const isFlowUuid = !refItem.includes("/");
                        const filename = isFlowUuid ? `UUID: ${refItem.slice(0, 8)}...` : refItem.split("/").pop();
                        return (
                          <div 
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-900 text-foreground text-[10px] border border-border/60 font-mono"
                          >
                            {!isFlowUuid && (
                              <img 
                                src={`http://localhost:8000/static/${refItem}?t=${cacheBuster}`} 
                                alt="Ref preview" 
                                className="w-3.5 h-3.5 rounded-xs object-cover" 
                              />
                            )}
                            <span className="truncate max-w-[120px]" title={refItem}>{filename}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveReference(refItem)}
                              className="text-zinc-400 hover:text-red-500 transition-colors ml-0.5 cursor-pointer"
                              title="Remove Reference"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* ======================================================= */}
              {/* FLOW COPILOT (CLEAN SLEEK PROMPT BOX)                    */}
              {/* ======================================================= */}
              <div className="pt-2.5 border-t border-border/50 shrink-0 space-y-1.5">
                
                {/* Copilot Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Wand2 size={11} className="text-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      Flow Copilot
                    </span>
                  </div>

                  {/* Reference Attachment Tag */}
                  {effectiveRef ? (
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[9.5px]">
                      <img 
                        src={`http://localhost:8000/static/${effectiveRef}?t=${cacheBuster}`}
                        alt="Reference thumbnail"
                        className="w-3.5 h-3.5 rounded-xs object-cover border border-emerald-500/40 shrink-0"
                      />
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {effectiveRefVIdx >= 0 ? `Ref: V${effectiveRefVIdx + 1}` : "Ref Frame"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedRefImage(null)}
                        className="text-panel-text hover:text-red-500 ml-1 cursor-pointer"
                        title="Detach reference frame"
                      >
                        <X size={9} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[9px] text-panel-text/60">
                      Text-to-Image Mode
                    </span>
                  )}
                </div>

                {/* Copilot Feedback Banner */}
                {copilotSummary && (
                  <div className="p-1.5 rounded-md bg-primary/10 border border-primary/20 flex items-start justify-between gap-1.5 animate-in fade-in duration-150">
                    <p className="text-[10px] text-foreground leading-tight flex-1">
                      <span className="font-bold text-primary mr-1">✓ Flow:</span>
                      {copilotSummary}
                    </p>
                    <button 
                      type="button" 
                      onClick={() => setCopilotSummary(null)} 
                      className="text-panel-text hover:text-foreground shrink-0 cursor-pointer p-0.5"
                    >
                      <X size={10} />
                    </button>
                  </div>
                )}

                {/* Copilot Prompt Input Container */}
                <div className="rounded-xl border border-border/80 bg-zinc-50/50 dark:bg-zinc-900/40 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all flex flex-col">
                  <textarea
                    ref={copilotInputRef}
                    rows={2}
                    value={copilotInput}
                    onChange={(e) => setCopilotInput(e.target.value)}
                    disabled={isCopilotRunning}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (copilotInput.trim()) {
                          handleCopilotSubmit(true);
                        }
                      }
                    }}
                    placeholder="Tell Flow what to adjust (e.g. 'Make mammoth friendly, add stickman rider')..."
                    className="w-full px-2.5 pt-2 pb-1 bg-transparent text-[11.5px] text-foreground outline-none resize-none leading-relaxed placeholder:text-panel-text/50 disabled:opacity-50"
                  />

                  {/* Action Toolbar */}
                  <div className="flex items-center justify-between px-2 py-1 border-t border-border/30 bg-card/60 rounded-b-xl">
                    <span className="text-[9px] text-panel-text/50 font-mono">
                      ↵ Enter to submit
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={!copilotInput.trim() || isCopilotRunning}
                        onClick={() => handleCopilotSubmit(false)}
                        className="px-2 py-0.5 rounded text-[10px] font-medium text-panel-text hover:text-foreground hover:bg-zinc-200/50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors cursor-pointer"
                        title="Refine prompt & script without rendering image"
                      >
                        Refine Text Only
                      </button>

                      <button
                        type="button"
                        disabled={!copilotInput.trim() || isCopilotRunning}
                        onClick={() => handleCopilotSubmit(true)}
                        className="px-2.5 py-0.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-[10px] font-semibold flex items-center gap-1 shadow-2xs disabled:opacity-40 transition-all cursor-pointer"
                      >
                        {isCopilotRunning ? (
                          <>
                            <Loader2 size={10} className="animate-spin" />
                            <span>Adjusting...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={10} />
                            <span>Adjust & Generate</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>

        {/* ======================================================= */}
        {/* COLUMN 3: RENDER STUDIO, TOOLBAR & VARIATIONS           */}
        {/* ======================================================= */}
        <div className="flex-1 min-w-[380px] flex flex-col h-full space-y-2 overflow-hidden min-h-0">
          
          {/* Top Options Toolbar (Cleanly Segmented) */}
          <div className="h-8 shrink-0 flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar">
            
            <div className="flex items-center gap-2 shrink-0">
              {/* Aspect Ratio Pills */}
              <div className="flex items-center gap-0.5 bg-card border border-border/70 p-0.5 rounded-lg shadow-2xs" title="Aspect Ratio">
                {["16:9", "4:3", "1:1", "9:16", "2:3"].map((ratio) => {
                  const isActive = aspectRatioValue === ratio;
                  return (
                    <button
                      key={ratio}
                      type="button"
                      onClick={async () => {
                        setAspectRatioValue(ratio);
                        if (activeProject?.id) {
                          await updateActiveProject({ aspect_ratio: ratio });
                        }
                      }}
                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono flex items-center gap-1 transition-all cursor-pointer ${
                        isActive
                          ? "bg-primary text-white font-bold shadow-2xs"
                          : "text-panel-text hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                      title={`Aspect Ratio ${ratio}`}
                    >
                      <AspectRatioGraphic ratio={ratio} />
                      <span>{ratio}</span>
                    </button>
                  );
                })}
              </div>

              {/* Flow Model Dropdown */}
              {imageProvider === "flow" && (
                <select
                  value={flowModel}
                  onChange={(e) => setFlowModel(e.target.value as "nano2" | "nano-pro")}
                  className="px-2 py-0.5 h-7 bg-card border border-border/70 rounded-lg text-[10px] font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer"
                  title="Google Flow Image Model"
                >
                  <option value="nano2">Nano Banana 2 (Fast)</option>
                  <option value="nano-pro">Nano Banana Pro (Quality)</option>
                </select>
              )}

              {/* Batch Count Selector */}
              {imageProvider === "flow" && (
                <div className="flex items-center gap-0.5 bg-card border border-border/70 p-0.5 rounded-lg shadow-2xs" title="Batch Generation Count">
                  <span className="text-[9px] font-mono px-1 text-panel-text">x</span>
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setImageCount(num)}
                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-medium transition-all cursor-pointer ${
                        imageCount === num
                          ? "bg-primary text-white font-bold"
                          : "text-panel-text hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Daemon Status & Engine Toggle */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Flow Daemon Pill */}
              {imageProvider === "flow" && (
                <div 
                  className={`px-2 py-0.5 rounded-md border text-[9.5px] font-medium flex items-center gap-1.5 shadow-2xs ${
                    flowStatus?.daemon_running 
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" 
                      : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
                  }`}
                  title={flowStatus?.daemon_running ? "MCP Daemon running on :8765" : "Run ./scripts/start_flow_daemon.sh"}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${flowStatus?.daemon_running ? "bg-emerald-500" : "bg-red-500"}`} />
                  <span>{flowStatus?.daemon_running ? ":8765 Connected" : "Offline"}</span>
                </div>
              )}

              {/* Hot-Swap Engine Toggle */}
              <button
                type="button"
                onClick={toggleImageEngine}
                className={`px-2 py-0.5 h-7 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1 border shadow-2xs cursor-pointer ${
                  imageProvider === "flow"
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/20"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                }`}
                title="Switch between Google Flow (MCP) and Local (Draw Things)"
              >
                {imageProvider === "flow" ? (
                  <>
                    <Cloud size={10} />
                    <span>Flow MCP</span>
                  </>
                ) : (
                  <>
                    <Cpu size={10} />
                    <span>Local</span>
                  </>
                )}
              </button>
            </div>

          </div>

          {/* Render Output Frame & Variations Card */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex-1 bg-card rounded-xl border transition-all shadow-2xs flex flex-col overflow-hidden min-h-0 relative ${
              isDraggingOver ? "border-primary ring-2 ring-primary/20" : "border-border/70"
            }`}
          >
            {/* Viewfinder Header */}
            <div className="h-8 px-3 bg-panel-header/80 border-b border-border/70 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ImageIcon size={11} className="text-panel-icon" />
                <span className="text-[10px] font-semibold tracking-wider uppercase text-panel-text">
                  Render Output Frame
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-2 py-0.5 rounded-md bg-zinc-200/60 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-[9.5px] font-medium text-foreground transition-colors flex items-center gap-1 cursor-pointer"
                  title="Upload an image file directly into this scene"
                >
                  {isUploading ? <Loader2 size={9} className="animate-spin" /> : <Upload size={9} />}
                  <span>{isUploading ? "Uploading..." : "Upload"}</span>
                </button>
                <input 
                  ref={fileInputRef} 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleDirectUpload(f);
                  }} 
                  className="hidden" 
                />

                {activeScene?.image_path && (
                  <button
                    type="button"
                    onClick={() => setIsZoomed(true)}
                    className="p-1 rounded-md hover:bg-zinc-200/50 dark:hover:bg-zinc-800 text-panel-text hover:text-foreground transition-colors cursor-pointer"
                    title="Zoom in Lightbox"
                  >
                    <Maximize2 size={11} />
                  </button>
                )}
              </div>
            </div>

            {/* Viewport Canvas */}
            <div className="flex-1 flex items-center justify-center p-3 overflow-hidden relative min-h-0 bg-zinc-50/20 dark:bg-zinc-950/20">
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center text-center p-6 select-none animate-pulse">
                  <Loader2 size={24} className="mb-2 animate-spin text-primary opacity-80" />
                  <p className="text-[10.5px] uppercase tracking-widest font-bold text-foreground">
                    {imageProvider === "flow" ? "Rendering via Google Flow MCP..." : "Synthesizing frame locally..."}
                  </p>
                  <p className="text-[9.5px] text-panel-text/70 mt-0.5">
                    Generating frame variation & updating timeline
                  </p>
                </div>
              ) : activeScene?.image_path ? (
                <div className="w-full h-full relative group flex items-center justify-center">
                  <img 
                    src={`http://localhost:8000/static/${activeScene.image_path}?t=${cacheBuster}`} 
                    alt={`Scene ${activeScene.scene_number}`} 
                    className="max-w-full max-h-full object-contain rounded-lg shadow-xs"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-4 select-none text-panel-text">
                  <ImageIcon size={28} className="mb-2 opacity-30" />
                  <p className="text-[10.5px] uppercase tracking-widest font-semibold text-panel-text">
                    No Render Output
                  </p>
                  <p className="text-[9.5px] text-panel-text/60 mt-1 max-w-[220px] leading-relaxed">
                    Click "Generate Frame", talk to Flow Copilot, or drop an image file here.
                  </p>
                </div>
              )}
            </div>

            {/* ======================================================= */}
            {/* VARIATIONS STRIP (SAFE CLICK-TO-SELECT & SAFE ACTIONS)  */}
            {/* ======================================================= */}
            {imagesList.length > 0 && (
              <div className="border-t border-border/70 bg-panel-header/50 p-2.5 shrink-0">
                <div className="flex items-center justify-between mb-2 px-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-panel-text flex items-center gap-1">
                      <Layers size={11} /> Variations ({imagesList.length})
                    </span>
                    {activeVariantIdx >= 0 && (
                      <span className="text-[9px] font-mono font-medium px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        V{activeVariantIdx + 1} Active
                      </span>
                    )}
                  </div>

                  {/* Explicit Action Buttons for the Active/Selected Variant */}
                  {activeScene?.image_path && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => handlePinVariantAsRef(activeScene.image_path!, e)}
                        className="px-2 py-0.5 rounded text-[9.5px] font-medium text-panel-text hover:text-foreground bg-zinc-200/50 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-750 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Pin active frame as reference image for Flow Copilot"
                      >
                        <Pin size={9} />
                        <span>Pin as Ref</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteVariant(activeScene.image_path!, e)}
                        className="px-2 py-0.5 rounded text-[9.5px] font-medium text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Delete active variant"
                      >
                        <Trash2 size={9} />
                        <span>Delete Variant</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Safe Thumbnail List (Clicking thumbnail ALWAYS ticks it safely) */}
                <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar py-0.5">
                  {imagesList.map((variantPath, vIdx) => {
                    const isActiveVariant = activeScene.image_path === variantPath;
                    return (
                      <div
                        key={vIdx}
                        onClick={() => handleSetActiveVariant(variantPath)}
                        className={`relative group shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                          isActiveVariant 
                            ? "border-emerald-500 shadow-xs ring-2 ring-emerald-500/30" 
                            : "border-border/70 hover:border-zinc-400 opacity-75 hover:opacity-100"
                        }`}
                        title={`Click to activate Variant ${vIdx + 1}`}
                      >
                        <img 
                          src={`http://localhost:8000/static/${variantPath}?t=${cacheBuster}`} 
                          alt={`Variant ${vIdx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        
                        {/* Variant Number Tag */}
                        <div className="absolute bottom-0.5 left-0.5 px-1 py-0.2 rounded bg-black/70 text-white text-[8px] font-mono">
                          V{vIdx + 1}
                        </div>

                        {/* Active Selection Checkmark Badge */}
                        {isActiveVariant ? (
                          <div className="absolute top-0.5 right-0.5 bg-emerald-500 text-white rounded-full p-0.5 shadow-xs">
                            <Check size={8} strokeWidth={3} />
                          </div>
                        ) : (
                          /* Micro delete button strictly in corner, non-overlapping with main thumbnail area */
                          <button
                            type="button"
                            onClick={(e) => handleDeleteVariant(variantPath, e)}
                            className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/60 hover:bg-red-600 text-white/80 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                            title={`Delete V${vIdx + 1}`}
                          >
                            <Trash2 size={8} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* Bottom Action Buttons */}
          <div className="flex gap-2 shrink-0 h-9">
            {activeScene?.image_status === "processing" ? (
              <button 
                type="button"
                onClick={handleStop}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[12px] font-medium shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <X size={13} />
                <span>Stop Rendering</span>
              </button>
            ) : (
              <button 
                type="button"
                onClick={handleGenerateFrame}
                disabled={isGenerating || !activeScene}
                className="flex-1 bg-primary hover:bg-primary-hover text-white rounded-xl text-[12px] font-semibold shadow-2xs transition-all flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
              >
                {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                <span>{isGenerating ? "Rendering..." : `Generate Frame (${imageProvider === "flow" ? "Flow" : "Local"})`}</span>
              </button>
            )}

            <button 
              type="button"
              onClick={handleTrashAll}
              disabled={isGenerating || !activeScene || !activeScene.image_path}
              className="bg-card border border-border/70 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 px-3 rounded-xl text-panel-text hover:border-red-300 dark:hover:border-red-800 transition-all flex items-center justify-center disabled:opacity-30 cursor-pointer"
              title="Clear Active Frame for this Scene"
            >
              <Trash2 size={13} />
            </button>
          </div>

        </div>

      </div>

      {/* ========================================================= */}
      {/* LIGHTBOX ZOOM MODAL WINDOW                                */}
      {/* ========================================================= */}
      {isZoomed && activeScene?.image_path && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-6 animate-in fade-in duration-150"
          onClick={() => setIsZoomed(false)}
        >
          <button 
            type="button"
            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer"
            onClick={() => setIsZoomed(false)}
          >
            <X size={18} />
          </button>
          <img 
            src={`http://localhost:8000/static/${activeScene.image_path}?t=${cacheBuster}`} 
            alt={`Scene ${activeScene.scene_number} Fullscreen`} 
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

    </div>
  );
}
