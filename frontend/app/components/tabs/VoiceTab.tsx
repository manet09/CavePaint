/* eslint-disable */
"use client";

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useMemo } from "react";
import { useProjectContext } from "../../context/ProjectContext";
import { 
  Loader2, 
  Check, 
  Play, 
  Pause, 
  RefreshCw, 
  FileText, 
  Volume2, 
  VolumeX, 
  AlertTriangle, 
  Trash2, 
  Upload, 
  UploadCloud, 
  Mic, 
  Download, 
  Sparkles, 
  Users, 
  ChevronDown, 
  Music, 
  X,
  AudioLines,
  UserCheck,
  User,
  SlidersHorizontal
} from "lucide-react";

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
  play: () => void;
}

const DEFAULT_KHMER_PHRASE = "កាលពី ១ម៉ឺនឆ្នាំមុន មនុស្សសម័យបុរេប្រវត្តិ បានរកឃើញអាថ៌កំបាំងមួយយ៉ាងអស្ចារ្យ។";

// Auto-resizing textarea to display full scene detail with NO internal scrollbars
function AutoResizeTextarea({
  defaultValue,
  onBlur,
  className,
  placeholder,
}: {
  defaultValue: string;
  onBlur: (val: string) => void;
  className: string;
  placeholder?: string;
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

// Modern, sleek audio player with interactive scrubber and volume toggle
const ModernAudioPlayer = forwardRef<
  CustomAudioPlayerRef,
  { src: string; className?: string; compact?: boolean; autoPlay?: boolean; onEnded?: () => void }
>(({ src, className = "", compact = false, autoPlay = false, onEnded }, ref) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    stop: () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime(0);
      }
    },
    play: () => {
      if (audioRef.current) {
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  }));

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const cur = audioRef.current.currentTime;
      const dur = audioRef.current.duration || 0;
      setCurrentTime(cur);
      if (dur > 0) {
        setProgress((cur / dur) * 100);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const dur = audioRef.current.duration || 0;
      setDuration(dur);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    if (onEnded) onEnded();
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!audioRef.current || !progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const ratio = Math.max(0, Math.min(1, clickX / width));
    const newTime = ratio * (audioRef.current.duration || 0);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(ratio * 100);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div 
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-100/70 dark:bg-zinc-900/90 border border-border/50 select-none ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={togglePlay}
        className="w-6 h-6 rounded-md flex items-center justify-center bg-zinc-200/90 dark:bg-zinc-800 text-foreground hover:bg-primary hover:text-white border border-border/60 dark:border-white/10 transition-colors shrink-0 cursor-pointer shadow-2xs"
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause size={11} fill="currentColor" /> : <Play size={11} fill="currentColor" className="ml-0.5" />}
      </button>

      {/* Scrub Bar */}
      <div 
        ref={progressBarRef}
        onClick={handleSeek}
        className="relative flex-1 h-1.5 bg-zinc-300/70 dark:bg-zinc-800/90 rounded-full overflow-hidden cursor-pointer group border border-black/5 dark:border-white/5"
        title="Seek position"
      >
        <div 
          className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-75"
          style={{ width: `${progress}%` }} 
        />
      </div>

      {/* Time Display */}
      <div className="text-[9.5px] font-mono text-panel-text/80 shrink-0 min-w-[54px] text-right select-none">
        {formatTime(currentTime)}{duration > 0 && <span className="opacity-60">/{formatTime(duration)}</span>}
      </div>

      {/* Mute toggle */}
      {!compact && (
        <button
          type="button"
          onClick={toggleMute}
          className="text-panel-text hover:text-foreground p-0.5 rounded transition-colors cursor-pointer shrink-0"
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX size={12} className="text-red-500" /> : <Volume2 size={12} />}
        </button>
      )}

      <audio
        ref={audioRef}
        src={src}
        autoPlay={autoPlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        className="hidden"
      />
    </div>
  );
});

ModernAudioPlayer.displayName = "ModernAudioPlayer";

interface VoiceTabProps {
  activeProject?: any;
  refreshProjectData?: () => Promise<void>;
}

export default function VoiceTab({ activeProject, refreshProjectData }: VoiceTabProps) {
  const { updateActiveProject, updateSingleScene } = useProjectContext();

  // Navigation sub-tab in Voice Studio
  const [activeSubTab, setActiveSubTab] = useState<"factory" | "library" | "script">("factory");

  // Character Library State
  const [characters, setCharacters] = useState<Character[]>([]);
  const [genderFilter, setGenderFilter] = useState<"All" | "Male" | "Female">("All");
  const [selectedCharIdForProject, setSelectedCharIdForProject] = useState<number | null>(null);

  // Character Audition Audio Element
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const [previewingCharId, setPreviewingCharId] = useState<number | null>(null);

  // Voice Factory Form State
  const [factoryMode, setFactoryMode] = useState<"design" | "clone">("design");
  const [newCharName, setNewCharName] = useState("");
  const [newCharRefText, setNewCharRefText] = useState(DEFAULT_KHMER_PHRASE);
  const [newCharFile, setNewCharFile] = useState<File | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [hasGeneratedPreview, setHasGeneratedPreview] = useState(false);
  const [previewCacheBuster, setPreviewCacheBuster] = useState(Date.now());
  const factoryPlayerRef = useRef<CustomAudioPlayerRef>(null);

  // AI Voice Design parameter matrix
  const [gender, setGender] = useState("Male");
  const [age, setAge] = useState("Adult");
  const [tone, setTone] = useState("Documentary");
  const [speed, setSpeed] = useState("Normal");

  // Timeline & Playback states
  const [cacheBuster, setCacheBuster] = useState(Date.now());
  const [modelState, setModelState] = useState<string>("unloaded");
  const [timelineFilter, setTimelineFilter] = useState<"all" | "ready" | "pending" | "outdated">("all");

  // Dropdown states for per-scene character assignment popover
  const [openSceneSpeakerDropdown, setOpenSceneSpeakerDropdown] = useState<number | null>(null);
  const speakerDropdownRef = useRef<HTMLDivElement>(null);

  // Action states
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSavingChar, setIsSavingChar] = useState(false);
  const [isApplyingAll, setIsApplyingAll] = useState(false);

  // Full Script tab state
  const [scriptNarrativeText, setScriptNarrativeText] = useState("");
  const [isSyncingScript, setIsSyncingScript] = useState(false);

  // Fetch Characters
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

  // Poll VoxCPM2 Model status
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

  // Sync initial project data
  useEffect(() => {
    if (activeProject) {
      setScriptNarrativeText(activeProject.script_narrative || "");
    }
  }, [activeProject?.id, activeProject?.script_narrative]);

  // Click outside listener for speaker picker dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (speakerDropdownRef.current && !speakerDropdownRef.current.contains(e.target as Node)) {
        setOpenSceneSpeakerDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Check if any scene is currently processing audio
  const scenes = activeProject?.scenes || [];
  const isAnySceneProcessing = scenes.some((s: any) => s.audio_status === "processing");

  // Fast polling logic during audio generation
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (isAnySceneProcessing) {
      intervalId = setInterval(() => {
        if (refreshProjectData) refreshProjectData();
      }, 1500);
    } else {
      setCacheBuster(Date.now());
      setIsGeneratingAll(false);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAnySceneProcessing, refreshProjectData]);

  // Compiled tag
  const compiledTag = `(${gender}, ${age}, ${tone} tone, ${speed} speed)`;

  // Auto-sync compiled tag to activeProject if changed
  useEffect(() => {
    if (!activeProject?.id) return;
    if (activeProject.voice_profile_tag === compiledTag) return;
    const saveTag = async () => {
      try {
        await updateActiveProject({ voice_profile_tag: compiledTag });
      } catch {}
    };
    const timer = setTimeout(saveTag, 1000);
    return () => clearTimeout(timer);
  }, [compiledTag, activeProject?.id, activeProject?.voice_profile_tag]);

  // Handle format toggle (WAV | MP3)
  const currentFormat = (activeProject?.audio_format || "wav").toLowerCase();
  const handleFormatChange = async (newFormat: "wav" | "mp3") => {
    if (!activeProject?.id || currentFormat === newFormat) return;
    await updateActiveProject({ audio_format: newFormat });
    if (refreshProjectData) await refreshProjectData();
  };

  // Model load / unload toggle
  const handleToggleModel = async () => {
    if (modelState === "loaded") {
      setModelState("unloading");
      await fetch("http://localhost:8000/api/model/unload", { method: "POST" });
      setModelState("unloaded");
    } else if (modelState === "unloaded") {
      setModelState("loading");
      await fetch("http://localhost:8000/api/model/load", { method: "POST" });
      setModelState("loaded");
    }
  };

  // Generate Single Scene Audio
  const handleGenerateSingleLine = async (scene: any) => {
    if (!scene?.id) return;
    try {
      const url = new URL(`http://localhost:8000/api/scenes/${scene.id}/generate-audio`);
      if (scene.character_id) {
        url.searchParams.append("character_id", scene.character_id.toString());
      } else if (selectedCharIdForProject) {
        url.searchParams.append("character_id", selectedCharIdForProject.toString());
      }
      await fetch(url.toString(), { method: "POST" });
      if (refreshProjectData) await refreshProjectData();
    } catch (err) {
      console.error("Failed to generate scene audio:", err);
    }
  };

  // Delete Single Scene Audio
  const handleDeleteSingleLine = async (scene: any) => {
    if (!scene?.id) return;
    try {
      const res = await fetch(`http://localhost:8000/api/scenes/${scene.id}/audio`, { method: "DELETE" });
      if (res.ok && refreshProjectData) {
        await refreshProjectData();
      }
    } catch (err) {
      console.error("Failed to delete scene audio:", err);
    }
  };

  // Generate All Scenes Audio
  const handleGenerateAllLines = async () => {
    if (!activeProject?.id) return;
    setIsGeneratingAll(true);
    try {
      const url = new URL(`http://localhost:8000/api/projects/${activeProject.id}/generate-voice`);
      if (selectedCharIdForProject) {
        url.searchParams.append("character_id", selectedCharIdForProject.toString());
      }
      await fetch(url.toString(), { method: "POST" });
      if (refreshProjectData) await refreshProjectData();
    } catch (err) {
      console.error("Failed to generate project voice:", err);
      setIsGeneratingAll(false);
    }
  };

  // Stop Voice Generation
  const handleStopVoice = async () => {
    if (!activeProject?.id) return;
    try {
      await fetch(`http://localhost:8000/api/projects/${activeProject.id}/stop-voice`, { method: "POST" });
      if (refreshProjectData) await refreshProjectData();
    } catch (err) {
      console.error("Failed to stop voice:", err);
    }
  };

  // Reset Voice
  const handleResetVoice = async () => {
    if (!activeProject?.id) return;
    setIsResetting(true);
    try {
      const res = await fetch(`http://localhost:8000/api/projects/${activeProject.id}/reset-voice`, { method: "POST" });
      if (res.ok && refreshProjectData) {
        await refreshProjectData();
      }
    } catch (err) {
      console.error("Failed to reset voice:", err);
    } finally {
      setIsResetting(false);
    }
  };

  // Assign Character to specific scene
  const handleAssignSceneCharacter = async (sceneId: number, character: Character | null) => {
    setOpenSceneSpeakerDropdown(null);
    await updateSingleScene(sceneId, {
      character_id: character ? character.id : undefined,
      character_name: character ? character.name : undefined,
    });
  };

  // Apply a Character to ALL scenes at once
  const handleApplyCharacterToAll = async (character: Character | null) => {
    if (!activeProject?.id) return;
    setIsApplyingAll(true);
    try {
      const url = new URL(`http://localhost:8000/api/projects/${activeProject.id}/assign-character`);
      if (character) {
        url.searchParams.append("character_id", character.id.toString());
      }
      const res = await fetch(url.toString(), { method: "POST" });
      if (res.ok && refreshProjectData) {
        await refreshProjectData();
      }
    } catch (err) {
      console.error("Failed to assign character to all scenes:", err);
    } finally {
      setIsApplyingAll(false);
    }
  };

  // Audition Sample Generation in Factory
  const handleGenerateAudition = async () => {
    setIsGeneratingPreview(true);
    try {
      if (factoryMode === "design") {
        const res = await fetch("http://localhost:8000/api/characters/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gender,
            personality_tag: compiledTag,
            reference_text: newCharRefText,
          }),
        });
        if (res.ok) {
          setHasGeneratedPreview(true);
          setPreviewCacheBuster(Date.now());
        }
      } else {
        const formData = new FormData();
        formData.append("reference_text", newCharRefText);
        formData.append("text_to_speak", DEFAULT_KHMER_PHRASE);
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
    } catch (err) {
      console.error("Failed to generate audition preview:", err);
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  // Delete Audition Preview
  const handleDeleteAudition = async () => {
    if (factoryPlayerRef.current) factoryPlayerRef.current.stop();
    setHasGeneratedPreview(false);
    try {
      if (factoryMode === "design") {
        await fetch("http://localhost:8000/api/characters/preview", { method: "DELETE" });
      } else {
        await fetch("http://localhost:8000/api/characters/preview-clone", { method: "DELETE" });
      }
    } catch {}
  };

  // Save Character to Library
  const handleSaveCharacter = async () => {
    if (!newCharName.trim() || !newCharRefText.trim()) return;
    if (factoryMode === "clone" && !newCharFile) return;

    setIsSavingChar(true);
    try {
      const formData = new FormData();
      formData.append("name", newCharName.trim());
      formData.append("gender", gender);
      formData.append("personality_tag", factoryMode === "design" ? compiledTag : "Custom Clone");
      formData.append("reference_text", newCharRefText.trim());

      if (factoryMode === "clone" && newCharFile) {
        formData.append("audio_file", newCharFile);
      }

      const res = await fetch("http://localhost:8000/api/characters", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setNewCharName("");
        setNewCharFile(null);
        setHasGeneratedPreview(false);
        await fetchCharacters();
        setActiveSubTab("library");
      }
    } catch (err) {
      console.error("Failed to save character:", err);
    } finally {
      setIsSavingChar(false);
    }
  };

  // Character Library Audition
  const togglePlayCharacterSample = (char: Character) => {
    if (!previewAudioRef.current) return;
    if (previewingCharId === char.id) {
      previewAudioRef.current.pause();
      setPreviewingCharId(null);
    } else {
      previewAudioRef.current.src = `http://localhost:8000/static/${char.audio_path}?t=${Date.now()}`;
      previewAudioRef.current.play().catch(() => {});
      setPreviewingCharId(char.id);
    }
  };

  // Delete Character from Library
  const handleDeleteCharacter = async (charId: number) => {
    try {
      const res = await fetch(`http://localhost:8000/api/characters/${charId}`, { method: "DELETE" });
      if (res.ok) {
        if (previewingCharId === charId) setPreviewingCharId(null);
        await fetchCharacters();
      }
    } catch (err) {
      console.error("Failed to delete character:", err);
    }
  };

  // Filter characters by gender
  const filteredCharacters = useMemo(() => {
    return characters.filter((c) => genderFilter === "All" || c.gender === genderFilter);
  }, [characters, genderFilter]);

  // Filter scenes for timeline
  const filteredScenes = useMemo(() => {
    if (timelineFilter === "ready") return scenes.filter((s: any) => s.audio_status === "completed");
    if (timelineFilter === "pending") return scenes.filter((s: any) => s.audio_status !== "completed");
    if (timelineFilter === "outdated") return scenes.filter((s: any) => s.audio_status === "outdated");
    return scenes;
  }, [scenes, timelineFilter]);

  // Statistics
  const completedCount = scenes.filter((s: any) => s.audio_status === "completed").length;
  const outdatedCount = scenes.filter((s: any) => s.audio_status === "outdated").length;
  const pendingCount = scenes.length - completedCount;

  // Full Script Segmentation / Sync handler
  const handleSyncScriptNarrative = async () => {
    if (!activeProject?.id || !scriptNarrativeText.trim()) return;
    setIsSyncingScript(true);
    try {
      await updateActiveProject({ script_narrative: scriptNarrativeText });
      const res = await fetch(`http://localhost:8000/api/projects/${activeProject.id}/segment-script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ long_script: scriptNarrativeText }),
      });
      if (res.ok && refreshProjectData) {
        await refreshProjectData();
      }
    } catch (err) {
      console.error("Failed to sync script narrative:", err);
    } finally {
      setIsSyncingScript(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-56px-48px)] max-h-[calc(100vh-56px-48px)] animate-in fade-in duration-200 select-none overflow-hidden">
      {/* Hidden audio element for previewing character auditions in library */}
      <audio 
        ref={previewAudioRef} 
        onEnded={() => setPreviewingCharId(null)} 
        onError={() => setPreviewingCharId(null)}
        className="hidden" 
      />

      {/* ========================================================= */}
      {/* 2-COLUMN WORKSPACE: VOICE STUDIO | AUDIO TIMELINE        */}
      {/* ========================================================= */}
      <div className="flex gap-4 w-full flex-1 min-h-0 pt-0.5 overflow-hidden">

        {/* ======================================================= */}
        {/* COLUMN 1: VOICE & CHARACTER STUDIO (~400px)              */}
        {/* ======================================================= */}
        <div className="w-92 xl:w-100 shrink-0 flex flex-col h-full bg-card rounded-xl border border-border/70 shadow-2xs overflow-hidden">
          
          {/* Studio Navigation Tabs Header - Zero Border Glitch */}
          <div className="h-11 px-3 border-b border-border/70 flex items-center justify-between shrink-0 bg-panel-header/60">
            <div className="flex items-center gap-1.5 w-full bg-zinc-100/80 dark:bg-zinc-900/80 p-1 rounded-xl border border-border/60">
              <button
                type="button"
                onClick={() => {
                  if (factoryPlayerRef.current) factoryPlayerRef.current.stop();
                  setActiveSubTab("factory");
                }}
                className={`flex-1 py-1 px-2.5 rounded-lg text-[10.5px] font-bold uppercase tracking-wider transition-colors duration-150 flex items-center justify-center gap-1.5 cursor-pointer border ${
                  activeSubTab === "factory"
                    ? "bg-card text-primary shadow-2xs border-border/70 font-extrabold"
                    : "text-panel-text hover:text-foreground border-transparent"
                }`}
              >
                <Sparkles size={12} className={activeSubTab === "factory" ? "text-primary" : "text-panel-icon"} />
                <span>Voice Factory</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (factoryPlayerRef.current) factoryPlayerRef.current.stop();
                  setActiveSubTab("library");
                }}
                className={`flex-1 py-1 px-2.5 rounded-lg text-[10.5px] font-bold uppercase tracking-wider transition-colors duration-150 flex items-center justify-center gap-1.5 cursor-pointer border ${
                  activeSubTab === "library"
                    ? "bg-card text-primary shadow-2xs border-border/70 font-extrabold"
                    : "text-panel-text hover:text-foreground border-transparent"
                }`}
              >
                <Users size={12} className={activeSubTab === "library" ? "text-primary" : "text-panel-icon"} />
                <span>Library ({characters.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab("script")}
                className={`py-1 px-2 rounded-lg text-[10.5px] font-bold uppercase tracking-wider transition-colors duration-150 flex items-center justify-center gap-1 cursor-pointer border ${
                  activeSubTab === "script"
                    ? "bg-card text-primary shadow-2xs border-border/70 font-extrabold"
                    : "text-panel-text hover:text-foreground border-transparent"
                }`}
                title="View & Edit Full Narrative Script"
              >
                <FileText size={12} />
              </button>
            </div>
          </div>

          {/* SubTab Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 flex flex-col justify-between min-h-0">
            
            {/* ---------------------------------------------------- */}
            {/* SUBTAB 1: VOICE FACTORY                              */}
            {/* ---------------------------------------------------- */}
            {activeSubTab === "factory" && (
              <div className="flex flex-col h-full space-y-3.5">
                
                {/* Mode Switcher Pill - Crisp Dark Mode Segmented Control */}
                <div className="flex bg-zinc-100/90 dark:bg-zinc-900 p-1 rounded-xl border border-border/60 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (factoryPlayerRef.current) factoryPlayerRef.current.stop();
                      setHasGeneratedPreview(false);
                      setFactoryMode("design");
                    }}
                    className={`flex-1 py-1.5 text-[10.5px] font-bold uppercase tracking-wider rounded-lg transition-colors duration-150 cursor-pointer text-center border ${
                      factoryMode === "design"
                        ? "bg-card text-foreground shadow-2xs border-border/70 font-extrabold"
                        : "text-panel-text hover:text-foreground border-transparent"
                    }`}
                  >
                    AI Voice Design
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (factoryPlayerRef.current) factoryPlayerRef.current.stop();
                      setHasGeneratedPreview(false);
                      setFactoryMode("clone");
                    }}
                    className={`flex-1 py-1.5 text-[10.5px] font-bold uppercase tracking-wider rounded-lg transition-colors duration-150 cursor-pointer text-center border ${
                      factoryMode === "clone"
                        ? "bg-card text-foreground shadow-2xs border-border/70 font-extrabold"
                        : "text-panel-text hover:text-foreground border-transparent"
                    }`}
                  >
                    Custom Clone
                  </button>
                </div>

                {/* Profile Name & Reference Text Inputs */}
                <div className="space-y-2 shrink-0">
                  <div>
                    <label className="text-[9.5px] font-semibold uppercase tracking-wider text-panel-text block mb-1">
                      Voice Profile Name
                    </label>
                    <input
                      type="text"
                      value={newCharName}
                      onChange={(e) => setNewCharName(e.target.value)}
                      placeholder="e.g. Warm Narrator, Ancient Shaman..."
                      className="w-full px-2.5 py-1.5 text-xs bg-zinc-50/70 dark:bg-zinc-900/60 rounded-lg border border-border/70 text-foreground outline-none focus:border-primary transition-colors placeholder:text-panel-text/40"
                    />
                  </div>

                  <div>
                    <label className="text-[9.5px] font-semibold uppercase tracking-wider text-panel-text block mb-1">
                      Reference Text Spoken (Khmer)
                    </label>
                    <input
                      type="text"
                      value={newCharRefText}
                      onChange={(e) => setNewCharRefText(e.target.value)}
                      placeholder="Enter engaging Khmer sentence for audition sample..."
                      className="w-full px-2.5 py-1.5 text-xs bg-zinc-50/70 dark:bg-zinc-900/60 rounded-lg border border-border/70 text-foreground outline-none focus:border-primary transition-colors placeholder:text-panel-text/40"
                    />
                  </div>
                </div>

                {/* Mode A: AI Voice Design Parameter Grid - Beautifully Spaced & Sectioned */}
                {factoryMode === "design" && (
                  <div className="space-y-3.5 pt-1 overflow-y-auto custom-scrollbar flex-1 pr-0.5">
                    
                    {/* Card 1: Speaker Persona & Identity */}
                    <div className="p-3 rounded-xl bg-zinc-50/60 dark:bg-zinc-900/40 border border-border/60 space-y-3">
                      <div className="flex items-center gap-1.5 pb-1 border-b border-border/40">
                        <User size={12} className="text-primary" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                          Speaker Persona
                        </span>
                      </div>

                      {/* Gender Row */}
                      <div>
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-panel-text block mb-1.5">
                          Gender
                        </span>
                        <div className="flex gap-2">
                          {["Male", "Female"].map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setGender(opt)}
                              className={`flex-1 py-1.5 text-[10.5px] rounded-lg border transition-all duration-150 cursor-pointer ${
                                gender === opt
                                  ? "bg-primary/15 dark:bg-primary/20 border-primary/60 text-primary dark:text-blue-400 shadow-2xs ring-1 ring-primary/20 font-bold"
                                  : "bg-zinc-100/60 dark:bg-zinc-900/50 border-border/60 text-panel-text hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800/70 font-medium"
                              }`}
                            >
                              {opt === "Male" ? "👨 Male" : "👩 Female"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Age Archetype 2x2 Grid */}
                      <div>
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-panel-text block mb-1.5">
                          Age Archetype
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { id: "Child", label: "👶 Child" },
                            { id: "Young Adult", label: "🧑 Young Adult" },
                            { id: "Adult", label: "👨 Adult" },
                            { id: "Elderly", label: "👴 Elderly" }
                          ].map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setAge(item.id)}
                              className={`py-1.5 px-2 text-[10px] rounded-lg border transition-all duration-150 cursor-pointer truncate ${
                                age === item.id
                                  ? "bg-primary/15 dark:bg-primary/20 border-primary/60 text-primary dark:text-blue-400 shadow-2xs ring-1 ring-primary/20 font-bold"
                                  : "bg-zinc-100/60 dark:bg-zinc-900/50 border-border/60 text-panel-text hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800/70 font-medium"
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Delivery & Acoustic Cadence */}
                    <div className="p-3 rounded-xl bg-zinc-50/60 dark:bg-zinc-900/40 border border-border/60 space-y-3">
                      <div className="flex items-center gap-1.5 pb-1 border-b border-border/40">
                        <SlidersHorizontal size={12} className="text-primary" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                          Delivery & Cadence
                        </span>
                      </div>

                      {/* Acoustic Tone 2x2 Grid */}
                      <div>
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-panel-text block mb-1.5">
                          Acoustic Tone
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { id: "Documentary", label: "🎙️ Documentary" },
                            { id: "News", label: "📰 News / Anchor" },
                            { id: "Neutral", label: "💬 Neutral Story" },
                            { id: "Energetic", label: "⚡ Energetic" }
                          ].map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setTone(item.id)}
                              className={`py-1.5 px-2 text-[10px] rounded-lg border transition-all duration-150 cursor-pointer truncate ${
                                tone === item.id
                                  ? "bg-primary/15 dark:bg-primary/20 border-primary/60 text-primary dark:text-blue-400 shadow-2xs ring-1 ring-primary/20 font-bold"
                                  : "bg-zinc-100/60 dark:bg-zinc-900/50 border-border/60 text-panel-text hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800/70 font-medium"
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Cadence / Speed */}
                      <div>
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-panel-text block mb-1.5">
                          Cadence / Speed
                        </span>
                        <div className="flex gap-1.5">
                          {[
                            { id: "Slow", label: "🐢 Slow" },
                            { id: "Normal", label: "▶ Normal" },
                            { id: "Fast", label: "⚡ Fast" }
                          ].map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setSpeed(item.id)}
                              className={`flex-1 py-1.5 text-[10px] rounded-lg border transition-all duration-150 cursor-pointer ${
                                speed === item.id
                                  ? "bg-primary/15 dark:bg-primary/20 border-primary/60 text-primary dark:text-blue-400 shadow-2xs ring-1 ring-primary/20 font-bold"
                                  : "bg-zinc-100/60 dark:bg-zinc-900/50 border-border/60 text-panel-text hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800/70 font-medium"
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Voice Blueprint Summary Pill */}
                    <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between gap-2">
                      <div className="overflow-hidden flex-1 min-w-0">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-primary block truncate">
                          Blueprint: {gender} • {age} • {tone} Tone • {speed} Speed
                        </span>
                      </div>
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-extrabold px-1.5 py-0.2 rounded-full bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                        Ready
                      </span>
                    </div>

                  </div>
                )}

                {/* Mode B: Custom Clone Audio Uploader */}
                {factoryMode === "clone" && (
                  <div className="space-y-2 flex-1 pt-1">
                    <label className="text-[9.5px] font-semibold uppercase tracking-wider text-panel-text block">
                      Upload Reference Voice Sample (.wav)
                    </label>
                    {!newCharFile ? (
                      <label className="flex flex-col items-center justify-center w-full h-36 border border-dashed border-border/80 hover:border-primary/60 rounded-xl cursor-pointer bg-zinc-50/50 dark:bg-zinc-900/30 hover:bg-zinc-100/40 dark:hover:bg-zinc-850/40 transition-all p-4 text-center">
                        <UploadCloud size={28} className="text-panel-icon mb-2 opacity-70" />
                        <span className="text-xs font-semibold text-foreground">Click or drop .wav sample</span>
                        <span className="text-[10px] text-panel-text mt-1">Clean, single-speaker Khmer reference audio</span>
                        <input
                          type="file"
                          accept=".wav"
                          className="hidden"
                          onChange={(e) => e.target.files && setNewCharFile(e.target.files[0])}
                        />
                      </label>
                    ) : (
                      <div className="flex flex-col items-center justify-center w-full h-36 border border-border/80 rounded-xl bg-zinc-50/70 dark:bg-zinc-900/40 p-4 relative">
                        <button
                          type="button"
                          onClick={() => setNewCharFile(null)}
                          className="absolute top-2 right-2 p-1 text-panel-text hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors cursor-pointer"
                          title="Remove file"
                        >
                          <X size={13} />
                        </button>
                        <AudioLines size={28} className="text-primary mb-2 animate-pulse" />
                        <span className="text-xs font-semibold text-foreground truncate max-w-[85%]">{newCharFile.name}</span>
                        <span className="text-[9.5px] font-mono text-panel-text mt-1">
                          {(newCharFile.size / 1024).toFixed(1)} KB (.wav)
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Audition Sample Output Player */}
                {hasGeneratedPreview && (
                  <div className="space-y-1 shrink-0 pt-1">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-primary block">
                      Audition Sample Ready
                    </span>
                    <ModernAudioPlayer
                      ref={factoryPlayerRef}
                      src={
                        factoryMode === "design"
                          ? `http://localhost:8000/static/shared_characters/temp_preview.wav?t=${previewCacheBuster}`
                          : `http://localhost:8000/static/custom_voices/temp_clone_preview.wav?t=${previewCacheBuster}`
                      }
                      autoPlay={true}
                    />
                  </div>
                )}

                {/* Action Buttons Toolbar */}
                <div className="pt-2 border-t border-border/40 space-y-1.5 shrink-0">
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={handleGenerateAudition}
                      disabled={isGeneratingPreview || !newCharRefText.trim() || (factoryMode === "clone" && !newCharFile)}
                      className="flex-1 py-2 px-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-foreground text-[10.5px] font-bold uppercase tracking-wider rounded-lg border border-border/70 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer shadow-2xs"
                    >
                      {isGeneratingPreview ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          <span>Synthesizing...</span>
                        </>
                      ) : (
                        <>
                          <Mic size={12} className="text-primary" />
                          <span>Audition Sample</span>
                        </>
                      )}
                    </button>

                    {hasGeneratedPreview && (
                      <button
                        type="button"
                        onClick={handleDeleteAudition}
                        className="py-2 px-2.5 text-red-500 hover:bg-red-500/10 text-[10.5px] font-bold uppercase tracking-wider rounded-lg border border-red-500/30 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        title="Delete temporary preview"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveCharacter}
                    disabled={isSavingChar || !newCharName.trim() || !hasGeneratedPreview}
                    className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white text-[11px] font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:bg-zinc-100 dark:disabled:bg-zinc-850 disabled:text-panel-text disabled:border disabled:border-border/50 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                  >
                    {isSavingChar ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={13} />
                        <span>Save to Global Library</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* SUBTAB 2: CHARACTER LIBRARY                          */}
            {/* ---------------------------------------------------- */}
            {activeSubTab === "library" && (
              <div className="flex flex-col h-full space-y-3">
                
                {/* Gender Filters */}
                <div className="flex items-center justify-between gap-1 pb-1 border-b border-border/40 shrink-0">
                  <div className="flex gap-1">
                    {["All", "Male", "Female"].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setGenderFilter(opt as any)}
                        className={`px-2.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider rounded-md border transition-colors cursor-pointer ${
                          genderFilter === opt
                            ? "bg-primary border-primary text-white shadow-2xs"
                            : "bg-card/50 border-border/50 text-panel-text hover:text-foreground"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>

                  {characters.length > 0 && (
                    <span className="text-[9.5px] font-mono text-panel-text">
                      {filteredCharacters.length} Profiles
                    </span>
                  )}
                </div>

                {/* Character Cards List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-0.5">
                  {filteredCharacters.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-panel-text">
                      <Users size={28} className="opacity-30 mb-2" />
                      <p className="text-xs font-medium">No character profiles found.</p>
                      <button
                        type="button"
                        onClick={() => setActiveSubTab("factory")}
                        className="mt-2 text-[10.5px] text-primary font-semibold hover:underline cursor-pointer"
                      >
                        Design your first voice profile in Voice Factory →
                      </button>
                    </div>
                  ) : (
                    filteredCharacters.map((char) => {
                      const isPreviewing = previewingCharId === char.id;
                      const isAssignedAsDefault = selectedCharIdForProject === char.id;

                      return (
                        <div
                          key={char.id}
                          className={`p-2.5 rounded-xl border transition-colors flex flex-col gap-2 bg-card/70 ${
                            isAssignedAsDefault
                              ? "border-primary/80 ring-1 ring-primary/30 shadow-2xs"
                              : "border-border/70 hover:border-border"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                              <button
                                type="button"
                                onClick={() => togglePlayCharacterSample(char)}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer shadow-2xs ${
                                  isPreviewing
                                    ? "bg-primary text-white"
                                    : "bg-primary/10 text-primary hover:bg-primary hover:text-white"
                                }`}
                                title={isPreviewing ? "Pause Audition" : "Play Audition"}
                              >
                                {isPreviewing ? (
                                  <Pause size={12} fill="currentColor" />
                                ) : (
                                  <Play size={12} fill="currentColor" className="ml-0.5" />
                                )}
                              </button>

                              <div className="overflow-hidden flex-1 min-w-0">
                                <span className="text-xs font-bold text-foreground truncate block">
                                  {char.name}
                                </span>
                                <span className="text-[9px] font-mono text-panel-text truncate block">
                                  {char.personality_tag}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteCharacter(char.id)}
                              className="p-1 text-panel-text hover:text-red-500 hover:bg-red-500/10 rounded transition-colors cursor-pointer shrink-0"
                              title="Delete Profile"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>

                          {/* Quick Assign Toolbar */}
                          <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-border/30">
                            <span className="text-[9px] font-mono text-panel-text/70 uppercase">
                              {char.gender}
                            </span>

                            <button
                              type="button"
                              disabled={isApplyingAll}
                              onClick={() => handleApplyCharacterToAll(char)}
                              className="px-2 py-0.5 rounded-md text-[9.5px] font-semibold text-primary hover:bg-primary/10 border border-primary/20 transition-all cursor-pointer flex items-center gap-1 disabled:opacity-40"
                              title="Set as narrator for all scenes in this project"
                            >
                              <UserCheck size={10} />
                              <span>Apply to All Scenes</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Reset All Characters Button */}
                {characters.length > 0 && (
                  <div className="pt-2 border-t border-border/40 shrink-0">
                    <button
                      type="button"
                      disabled={isApplyingAll}
                      onClick={() => handleApplyCharacterToAll(null)}
                      className="w-full py-1.5 px-2 bg-zinc-100 dark:bg-zinc-800 text-panel-text hover:text-foreground text-[9.5px] font-semibold uppercase tracking-wider rounded-lg border border-border/60 transition-colors cursor-pointer text-center"
                      title="Reset all scenes back to project default voice tag"
                    >
                      Reset All Scenes to Default Voice
                    </button>
                  </div>
                )}

              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* SUBTAB 3: FULL NARRATIVE SCRIPT                      */}
            {/* ---------------------------------------------------- */}
            {activeSubTab === "script" && (
              <div className="flex flex-col h-full space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-border/40 shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                    Narrative Script (Khmer)
                  </span>
                  <button
                    type="button"
                    disabled={isSyncingScript || !scriptNarrativeText.trim()}
                    onClick={handleSyncScriptNarrative}
                    className="px-2 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider bg-primary hover:bg-primary-hover text-white transition-all cursor-pointer flex items-center gap-1 disabled:opacity-40 shadow-2xs"
                    title="Segment script narrative into scenes"
                  >
                    {isSyncingScript ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                    <span>Sync Scenes</span>
                  </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                  <AutoResizeTextarea
                    defaultValue={scriptNarrativeText}
                    onBlur={async (val) => {
                      setScriptNarrativeText(val);
                      if (activeProject?.id) {
                        await updateActiveProject({ script_narrative: val });
                      }
                    }}
                    placeholder="Enter full narrative script in Khmer..."
                    className="w-full flex-1 bg-zinc-50/50 dark:bg-zinc-900/40 p-2.5 rounded-lg text-xs leading-relaxed text-foreground border border-border/60 outline-none focus:border-primary transition-colors overflow-y-auto custom-scrollbar"
                  />
                </div>

                <p className="text-[9.5px] text-panel-text leading-tight shrink-0">
                  Auto-saved. Clicking <span className="font-semibold text-foreground">Sync Scenes</span> will re-segment this script into timeline scenes.
                </p>
              </div>
            )}

          </div>

        </div>

        {/* ======================================================= */}
        {/* COLUMN 2: AUDIO TIMELINE & SCENE DIRECTOR (flex-1)       */}
        {/* ======================================================= */}
        <div className="flex-1 min-w-[420px] flex flex-col h-full space-y-2 overflow-hidden min-h-0">
          
          {/* Top Options Toolbar (Cleanly Segmented) */}
          <div className="h-8 shrink-0 flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar">
            
            {/* Left: Ready Counter & Filter Pills */}
            <div className="flex items-center gap-2 shrink-0">
              
              {/* Ready Status Counter */}
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Check size={9} strokeWidth={2.5} />
                <span>{completedCount}/{scenes.length} Audio Ready</span>
              </div>

              {/* Timeline Filter Pills */}
              <div className="flex items-center gap-0.5 bg-card border border-border/70 p-0.5 rounded-lg shadow-2xs">
                {(["all", "ready", "pending", "outdated"] as const).map((mode) => {
                  const isActive = timelineFilter === mode;
                  const label = 
                    mode === "all" ? `All (${scenes.length})` :
                    mode === "ready" ? `Ready (${completedCount})` :
                    mode === "pending" ? `Pending (${pendingCount})` :
                    `Outdated (${outdatedCount})`;

                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setTimelineFilter(mode)}
                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-medium transition-colors cursor-pointer ${
                        isActive
                          ? "bg-primary text-white font-bold shadow-2xs"
                          : "text-panel-text hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

            </div>

            {/* Right: Engine Status, Format Switcher & Batch Action */}
            <div className="flex items-center gap-1.5 shrink-0">
              
              {/* Audio Format Pill (WAV | MP3) */}
              <div className="flex items-center gap-0.5 bg-card border border-border/70 p-0.5 rounded-lg shadow-2xs" title="Project Audio Container Format">
                {(["wav", "mp3"] as const).map((fmt) => {
                  const isActive = currentFormat === fmt;
                  return (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => handleFormatChange(fmt)}
                      className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-bold uppercase transition-colors cursor-pointer ${
                        isActive
                          ? "bg-primary text-white shadow-2xs"
                          : "text-panel-text hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {fmt}
                    </button>
                  );
                })}
              </div>

              {/* VoxCPM2 Engine Status Pill */}
              <button
                type="button"
                onClick={handleToggleModel}
                className={`px-2 py-0.5 rounded-md border text-[9.5px] font-medium flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors ${
                  modelState === "loaded"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                    : modelState === "loading" || modelState === "unloading"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                    : "bg-zinc-100 dark:bg-zinc-800 text-panel-text border-border/60 hover:text-foreground"
                }`}
                title={modelState === "loaded" ? "VoxCPM2 is active in memory. Click to unload VRAM." : "Click to load VoxCPM2"}
              >
                {modelState === "loading" || modelState === "unloading" ? (
                  <Loader2 size={9} className="animate-spin" />
                ) : (
                  <span className={`w-1.5 h-1.5 rounded-full ${modelState === "loaded" ? "bg-emerald-500" : "bg-neutral-400"}`} />
                )}
                <span>VoxCPM2: {modelState}</span>
              </button>

              {/* Clear All Audio Button */}
              <button
                type="button"
                onClick={handleResetVoice}
                disabled={isGeneratingAll || isResetting || scenes.length === 0 || completedCount === 0}
                className="px-2.5 py-0.5 h-7 rounded-lg text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1.5 shadow-2xs"
                title="Delete all generated voice audio for this project"
              >
                {isResetting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                <span>Clear All Audio</span>
              </button>

              {/* Primary Batch Generate Button */}
              {!isAnySceneProcessing && !isGeneratingAll ? (
                <button
                  type="button"
                  onClick={handleGenerateAllLines}
                  disabled={scenes.length === 0}
                  className="px-2.5 py-0.5 h-7 rounded-lg bg-primary hover:bg-primary-hover text-white text-[10px] font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-40"
                  title="Synthesize audio for all scenes"
                >
                  <Play size={10} fill="currentColor" />
                  <span>Generate All Lines</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopVoice}
                  className="px-2.5 py-0.5 h-7 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <Loader2 size={10} className="animate-spin" />
                  <span>Stop Synthesis</span>
                </button>
              )}

            </div>

          </div>

          {/* Vertical Scene List */}
          <div className="flex-1 bg-card rounded-xl border border-border/70 p-3 shadow-2xs overflow-y-auto custom-scrollbar space-y-2 min-h-0">
            {filteredScenes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-panel-text">
                <AudioLines size={32} className="opacity-30 mb-2" />
                <p className="text-sm font-medium">No scenes match the selected filter.</p>
              </div>
            ) : (
              filteredScenes.map((scene: any) => {
                const isCompleted = scene.audio_status === "completed";
                const isProcessing = scene.audio_status === "processing";
                const isOutdated = scene.audio_status === "outdated";
                const hasAudio = isCompleted || (isOutdated && scene.audio_path);

                const audioUrl = scene.audio_path 
                  ? `http://localhost:8000/static/${scene.audio_path}?t=${cacheBuster}`
                  : `http://localhost:8000/static/${activeProject?.slug}/scene_${String(scene.scene_number).padStart(3, "0")}.${currentFormat}?t=${cacheBuster}`;

                return (
                  <div
                    key={scene.id}
                    className={`p-3 rounded-lg border transition-colors flex flex-col gap-2 relative ${
                      isProcessing
                        ? "bg-amber-500/5 border-amber-500/30"
                        : isOutdated
                        ? "bg-amber-500/5 dark:bg-amber-500/3 border-amber-500/25 dark:border-amber-500/20"
                        : isCompleted
                        ? "bg-card border-border/70 dark:border-border/60 shadow-2xs"
                        : "bg-card/40 border-border/40"
                    }`}
                  >
                    {/* Scene Card Header */}
                    <div className="flex items-center justify-between gap-2">
                      
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold font-mono text-foreground">
                          Scene #{String(scene.scene_number).padStart(2, "0")}
                        </span>

                        {/* Speaker Assignment Badge with Popover */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setOpenSceneSpeakerDropdown(openSceneSpeakerDropdown === scene.id ? null : scene.id)}
                            className="px-2 py-0.5 rounded-full text-[9px] font-medium border transition-colors flex items-center gap-1 cursor-pointer bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                            title="Click to assign character voice"
                          >
                            <Mic size={9} />
                            <span>{scene.character_name || "Project Default Voice"}</span>
                            <ChevronDown size={8} />
                          </button>

                          {/* Speaker Dropdown Popover */}
                          {openSceneSpeakerDropdown === scene.id && (
                            <div 
                              ref={speakerDropdownRef}
                              className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-xl p-1.5 min-w-[200px] space-y-1 animate-in fade-in zoom-in-95 duration-100"
                            >
                              <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-panel-text border-b border-border/40">
                                Assign Voice to Scene #{scene.scene_number}
                              </div>

                              {/* Option: Default Voice */}
                              <button
                                type="button"
                                onClick={() => handleAssignSceneCharacter(scene.id, null)}
                                className={`w-full text-left px-2 py-1 rounded-md text-[10px] transition-colors cursor-pointer flex items-center justify-between ${
                                  !scene.character_id
                                    ? "bg-primary/10 text-primary font-bold"
                                    : "text-panel-text hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                }`}
                              >
                                <span>Project Default Voice</span>
                                {!scene.character_id && <Check size={10} />}
                              </button>

                              {/* Character Options */}
                              {characters.map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => handleAssignSceneCharacter(scene.id, c)}
                                  className={`w-full text-left px-2 py-1 rounded-md text-[10px] transition-colors cursor-pointer flex items-center justify-between ${
                                    scene.character_id === c.id
                                      ? "bg-primary/10 text-primary font-bold"
                                      : "text-panel-text hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                  }`}
                                >
                                  <span className="truncate">{c.name}</span>
                                  {scene.character_id === c.id && <Check size={10} />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status Badges & Action Buttons */}
                      <div className="flex items-center gap-1.5">
                        {isProcessing ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                            <Loader2 size={8} className="animate-spin" />
                            <span>Synthesizing...</span>
                          </span>
                        ) : isOutdated ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            <AlertTriangle size={8} />
                            <span>Outdated</span>
                          </span>
                        ) : isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <Check size={8} strokeWidth={2.5} />
                            <span>Ready</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[8.5px] font-medium text-panel-text/70 bg-zinc-100 dark:bg-zinc-800/60 border border-border/40">
                            Idle
                          </span>
                        )}

                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleGenerateSingleLine(scene)}
                          className="w-6 h-6 rounded border border-border/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-panel-text hover:text-foreground flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer"
                          title="Synthesize audio for this scene"
                        >
                          <RefreshCw size={10} className={isProcessing ? "animate-spin" : ""} />
                        </button>

                        {hasAudio && (
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleDeleteSingleLine(scene)}
                            className="w-6 h-6 rounded border border-border/60 hover:border-red-500/50 hover:bg-red-500/10 text-panel-text hover:text-red-500 flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer"
                            title="Delete audio for this scene"
                          >
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>

                    </div>

                    {/* Auto-Resizing Khmer Voiceover Text (Two-Way Sync to Brainstorming & Images tabs) */}
                    <div>
                      <AutoResizeTextarea
                        defaultValue={scene.narration_khmer || ""}
                        onBlur={(val) => updateSingleScene(scene.id, { narration_khmer: val })}
                        placeholder="Khmer voiceover narration..."
                        className="w-full bg-transparent text-[12.5px] text-foreground leading-relaxed outline-none border-b border-transparent focus:border-primary/50 transition-colors py-0.5"
                      />
                    </div>

                    {/* Inline Audio Player if rendered */}
                    {hasAudio && (
                      <div className={`pt-1 ${isOutdated ? "opacity-60" : ""}`}>
                        <ModernAudioPlayer
                          src={audioUrl}
                          compact={true}
                        />
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>

          {/* Master Timeline Output Footer Bar */}
          <div className="bg-card rounded-xl border border-border/70 p-3 shadow-2xs shrink-0 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <Music size={15} />
              </div>
              <div>
                <span className="text-xs font-bold text-foreground block">
                  Master Voiceover Timeline
                </span>
                <span className="text-[9.5px] font-mono text-panel-text block">
                  {activeProject?.master_audio_path ? `master_voiceover.${currentFormat}` : "Awaiting compilation..."}
                </span>
              </div>
            </div>

            {/* Center Player or Empty placeholder */}
            <div className="flex-1 max-w-xl">
              {activeProject?.master_audio_path ? (
                <ModernAudioPlayer
                  src={`http://localhost:8000/static/${activeProject.slug}/master_voiceover.${currentFormat}?t=${cacheBuster}`}
                  compact={false}
                />
              ) : (
                <div className="w-full h-8 flex items-center justify-center bg-zinc-50/50 dark:bg-zinc-900/30 border border-dashed border-border/60 rounded-lg text-[10px] text-panel-text font-medium">
                  Complete all scene audio to compile master timeline track
                </div>
              )}
            </div>

            {/* Download Button */}
            {activeProject?.master_audio_path && (
              <a
                href={`http://localhost:8000/static/${activeProject.slug}/master_voiceover.${currentFormat}?t=${cacheBuster}`}
                download={`master_voiceover_${activeProject.slug}.${currentFormat}`}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-750 text-foreground text-[10px] font-bold uppercase tracking-wider border border-border/70 flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs"
                title="Download full concatenated timeline track"
              >
                <Download size={11} className="text-primary" />
                <span>Export {currentFormat.toUpperCase()}</span>
              </a>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
