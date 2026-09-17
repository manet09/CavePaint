/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Project } from "../../context/ProjectContext";
import { 
  FolderCheck, 
  Image as ImageIcon, 
  AudioLines, 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Music, 
  Type, 
  Plus, 
  Trash2, 
  Copy, 
  Film, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Scissors, 
  Sparkles, 
  Sliders, 
  Loader2,
  ExternalLink,
  ChevronRight,
  Move,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Settings2,
  Layers,
  FileAudio
} from "lucide-react";
import Link from "next/link";

interface AssemblyTabProps {
  activeProject: Project;
}

interface SceneCouplingItem {
  id: number;
  scene_number: number;
  coupling_status: "ready" | "missing_audio" | "missing_image" | "uncoupled";
  image_path: string;
  image_exists: boolean;
  audio_path: string;
  audio_exists: boolean;
  audio_status: string;
  duration: number;
  volume: number;
  narration_khmer: string;
  image_prompt_english: string;
}

interface BgmFile {
  filename: string;
  relative_path: string;
  duration: number;
  size_bytes: number;
}

interface TextOverlayItem {
  id: string;
  text: string;
  font_family: string;
  font_size: number;
  color: string;
  bg_color: string;
  position?: "bottom" | "center" | "top";
  x_percent: number; // 0 to 100
  y_percent: number; // 0 to 100
  start_time: number;
  duration: number;
}

interface BgmTrackConfig {
  relative_path: string;
  filename: string;
  start_time: number;
  duration: number;
  volume: number;
}

interface TimelineState {
  bgm: BgmTrackConfig | null;
  text_overlays: TextOverlayItem[];
  scene_volumes: Record<string, number>;
  master_bgm_volume: number;
  ducking: boolean;
}

const FONT_OPTIONS = [
  { id: "Arial, sans-serif", label: "Sans (Universal)" },
  { id: "Georgia, serif", label: "Serif (Editorial)" },
  { id: "'Impact', sans-serif", label: "Impact (Bold Title)" },
  { id: "'Khmer Sangam MN', 'Kantumruy Pro', sans-serif", label: "Khmer Standard" },
];

const COLOR_PRESETS = [
  { label: "White", value: "#FFFFFF" },
  { label: "Yellow", value: "#FACC15" },
  { label: "Cyan", value: "#38BDF8" },
  { label: "Coral", value: "#F87171" },
  { label: "Black", value: "#000000" },
];

const BG_PRESETS = [
  { label: "Translucent Dark", value: "rgba(0,0,0,0.65)" },
  { label: "Solid Black", value: "rgba(0,0,0,0.95)" },
  { label: "Solid White", value: "rgba(255,255,255,0.9)" },
  { label: "Transparent", value: "transparent" },
];

export default function AssemblyTab({ activeProject }: AssemblyTabProps) {
  const [scenesData, setScenesData] = useState<SceneCouplingItem[]>([]);
  const [bgmFiles, setBgmFiles] = useState<BgmFile[]>([]);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [coupledCount, setCoupledCount] = useState<number>(0);
  const [hasFinalVideo, setHasFinalVideo] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<"all" | "ready" | "incomplete">("all");
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(true);
  const [isUploadingBgm, setIsUploadingBgm] = useState<boolean>(false);
  
  // Timeline zoom level (pixels per second)
  const [zoomPxPerSec, setZoomPxPerSec] = useState<number>(35);

  // Timeline configuration
  const [timeline, setTimeline] = useState<TimelineState>({
    bgm: null,
    text_overlays: [],
    scene_volumes: {},
    master_bgm_volume: 0.3,
    ducking: true,
  });

  // Selected elements for timeline editing
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [isBgmSelected, setIsBgmSelected] = useState<boolean>(false);

  // Dragging states
  const [isDraggingCanvasText, setIsDraggingCanvasText] = useState<boolean>(false);
  const [canvasDragStart, setCanvasDragStart] = useState<{ mouseX: number; mouseY: number; initialX: number; initialY: number } | null>(null);
  
  // Timeline clip dragging
  const [timelineDrag, setTimelineDrag] = useState<{
    type: "text_move" | "text_trim_left" | "text_trim_right" | "bgm_move" | "bgm_trim_right";
    id?: string;
    startMouseX: number;
    initialStartTime: number;
    initialDuration: number;
  } | null>(null);

  // Render job status
  const [renderJob, setRenderJob] = useState<{
    status: "idle" | "rendering" | "completed" | "failed";
    progress: number;
    output_path: string | null;
    error: string | null;
  }>({
    status: "idle",
    progress: 0,
    output_path: null,
    error: null,
  });

  // Interactive Player State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [auditioningSceneId, setAuditioningSceneId] = useState<number | null>(null);

  // Audio references
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const singleAuditionAudioRef = useRef<HTMLAudioElement | null>(null);
  const playheadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // DOM references
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoViewportRef = useRef<HTMLDivElement>(null);
  const timelineLanesRef = useRef<HTMLDivElement>(null);

  const slug = activeProject.slug || `project-${activeProject.id}`;
  const aspectRatio = activeProject.aspect_ratio || "16:9";

  const getAssetUrl = (path: string) => {
    if (!path) return "";
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    return `http://localhost:8000/static/${cleanPath}`;
  };

  // Fetch assembly coupling status & timeline
  const fetchAssemblyStatus = useCallback(async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/projects/${activeProject.id}/assembly-status`);
      if (res.ok) {
        const data = await res.json();
        setScenesData(data.scenes || []);
        setBgmFiles(data.bgm_files || []);
        setTotalDuration(data.total_duration || 0);
        setCoupledCount(data.coupled_count || 0);
        setHasFinalVideo(data.has_final_video || false);
        if (data.render_job) setRenderJob(data.render_job);

        // Load timeline configuration from server if exists
        if (data.timeline_data && Object.keys(data.timeline_data).length > 0) {
          const rawOverlays = data.timeline_data.text_overlays || [];
          const normalizedOverlays: TextOverlayItem[] = rawOverlays.map((t: any) => ({
            ...t,
            x_percent: t.x_percent ?? 50,
            y_percent: t.y_percent ?? (t.position === "top" ? 15 : t.position === "center" ? 50 : 85),
          }));

          setTimeline({
            bgm: data.timeline_data.bgm || null,
            text_overlays: normalizedOverlays,
            scene_volumes: data.timeline_data.scene_volumes || {},
            master_bgm_volume: data.timeline_data.master_bgm_volume ?? 0.3,
            ducking: data.timeline_data.ducking ?? true,
          });
        }
      }
    } catch (err) {
      console.error("Failed to load assembly status:", err);
    } finally {
      setIsLoadingStatus(false);
    }
  }, [activeProject.id]);

  useEffect(() => {
    fetchAssemblyStatus();
  }, [fetchAssemblyStatus]);

  // Poll render status if rendering
  useEffect(() => {
    if (renderJob.status !== "rendering") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/projects/${activeProject.id}/render-status`);
        if (res.ok) {
          const job = await res.json();
          setRenderJob(job);
          if (job.status === "completed") {
            setHasFinalVideo(true);
            clearInterval(interval);
          } else if (job.status === "failed") {
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error("Polling render error:", err);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [renderJob.status, activeProject.id]);

  // Save timeline configuration to backend
  const saveTimelineState = async (newTimeline: TimelineState) => {
    setTimeline(newTimeline);
    try {
      await fetch(`http://localhost:8000/api/projects/${activeProject.id}/timeline`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTimeline),
      });
    } catch (err) {
      console.error("Failed to save timeline:", err);
    }
  };

  // Computes accumulated start times for each coupled scene
  const sceneTimelineMap = useMemo(() => {
    let accumulated = 0;
    return scenesData.map(s => {
      const start = accumulated;
      const dur = s.coupling_status === "ready" ? s.duration : 3.0;
      accumulated += dur;
      return {
        ...s,
        timeline_start: start,
        timeline_end: start + dur,
        effective_dur: dur,
      };
    });
  }, [scenesData]);

  // Max timeline duration considering scenes, text, and bgm
  const maxTimelineDuration = useMemo(() => {
    let maxT = totalDuration > 0 ? totalDuration : 20.0;
    if (timeline.bgm) {
      maxT = Math.max(maxT, timeline.bgm.start_time + timeline.bgm.duration);
    }
    timeline.text_overlays.forEach(t => {
      maxT = Math.max(maxT, t.start_time + t.duration);
    });
    return Math.max(maxT, 10.0);
  }, [totalDuration, timeline.bgm, timeline.text_overlays]);

  // Current active scene at playhead
  const currentSceneAtPlayhead = useMemo(() => {
    const found = sceneTimelineMap.find(s => currentTime >= s.timeline_start && currentTime < s.timeline_end);
    return found || sceneTimelineMap[0];
  }, [sceneTimelineMap, currentTime]);

  // Current active text overlay at playhead
  const activeOverlayAtPlayhead = useMemo(() => {
    if (selectedTextId) {
      const selected = timeline.text_overlays.find(t => t.id === selectedTextId);
      if (selected) return selected;
    }
    return timeline.text_overlays.find(t => currentTime >= t.start_time && currentTime < t.start_time + t.duration);
  }, [timeline.text_overlays, currentTime, selectedTextId]);

  // Selected text item object
  const selectedTextItem = useMemo(() => {
    return timeline.text_overlays.find(t => t.id === selectedTextId) || null;
  }, [timeline.text_overlays, selectedTextId]);

  // -------------------------------------------------------------
  // AUDIO SYNCHRONIZATION ENGINE (Voiceover + BGM)
  // -------------------------------------------------------------

  // Sync voiceover and BGM on every frame or state change
  useEffect(() => {
    const currentScene = currentSceneAtPlayhead;
    const voiceAudio = voiceAudioRef.current;
    const bgmAudio = bgmAudioRef.current;

    // 1. VOICEOVER SYNCHRONIZATION
    if (voiceAudio) {
      if (currentScene && currentScene.audio_exists && currentScene.audio_path) {
        const sceneAudioUrl = getAssetUrl(currentScene.audio_path);
        const expectedSceneTime = Math.max(0, currentTime - currentScene.timeline_start);
        const sceneVolume = timeline.scene_volumes[String(currentScene.scene_number)] ?? 1.0;
        voiceAudio.volume = Math.min(1.0, Math.max(0.0, sceneVolume));

        // If source changed, load new scene audio
        if (voiceAudio.src !== sceneAudioUrl) {
          voiceAudio.src = sceneAudioUrl;
          voiceAudio.currentTime = expectedSceneTime;
          if (isPlaying) {
            voiceAudio.play().catch(() => {});
          }
        } else {
          // Check drift
          if (Math.abs(voiceAudio.currentTime - expectedSceneTime) > 0.3) {
            voiceAudio.currentTime = expectedSceneTime;
          }
          if (isPlaying && voiceAudio.paused) {
            voiceAudio.play().catch(() => {});
          } else if (!isPlaying && !voiceAudio.paused) {
            voiceAudio.pause();
          }
        }
      } else {
        if (!voiceAudio.paused) voiceAudio.pause();
      }
    }

    // 2. BACKGROUND MUSIC SYNCHRONIZATION
    if (bgmAudio && timeline.bgm) {
      const hasSpeech = currentScene && currentScene.audio_exists;
      const duckFactor = (timeline.ducking && hasSpeech) ? 0.35 : 1.0;
      bgmAudio.volume = Math.min(1.0, Math.max(0.0, timeline.master_bgm_volume * duckFactor));

      const isInsideBgm = currentTime >= timeline.bgm.start_time && currentTime < (timeline.bgm.start_time + timeline.bgm.duration);
      if (isInsideBgm) {
        const expectedBgmTime = currentTime - timeline.bgm.start_time;
        if (Math.abs(bgmAudio.currentTime - expectedBgmTime) > 0.35) {
          bgmAudio.currentTime = expectedBgmTime;
        }
        if (isPlaying && bgmAudio.paused) {
          bgmAudio.play().catch(() => {});
        } else if (!isPlaying && !bgmAudio.paused) {
          bgmAudio.pause();
        }
      } else {
        if (!bgmAudio.paused) bgmAudio.pause();
      }
    } else if (bgmAudio && !timeline.bgm) {
      if (!bgmAudio.paused) bgmAudio.pause();
    }
  }, [currentTime, isPlaying, currentSceneAtPlayhead, timeline.bgm, timeline.master_bgm_volume, timeline.ducking, timeline.scene_volumes]);

  // Master Play / Pause toggler
  const togglePlay = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  };

  const startPlayback = () => {
    if (maxTimelineDuration <= 0) return;
    setIsPlaying(true);
    const startTimestamp = performance.now() - (currentTime * 1000);

    playheadIntervalRef.current = setInterval(() => {
      const elapsed = (performance.now() - startTimestamp) / 1000;
      if (elapsed >= maxTimelineDuration) {
        stopPlayback();
        setCurrentTime(0);
      } else {
        setCurrentTime(elapsed);
      }
    }, 40);
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    if (playheadIntervalRef.current) {
      clearInterval(playheadIntervalRef.current);
      playheadIntervalRef.current = null;
    }
    if (voiceAudioRef.current) voiceAudioRef.current.pause();
    if (bgmAudioRef.current) bgmAudioRef.current.pause();
  };

  const handleSeek = (time: number) => {
    const clamped = Math.max(0, Math.min(maxTimelineDuration, time));
    setCurrentTime(clamped);
    if (isPlaying) {
      // Re-anchor startTimestamp
      if (playheadIntervalRef.current) clearInterval(playheadIntervalRef.current);
      const startTimestamp = performance.now() - (clamped * 1000);
      playheadIntervalRef.current = setInterval(() => {
        const elapsed = (performance.now() - startTimestamp) / 1000;
        if (elapsed >= maxTimelineDuration) {
          stopPlayback();
          setCurrentTime(0);
        } else {
          setCurrentTime(elapsed);
        }
      }, 40);
    }
  };

  // Single scene isolated voice audition
  const handleAuditionSingleScene = (scene: SceneCouplingItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!scene.audio_exists || !scene.audio_path) return;

    if (auditioningSceneId === scene.id) {
      if (singleAuditionAudioRef.current) {
        singleAuditionAudioRef.current.pause();
      }
      setAuditioningSceneId(null);
      return;
    }

    if (isPlaying) stopPlayback();

    setAuditioningSceneId(scene.id);
    if (singleAuditionAudioRef.current) {
      singleAuditionAudioRef.current.src = getAssetUrl(scene.audio_path);
      const vol = timeline.scene_volumes[String(scene.scene_number)] ?? 1.0;
      singleAuditionAudioRef.current.volume = Math.min(1.0, Math.max(0.0, vol));
      singleAuditionAudioRef.current.currentTime = 0;
      singleAuditionAudioRef.current.play().catch(() => {});
      singleAuditionAudioRef.current.onended = () => {
        setAuditioningSceneId(null);
      };
    }
  };

  // Keyboard Spacebar play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // -------------------------------------------------------------
  // FREEFORM TEXT DRAGGING ON VIDEO CANVAS
  // -------------------------------------------------------------
  const handleCanvasTextPointerDown = (e: React.PointerEvent) => {
    if (!activeOverlayAtPlayhead) return;
    e.stopPropagation();
    setSelectedTextId(activeOverlayAtPlayhead.id);
    setIsBgmSelected(false);
    setIsDraggingCanvasText(true);
    setCanvasDragStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialX: activeOverlayAtPlayhead.x_percent,
      initialY: activeOverlayAtPlayhead.y_percent,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleCanvasTextPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingCanvasText || !canvasDragStart || !activeOverlayAtPlayhead || !videoViewportRef.current) return;
    const rect = videoViewportRef.current.getBoundingClientRect();
    const deltaXPixels = e.clientX - canvasDragStart.mouseX;
    const deltaYPixels = e.clientY - canvasDragStart.mouseY;

    const deltaXPercent = (deltaXPixels / rect.width) * 100;
    const deltaYPercent = (deltaYPixels / rect.height) * 100;

    const newX = Math.round(Math.max(5, Math.min(95, canvasDragStart.initialX + deltaXPercent)) * 10) / 10;
    const newY = Math.round(Math.max(5, Math.min(95, canvasDragStart.initialY + deltaYPercent)) * 10) / 10;

    handleUpdateText(activeOverlayAtPlayhead.id, { x_percent: newX, y_percent: newY });
  };

  const handleCanvasTextPointerUp = (e: React.PointerEvent) => {
    if (isDraggingCanvasText) {
      setIsDraggingCanvasText(false);
      setCanvasDragStart(null);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  // -------------------------------------------------------------
  // CAPCUT-STYLE TIMELINE DRAG & RESIZE ENGINE
  // -------------------------------------------------------------
  const handleTimelineClipPointerDown = (
    e: React.PointerEvent, 
    type: "text_move" | "text_trim_left" | "text_trim_right" | "bgm_move" | "bgm_trim_right", 
    id?: string,
    initialStartTime: number = 0,
    initialDuration: number = 3
  ) => {
    e.stopPropagation();
    if (type.startsWith("text")) {
      if (id) setSelectedTextId(id);
      setIsBgmSelected(false);
    } else {
      setIsBgmSelected(true);
      setSelectedTextId(null);
    }

    setTimelineDrag({
      type,
      id,
      startMouseX: e.clientX,
      initialStartTime,
      initialDuration,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleTimelineClipPointerMove = (e: React.PointerEvent) => {
    if (!timelineDrag) return;
    const deltaPx = e.clientX - timelineDrag.startMouseX;
    const deltaTime = deltaPx / zoomPxPerSec;

    if (timelineDrag.type === "text_move" && timelineDrag.id) {
      const newStart = Math.max(0, Math.round((timelineDrag.initialStartTime + deltaTime) * 10) / 10);
      handleUpdateText(timelineDrag.id, { start_time: newStart });
    } else if (timelineDrag.type === "text_trim_right" && timelineDrag.id) {
      const newDur = Math.max(0.5, Math.round((timelineDrag.initialDuration + deltaTime) * 10) / 10);
      handleUpdateText(timelineDrag.id, { duration: newDur });
    } else if (timelineDrag.type === "text_trim_left" && timelineDrag.id) {
      const newStart = Math.max(0, Math.round((timelineDrag.initialStartTime + deltaTime) * 10) / 10);
      const newDur = Math.max(0.5, Math.round((timelineDrag.initialDuration - deltaTime) * 10) / 10);
      handleUpdateText(timelineDrag.id, { start_time: newStart, duration: newDur });
    } else if (timelineDrag.type === "bgm_move" && timeline.bgm) {
      const newStart = Math.max(0, Math.round((timelineDrag.initialStartTime + deltaTime) * 10) / 10);
      saveTimelineState({
        ...timeline,
        bgm: { ...timeline.bgm, start_time: newStart },
      });
    } else if (timelineDrag.type === "bgm_trim_right" && timeline.bgm) {
      const newDur = Math.max(1.0, Math.round((timelineDrag.initialDuration + deltaTime) * 10) / 10);
      saveTimelineState({
        ...timeline,
        bgm: { ...timeline.bgm, duration: newDur },
      });
    }
  };

  const handleTimelineClipPointerUp = (e: React.PointerEvent) => {
    if (timelineDrag) {
      setTimelineDrag(null);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  // Split tool at playhead
  const handleSplitAtPlayhead = () => {
    if (selectedTextId) {
      const item = timeline.text_overlays.find(t => t.id === selectedTextId);
      if (item && currentTime > item.start_time && currentTime < item.start_time + item.duration) {
        const firstDur = Math.round((currentTime - item.start_time) * 10) / 10;
        const secondDur = Math.round((item.duration - firstDur) * 10) / 10;
        
        const secondItem: TextOverlayItem = {
          ...item,
          id: `text_${Date.now()}`,
          start_time: Math.round(currentTime * 10) / 10,
          duration: Math.max(0.5, secondDur),
        };

        const updatedOverlays = timeline.text_overlays.map(t => 
          t.id === item.id ? { ...t, duration: Math.max(0.5, firstDur) } : t
        );
        updatedOverlays.push(secondItem);

        saveTimelineState({ ...timeline, text_overlays: updatedOverlays });
        setSelectedTextId(secondItem.id);
      }
    } else if (isBgmSelected && timeline.bgm) {
      if (currentTime > timeline.bgm.start_time && currentTime < timeline.bgm.start_time + timeline.bgm.duration) {
        const firstDur = Math.round((currentTime - timeline.bgm.start_time) * 10) / 10;
        saveTimelineState({
          ...timeline,
          bgm: { ...timeline.bgm, duration: Math.max(1.0, firstDur) },
        });
      }
    }
  };

  // Add text overlay
  const handleAddText = () => {
    const newText: TextOverlayItem = {
      id: `text_${Date.now()}`,
      text: "New Caption",
      font_family: "Arial, sans-serif",
      font_size: 34,
      color: "#FFFFFF",
      bg_color: "rgba(0,0,0,0.65)",
      x_percent: 50,
      y_percent: 85,
      start_time: Math.round(currentTime * 10) / 10,
      duration: 3.5,
    };
    const updated = {
      ...timeline,
      text_overlays: [...timeline.text_overlays, newText],
    };
    setSelectedTextId(newText.id);
    setIsBgmSelected(false);
    saveTimelineState(updated);
  };

  // Update text overlay
  const handleUpdateText = (id: string, updates: Partial<TextOverlayItem>) => {
    const updatedOverlays = timeline.text_overlays.map(t => t.id === id ? { ...t, ...updates } : t);
    saveTimelineState({ ...timeline, text_overlays: updatedOverlays });
  };

  // Duplicate text overlay
  const handleDuplicateSelected = () => {
    if (selectedTextId) {
      const item = timeline.text_overlays.find(t => t.id === selectedTextId);
      if (!item) return;
      const cloned: TextOverlayItem = {
        ...item,
        id: `text_${Date.now()}`,
        start_time: Math.round((item.start_time + item.duration + 0.2) * 10) / 10,
      };
      saveTimelineState({
        ...timeline,
        text_overlays: [...timeline.text_overlays, cloned],
      });
      setSelectedTextId(cloned.id);
    } else if (isBgmSelected && timeline.bgm) {
      const newStart = Math.round((timeline.bgm.start_time + timeline.bgm.duration) * 10) / 10;
      saveTimelineState({
        ...timeline,
        bgm: { ...timeline.bgm, start_time: newStart },
      });
    }
  };

  // Delete selected clip
  const handleDeleteSelected = () => {
    if (selectedTextId) {
      const updated = timeline.text_overlays.filter(t => t.id !== selectedTextId);
      setSelectedTextId(null);
      saveTimelineState({ ...timeline, text_overlays: updated });
    } else if (isBgmSelected && timeline.bgm) {
      setIsBgmSelected(false);
      saveTimelineState({ ...timeline, bgm: null });
    }
  };

  // Scene voice volume change
  const handleSceneVolumeChange = (sceneNum: number, vol: number) => {
    const newVolumes = { ...timeline.scene_volumes, [String(sceneNum)]: vol };
    const updated = { ...timeline, scene_volumes: newVolumes };
    saveTimelineState(updated);
  };

  // Upload BGM file
  const handleBgmUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingBgm(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`http://localhost:8000/api/projects/${activeProject.id}/upload-bgm`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const result = await res.json();
        const uploadedFile: BgmFile = result.file;
        setBgmFiles(prev => [...prev.filter(f => f.filename !== uploadedFile.filename), uploadedFile]);
        
        const updatedTimeline: TimelineState = {
          ...timeline,
          bgm: {
            relative_path: uploadedFile.relative_path,
            filename: uploadedFile.filename,
            start_time: 0.0,
            duration: uploadedFile.duration,
            volume: timeline.master_bgm_volume,
          }
        };
        saveTimelineState(updatedTimeline);
        setIsBgmSelected(true);
      }
    } catch (err) {
      console.error("Upload BGM failed:", err);
    } finally {
      setIsUploadingBgm(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Trigger video render
  const handleTriggerRender = async () => {
    if (coupledCount === 0) return;
    try {
      setRenderJob({ status: "rendering", progress: 5, output_path: null, error: null });
      const res = await fetch(`http://localhost:8000/api/projects/${activeProject.id}/render-video`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        setRenderJob({ status: "failed", progress: 0, output_path: null, error: data.detail || "Render failed" });
      }
    } catch (err: any) {
      setRenderJob({ status: "failed", progress: 0, output_path: null, error: err.message || "Failed to trigger render" });
    }
  };

  // Filtered scenes
  const filteredScenes = useMemo(() => {
    if (filterMode === "ready") return scenesData.filter(s => s.coupling_status === "ready");
    if (filterMode === "incomplete") return scenesData.filter(s => s.coupling_status !== "ready");
    return scenesData;
  }, [scenesData, filterMode]);

  // Format time as MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="flex flex-col gap-4 pb-16 animate-in fade-in slide-in-from-bottom-3 duration-500 max-w-[1780px] mx-auto select-none">
      
      {/* Hidden Audio Elements */}
      <audio ref={voiceAudioRef} preload="auto" />
      <audio ref={bgmAudioRef} preload="auto" />
      <audio ref={singleAuditionAudioRef} preload="auto" />

      {/* Top Banner: File Location & Coupling Readiness */}
      <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Film size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm text-foreground tracking-tight">Timeline Assembly & Mastering</h2>
              <span className="text-[11px] px-2 py-0.2 rounded-full bg-primary/10 text-primary font-mono font-medium">
                {aspectRatio}
              </span>
              <span className="text-xs text-foreground/40">•</span>
              <span className="text-xs text-foreground/60 font-medium">
                {totalDuration > 0 ? `${formatTime(totalDuration)} video runtime` : "No ready audio"}
              </span>
            </div>
            <p className="text-[11px] text-foreground/50 font-mono flex items-center gap-1.5 mt-0.5">
              <FolderCheck size={12} className="text-primary/70 shrink-0" />
              ~/Code/video_studio/workspace/{slug}/
            </p>
          </div>
        </div>

        {/* Readiness Pill & Quick Actions */}
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-foreground/70">
                Coupled Scenes:
              </span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                coupledCount === scenesData.length && scenesData.length > 0
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
              }`}>
                {coupledCount} / {scenesData.length} Ready ({scenesData.length ? Math.round((coupledCount / scenesData.length) * 100) : 0}%)
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-44 h-1.5 bg-border rounded-full mt-1 overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${scenesData.length ? (coupledCount / scenesData.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          <button
            onClick={handleTriggerRender}
            disabled={coupledCount === 0 || renderJob.status === "rendering"}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {renderJob.status === "rendering" ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Exporting {renderJob.progress}%...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>Export Video (MP4)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Render Alert / Progress Bar */}
      {renderJob.status === "rendering" && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs text-primary font-medium">
            <Loader2 size={15} className="animate-spin" />
            <span>Assembling frames, dialogue voice tracks, BGM, and burned subtitles into {aspectRatio} MP4...</span>
          </div>
          <span className="text-xs font-mono font-bold text-primary">{renderJob.progress}%</span>
        </div>
      )}

      {hasFinalVideo && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-emerald-500 font-medium">
            <CheckCircle2 size={15} />
            <span>Final video rendered successfully: <code className="font-mono">{slug}/final_output.mp4</code></span>
          </div>
          <a
            href={getAssetUrl(`${slug}/final_output.mp4`)}
            download="final_output.mp4"
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors shadow-sm"
          >
            <Download size={13} />
            <span>Download MP4</span>
          </a>
        </div>
      )}

      {/* TOP SECTION: Split View (Scene List on Left, Video Monitor + Text Style on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* Left Column: Scene Coupling & Voice Audition Deck (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Scene Voice Lines</h3>
              <p className="text-[10px] text-foreground/50">Audition voiceover & adjust individual gain</p>
            </div>
            
            {/* Filter pills */}
            <div className="flex items-center bg-card border border-border rounded-lg p-0.5 text-[10px]">
              <button
                onClick={() => setFilterMode("all")}
                className={`px-2 py-0.5 rounded transition-colors ${filterMode === "all" ? "bg-primary text-primary-foreground font-semibold" : "text-foreground/60 hover:text-foreground"}`}
              >
                All ({scenesData.length})
              </button>
              <button
                onClick={() => setFilterMode("ready")}
                className={`px-2 py-0.5 rounded transition-colors ${filterMode === "ready" ? "bg-emerald-500 text-white font-semibold" : "text-foreground/60 hover:text-foreground"}`}
              >
                Ready ({coupledCount})
              </button>
              <button
                onClick={() => setFilterMode("incomplete")}
                className={`px-2 py-0.5 rounded transition-colors ${filterMode === "incomplete" ? "bg-amber-500 text-white font-semibold" : "text-foreground/60 hover:text-foreground"}`}
              >
                Missing ({scenesData.length - coupledCount})
              </button>
            </div>
          </div>

          {/* Scenes List */}
          <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
            {filteredScenes.length === 0 ? (
              <div className="p-6 border border-dashed border-border rounded-xl text-center text-xs text-foreground/40">
                No scenes found matching the filter.
              </div>
            ) : (
              filteredScenes.map((scene) => {
                const isCoupled = scene.coupling_status === "ready";
                const isSelected = currentSceneAtPlayhead?.scene_number === scene.scene_number;
                const volumeVal = timeline.scene_volumes[String(scene.scene_number)] ?? 1.0;
                const isAuditioning = auditioningSceneId === scene.id;

                return (
                  <div
                    key={scene.id}
                    onClick={() => handleSeek(sceneTimelineMap.find(s => s.scene_number === scene.scene_number)?.timeline_start || 0)}
                    className={`bg-card border rounded-xl p-2.5 transition-all cursor-pointer ${
                      isSelected 
                        ? "border-primary ring-1 ring-primary/40 shadow-sm" 
                        : "border-border hover:border-border/80"
                    }`}
                  >
                    <div className="flex gap-2.5">
                      {/* Image Thumbnail */}
                      <div className="w-16 h-20 bg-black/40 rounded-lg overflow-hidden shrink-0 relative flex items-center justify-center border border-border/50">
                        {scene.image_exists && scene.image_path ? (
                          <img
                            src={getAssetUrl(scene.image_path)}
                            alt={`Scene ${scene.scene_number}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-foreground/30 p-1 text-center">
                            <ImageIcon size={14} className="mb-0.5" />
                            <span className="text-[8px] font-semibold uppercase">No Frame</span>
                          </div>
                        )}
                        <span className="absolute top-1 left-1 bg-black/75 backdrop-blur-sm text-white text-[9px] font-mono px-1 py-0.2 rounded">
                          #{String(scene.scene_number).padStart(2, "0")}
                        </span>
                      </div>

                      {/* Content & Audio Controls */}
                      <div className="flex flex-col justify-between flex-1 min-w-0">
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                                isCoupled 
                                  ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/20" 
                                  : scene.coupling_status === "missing_audio"
                                  ? "bg-amber-500/15 text-amber-500 border border-amber-500/20"
                                  : scene.coupling_status === "missing_image"
                                  ? "bg-blue-500/15 text-blue-500 border border-blue-500/20"
                                  : "bg-rose-500/15 text-rose-500 border border-rose-500/20"
                              }`}>
                                {isCoupled ? "Coupled" : scene.coupling_status.replace("_", " ")}
                              </span>

                              {isCoupled && (
                                <span className="text-[9px] font-mono text-foreground/60 bg-foreground/5 px-1.5 py-0.2 rounded">
                                  {scene.duration.toFixed(1)}s
                                </span>
                              )}
                            </div>

                            {/* Audition Single Scene Voice Button */}
                            {scene.audio_exists && (
                              <button
                                onClick={(e) => handleAuditionSingleScene(scene, e)}
                                title={isAuditioning ? "Pause voice line" : "Audition voice line isolated"}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                                  isAuditioning 
                                    ? "bg-primary text-primary-foreground animate-pulse" 
                                    : "bg-foreground/5 hover:bg-foreground/10 text-foreground/70"
                                }`}
                              >
                                {isAuditioning ? <Pause size={10} /> : <Play size={10} />}
                                <span>{isAuditioning ? "Playing" : "Audition"}</span>
                              </button>
                            )}

                            {/* Jump to Tab links */}
                            {!isCoupled && (
                              <div className="flex items-center gap-1">
                                {!scene.image_exists && (
                                  <Link
                                    href={`/projects/${activeProject.id}/images`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[9px] text-blue-400 hover:underline flex items-center gap-0.5"
                                  >
                                    <span>Images</span>
                                    <ChevronRight size={9} />
                                  </Link>
                                )}
                                {!scene.audio_exists && (
                                  <Link
                                    href={`/projects/${activeProject.id}/voice`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[9px] text-amber-400 hover:underline flex items-center gap-0.5"
                                  >
                                    <span>Voice</span>
                                    <ChevronRight size={9} />
                                  </Link>
                                )}
                              </div>
                            )}
                          </div>

                          <p className="text-xs text-foreground/90 font-medium line-clamp-2 leading-relaxed">
                            {scene.narration_khmer || scene.image_prompt_english || "No narration text"}
                          </p>
                        </div>

                        {/* Individual Scene Voice Volume Slider */}
                        <div className="flex items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-border/40" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5 flex-1">
                            <Volume2 size={11} className="text-foreground/40 shrink-0" />
                            <span className="text-[9px] text-foreground/50 font-medium w-14">
                              Vol: {Math.round(volumeVal * 100)}%
                            </span>
                            <input
                              type="range"
                              min="0"
                              max="1.5"
                              step="0.05"
                              value={volumeVal}
                              onChange={(e) => handleSceneVolumeChange(scene.scene_number, parseFloat(e.target.value))}
                              className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                            />
                          </div>
                          <button
                            onClick={() => handleSceneVolumeChange(scene.scene_number, 1.0)}
                            title="Reset volume to 100%"
                            className="text-[9px] text-foreground/40 hover:text-foreground transition-colors"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Interactive Video Monitor with Freeform Draggable Text (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-2.5">
          
          {/* Video Viewport Frame */}
          <div 
            ref={videoViewportRef}
            className="w-full bg-black rounded-xl border border-border relative flex items-center justify-center overflow-hidden h-[380px] shadow-sm select-none"
          >
            {currentSceneAtPlayhead?.image_exists && currentSceneAtPlayhead.image_path ? (
              <img
                src={getAssetUrl(currentSceneAtPlayhead.image_path)}
                alt="Active Frame"
                className="w-full h-full object-contain pointer-events-none"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-foreground/30 p-8 text-center pointer-events-none">
                <ImageIcon size={36} className="mb-2 opacity-50" />
                <p className="text-xs font-semibold">Frame not yet generated for Scene #{currentSceneAtPlayhead?.scene_number}</p>
                <p className="text-[11px] text-foreground/40 mt-1">Render image in Images Tab to preview</p>
              </div>
            )}

            {/* FREEFORM DRAGGABLE TEXT OVERLAY */}
            {activeOverlayAtPlayhead && (
              <div
                onPointerDown={handleCanvasTextPointerDown}
                onPointerMove={handleCanvasTextPointerMove}
                onPointerUp={handleCanvasTextPointerUp}
                style={{
                  position: "absolute",
                  left: `${activeOverlayAtPlayhead.x_percent}%`,
                  top: `${activeOverlayAtPlayhead.y_percent}%`,
                  transform: "translate(-50%, -50%)",
                  fontFamily: activeOverlayAtPlayhead.font_family,
                  fontSize: `${activeOverlayAtPlayhead.font_size}px`,
                  color: activeOverlayAtPlayhead.color,
                  backgroundColor: activeOverlayAtPlayhead.bg_color,
                }}
                className={`px-4 py-1.5 rounded-lg text-center font-semibold shadow-lg max-w-[85%] leading-snug break-words cursor-move group transition-shadow ${
                  selectedTextId === activeOverlayAtPlayhead.id 
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-black/50 shadow-2xl" 
                    : "hover:ring-1 hover:ring-white/50"
                }`}
                title="Click and drag anywhere on the screen to position freely!"
              >
                <span>{activeOverlayAtPlayhead.text}</span>
                
                {/* Drag Indicator Badge */}
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-sm text-white text-[9px] font-mono px-1.5 py-0.2 rounded border border-white/20 opacity-0 group-hover:opacity-100 flex items-center gap-1 pointer-events-none transition-opacity">
                  <Move size={8} /> Drag to position
                </span>
              </div>
            )}

            {/* Top Right Timecode Badge */}
            <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-sm text-white font-mono text-xs px-2.5 py-1 rounded-md border border-white/10 shadow flex items-center gap-2">
              <span className="text-primary font-bold">Scene #{currentSceneAtPlayhead?.scene_number || 1}</span>
              <span className="text-white/40">|</span>
              <span>{formatTime(currentTime)} / {formatTime(maxTimelineDuration)}</span>
            </div>
          </div>

          {/* Text Style Bar (Visible when text overlay is selected or active) */}
          {selectedTextItem ? (
            <div className="bg-card border border-border rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <Type size={14} className="text-primary shrink-0" />
                <input
                  type="text"
                  value={selectedTextItem.text}
                  onChange={(e) => handleUpdateText(selectedTextItem.id, { text: e.target.value })}
                  placeholder="Type subtitle or title text..."
                  className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground outline-none focus:border-primary font-medium"
                />
              </div>

              {/* Font Family */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-foreground/50 font-semibold uppercase">Font:</span>
                <select
                  value={selectedTextItem.font_family}
                  onChange={(e) => handleUpdateText(selectedTextItem.id, { font_family: e.target.value })}
                  className="bg-background border border-border rounded px-2 py-1 text-[11px] text-foreground outline-none"
                >
                  {FONT_OPTIONS.map(f => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>

              {/* Font Size */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-foreground/50 font-semibold uppercase">Size:</span>
                <input
                  type="range"
                  min="20"
                  max="64"
                  value={selectedTextItem.font_size}
                  onChange={(e) => handleUpdateText(selectedTextItem.id, { font_size: parseInt(e.target.value) })}
                  className="w-16 h-1 bg-border rounded appearance-none cursor-pointer accent-primary"
                />
                <span className="text-[10px] font-mono text-foreground/60">{selectedTextItem.font_size}px</span>
              </div>

              {/* Text Color Chips */}
              <div className="flex items-center gap-1">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => handleUpdateText(selectedTextItem.id, { color: c.value })}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                    className={`w-4 h-4 rounded-full border ${selectedTextItem.color === c.value ? "border-primary ring-2 ring-primary/40" : "border-border/60"}`}
                  />
                ))}
              </div>

              {/* Background pill selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-foreground/50 font-semibold uppercase">Box:</span>
                <select
                  value={selectedTextItem.bg_color}
                  onChange={(e) => handleUpdateText(selectedTextItem.id, { bg_color: e.target.value })}
                  className="bg-background border border-border rounded px-1.5 py-1 text-[10px] text-foreground outline-none"
                >
                  {BG_PRESETS.map(b => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
              </div>

              {/* Quick Snap Alignment Chips */}
              <div className="flex items-center gap-1 bg-background border border-border rounded p-0.5 text-[10px]">
                <button
                  onClick={() => handleUpdateText(selectedTextItem.id, { x_percent: 50, y_percent: 15 })}
                  className="px-1.5 py-0.5 rounded hover:bg-foreground/5 text-foreground/70"
                >
                  Top
                </button>
                <button
                  onClick={() => handleUpdateText(selectedTextItem.id, { x_percent: 50, y_percent: 50 })}
                  className="px-1.5 py-0.5 rounded hover:bg-foreground/5 text-foreground/70"
                >
                  Center
                </button>
                <button
                  onClick={() => handleUpdateText(selectedTextItem.id, { x_percent: 50, y_percent: 85 })}
                  className="px-1.5 py-0.5 rounded hover:bg-foreground/5 text-foreground/70"
                >
                  Bottom
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-card/50 border border-dashed border-border rounded-xl px-4 py-2 text-xs text-foreground/40 flex items-center justify-between">
              <span>Click any text overlay clip in the timeline below to customize font, color, and drag position freely.</span>
              <button
                onClick={handleAddText}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-semibold transition-colors"
              >
                <Plus size={12} />
                <span>Add Text Clip</span>
              </button>
            </div>
          )}

        </div>

      </div>

      {/* ------------------------------------------------------------- */}
      {/* CAPCUT-STYLE MULTI-TRACK HORIZONTAL TIMELINE                   */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col mt-1">
        
        {/* Timeline Transport Toolbar */}
        <div className="bg-card border-b border-border px-4 py-2.5 flex items-center justify-between gap-4">
          
          {/* Transport Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              disabled={maxTimelineDuration === 0}
              className="w-8 h-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center transition-colors shadow-sm disabled:opacity-40"
              title="Play / Pause (Spacebar)"
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
            </button>

            <button
              onClick={() => handleSeek(0)}
              className="w-7 h-7 rounded-lg border border-border hover:bg-foreground/5 flex items-center justify-center text-foreground/70 transition-colors"
              title="Rewind to Start"
            >
              <RotateCcw size={12} />
            </button>

            <div className="text-xs font-mono font-bold text-foreground ml-2">
              <span>{formatTime(currentTime)}</span>
              <span className="text-foreground/40 font-normal"> / {formatTime(maxTimelineDuration)}</span>
            </div>
          </div>

          {/* Edit Tools (Split, Duplicate, Delete) */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSplitAtPlayhead}
              disabled={!selectedTextId && !isBgmSelected}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-foreground/5 hover:bg-foreground/10 text-foreground/80 text-[11px] font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Split selected clip at current playhead position"
            >
              <Scissors size={12} />
              <span>Split Clip</span>
            </button>

            <button
              onClick={handleDuplicateSelected}
              disabled={!selectedTextId && !isBgmSelected}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-foreground/5 hover:bg-foreground/10 text-foreground/80 text-[11px] font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Duplicate selected clip"
            >
              <Copy size={12} />
              <span>Duplicate</span>
            </button>

            <button
              onClick={handleDeleteSelected}
              disabled={!selectedTextId && !isBgmSelected}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-[11px] font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Delete selected clip"
            >
              <Trash2 size={12} />
              <span>Delete</span>
            </button>

            <div className="h-4 w-px bg-border mx-1" />

            <button
              onClick={handleAddText}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-foreground/5 hover:bg-foreground/10 text-foreground/80 text-[11px] font-semibold transition-colors border border-border"
            >
              <Type size={12} className="text-primary" />
              <span>+ Text</span>
            </button>

            <label className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-foreground/5 hover:bg-foreground/10 text-foreground/80 text-[11px] font-semibold transition-colors border border-border cursor-pointer">
              <Music size={12} className="text-primary" />
              <span>{isUploadingBgm ? "Uploading..." : "+ Music"}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleBgmUpload}
                className="hidden"
                disabled={isUploadingBgm}
              />
            </label>
          </div>

          {/* Timeline Zoom Slider */}
          <div className="flex items-center gap-2">
            <ZoomOut size={12} className="text-foreground/40" />
            <input
              type="range"
              min="15"
              max="70"
              value={zoomPxPerSec}
              onChange={(e) => setZoomPxPerSec(parseInt(e.target.value))}
              className="w-20 h-1 bg-border rounded appearance-none cursor-pointer accent-primary"
              title="Timeline Zoom"
            />
            <ZoomIn size={12} className="text-foreground/40" />
          </div>
        </div>

        {/* Tracks Area: Left Track Headers (Fixed) + Right Lanes (Horizontally Scrollable) */}
        <div className="flex border-b border-border bg-background relative overflow-hidden min-h-[260px]">
          
          {/* Left Track Headers (~110px) */}
          <div className="w-28 shrink-0 bg-card border-r border-border flex flex-col z-20 shadow-sm text-xs font-semibold text-foreground/70">
            {/* Ruler header */}
            <div className="h-7 border-b border-border flex items-center px-3 text-[10px] text-foreground/40 uppercase tracking-wider font-mono">
              Timecode
            </div>

            {/* Video Track Header */}
            <div className="h-16 border-b border-border flex items-center px-3 gap-1.5">
              <Film size={13} className="text-blue-400" />
              <span className="text-[11px]">Video</span>
            </div>

            {/* Voice Track Header */}
            <div className="h-12 border-b border-border flex items-center px-3 gap-1.5">
              <FileAudio size={13} className="text-amber-400" />
              <span className="text-[11px]">Voice</span>
            </div>

            {/* Text Track Header */}
            <div className="h-12 border-b border-border flex items-center px-3 gap-1.5">
              <Type size={13} className="text-purple-400" />
              <span className="text-[11px]">Text</span>
            </div>

            {/* Music Track Header */}
            <div className="h-14 flex items-center justify-between px-3">
              <div className="flex items-center gap-1.5">
                <Music size={13} className="text-cyan-400" />
                <span className="text-[11px]">Music</span>
              </div>
              {timeline.bgm && (
                <button
                  onClick={() => saveTimelineState({ ...timeline, ducking: !timeline.ducking })}
                  title={timeline.ducking ? "Ducking ON (-12dB)" : "Ducking OFF"}
                  className={`text-[8px] px-1 py-0.2 rounded font-mono ${timeline.ducking ? "bg-emerald-500/20 text-emerald-400" : "bg-foreground/10 text-foreground/40"}`}
                >
                  Duck
                </button>
              )}
            </div>
          </div>

          {/* Right Scrollable Lanes */}
          <div 
            ref={timelineLanesRef}
            className="flex-1 overflow-x-auto overflow-y-hidden relative bg-black/20"
            style={{ minWidth: 0 }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left + e.currentTarget.scrollLeft;
              const targetTime = clickX / zoomPxPerSec;
              handleSeek(targetTime);
            }}
          >
            {/* Scrollable Container sizing based on maxTimelineDuration */}
            <div 
              style={{ width: `${Math.max(1200, (maxTimelineDuration + 5) * zoomPxPerSec)}px` }}
              className="relative flex flex-col h-full"
            >
              
              {/* 1. Time Ruler Lane (h-7) */}
              <div className="h-7 border-b border-border/60 bg-card/60 relative cursor-pointer font-mono text-[9px] text-foreground/40">
                {Array.from({ length: Math.ceil(maxTimelineDuration + 5) }).map((_, sec) => {
                  if (sec % 2 !== 0 && zoomPxPerSec < 30) return null;
                  return (
                    <div
                      key={sec}
                      style={{ left: `${sec * zoomPxPerSec}px` }}
                      className="absolute top-0 bottom-0 flex flex-col justify-between border-l border-border/40 pl-1 pointer-events-none"
                    >
                      <span>{formatTime(sec)}</span>
                      <div className="h-1.5 w-px bg-border/80" />
                    </div>
                  );
                })}
              </div>

              {/* 2. Track 1: Video / Scenes Filmstrip (h-16) */}
              <div className="h-16 border-b border-border/40 relative flex items-center px-0 bg-card/20">
                {sceneTimelineMap.map((scene) => {
                  const blockWidth = scene.effective_dur * zoomPxPerSec;
                  const isSelected = currentSceneAtPlayhead?.scene_number === scene.scene_number;

                  return (
                    <div
                      key={scene.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSeek(scene.timeline_start);
                      }}
                      style={{
                        position: "absolute",
                        left: `${scene.timeline_start * zoomPxPerSec}px`,
                        width: `${Math.max(20, blockWidth - 2)}px`,
                      }}
                      className={`h-13 rounded-md overflow-hidden border flex items-center transition-all cursor-pointer ${
                        isSelected 
                          ? "border-primary ring-1 ring-primary shadow-md bg-primary/20" 
                          : "border-blue-500/30 bg-blue-500/10 hover:border-blue-400"
                      }`}
                    >
                      {/* Mini thumbnail */}
                      {scene.image_exists && scene.image_path ? (
                        <img
                          src={getAssetUrl(scene.image_path)}
                          alt={`Scene ${scene.scene_number}`}
                          className="w-12 h-full object-cover shrink-0 pointer-events-none"
                        />
                      ) : (
                        <div className="w-10 h-full bg-black/40 flex items-center justify-center shrink-0 text-foreground/30">
                          <ImageIcon size={10} />
                        </div>
                      )}
                      
                      <div className="px-2 flex flex-col justify-center min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-foreground truncate">
                          #{String(scene.scene_number).padStart(2, "0")} ({scene.duration.toFixed(1)}s)
                        </span>
                        <span className="text-[9px] text-foreground/50 truncate font-mono">
                          {scene.coupling_status === "ready" ? "✓ Coupled" : "Missing"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 3. Track 2: Voiceover Narration Track (h-12) */}
              <div className="h-12 border-b border-border/40 relative flex items-center bg-card/10">
                {sceneTimelineMap.map((scene) => {
                  if (!scene.audio_exists) return null;
                  const blockWidth = scene.effective_dur * zoomPxPerSec;
                  const isSelected = currentSceneAtPlayhead?.scene_number === scene.scene_number;

                  return (
                    <div
                      key={`voice_${scene.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSeek(scene.timeline_start);
                      }}
                      style={{
                        position: "absolute",
                        left: `${scene.timeline_start * zoomPxPerSec}px`,
                        width: `${Math.max(20, blockWidth - 2)}px`,
                      }}
                      className={`h-9 rounded border flex items-center px-2 gap-1.5 transition-all cursor-pointer ${
                        isSelected 
                          ? "border-amber-400 bg-amber-500/25 ring-1 ring-amber-400" 
                          : "border-amber-500/30 bg-amber-500/10 hover:border-amber-400"
                      }`}
                    >
                      <AudioLines size={12} className="text-amber-400 shrink-0" />
                      <span className="text-[9px] font-medium text-amber-200 truncate">
                        Line #{scene.scene_number} ({scene.duration.toFixed(1)}s)
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 4. Track 3: Text / Subtitle Track (h-12) */}
              <div className="h-12 border-b border-border/40 relative flex items-center bg-card/20">
                {timeline.text_overlays.map((item) => {
                  const blockWidth = item.duration * zoomPxPerSec;
                  const isSelected = selectedTextId === item.id;

                  return (
                    <div
                      key={item.id}
                      onPointerDown={(e) => handleTimelineClipPointerDown(e, "text_move", item.id, item.start_time, item.duration)}
                      onPointerMove={handleTimelineClipPointerMove}
                      onPointerUp={handleTimelineClipPointerUp}
                      style={{
                        position: "absolute",
                        left: `${item.start_time * zoomPxPerSec}px`,
                        width: `${Math.max(20, blockWidth)}px`,
                      }}
                      className={`h-9 rounded-md border flex items-center justify-between px-1.5 transition-all cursor-move group select-none ${
                        isSelected 
                          ? "border-purple-400 bg-purple-600/40 ring-1 ring-purple-300 shadow-md" 
                          : "border-purple-500/40 bg-purple-600/20 hover:border-purple-400"
                      }`}
                    >
                      {/* Left Trim Handle */}
                      <div
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          handleTimelineClipPointerDown(e, "text_trim_left", item.id, item.start_time, item.duration);
                        }}
                        className="w-1.5 h-full -ml-1 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/40 rounded-l hover:bg-white"
                        title="Drag to trim start"
                      />

                      <div className="flex items-center gap-1 min-w-0 flex-1 px-1">
                        <Type size={11} className="text-purple-300 shrink-0" />
                        <span className="text-[10px] font-medium text-purple-100 truncate">
                          {item.text}
                        </span>
                      </div>

                      {/* Right Trim Handle */}
                      <div
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          handleTimelineClipPointerDown(e, "text_trim_right", item.id, item.start_time, item.duration);
                        }}
                        className="w-1.5 h-full -mr-1 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/40 rounded-r hover:bg-white"
                        title="Drag to trim duration"
                      />
                    </div>
                  );
                })}
              </div>

              {/* 5. Track 4: Background Music Track (h-14) */}
              <div className="h-14 relative flex items-center bg-card/10">
                {timeline.bgm && (
                  <div
                    onPointerDown={(e) => handleTimelineClipPointerDown(e, "bgm_move", undefined, timeline.bgm!.start_time, timeline.bgm!.duration)}
                    onPointerMove={handleTimelineClipPointerMove}
                    onPointerUp={handleTimelineClipPointerUp}
                    style={{
                      position: "absolute",
                      left: `${timeline.bgm.start_time * zoomPxPerSec}px`,
                      width: `${Math.max(40, timeline.bgm.duration * zoomPxPerSec)}px`,
                    }}
                    className={`h-10 rounded-md border flex items-center justify-between px-2 transition-all cursor-move group select-none ${
                      isBgmSelected 
                        ? "border-cyan-400 bg-cyan-600/35 ring-1 ring-cyan-300 shadow-md" 
                        : "border-cyan-500/40 bg-cyan-600/20 hover:border-cyan-400"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Music size={12} className="text-cyan-300 shrink-0" />
                      <span className="text-[10px] font-semibold text-cyan-100 truncate max-w-[200px]">
                        {timeline.bgm.filename} ({timeline.bgm.duration.toFixed(1)}s)
                      </span>
                    </div>

                    {/* Right Trim Handle */}
                    <div
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        handleTimelineClipPointerDown(e, "bgm_trim_right", undefined, timeline.bgm!.start_time, timeline.bgm!.duration);
                      }}
                      className="w-2 h-full -mr-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/40 rounded-r hover:bg-white"
                      title="Drag to trim music length"
                    />
                  </div>
                )}
              </div>

              {/* VERTICAL RED PLAYHEAD SCRUBBER */}
              <div
                style={{ left: `${currentTime * zoomPxPerSec}px` }}
                className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-30 pointer-events-none transition-none shadow-[0_0_8px_rgba(244,63,94,0.8)]"
              >
                {/* Scrubber Diamond Head */}
                <div className="w-3.5 h-3.5 bg-rose-500 -ml-[6px] -top-1 absolute rotate-45 rounded-xs shadow-md" />
              </div>

            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
