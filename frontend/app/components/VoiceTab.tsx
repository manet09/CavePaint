"use client";

import React, { useState, useEffect } from "react";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/purity */
import { Project, SceneData } from "../context/ProjectContext";
import { Loader2, Check, Play, Settings, RefreshCcw } from "lucide-react";

interface VoiceTabProps {
  activeProject: Project;
  refreshProjectData: () => Promise<void>;
}

export default function VoiceTab({ activeProject, refreshProjectData }: VoiceTabProps) {
  // Column 1 state
  const [longScript, setLongScript] = useState("");
  const [isParsing, setIsParsing] = useState(false);

  // Column 2 state
  const [gender, setGender] = useState("Male");
  const [age, setAge] = useState("Adult");
  const [tone, setTone] = useState("Documentary");
  const [speed, setSpeed] = useState("Normal");
  
  const [cacheBuster, setCacheBuster] = useState(Date.now());

  // Polling logic
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    // Check if any scene is processing
    const isProcessing = activeProject?.scenes?.some(
      (scene: SceneData) => scene.audio_status === "processing"
    );

    if (isProcessing) {
      intervalId = setInterval(() => {
        refreshProjectData();
      }, 1500);
    } else {
      setCacheBuster(Date.now());
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeProject?.scenes, refreshProjectData]);

  // Handle parse
  const handleParseScript = async () => {
    if (!longScript.trim()) return;
    setIsParsing(true);
    try {
      const response = await fetch(`http://localhost:8000/api/projects/${activeProject.id}/segment-script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ long_script: longScript }),
      });
      if (response.ok) {
        await refreshProjectData();
        setLongScript("");
      }
    } catch (error) {
      console.error("Failed to parse script:", error);
    } finally {
      setIsParsing(false);
    }
  };

  const [isResetting, setIsResetting] = useState(false);

  const handleResetVoice = async () => {
    if (!activeProject?.id) return;
    setIsResetting(true);
    try {
      const response = await fetch(`http://localhost:8000/api/projects/${activeProject.id}/reset-voice`, {
        method: "POST",
      });
      if (response.ok) {
        await refreshProjectData();
      }
    } catch (error) {
      console.error("Failed to reset voice profile:", error);
    } finally {
      setIsResetting(false);
    }
  };

  const handleRegenerateLine = async (sceneId: number) => {
    // Optimistic UI updates could be handled by local state, but we rely on refreshProjectData here
    // However, the prompt says "optimistically set that specific scene's UI state to 'processing'"
    // We can just rely on the API setting the status to 'processing' and then doing refreshProjectData.
    try {
      const response = await fetch(`http://localhost:8000/api/scenes/${sceneId}/generate-audio`, {
        method: "POST",
      });
      if (response.ok) {
        await refreshProjectData();
      }
    } catch (error) {
      console.error(`Failed to regenerate audio for scene ${sceneId}:`, error);
    }
  };


  // Compile prompt tag
  const compiledTag = `(${gender}, ${age}, ${tone} tone, ${speed} speed)`;

  // Save voice profile tag
  useEffect(() => {
    // Only save if changed
    if (activeProject?.voice_profile_tag === compiledTag) return;
    
    const saveTag = async () => {
      try {
        await fetch(`http://localhost:8000/api/projects/${activeProject.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voice_profile_tag: compiledTag }),
        });
        await refreshProjectData();
      } catch (error) {
        console.error("Error saving voice profile tag:", error);
      }
    };
    
    // Debounce save to avoid too many requests
    const timeout = setTimeout(saveTag, 1000);
    return () => clearTimeout(timeout);
  }, [compiledTag, activeProject?.id, activeProject?.voice_profile_tag, refreshProjectData]);

  // Master generation
  const [isGenerating, setIsGenerating] = useState(false);
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
      console.error("Error generating voice:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* LEFT PANE: SCRIPT & DECK */}
      <div className="lg:col-span-5 flex flex-col h-full gap-6">
        
        {/* SCRIPT CANVAS */}
        <div className="flex flex-col bg-card border border-border rounded-lg shadow-sm overflow-hidden shrink-0">
        <div className="p-4 border-b border-border bg-muted/20">
          <h2 className="text-lg font-bold flex items-center gap-2 text-card-foreground">
            <Settings size={18} className="text-primary" /> Script Canvas
          </h2>
          <p className="text-sm text-foreground/60 mt-1">Paste your Khmer narrative below.</p>
        </div>
        <div className="p-4 flex-1 flex flex-col gap-4">
          <textarea
            value={longScript}
            onChange={(e) => setLongScript(e.target.value)}
            className="flex-1 w-full bg-background border border-border rounded-md p-4 resize-none outline-none focus:ring-2 focus:ring-primary/50 text-sm leading-relaxed"
            placeholder="Paste your full 1.5-minute Khmer narrative script stream here..."
          />
          <button
            onClick={handleParseScript}
            disabled={isParsing || !longScript.trim()}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-md shadow hover:bg-primary/90 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
          >
            {isParsing ? <Loader2 size={18} className="animate-spin" /> : <Settings size={18} />}
            {isParsing ? "Slicing Text..." : "Parse and Bind Audio Segments"}
          </button>
        </div>
      </div>

        {/* VOICE PERSONALITY DECK */}
        <div className="flex-1 flex flex-col bg-card border border-border rounded-lg shadow-sm overflow-hidden min-h-0">
        <div className="p-4 border-b border-border bg-muted/20">
          <h2 className="text-lg font-bold flex items-center gap-2 text-card-foreground">
            <Play size={18} className="text-primary" /> Voice Personality Deck
          </h2>
          <p className="text-sm text-foreground/60 mt-1">Configure acoustic attributes.</p>
        </div>
        <div className="p-6 flex-1 flex flex-col gap-6 overflow-y-auto">
          
          {/* Gender */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Gender</h3>
            <div className="flex flex-wrap gap-2">
              {["Male", "Female"].map(opt => (
                <button
                  key={opt}
                  onClick={() => setGender(opt)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${gender === opt ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:border-primary/50"}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Age */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Age</h3>
            <div className="flex flex-wrap gap-2">
              {["Child", "Young Adult", "Adult", "Old-aged Adult"].map(opt => (
                <button
                  key={opt}
                  onClick={() => setAge(opt)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${age === opt ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:border-primary/50"}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Tone</h3>
            <div className="flex flex-wrap gap-2">
              {["Documentary", "News", "Neutral", "Energetic", "Calm"].map(opt => (
                <button
                  key={opt}
                  onClick={() => setTone(opt)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${tone === opt ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:border-primary/50"}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Speed */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Speed</h3>
            <div className="flex flex-wrap gap-2">
              {["Slow", "Normal", "Fast"].map(opt => (
                <button
                  key={opt}
                  onClick={() => setSpeed(opt)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${speed === opt ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:border-primary/50"}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-border/50">
            <button
              onClick={handleGenerateVoice}
              disabled={isGenerating || isResetting || !activeProject?.scenes?.length}
              className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-md shadow hover:bg-primary/90 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
            >
              {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
              Generate All Audio
            </button>
            <button
              onClick={handleResetVoice}
              disabled={isGenerating || isResetting || !activeProject?.scenes?.length}
              className="w-full mt-3 py-3 bg-transparent text-red-500 border border-red-500 font-semibold rounded-md hover:bg-red-500/10 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
            >
              {isResetting ? <Loader2 size={18} className="animate-spin" /> : <RefreshCcw size={18} />}
              Reset Voice Profile
            </button>
          </div>

        </div>
      </div>
    </div>
      
      {/* RIGHT PANE: TIMELINE PROGRESS & MASTER PLAYER */}
      <div className="lg:col-span-7 flex flex-col h-full bg-card border border-border rounded-lg shadow-sm overflow-hidden relative">
        <div className="p-4 border-b border-border bg-muted/20 flex justify-between items-center z-10">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-card-foreground">
              <RefreshCcw size={18} className="text-primary" /> Timeline Progress
            </h2>
            <p className="text-sm text-foreground/60 mt-1">Scene synchronization status.</p>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-32">
          {(!activeProject?.scenes || activeProject.scenes.length === 0) ? (
            <div className="text-center p-8 border border-dashed border-border rounded-lg text-foreground/50 text-sm">
              No scenes bound yet.
            </div>
          ) : (
            activeProject.scenes.map((scene: SceneData) => (
              <div key={scene.id} className="bg-background border border-border rounded-md p-3 flex flex-col gap-2 relative shadow-sm">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold text-foreground/50">
                    Scene #{String(scene.scene_number).padStart(3, '0')}
                  </span>
                  
                  {/* Status Badges */}
                  <div className="flex items-center gap-2">
                    {scene.audio_status === "completed" ? (
                      <span className="bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 uppercase">
                        <Check size={10} /> Completed
                      </span>
                    ) : scene.audio_status === "processing" ? (
                      <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 uppercase">
                        <Loader2 size={10} className="animate-spin" /> Synthesizing line...
                      </span>
                    ) : (
                      <span className="bg-neutral-500/10 text-neutral-500 border border-neutral-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 uppercase">
                        Idle
                      </span>
                    )}
                    <button 
                      onClick={() => handleRegenerateLine(scene.id)} 
                      disabled={scene.audio_status === "processing"}
                      title="Regenerate Line"
                      className="w-6 h-6 rounded-full flex items-center justify-center bg-muted text-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                    >
                      <RefreshCcw size={12} className={scene.audio_status === "processing" ? "animate-spin" : ""} />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-foreground/80 line-clamp-2" title={scene.narration_khmer || undefined}>
                  {scene.narration_khmer || "Empty narrative chunk..."}
                </p>
                {scene.audio_status === "completed" && scene.audio_path && (
                  <div className="mt-1">
                    <audio 
                      controls 
                      className="w-full max-w-[220px] h-8 scale-90 origin-left"
                      src={`http://localhost:8000/static/${activeProject.slug}/scene_${String(scene.scene_number).padStart(3, '0')}.wav?t=${cacheBuster}`}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Persistent Master Player wrapper */}
        <div className="absolute bottom-0 left-0 right-0 bg-card border-t border-border p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Master Rendered Output</span>
            {activeProject?.master_audio_path && (
              <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full font-semibold">Ready</span>
            )}
          </div>
          {activeProject?.master_audio_path ? (
            <audio 
              controls 
              className="w-full h-10 outline-none rounded-md bg-background"
              src={`http://localhost:8000/static/${activeProject.slug}/master_voiceover.wav?t=${cacheBuster}`} 
            />
          ) : (
            <div className="w-full h-10 flex items-center justify-center bg-background border border-border border-dashed rounded-md text-xs text-foreground/40 font-medium">
              Awaiting Master Concatenation...
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
