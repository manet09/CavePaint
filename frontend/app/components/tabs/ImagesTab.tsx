/* eslint-disable */
"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useProjectContext } from "../../context/ProjectContext";
import { 
  CornerDownLeft, 
  Image as ImageIcon, 
  Wand2, 
  Sparkles,
  Trash2, 
  Loader2, 
  Check, 
  Maximize2, 
  X, 
  CheckCircle2, 
  Upload, 
  Cpu, 
  Cloud, 
  Pin, 
  Plus, 
  Paperclip, 
  Layers,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  RotateCcw,
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

// Clean auto-resizing textarea with no internal scrollbars (matches Brainstorming tab)
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

  // Derived variants list
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
          ? ` (referencing @${data.referenced_asset_name})`
          : (refToUse ? ` (referencing ${refToUse.split("/").pop()})` : "");

        setCopilotSummary((data.change_summary || "Flow adjustment queued.") + refNote);
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
  const handleDeleteVariant = async (variantPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
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
  const handlePinVariantAsRef = async (variantPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  return (
    <div className="flex flex-col h-[calc(100vh-56px-48px)] max-h-[calc(100vh-56px-48px)] animate-in fade-in duration-200 select-none">
      
      {/* ========================================================= */}
      {/* MAIN 2-COLUMN WORKSPACE (NO BOXES-IN-BOXES)               */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full flex-1 min-h-0 pt-1">
        
        {/* ======================================================= */}
        {/* LEFT COLUMN: SCENE DIRECTOR & COPILOT (lg:col-span-6)    */}
        {/* ======================================================= */}
        <div className="lg:col-span-6 flex flex-col h-full pr-1 min-h-0">
          
          {/* Header Bar: Scene Navigator & Quick Jump Pills */}
          <div className="h-8 shrink-0 flex items-center justify-between gap-3 mb-2">
            
            {/* Prev / Next & Active Scene Dropdown */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={activeSceneIndex <= 0}
                onClick={() => setActiveSceneIndex(prev => Math.max(0, prev - 1))}
                className="p-1 rounded-md border border-border/60 hover:bg-card text-panel-text hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Previous scene"
              >
                <ChevronLeft size={13} />
              </button>

              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border/70 rounded-lg shadow-2xs">
                <span className="text-[11.5px] font-bold text-primary tracking-wide">
                  Scene #{String(activeScene?.scene_number || activeSceneIndex + 1).padStart(2, "0")}
                </span>
                <span className="text-[10px] text-panel-text font-mono">
                  / {scenes.length}
                </span>
                {activeScene?.image_path ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 ml-0.5" title="Frame rendered" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-700 shrink-0 ml-0.5" title="No frame yet" />
                )}
              </div>

              <button
                type="button"
                disabled={activeSceneIndex >= scenes.length - 1}
                onClick={() => setActiveSceneIndex(prev => Math.min(scenes.length - 1, prev + 1))}
                className="p-1 rounded-md border border-border/60 hover:bg-card text-panel-text hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Next scene"
              >
                <ChevronRight size={13} />
              </button>
            </div>

            {/* Horizontal Quick Scene Jump Pills */}
            <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar max-w-[280px] py-0.5">
              {scenes.map((s: any, idx: number) => {
                const isSelected = activeSceneIndex === idx;
                const hasImage = !!s.image_path;
                return (
                  <button
                    key={s.id || idx}
                    type="button"
                    onClick={() => setActiveSceneIndex(idx)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-medium transition-all shrink-0 cursor-pointer ${
                      isSelected 
                        ? "bg-primary text-white shadow-2xs" 
                        : hasImage
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                          : "bg-card border border-border/60 text-panel-text hover:text-foreground hover:border-border"
                    }`}
                    title={`Scene #${idx + 1}${hasImage ? " (Rendered)" : ""}`}
                  >
                    #{idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Unboxed Scene Card */}
          {!activeScene ? (
            <div className="flex-1 bg-card rounded-xl border border-border/70 p-8 flex flex-col items-center justify-center text-center text-panel-text">
              <ImageIcon size={32} className="opacity-30 mb-2" />
              <p className="text-sm">No scenes found in project.</p>
              <p className="text-xs text-panel-text/60 mt-1">Add or import scenes in the Brainstorming tab.</p>
            </div>
          ) : (
            <div className="flex-1 bg-card rounded-xl p-4 border border-border/70 shadow-2xs flex flex-col justify-between overflow-hidden min-h-0">
              
              {/* Scrollable upper content: voiceover, prompt, exclusions, references */}
              <div className="overflow-y-auto custom-scrollbar space-y-3.5 pr-1 flex-1">
                
                {/* 1. Khmer Voiceover Script */}
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-[9px] font-semibold text-panel-text uppercase tracking-wider flex items-center gap-1">
                      <Volume2 size={10} className="text-panel-icon" />
                      Voiceover (Khmer)
                    </label>
                    <span className="text-[9px] text-panel-text/60">Auto-saves & syncs to Brainstorming</span>
                  </div>
                  <AutoResizeTextarea
                    defaultValue={activeScene.narration_khmer || ""}
                    onBlur={(val) => updateSingleScene(activeScene.id, { narration_khmer: val })}
                    placeholder="Khmer voiceover narration..."
                    className="w-full bg-transparent text-[13.5px] text-foreground leading-relaxed outline-none border-b border-border/30 focus:border-primary transition-colors py-1"
                  />
                </div>

                {/* 2. Stickman Visual Prompt (English) */}
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-[9px] font-semibold text-panel-text uppercase tracking-wider flex items-center gap-1">
                      <Sparkles size={10} className="text-panel-icon" />
                      Stickman Visual Prompt (English)
                    </label>
                    <span className="text-[9px] text-panel-text/60">2D Flat Vector Stickman Doodle</span>
                  </div>
                  <AutoResizeTextarea
                    defaultValue={activeScene.image_prompt_english || ""}
                    onBlur={(val) => updateSingleScene(activeScene.id, { image_prompt_english: val })}
                    placeholder="Stickman visual prompt in English..."
                    className="w-full bg-transparent font-mono text-[11px] text-foreground/85 leading-relaxed outline-none border-b border-border/30 focus:border-primary transition-colors py-1"
                  />
                </div>

                {/* 3. Negative Constraints / Exclusions (Collapsible) */}
                <div className="pt-1 border-t border-border/30">
                  <button
                    type="button"
                    onClick={() => setIsExclusionsExpanded(prev => !prev)}
                    className="flex items-center gap-1.5 text-[10px] font-medium text-panel-text hover:text-foreground cursor-pointer transition-colors py-0.5 w-full text-left"
                    title="Click to expand/collapse exclusions"
                  >
                    <ChevronRight 
                      size={11} 
                      className={`text-panel-text transition-transform duration-150 shrink-0 ${
                        isExclusionsExpanded ? "rotate-90 text-primary" : ""
                      }`} 
                    />
                    <span className="uppercase tracking-wider text-[9px] font-semibold text-panel-text">
                      Exclusions
                    </span>
                    {!isExclusionsExpanded && activeScene.negative_prompt && (
                      <span className="text-[10px] font-mono text-panel-text/60 truncate flex-1 ml-1">
                        — {activeScene.negative_prompt}
                      </span>
                    )}
                    {!isExclusionsExpanded && !activeScene.negative_prompt && (
                      <span className="text-[10px] text-panel-text/40 italic flex-1 ml-1">
                        (none)
                      </span>
                    )}
                  </button>

                  {isExclusionsExpanded && (
                    <div className="pt-1.5 pb-0.5 animate-in fade-in duration-100">
                      <AutoResizeTextarea
                        defaultValue={activeScene.negative_prompt || ""}
                        onBlur={(val) => updateSingleScene(activeScene.id, { negative_prompt: val })}
                        placeholder="e.g. text, words, labels, watermark, 3D, photorealistic, comic book detail..."
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
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 text-[10.5px] border border-border/60 font-mono"
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
              {/* TALK DIRECTLY TO FLOW (COPILOT ADJUSTMENT BAR)           */}
              {/* ======================================================= */}
              <div className="pt-3 border-t border-border/60 shrink-0 space-y-2">
                
                {/* Copilot Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Wand2 size={12} className="text-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      Talk Directly to Flow (Copilot)
                    </span>
                  </div>
                  <span className="text-[9px] text-panel-text/60">
                    Knows current prompt & Khmer script
                  </span>
                </div>

                {/* Copilot Feedback Banner (if recently run) */}
                {copilotSummary && (
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 flex items-start justify-between gap-2 animate-in fade-in duration-150">
                    <p className="text-[11px] text-foreground leading-relaxed">
                      <span className="font-bold text-primary mr-1">✓ Flow Copilot:</span>
                      {copilotSummary}
                    </p>
                    <button 
                      type="button" 
                      onClick={() => setCopilotSummary(null)} 
                      className="text-panel-text hover:text-foreground shrink-0 cursor-pointer p-0.5"
                    >
                      <X size={11} />
                    </button>
                  </div>
                )}

                {/* Active Reference Context for Copilot */}
                {(() => {
                  const effectiveRef = selectedRefImage !== undefined ? selectedRefImage : (activeScene.image_path || null);
                  const vIdx = effectiveRef ? imagesList.findIndex((p: string) => p === effectiveRef) : -1;
                  const filename = effectiveRef ? effectiveRef.split("/").pop() : "";

                  return effectiveRef ? (
                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-100/90 dark:bg-zinc-800/70 border border-emerald-500/30 text-[11px] animate-in fade-in duration-100">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <img 
                          src={`http://localhost:8000/static/${effectiveRef}?t=${cacheBuster}`}
                          alt="Reference thumbnail"
                          className="w-6 h-6 rounded-sm object-cover border border-emerald-500/40 shrink-0"
                        />
                        <div className="flex flex-col truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[10.5px]">
                              {vIdx >= 0 ? `Modifying V${vIdx + 1}` : "Modifying Image"}
                            </span>
                            <span className="text-[9.5px] text-panel-text/60 font-mono truncate max-w-[140px]" title={effectiveRef}>
                              {filename}
                            </span>
                          </div>
                          <span className="text-[9px] text-panel-text/70">
                            Flow will condition adjustments on this active frame
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedRefImage(null)}
                        className="px-2 py-0.5 rounded text-[9.5px] font-medium text-panel-text hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer ml-2"
                        title="Don't use image reference (generate text-to-image)"
                      >
                        Detach Ref
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-100/50 dark:bg-zinc-900/30 border border-border/50 text-[10.5px] text-panel-text/70">
                      <span className="text-[10px]">No reference image attached (Text-to-Image mode)</span>
                      {activeScene.image_path && (
                        <button
                          type="button"
                          onClick={() => setSelectedRefImage(activeScene.image_path)}
                          className="text-[10px] font-semibold text-primary hover:underline cursor-pointer"
                        >
                          Attach Active Image
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Copilot Input Box */}
                <div className="relative flex flex-col rounded-xl border border-border/80 bg-zinc-50/50 dark:bg-zinc-900/40 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
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
                    placeholder="Tell Flow what to adjust (e.g. 'Make the mammoth friendly, put stickman rider holding a torch, and update voiceover to match')..."
                    className="w-full px-3 pt-2 pb-1 bg-transparent text-[12.5px] text-foreground outline-none resize-none leading-relaxed placeholder:text-panel-text/50 custom-scrollbar disabled:opacity-50"
                  />

                  {/* Copilot Action Toolbar */}
                  <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-border/30 bg-card/60 rounded-b-xl">
                    <span className="text-[9.5px] text-panel-text/60 font-mono">
                      Shift+Enter for newline
                    </span>

                    <div className="flex items-center gap-1.5">
                      {/* Refine Text Only */}
                      <button
                        type="button"
                        disabled={!copilotInput.trim() || isCopilotRunning}
                        onClick={() => handleCopilotSubmit(false)}
                        className="px-2.5 py-1 rounded-lg text-[10.5px] font-medium text-panel-text hover:text-foreground hover:bg-zinc-200/50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors cursor-pointer"
                        title="Update prompt & script without generating image"
                      >
                        Refine Text Only
                      </button>

                      {/* Adjust & Generate Flow */}
                      <button
                        type="button"
                        disabled={!copilotInput.trim() || isCopilotRunning}
                        onClick={() => handleCopilotSubmit(true)}
                        className="px-3 py-1 rounded-lg bg-primary hover:bg-primary-hover text-white text-[10.5px] font-semibold flex items-center gap-1.5 shadow-2xs disabled:opacity-40 transition-all cursor-pointer"
                      >
                        {isCopilotRunning ? (
                          <>
                            <Loader2 size={11} className="animate-spin" />
                            <span>Adjusting...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={11} />
                            <span>Adjust & Generate (Flow)</span>
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
        {/* RIGHT COLUMN: RENDER STUDIO & VARIATIONS (lg:col-span-6) */}
        {/* ======================================================= */}
        <div className="lg:col-span-6 flex flex-col h-full pl-1 min-h-0 space-y-2.5">
          
          {/* Header Toolbar: Generation Parameters (Pill styling matching Brainstorming tab) */}
          <div className="h-8 shrink-0 flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar">
            
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Aspect Ratio Selector Pills */}
              <div className="flex items-center gap-0.5 bg-card border border-border/70 p-0.5 rounded-lg shadow-2xs">
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
                      className={`px-1.5 py-0.5 rounded-md text-[9.5px] font-mono flex items-center gap-1 transition-all cursor-pointer ${
                        isActive
                          ? "bg-primary text-white font-bold shadow-2xs"
                          : "text-panel-text hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                      title={`Aspect ratio ${ratio}`}
                    >
                      <AspectRatioGraphic ratio={ratio} />
                      <span>{ratio}</span>
                    </button>
                  );
                })}
              </div>

              {/* Flow Model Dropdown Pill */}
              {imageProvider === "flow" && (
                <select
                  value={flowModel}
                  onChange={(e) => setFlowModel(e.target.value as "nano2" | "nano-pro")}
                  className="px-2 py-1 bg-card border border-border/70 rounded-lg text-[10.5px] font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer"
                  title="Google Flow Image Model"
                >
                  <option value="nano2">Nano Banana 2 (Fast)</option>
                  <option value="nano-pro">Nano Banana Pro (Quality)</option>
                </select>
              )}

              {/* Batch Count Selector Pills */}
              {imageProvider === "flow" && (
                <div className="flex items-center gap-0.5 bg-card border border-border/70 p-0.5 rounded-lg shadow-2xs" title="Batch Generation Count">
                  <span className="text-[9.5px] font-mono px-1 text-panel-text">x</span>
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setImageCount(num)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium transition-all cursor-pointer ${
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
                  className={`px-2 py-0.5 rounded-md border text-[10px] font-medium flex items-center gap-1.5 shadow-2xs ${
                    flowStatus?.daemon_running 
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" 
                      : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
                  }`}
                  title={flowStatus?.daemon_running ? "MCP Daemon running on :8765" : "Run ./scripts/start_flow_daemon.sh"}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${flowStatus?.daemon_running ? "bg-emerald-500" : "bg-red-500"}`} />
                  <span>{flowStatus?.daemon_running ? ":8765" : "Offline"}</span>
                </div>
              )}

              {/* Hot-Swap Engine Toggle */}
              <button
                type="button"
                onClick={toggleImageEngine}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-medium transition-all flex items-center gap-1.5 border shadow-2xs cursor-pointer ${
                  imageProvider === "flow"
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/20"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                }`}
                title="Click to switch between Google Flow (MCP) and Local (Draw Things)"
              >
                {imageProvider === "flow" ? (
                  <>
                    <Cloud size={11} />
                    <span>Flow MCP</span>
                  </>
                ) : (
                  <>
                    <Cpu size={11} />
                    <span>Local</span>
                  </>
                )}
              </button>
            </div>

          </div>

          {/* Render Output Frame & Variations Container */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex-1 bg-card rounded-xl border transition-all shadow-2xs flex flex-col overflow-hidden min-h-0 relative ${
              isDraggingOver ? "border-primary ring-2 ring-primary/20" : "border-border/70"
            }`}
          >
            
            {/* Viewfinder Header Bar */}
            <div className="h-9 px-3.5 bg-panel-header/80 border-b border-border/70 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ImageIcon size={12} className="text-panel-icon" />
                <span className="text-[10px] font-semibold tracking-wider uppercase text-panel-text">
                  Render Output Frame
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Upload Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-2 py-0.5 rounded-md bg-zinc-200/60 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-[10px] font-medium text-foreground transition-colors flex items-center gap-1 cursor-pointer"
                  title="Directly upload an image file into this scene"
                >
                  {isUploading ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
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

                {/* Lightbox Zoom Button */}
                {activeScene?.image_path && (
                  <button
                    type="button"
                    onClick={() => setIsZoomed(true)}
                    className="p-1 rounded-md hover:bg-zinc-200/50 dark:hover:bg-zinc-800 text-panel-text hover:text-foreground transition-colors cursor-pointer"
                    title="Zoom in Lightbox"
                  >
                    <Maximize2 size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Viewport Canvas */}
            <div className="flex-1 flex items-center justify-center p-3 overflow-hidden relative min-h-0 bg-zinc-50/20 dark:bg-zinc-950/20">
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center text-center p-6 select-none animate-pulse">
                  <Loader2 size={26} className="mb-2.5 animate-spin text-primary opacity-80" />
                  <p className="text-[11px] uppercase tracking-widest font-bold text-foreground">
                    {imageProvider === "flow" ? "Rendering via Google Flow MCP..." : "Synthesizing frame locally..."}
                  </p>
                  <p className="text-[10px] text-panel-text/70 mt-1">
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
                <div className="flex flex-col items-center justify-center text-center p-6 select-none text-panel-text">
                  <ImageIcon size={30} className="mb-2 opacity-30" />
                  <p className="text-[11px] uppercase tracking-widest font-semibold text-panel-text">
                    No Render Output
                  </p>
                  <p className="text-[10px] text-panel-text/60 mt-1 max-w-[220px] leading-relaxed">
                    Click "Generate Frame", talk to Flow Copilot, or drop an image file here.
                  </p>
                </div>
              )}
            </div>

            {/* Variations Strip (Downstream Video Automation Ready) */}
            {imagesList.length > 0 && (
              <div className="border-t border-border/70 bg-panel-header/50 p-2.5 shrink-0">
                <div className="flex items-center justify-between mb-1.5 px-0.5">
                  <span className="text-[9.5px] uppercase font-bold text-panel-text flex items-center gap-1">
                    <Layers size={10} /> Variations ({imagesList.length})
                  </span>
                  <span className="text-[9px] text-panel-text/60">
                    Click thumbnail to select active timeline frame
                  </span>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar py-0.5">
                  {imagesList.map((variantPath, vIdx) => {
                    const isActiveVariant = activeScene.image_path === variantPath;
                    return (
                      <div
                        key={vIdx}
                        onClick={() => handleSetActiveVariant(variantPath)}
                        className={`relative group shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                          isActiveVariant 
                            ? "border-emerald-500 shadow-xs ring-2 ring-emerald-500/20" 
                            : "border-border/70 hover:border-zinc-400 opacity-75 hover:opacity-100"
                        }`}
                      >
                        <img 
                          src={`http://localhost:8000/static/${variantPath}?t=${cacheBuster}`}
                          alt={`Variant ${vIdx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        
                        {/* Variant Number Tag */}
                        <div className="absolute bottom-0.5 left-0.5 px-1 py-0.2 rounded bg-black/60 text-white text-[8px] font-mono">
                          V{vIdx + 1}
                        </div>

                        {/* Active Selection Checkmark */}
                        {isActiveVariant && (
                          <div className="absolute top-0.5 right-0.5 bg-emerald-500 text-white rounded-full p-0.5 shadow-xs">
                            <Check size={8} strokeWidth={3} />
                          </div>
                        )}
                        
                        {/* Hover Actions: Set as Ref or Delete */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => handlePinVariantAsRef(variantPath, e)}
                            className="p-1 rounded bg-white/20 hover:bg-white/40 text-white transition-colors cursor-pointer"
                            title="Use as Reference Image"
                          >
                            <Pin size={10} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteVariant(variantPath, e)}
                            className="p-1 rounded bg-red-500/50 hover:bg-red-600 text-white transition-colors cursor-pointer"
                            title="Delete this variation"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* Bottom Action Footer Bar */}
          <div className="flex gap-2.5 shrink-0 h-10">
            {activeScene?.image_status === "processing" ? (
              <button 
                type="button"
                onClick={handleStop}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[13px] font-medium shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <X size={14} />
                <span>Stop Rendering</span>
              </button>
            ) : (
              <button 
                type="button"
                onClick={handleGenerateFrame}
                disabled={isGenerating || !activeScene}
                className="flex-1 bg-primary hover:bg-primary-hover text-white rounded-xl text-[13px] font-semibold shadow-2xs transition-all flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
              >
                {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                <span>{isGenerating ? "Rendering..." : `Generate Frame (${imageProvider === "flow" ? "Flow" : "Local"})`}</span>
              </button>
            )}

            <button 
              type="button"
              onClick={handleTrashAll}
              disabled={isGenerating || !activeScene || !activeScene.image_path}
              className="bg-card border border-border/70 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 px-3.5 rounded-xl text-panel-text hover:border-red-300 dark:hover:border-red-800 transition-all flex items-center justify-center disabled:opacity-30 cursor-pointer"
              title="Clear Active Frame for this Scene"
            >
              <Trash2 size={14} />
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
