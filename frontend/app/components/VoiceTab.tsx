/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect } from "react";
import { Project } from "../context/ProjectContext";
import { Cpu, ZapOff, AudioLines, Check, Loader2, Mic } from "lucide-react";

interface VoiceTabProps {
  activeProject: Project;
  refreshProjectData: () => Promise<void>;
}

interface SceneData {
  id?: number;
  scene_number?: number;
  narration_khmer?: string;
  audio_path?: string;
  audio_status?: string;
  [key: string]: unknown;
}

export default function VoiceTab({ activeProject, refreshProjectData }: VoiceTabProps) {
  const [isModelWarm, setIsModelWarm] = useState(false);
  const [isTogglingModel, setIsTogglingModel] = useState(false);
  
  const [globalVoiceStyle, setGlobalVoiceStyle] = useState(activeProject.voice_style || "");
  const [isSavingStyle, setIsSavingStyle] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setGlobalVoiceStyle(activeProject.voice_style || "");
  }, [activeProject.voice_style]);

  const handleToggleModel = async (action: "load" | "unload") => {
    setIsTogglingModel(true);
    try {
      const response = await fetch(`http://localhost:8000/api/model/${action}`, {
        method: "POST",
      });
      if (response.ok) {
        setIsModelWarm(action === "load");
      }
    } catch (error) {
      console.error(`Error ${action}ing model:`, error);
    } finally {
      setIsTogglingModel(false);
    }
  };

  const handleSaveStyle = async () => {
    setIsSavingStyle(true);
    setSaveSuccess(false);
    try {
      const response = await fetch(`http://localhost:8000/api/projects/${activeProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice_style: globalVoiceStyle }),
      });
      if (response.ok) {
        await refreshProjectData();
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (error) {
      console.error("Error saving global voice style:", error);
    } finally {
      setIsSavingStyle(false);
    }
  };

  const handleGenerateVoice = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(`http://localhost:8000/api/projects/${activeProject.id}/generate-voice`, {
        method: "POST",
      });
      if (response.ok) {
        await refreshProjectData();
      }
    } catch (error) {
      console.error("Error generating voiceover track:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const getAudioUrl = (path: string) => {
    if (!path) return "";
    const filename = path.split("/").pop() || path.split("\\").pop();
    return `http://localhost:8000/static/${filename}`;
  };

  return (
    <div className="flex flex-col gap-8 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Memory Lifecycle Banner */}
      <div className="bg-card border border-border rounded-lg p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-4 h-4">
            <div className={`absolute inset-0 rounded-full ${isModelWarm ? "bg-green-500 opacity-20 animate-ping" : "bg-neutral-500 opacity-20"}`}></div>
            <div className={`w-2.5 h-2.5 rounded-full ${isModelWarm ? "bg-green-500" : "bg-neutral-500"}`}></div>
          </div>
          <span className="font-semibold text-card-foreground">
            VoxCPM2 Status: <span className={isModelWarm ? "text-green-500" : "text-neutral-500"}>{isModelWarm ? "Warm & Ready" : "Cold / Standby"}</span>
          </span>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <button
            onClick={() => handleToggleModel("load")}
            disabled={isTogglingModel || isModelWarm}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white hover:bg-primary-hover rounded-md transition-colors text-sm font-medium disabled:opacity-50"
          >
            {isTogglingModel && !isModelWarm ? <Loader2 size={16} className="animate-spin" /> : <Cpu size={16} />}
            Load Model
          </button>
          <button
            onClick={() => handleToggleModel("unload")}
            disabled={isTogglingModel || !isModelWarm}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-neutral-800 text-neutral-400 hover:text-red-400 rounded-md transition-colors text-sm font-medium disabled:opacity-50"
          >
            {isTogglingModel && isModelWarm ? <Loader2 size={16} className="animate-spin" /> : <ZapOff size={16} />}
            Unload Model & Flush VRAM
          </button>
        </div>
      </div>

      {/* Global Voice Style Configuration */}
      <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
        <label className="flex items-center gap-2 text-sm font-semibold mb-3 text-card-foreground">
          <Mic size={16} className="text-primary" /> Global Voice Style Parameters
        </label>
        <div className="flex gap-4 items-center">
          <input
            type="text"
            value={globalVoiceStyle}
            onChange={(e) => setGlobalVoiceStyle(e.target.value)}
            onBlur={handleSaveStyle}
            className="flex-1 p-3 bg-background text-foreground border border-border bg-opacity-50 font-sans focus:border-primary focus:ring-1 focus:ring-primary outline-none rounded-md"
            placeholder="e.g. Deep male voice, authoritative, slow pacing, cinematic reverb"
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

      {/* Master Generation Controller */}
      <div className="flex justify-between items-center bg-background p-4 rounded-lg border border-border">
        <div>
          <h3 className="font-bold text-foreground">Sequential Text-to-Speech Engine</h3>
          <p className="text-sm text-foreground/60">Generate Khmer audio tracks for all scenes automatically.</p>
        </div>
        <button
          onClick={handleGenerateVoice}
          disabled={isGenerating || (!activeProject.scenes || activeProject.scenes.length === 0)}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-white hover:bg-primary-hover rounded-md transition-colors font-medium shadow-sm disabled:opacity-50"
        >
          {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <AudioLines size={20} />}
          {isGenerating ? "Queuing..." : "Compile Video Voiceover Track"}
        </button>
      </div>

      {/* Tracking List */}
      <div className="space-y-4">
        {(!activeProject.scenes || activeProject.scenes.length === 0) ? (
          <div className="text-center p-12 border border-dashed border-border rounded-lg text-foreground/50">
            No scenes available. Parse the script in the Overview tab first.
          </div>
        ) : (
          activeProject.scenes.map((scene: unknown, index: number) => {
            const sceneData = scene as SceneData;
            return (
            <div key={sceneData.id || index} className="bg-card border border-border rounded-lg p-5 flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <span className="font-bold text-sm tracking-wide text-foreground/50 mb-2 block">
                  Scene #{String(sceneData.scene_number || index + 1).padStart(2, '0')}
                </span>
                <p className="text-sm text-foreground/90 leading-relaxed font-medium">
                  {sceneData.narration_khmer || "No narration script provided."}
                </p>
              </div>
              
              <div className="w-full md:w-72 flex items-center justify-end border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6">
                {sceneData.audio_path ? (
                  <audio controls className="w-full h-10 outline-none rounded-full">
                    <source src={getAudioUrl(sceneData.audio_path)} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                ) : sceneData.audio_status === "pending" || sceneData.audio_status === "rendering" ? (
                  <div className="flex items-center gap-3 text-yellow-500 bg-yellow-500/10 px-4 py-2 rounded-lg w-full justify-center">
                    <Loader2 size={16} className={sceneData.audio_status === "rendering" ? "animate-spin" : ""} />
                    <span className="text-sm font-medium">{sceneData.audio_status === "rendering" ? "Rendering..." : "Pending"}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-foreground/30 text-sm justify-center w-full">
                    <AudioLines size={16} className="opacity-50" />
                    Awaiting trigger
                  </div>
                )}
              </div>
            </div>
            );
          })
        )}
      </div>

    </div>
  );
}
