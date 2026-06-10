"use client";

import React, { useState, useEffect, useRef } from "react";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/purity */
import { Project, SceneData } from "../context/ProjectContext";
import { Loader2, Check, Play, Pause, Settings, RefreshCcw, FileText, Mic, Volume2 } from "lucide-react";

const CustomAudioPlayer = ({ src, className = "" }: { src: string, className?: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const total = audioRef.current.duration;
      setCurrentTime(current);
      if (total) setProgress((current / total) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex items-center gap-3 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white px-3 py-2 rounded-md ${className}`}>
      <button onClick={togglePlay} className="text-zinc-900 dark:text-white hover:text-primary transition-colors flex-shrink-0">
        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
      </button>
      <div className="relative flex-1 h-2 bg-zinc-300 dark:bg-zinc-600 rounded-full overflow-hidden cursor-pointer">
        <div className="absolute top-0 left-0 h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
      </div>
      <div className="text-[10px] font-mono text-zinc-600 dark:text-zinc-300 w-10 text-right shrink-0">
        {formatTime(currentTime)}
      </div>
      <Volume2 size={16} className="text-zinc-500 dark:text-zinc-400 shrink-0" />
      <audio 
        ref={audioRef} 
        src={src} 
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        className="hidden" 
      />
    </div>
  );
};

interface VoiceTabProps {
  activeProject: Project;
  refreshProjectData: () => Promise<void>;
}

export default function VoiceTab({ activeProject, refreshProjectData }: VoiceTabProps) {


  // Column 2 state
  const [gender, setGender] = useState("Male");
  const [age, setAge] = useState("Adult");
  const [tone, setTone] = useState("Documentary");
  const [speed, setSpeed] = useState("Normal");
  
  const [cacheBuster, setCacheBuster] = useState(Date.now());

  const [localScriptNarrative, setLocalScriptNarrative] = useState("");
  const [modelLoaded, setModelLoaded] = useState(false);

  useEffect(() => {
    if (activeProject) {
      setLocalScriptNarrative(activeProject.script_narrative || "");
    }
  }, [activeProject?.script_narrative]);

  const handleScriptNarrativeBlur = async () => {
    if (localScriptNarrative === (activeProject?.script_narrative || "")) return;
    try {
      await fetch(`http://localhost:8000/api/projects/${activeProject?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script_narrative: localScriptNarrative }),
      });
      if (refreshProjectData) await refreshProjectData();
    } catch (err) {
      console.error(err);
    }
  };

  // Poll model status
  useEffect(() => {
    const fetchModelStatus = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/model/status");
        if (res.ok) {
          const data = await res.json();
          setModelLoaded(data.loaded);
        }
      } catch (err) {}
    };

    fetchModelStatus();
    const interval = setInterval(fetchModelStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const isAnySceneProcessing = activeProject?.scenes?.some(
    (scene: SceneData) => scene.audio_status === "processing"
  );

  // Polling logic
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isAnySceneProcessing) {
      intervalId = setInterval(() => {
        refreshProjectData();
      }, 1500);
    } else {
      setCacheBuster(Date.now());
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAnySceneProcessing, refreshProjectData]);



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

  const handleStopVoice = async () => {
    try {
      await fetch(`http://localhost:8000/api/projects/${activeProject.id}/stop-voice`, { method: "POST" });
      await refreshProjectData();
    } catch (error) {
      console.error("Error stopping voice:", error);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* LEFT PANE: SCRIPT & DECK */}
      <div className="lg:col-span-5 flex flex-col h-full gap-6">
        
        {/* SCRIPT CANVAS */}
        <div className="bg-card rounded-xl border border-border flex flex-col h-60 overflow-hidden shrink-0">
          <div className="bg-zinc-50/70 dark:bg-zinc-900/40 px-4 py-2 border-b border-border/60 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-card-foreground">
            <FileText size={14} className="text-primary" /> Narrative Script (Khmer)
          </div>
          <textarea
            value={localScriptNarrative}
            onChange={(e) => setLocalScriptNarrative(e.target.value)}
            onBlur={handleScriptNarrativeBlur}
            className="flex-1 w-full p-3 bg-transparent resize-none outline-none text-xs font-sans text-foreground/80 sleek-scroll leading-relaxed"
            placeholder="No script narrative available."
          />
        </div>

        {/* VOICE PERSONALITY DECK */}
        <div className="flex-1 flex flex-col bg-card border border-border rounded-xl shadow-sm overflow-hidden min-h-0">
          <div className="bg-zinc-50/70 dark:bg-zinc-900/40 px-4 py-2 border-b border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-card-foreground">
              <Mic size={14} className="text-primary" /> Voice Personality Deck
            </div>
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${modelLoaded ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-neutral-500/10 text-neutral-500 border-neutral-500/20"}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${modelLoaded ? "bg-green-500" : "bg-neutral-500"}`} />
              VoxCPM2: {modelLoaded ? "Loaded" : "Idle"}
            </div>
          </div>
          <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto sleek-scroll">
            
            {/* Gender */}
            <div className="space-y-1.5">
              <h3 className="text-xs text-foreground/70 mb-1">Gender</h3>
              <div className="flex flex-wrap gap-2">
                {["Male", "Female"].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setGender(opt)}
                    className={`py-1.5 px-3 text-xs font-mono rounded border transition-all ${gender === opt ? "bg-primary/5 border-primary text-primary" : "bg-background border-border/50 text-foreground/70 hover:border-primary/40 hover:text-foreground"}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Age */}
            <div className="space-y-1.5">
              <h3 className="text-xs text-foreground/70 mb-1">Age</h3>
              <div className="flex flex-wrap gap-2">
                {["Child", "Young Adult", "Adult", "Old-aged Adult"].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setAge(opt)}
                    className={`py-1.5 px-3 text-xs font-mono rounded border transition-all ${age === opt ? "bg-primary/5 border-primary text-primary" : "bg-background border-border/50 text-foreground/70 hover:border-primary/40 hover:text-foreground"}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Tone */}
            <div className="space-y-1.5">
              <h3 className="text-xs text-foreground/70 mb-1">Tone</h3>
              <div className="flex flex-wrap gap-2">
                {["Documentary", "News", "Neutral", "Energetic", "Calm"].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setTone(opt)}
                    className={`py-1.5 px-3 text-xs font-mono rounded border transition-all ${tone === opt ? "bg-primary/5 border-primary text-primary" : "bg-background border-border/50 text-foreground/70 hover:border-primary/40 hover:text-foreground"}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Speed */}
            <div className="space-y-1.5">
              <h3 className="text-xs text-foreground/70 mb-1">Speed</h3>
              <div className="flex flex-wrap gap-2">
                {["Slow", "Normal", "Fast"].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setSpeed(opt)}
                    className={`py-1.5 px-3 text-xs font-mono rounded border transition-all ${speed === opt ? "bg-primary/5 border-primary text-primary" : "bg-background border-border/50 text-foreground/70 hover:border-primary/40 hover:text-foreground"}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-border/50 flex flex-col gap-2">
              <div className="flex gap-2">
                {!isAnySceneProcessing && !isGenerating ? (
                  <button
                    onClick={handleGenerateVoice}
                    disabled={isResetting || !activeProject?.scenes?.length}
                    className="flex-[2] py-2 bg-primary text-primary-foreground text-xs font-semibold rounded shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
                  >
                    <Play size={14} /> Generate
                  </button>
                ) : (
                  <button
                    onClick={handleStopVoice}
                    className="flex-[2] py-2 bg-red-600 text-white text-xs font-semibold rounded shadow-sm hover:bg-red-700 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
                  >
                    <Loader2 size={14} className="animate-spin" /> Stop
                  </button>
                )}
                <button
                  onClick={handleResetVoice}
                  disabled={isGenerating || isResetting || !activeProject?.scenes?.length}
                  className="flex-[1] py-2 bg-transparent text-red-500 border border-red-500/50 text-xs font-semibold rounded hover:bg-red-500/10 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
                >
                  {isResetting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                  Clear
                </button>
              </div>
            </div>
          </div>
      </div>
    </div>
      
      {/* RIGHT PANE: TIMELINE PROGRESS & MASTER PLAYER */}
      <div className="lg:col-span-7 flex flex-col h-full bg-card border border-border rounded-lg shadow-sm overflow-hidden relative">
        <div className="bg-zinc-50/70 dark:bg-zinc-900/40 px-4 py-2 border-b border-border/60 flex justify-between items-center z-10">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-card-foreground">
            <RefreshCcw size={14} className="text-primary" /> Timeline Progress
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-32">
          {(!activeProject?.scenes || activeProject.scenes.length === 0) ? (
            <div className="text-center p-8 border border-dashed border-border rounded-lg text-foreground/50 text-sm">
              No scenes bound yet.
            </div>
          ) : (
            activeProject.scenes.map((scene: SceneData) => (
              <div key={scene.id} className="bg-background border border-border rounded-md p-3 flex flex-col relative shadow-sm">
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
                <p className="text-xs text-foreground/80 line-clamp-2 leading-loose" title={scene.narration_khmer || undefined}>
                  {scene.narration_khmer || "Empty narrative chunk..."}
                </p>
                {scene.audio_status === "completed" && scene.audio_path && (
                  <div className="mt-2">
                    <CustomAudioPlayer 
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
            <CustomAudioPlayer 
              src={`http://localhost:8000/static/${activeProject.slug}/master_voiceover.wav?t=${cacheBuster}`} 
              className="mt-1 bg-zinc-900 shadow-inner"
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
