"use client";

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/purity */
import { Project, SceneData } from "../../context/ProjectContext";
import { Loader2, Check, Play, Pause, RefreshCcw, FileText, Volume2, AlertTriangle, Trash2, Upload, UploadCloud, Mic } from "lucide-react";

export interface Character {
  id: number;
  name: string;
  gender: string;
  personality_tag: string;
  audio_path: string;
  reference_text: string;
}

export interface CustomAudioPlayerRef {
  stop: () => void;
}

const CustomAudioPlayer = forwardRef<CustomAudioPlayerRef, { src: string, className?: string }>(({ src, className = "" }, ref) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useImperativeHandle(ref, () => ({
    stop: () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime(0);
      }
    }
  }));

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
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
    //
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
    <div className={`flex items-center gap-3 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white px-3 py-2 rounded-md ${className}`} onClick={(e) => e.stopPropagation()}>
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
});

CustomAudioPlayer.displayName = "CustomAudioPlayer";

interface VoiceTabProps {
  activeProject: Project;
  refreshProjectData: () => Promise<void>;
}

export default function VoiceTab({ activeProject, refreshProjectData }: VoiceTabProps) {

  // Left Panel Dual-Tab State
  const [activeTab, setActiveTab] = useState<"library" | "factory">("library");

  // Character Library State
  const [characters, setCharacters] = useState<Character[]>([]);
  const [genderFilter, setGenderFilter] = useState<"All" | "Male" | "Female">("All");
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);

  // Voice Factory Form State
  const [factoryMode, setFactoryMode] = useState<"design" | "clone">("design");
  const [newCharName, setNewCharName] = useState("");
  const [newCharRefText, setNewCharRefText] = useState("ភ្នំពេញគឺជាទីក្រុងធំនៃប្រទេសកម្ពុជា។");
  const [newCharFile, setNewCharFile] = useState<File | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [hasGeneratedPreview, setHasGeneratedPreview] = useState(false);
  const [previewCacheBuster, setPreviewCacheBuster] = useState(Date.now());
  const previewPlayerRef = useRef<CustomAudioPlayerRef>(null);

  // Column 2 state
  const [gender, setGender] = useState("Male");
  const [age, setAge] = useState("Adult");
  const [tone, setTone] = useState("Documentary");
  const [speed, setSpeed] = useState("Normal");
  
  const [cacheBuster, setCacheBuster] = useState(Date.now());
  const [localScriptNarrative, setLocalScriptNarrative] = useState("");
  const [modelState, setModelState] = useState("unloaded");

  // Hidden Audio for previewing characters
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const [previewingId, setPreviewingId] = useState<number | null>(null);

  const fetchCharacters = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/characters");
      if (res.ok) {
        const data = await res.json();
        setCharacters(data);
      }
    } catch (err) {
      console.error("Error fetching characters:", err);
    }
  };

  useEffect(() => {
    fetchCharacters();
  }, []);

  useEffect(() => {
    if (activeProject) {
      setLocalScriptNarrative(activeProject.script_narrative || "");
    }
  }, [activeProject, activeProject?.script_narrative]);

  const handleScriptNarrativeBlur = async () => {
    if (localScriptNarrative === (activeProject?.script_narrative || "")) return;
    try {
      await fetch(`http://localhost:8000/api/projects/${activeProject?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script_narrative: localScriptNarrative }),
      });
      if (refreshProjectData) await refreshProjectData();
    } catch {
      // fallback
    }
  };

  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncScript = async () => {
    if (!activeProject?.id) return;
    setIsSyncing(true);
    try {
      await fetch(`http://localhost:8000/api/projects/${activeProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script_narrative: localScriptNarrative }),
      });
      const response = await fetch(`http://localhost:8000/api/projects/${activeProject.id}/segment-script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ long_script: localScriptNarrative }),
      });
      if (response.ok) {
        await refreshProjectData();
      }
    } catch {
      //
    } finally {
      setIsSyncing(false);
    }
  };

  // Poll model status
  useEffect(() => {
    const fetchModelStatus = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/model/status");
        if (res.ok) {
          const data = await res.json();
          setModelState(data.state);
        }
      } catch {}
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
    } catch {
      //
    } finally {
      setIsResetting(false);
    }
  };

  const handleRegenerateLine = async (sceneId: number) => {
    try {
      const url = new URL(`http://localhost:8000/api/scenes/${sceneId}/generate-audio`);
      if (selectedCharacterId) {
        url.searchParams.append("character_id", selectedCharacterId.toString());
      }
      const response = await fetch(url.toString(), {
        method: "POST",
      });
      if (response.ok) {
        await refreshProjectData();
      }
    } catch {
      //
    }
  };

  const compiledTag = `(${gender}, ${age}, ${tone} tone, ${speed} speed)`;

  useEffect(() => {
    if (activeProject?.voice_profile_tag === compiledTag) return;
    const saveTag = async () => {
      try {
        await fetch(`http://localhost:8000/api/projects/${activeProject.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voice_profile_tag: compiledTag }),
        });
        await refreshProjectData();
      } catch {}
    };
    const timeout = setTimeout(saveTag, 1000);
    return () => clearTimeout(timeout);
  }, [compiledTag, activeProject?.id, activeProject?.voice_profile_tag, refreshProjectData]);

  const [isGenerating, setIsGenerating] = useState(false);
  const handleGenerateVoice = async () => {
    setIsGenerating(true);
    try {
      const url = new URL(`http://localhost:8000/api/projects/${activeProject.id}/generate-voice`);
      if (selectedCharacterId) {
        url.searchParams.append("character_id", selectedCharacterId.toString());
      }
      const response = await fetch(url.toString(), {
        method: "POST",
      });
      if (response.ok) {
        await refreshProjectData();
      }
    } catch {
      //
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStopVoice = async () => {
    try {
      await fetch(`http://localhost:8000/api/projects/${activeProject.id}/stop-voice`, { method: "POST" });
      await refreshProjectData();
    } catch {
      // failed
    }
  };

  // Character Library Actions
  const playPreview = (e: React.MouseEvent, char: Character) => {
    e.stopPropagation();
    if (previewAudioRef.current) {
      if (previewingId === char.id) {
        previewAudioRef.current.pause();
        setPreviewingId(null);
      } else {
        previewAudioRef.current.src = `http://localhost:8000/static/${char.audio_path}?t=${Date.now()}`;
        previewAudioRef.current.play();
        setPreviewingId(char.id);
      }
    }
  };

  const deleteCharacter = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      const res = await fetch(`http://localhost:8000/api/characters/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (selectedCharacterId === id) setSelectedCharacterId(null);
        await fetchCharacters();
      }
    } catch (err) {
      console.error("Failed to delete character:", err);
    }
  };

  const handleGeneratePreview = async () => {
    setIsGeneratingPreview(true);
    try {
      if (factoryMode === "design") {
        const res = await fetch("http://localhost:8000/api/characters/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gender,
            personality_tag: compiledTag,
            reference_text: newCharRefText
          })
        });
        if (res.ok) {
          setHasGeneratedPreview(true);
          setPreviewCacheBuster(Date.now());
        }
      } else {
        const formData = new FormData();
        formData.append("reference_text", newCharRefText);
        formData.append("text_to_speak", "ភ្នំពេញគឺជាទីក្រុងធំនៃប្រទេសកម្ពុជា។");
        if (newCharFile) {
          formData.append("audio_file", newCharFile);
        }
        const res = await fetch("http://localhost:8000/api/characters/preview-clone", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          setHasGeneratedPreview(true);
          setPreviewCacheBuster(Date.now());
        }
      }
    } catch {
      // failed
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleDeletePreview = async () => {
    if (previewPlayerRef.current) {
      previewPlayerRef.current.stop();
    }
    setHasGeneratedPreview(false);
    setPreviewCacheBuster(0);
    try {
      if (factoryMode === "design") {
        await fetch("http://localhost:8000/api/characters/preview", { method: "DELETE" });
      } else {
        await fetch("http://localhost:8000/api/characters/preview-clone", { method: "DELETE" });
      }
    } catch {
      // ignore error
    }
  };

  // Voice Factory Actions
  const [isSavingChar, setIsSavingChar] = useState(false);
  const handleSaveCharacter = async () => {
    if (!newCharName || !newCharRefText) return;
    if (factoryMode === "clone" && !newCharFile) return;

    setIsSavingChar(true);
    try {
      const formData = new FormData();
      formData.append("name", newCharName);
      formData.append("gender", gender);
      formData.append("personality_tag", factoryMode === "design" ? compiledTag : "Custom Clone");
      formData.append("reference_text", newCharRefText);
      
      if (factoryMode === "clone" && newCharFile) {
        formData.append("audio_file", newCharFile);
      }

      const res = await fetch("http://localhost:8000/api/characters", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setNewCharName("");
        setNewCharRefText("ភ្នំពេញគឺជាទីក្រុងធំនៃប្រទេសកម្ពុជា។");
        setNewCharFile(null);
        setHasGeneratedPreview(false);
        await fetchCharacters();
        setActiveTab("library");
      }
    } catch {
      // failed
    } finally {
      setIsSavingChar(false);
    }
  };

  const filteredCharacters = characters.filter(c => genderFilter === "All" || c.gender === genderFilter);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <audio ref={previewAudioRef} onEnded={() => setPreviewingId(null)} className="hidden" />
      
      {/* LEFT PANE: SCRIPT & TABS */}
      <div className="lg:col-span-5 flex flex-col h-full gap-6">
        
        {/* SCRIPT CANVAS */}
        <div className="bg-card rounded-xl border border-border flex flex-col h-60 overflow-hidden shrink-0 shadow-sm">
          <div className="bg-panel-header px-4 py-2 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-panel-text">
              <FileText size={14} className="text-panel-icon" /> Narrative Script (Khmer)
            </div>
            <button
              onClick={handleSyncScript}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-md shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
              Sync
            </button>
          </div>
          <textarea
            value={localScriptNarrative}
            onChange={(e) => setLocalScriptNarrative(e.target.value)}
            onBlur={handleScriptNarrativeBlur}
            className="flex-1 w-full p-3 bg-transparent resize-none outline-none text-xs font-sans text-foreground/80 sleek-scroll leading-relaxed"
            placeholder="No script narrative available."
          />
        </div>

        {/* TABS CONTAINER */}
        <div className="flex-1 flex flex-col bg-card border border-border rounded-xl shadow-sm overflow-hidden min-h-0">
          {/* Tab Header */}
          <div className="flex border-b border-border bg-panel-header">
            <button
              onClick={() => {
                if (previewPlayerRef.current) previewPlayerRef.current.stop();
                setHasGeneratedPreview(false);
                setActiveTab("library");
              }}
              className={`flex-1 py-3 text-xs font-semibold tracking-wide uppercase transition-colors ${activeTab === "library" ? "text-primary border-b-2 border-primary bg-background" : "text-foreground/60 hover:text-foreground"}`}
            >
              Character Library
            </button>
            <button
              onClick={() => {
                if (previewPlayerRef.current) previewPlayerRef.current.stop();
                setHasGeneratedPreview(false);
                setActiveTab("factory");
              }}
              className={`flex-1 py-3 text-xs font-semibold tracking-wide uppercase transition-colors ${activeTab === "factory" ? "text-primary border-b-2 border-primary bg-background" : "text-foreground/60 hover:text-foreground"}`}
            >
              Voice Factory
            </button>
          </div>

          <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto sleek-scroll">
            {activeTab === "library" && (
              <div className="flex flex-col gap-4 h-full">
                {/* Gender Filter */}
                <div className="flex gap-2">
                  {["All", "Male", "Female"].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setGenderFilter(opt as "All" | "Male" | "Female")}
                      className={`py-1 px-3 text-[10px] font-bold uppercase tracking-wider rounded-full border transition-all ${genderFilter === opt ? "bg-primary/10 border-primary text-primary" : "bg-background border-border/50 text-foreground/70 hover:border-primary/40"}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                
                {/* Character Grid */}
                <div className="grid grid-cols-2 gap-3 pb-20">
                  {filteredCharacters.length === 0 ? (
                    <div className="col-span-2 text-center text-xs text-foreground/50 py-8 border border-dashed border-border rounded-md">
                      No characters found in library.
                    </div>
                  ) : (
                    filteredCharacters.map(char => (
                      <div 
                        key={char.id}
                        onClick={() => setSelectedCharacterId(char.id)}
                        className={`relative group cursor-pointer flex items-center justify-between p-3 rounded-lg border transition-all ${selectedCharacterId === char.id ? "border-primary bg-primary/5 ring-1 ring-primary/50" : "border-border bg-background hover:border-primary/40"}`}
                      >
                        <div className="flex flex-col overflow-hidden pr-6">
                          <span className="text-xs font-bold text-foreground truncate">{char.name}</span>
                          <span className="text-[9px] text-foreground/50 uppercase tracking-wider truncate">{char.personality_tag}</span>
                        </div>
                        <div className="flex flex-col gap-1 absolute right-2">
                          <button 
                            onClick={(e) => playPreview(e, char)}
                            className="w-6 h-6 rounded-full flex items-center justify-center bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors"
                          >
                            {previewingId === char.id ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                          </button>
                          <button
                            onClick={(e) => deleteCharacter(e, char.id)}
                            className="w-6 h-6 rounded-full flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === "factory" && (
              <div className="flex flex-col gap-5 h-full pb-20">
                {/* Mode Toggle */}
                <div className="flex bg-zinc-200 dark:bg-zinc-800 p-1 rounded-lg">
                  <button
                    onClick={() => {
                      if (previewPlayerRef.current) previewPlayerRef.current.stop();
                      setHasGeneratedPreview(false);
                      setFactoryMode("design");
                    }}
                    className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${factoryMode === "design" ? "bg-white dark:bg-zinc-700 text-primary shadow-sm" : "text-foreground/50 hover:text-foreground"}`}
                  >
                    AI Voice Design
                  </button>
                  <button
                    onClick={() => {
                      if (previewPlayerRef.current) previewPlayerRef.current.stop();
                      setHasGeneratedPreview(false);
                      setFactoryMode("clone");
                    }}
                    className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${factoryMode === "clone" ? "bg-white dark:bg-zinc-700 text-primary shadow-sm" : "text-foreground/50 hover:text-foreground"}`}
                  >
                    Custom Clone
                  </button>
                </div>
                
                {/* Form Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-foreground/70 mb-1">Character Name</label>
                    <input 
                      type="text" 
                      value={newCharName}
                      onChange={(e) => setNewCharName(e.target.value)}
                      placeholder="e.g. Warm Narrator"
                      className="w-full bg-background border border-border rounded px-3 py-2 text-xs text-foreground outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-foreground/70 mb-1">Reference Text Spoken</label>
                    <input 
                      type="text" 
                      value={newCharRefText}
                      onChange={(e) => setNewCharRefText(e.target.value)}
                      placeholder="Exact transcript of the uploaded audio..."
                      className="w-full bg-background border border-border rounded px-3 py-2 text-xs text-foreground outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                {/* File Drop (Clone Mode Only) */}
                {factoryMode === "clone" && (
                  <div>
                    <label className="block text-xs text-foreground/70 mb-1">Upload Custom Voice Sample (.wav)</label>
                    {!newCharFile ? (
                      <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-border border-dashed rounded-lg cursor-pointer bg-background hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <UploadCloud size={20} className="text-foreground/40 mb-2" />
                          <p className="text-xs text-foreground/60 font-semibold">Click or drag audio file here</p>
                        </div>
                        <input type="file" accept=".wav" className="hidden" onChange={(e) => e.target.files && setNewCharFile(e.target.files[0])} />
                      </label>
                    ) : (
                      <div className="flex flex-col items-center justify-center w-full h-24 border-2 border-border border-dashed rounded-lg bg-zinc-50 dark:bg-zinc-900/50 relative">
                        <button 
                          type="button" 
                          onClick={() => setNewCharFile(null)}
                          className="absolute top-2 right-2 p-1.5 bg-red-500/10 text-red-500 rounded-md hover:bg-red-500 hover:text-white transition-colors z-10"
                          title="Remove file"
                        >
                          <Trash2 size={14} />
                        </button>
                        <UploadCloud size={20} className="text-primary/60 mb-2" />
                        <p className="text-xs text-foreground/80 font-semibold truncate max-w-[80%]">{newCharFile.name}</p>
                        <p className={`text-[10px] font-mono mt-1 ${newCharFile.size === 0 ? "text-red-500 font-bold" : "text-foreground/50"}`}>
                          {newCharFile.size === 0 ? "⚠️ FILE IS 0 BYTES (EMPTY)" : `${(newCharFile.size / 1024).toFixed(2)} KB`}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Legacy Selectors (Design Mode Only) */}
                {factoryMode === "design" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                    <h3 className="text-[10px] uppercase tracking-wider text-foreground/70 font-semibold mb-1">Gender</h3>
                    <div className="flex flex-wrap gap-1">
                      {["Male", "Female"].map(opt => (
                        <button key={opt} onClick={() => setGender(opt)} className={`py-1 px-2 text-[10px] font-mono rounded border transition-all ${gender === opt ? "bg-primary/5 border-primary text-primary" : "bg-background border-border/50 text-foreground/70 hover:border-primary/40"}`}>{opt}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-[10px] uppercase tracking-wider text-foreground/70 font-semibold mb-1">Age</h3>
                    <div className="flex flex-wrap gap-1">
                      {["Child", "Young Adult", "Adult", "Elderly"].map(opt => (
                        <button key={opt} onClick={() => setAge(opt)} className={`py-1 px-2 text-[10px] font-mono rounded border transition-all ${age === opt ? "bg-primary/5 border-primary text-primary" : "bg-background border-border/50 text-foreground/70 hover:border-primary/40"}`}>{opt}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-[10px] uppercase tracking-wider text-foreground/70 font-semibold mb-1">Tone</h3>
                    <div className="flex flex-wrap gap-1">
                      {["Documentary", "News", "Neutral", "Energetic"].map(opt => (
                        <button key={opt} onClick={() => setTone(opt)} className={`py-1 px-2 text-[10px] font-mono rounded border transition-all ${tone === opt ? "bg-primary/5 border-primary text-primary" : "bg-background border-border/50 text-foreground/70 hover:border-primary/40"}`}>{opt}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-[10px] uppercase tracking-wider text-foreground/70 font-semibold mb-1">Speed</h3>
                    <div className="flex flex-wrap gap-1">
                      {["Slow", "Normal", "Fast"].map(opt => (
                        <button key={opt} onClick={() => setSpeed(opt)} className={`py-1 px-2 text-[10px] font-mono rounded border transition-all ${speed === opt ? "bg-primary/5 border-primary text-primary" : "bg-background border-border/50 text-foreground/70 hover:border-primary/40"}`}>{opt}</button>
                      ))}
                    </div>
                  </div>
                </div>
                )}

                {/* Workflow Actions */}
                <div className="mt-auto flex flex-col gap-2 pt-4">
                  {hasGeneratedPreview && (
                    <CustomAudioPlayer 
                      ref={previewPlayerRef}
                      src={factoryMode === "design" 
                        ? `http://localhost:8000/static/shared_characters/temp_preview.wav?t=${previewCacheBuster}`
                        : `http://localhost:8000/static/custom_voices/temp_clone_preview.wav?t=${previewCacheBuster}`
                      }
                      className="w-full mb-2"
                    />
                  )}
                  <div className="flex flex-row gap-2">
                    <button
                      onClick={handleGeneratePreview}
                      disabled={isGeneratingPreview || !newCharRefText || (factoryMode === "clone" && (!newCharFile || newCharFile.size === 0))}
                      className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[10px] font-bold uppercase tracking-wider rounded shadow-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
                    >
                      {isGeneratingPreview ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />}
                      Generate Audition Sample
                    </button>
                    <button
                      onClick={handleDeletePreview}
                      disabled={!hasGeneratedPreview}
                      className="flex-1 py-2.5 bg-transparent border border-red-500/50 text-red-500 text-[10px] font-bold uppercase tracking-wider rounded shadow-sm hover:bg-red-500/10 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
                    >
                      <Trash2 size={14} /> Delete Preview
                    </button>
                    <button
                      onClick={handleSaveCharacter}
                      disabled={isSavingChar || !newCharName || !newCharRefText || (factoryMode === "clone" && (!newCharFile || newCharFile.size === 0)) || !hasGeneratedPreview}
                      className="flex-1 py-2.5 bg-primary text-white hover:bg-primary-hover transition-colors font-medium uppercase tracking-wider rounded shadow-sm disabled:opacity-40 flex justify-center items-center gap-2 text-[10px]"
                    >
                      {isSavingChar ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} 
                      Save to Global Library
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Global Actions Bar at the bottom of the left pane */}
          <div className="p-4 border-t border-border/50 bg-background flex flex-col gap-2 mt-auto">
            <div className="flex gap-2">
              {!isAnySceneProcessing && !isGenerating ? (
                <button
                  onClick={handleGenerateVoice}
                  disabled={isResetting || !activeProject?.scenes?.length}
                  className="flex-[2] py-2 bg-zinc-800 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 text-xs font-semibold rounded shadow-sm hover:opacity-90 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
                >
                  <Play size={14} fill="currentColor" /> Generate All Lines
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
                Clear Audio
              </button>
            </div>
          </div>

        </div>
      </div>
      
      {/* RIGHT PANE: TIMELINE PROGRESS & MASTER PLAYER */}
      <div className="lg:col-span-7 flex flex-col h-full bg-card border border-border rounded-lg shadow-sm overflow-hidden relative">
        <div className="bg-panel-header px-4 py-2 border-b border-border flex justify-between items-center z-10">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-panel-text">
            <RefreshCcw size={14} className="text-panel-icon" /> Timeline Progress
          </div>
          <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              if (modelState === "loaded") {
                setModelState("unloading");
                await fetch("http://localhost:8000/api/model/unload", { method: "POST" });
              }
            }}
            disabled={modelState !== "loaded"}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-all ${
              modelState === "loaded"
                ? "bg-green-500/10 border-green-500/30 text-green-600 hover:bg-green-500/20 cursor-pointer"
                : modelState === "loading"
                ? "bg-amber-500/10 border-amber-500/30 text-amber-600 cursor-default"
                : modelState === "unloading"
                ? "bg-red-500/10 border-red-500/30 text-red-600 cursor-default"
                : "bg-neutral-500/10 border-neutral-500/30 text-neutral-500 cursor-default"
            }`}
          >
            {(modelState === "loading" || modelState === "unloading") ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              <div className={`w-1.5 h-1.5 rounded-full ${modelState === "loaded" ? "bg-green-500" : "bg-neutral-500"}`} />
            )}
            VoxCPM2: {modelState}
          </button>
        </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-32">
          {(!activeProject?.scenes || activeProject.scenes.length === 0) ? (
            <div className="text-center p-8 border border-dashed border-border rounded-lg text-foreground/50 text-sm">
              No scenes bound yet.
            </div>
          ) : (
            activeProject.scenes.map((scene: SceneData) => (
                <div key={scene.id} className={`border rounded-md p-3 flex flex-col relative shadow-sm ${scene.audio_status === 'outdated' ? 'border-yellow-500/50 bg-yellow-500/5' : 'bg-background border-border'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-wider">
                        Scene #{String(scene.scene_number).padStart(3, '0')}
                      </span>
                      {/* Speaker Badge */}
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border inline-flex items-center gap-1 w-max ${scene.character_name ? 'bg-primary/10 text-primary border-primary/20' : 'bg-muted text-foreground/40 border-border'}`}>
                        🎙️ {scene.character_name || 'Unassigned Line'}
                      </span>
                    </div>
                    
                    {/* Status Badges */}
                    <div className="flex items-center gap-2">
                      {scene.audio_status === "completed" ? (
                        <span className="bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 uppercase">
                          <Check size={10} /> Completed
                        </span>
                      ) : scene.audio_status === "outdated" ? (
                        <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 uppercase">
                          <AlertTriangle size={10} /> Outdated (Regenerate)
                        </span>
                      ) : scene.audio_status === "processing" ? (
                        <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 uppercase">
                          <Loader2 size={10} className="animate-spin" /> Synthesizing...
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
                  {scene.audio_status === "outdated" && scene.audio_path && (
                    <div className="mt-2 opacity-60">
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
