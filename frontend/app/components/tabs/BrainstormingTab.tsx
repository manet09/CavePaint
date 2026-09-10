/* eslint-disable */
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useProjectContext } from "../../context/ProjectContext";
import { 
  Copy, 
  Check, 
  Sparkles, 
  Layers, 
  Sliders, 
  FileText, 
  ArrowRight, 
  Trash2, 
  RefreshCw, 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  Palette,
  Compass,
  FileCode2,
  ChevronRight,
  Eye,
  X,
  Shirt,
  RotateCcw,
  LayoutTemplate
} from "lucide-react";

interface BrainstormingTabProps {
  activeProject?: any;
  refreshProjectData?: () => Promise<void>;
}

// Preset Era options with rich character attire & hair definitions
const ERA_OPTIONS = [
  { 
    id: "ancient", 
    label: "🦖 Ancient / Prehistoric", 
    desc: "Stone Age, Ice Age, primitive caves, mammoth hunters, tribal camps",
    attire: "Thick woolly mammoth fur pelt wrap, ragged animal hide tunic, stitched leather boots",
    hair: "Wild, thick, messy prehistoric caveman hair",
    props: "Flint spear, bone tools, primitive campfire, mammoth tusks",
  },
  { 
    id: "medieval", 
    label: "🏰 Medieval / Feudal", 
    desc: "Stone castles, feudal kingdoms, muddy peasant villages, iron swords, dungeons",
    attire: "Coarse linen peasant tunic with leather belt, woolen trousers, worn leather boots",
    hair: "Shaggy medieval peasant haircut or hooded cloth cowl",
    props: "Iron lantern, wooden barrel, torch, quill and scroll",
  },
  { 
    id: "90s", 
    label: "📼 90s / Retro", 
    desc: "Analog era, chunky CRT monitors, messy bedrooms, floppy disks, dial-up internet",
    attire: "Oversized vintage color-block windbreaker, graphic t-shirt, baggy denim jeans, chunky retro sneakers",
    hair: "90s curtains/middle-parted haircut or backwards baseball cap",
    props: "Chunky CRT monitor, cassette Walkman, floppy disks, messy desk",
  },
  { 
    id: "modern", 
    label: "📱 Today / Modern", 
    desc: "Urban minimalist apartments, modern coffee shops, glass offices, smartphones",
    attire: "Clean modern hoodie or casual jacket, minimalist t-shirt, dark jeans, white sneakers",
    hair: "Neat styled contemporary haircut (textured crop or modern fade)",
    props: "Smartphone, laptop, minimalist ceramic mug, clean desk",
  },
  { 
    id: "scifi", 
    label: "🚀 Future / Sci-Fi", 
    desc: "Cyberpunk neon alleys, orbital space stations, hologram servers, Martian colonies",
    attire: "Sleek minimalist form-fitting tech jumpsuit, tactical utility belt, magnetic boots",
    hair: "Sleek futuristic haircut, neon-tinted tips, or subtle cybernetic earpiece",
    props: "Glowing holographic datapad, neon UI panels, hovering drone",
  },
  { 
    id: "dystopian", 
    label: "☢️ Dystopian", 
    desc: "Bleak post-apocalyptic wastelands, overgrown concrete ruins, fallout bunkers",
    attire: "Scavenged patchwork duster coat, ragged wrapped scarf, utility straps, combat boots",
    hair: "Windblown dusty hair, protective fabric bandana or goggles pushed onto forehead",
    props: "Geiger counter, cracked gas mask, rusted salvage tools",
  },
];

// Preset Atmosphere & Solid Backdrop Color Palettes (Pure Studio White as default)
const MOOD_OPTIONS = [
  { id: "pure_white", label: "Pure Studio White", color: "#ffffff", desc: "Crisp clean pure white background, signature YouTube explainer aesthetic" },
  { id: "pale_ice", label: "Pale Ice Blue", color: "#e0f2fe", desc: "Chilly crisp light blue, isolated and analytical" },
  { id: "parchment_cream", label: "Parchment Cream", color: "#fef3c7", desc: "Warm antique parchment, historical and academic" },
  { id: "muted_sand", label: "Muted Sand", color: "#f5ebe0", desc: "Warm desert earth, prehistoric and rugged" },
  { id: "slate_navy", label: "Slate Navy", color: "#1e293b", desc: "Deep dark navy blue, contemplative and serious" },
  { id: "dark_crimson", label: "Dark Crimson", color: "#450a0a", desc: "Deep brooding burgundy, conflict and danger" },
];

// Preset Scene Staging options
const SCENE_STAGING_OPTIONS = [
  { 
    id: "studio", 
    label: "Studio Canvas (Whatly)", 
    sub: "Grounded with floor contact shadow on seamless white/solid backdrop",
    desc: "Character & key props grounded with subtle floor shadow on seamless backdrop" 
  },
  { 
    id: "environment", 
    label: "Full Environment", 
    sub: "Full-bleed 2D illustrated setting filling the entire canvas",
    desc: "Rich 2D illustrated setting filling the canvas edge-to-edge without border cutouts" 
  },
];

// Preset Video Aspect Ratio options
const ASPECT_RATIO_OPTIONS = [
  { id: "16:9", label: "🖥️ 16:9 Widescreen", sub: "YouTube Long-form", desc: "16:9 widescreen landscape composition, full-bleed framing" },
  { id: "9:16", label: "📱 9:16 Vertical", sub: "Shorts / TikTok / Reels", desc: "9:16 vertical orientation, full-bleed vertical composition" },
  { id: "1:1", label: "⏹️ 1:1 Square", sub: "Instagram / Feed", desc: "1:1 square centered composition, full-bleed framing" },
  { id: "4:3", label: "📺 4:3 Classic", sub: "Standard / Retro", desc: "4:3 standard balanced composition, full-bleed framing" },
  { id: "2:3", label: "🖼️ 2:3 Portrait", sub: "Vertical Feed", desc: "2:3 vertical portrait composition, full-bleed framing" },
];

export default function BrainstormingTab({ activeProject, refreshProjectData }: BrainstormingTabProps) {
  const { updateActiveProject, updateSingleScene } = useProjectContext();

  // Local state for creative fields
  const [scriptText, setScriptText] = useState("");
  const [selectedEra, setSelectedEra] = useState("ancient");
  const [selectedMood, setSelectedMood] = useState("pure_white");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState("16:9");
  const [characterAttire, setCharacterAttire] = useState("");
  const [sceneStaging, setSceneStaging] = useState<"studio" | "environment">("studio");
  const [customSetting, setCustomSetting] = useState("");

  // Batching controller state (Option A: sentence-based, -1 = All Scenes)
  const [batchSize, setBatchSize] = useState(5);
  const [selectedBatchIndex, setSelectedBatchIndex] = useState(0);

  // Copy & Modal state
  const [isCopied, setIsCopied] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // JSON Ingestion state
  const [jsonInput, setJsonInput] = useState("");
  const [importMode, setImportMode] = useState<"append" | "replace">("replace");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  // Sync initial project data into local state
  useEffect(() => {
    if (activeProject) {
      setScriptText(activeProject.script_narrative || "");
      const era = activeProject.theme_era || "ancient";
      setSelectedEra(era);
      setSelectedMood(activeProject.theme_mood || "pure_white");
      setSelectedAspectRatio(activeProject.aspect_ratio || "16:9");
      setCustomSetting(activeProject.theme_custom || "");
      setSceneStaging((activeProject.scene_staging as any) || "studio");

      const eraObj = ERA_OPTIONS.find((e) => e.id === era);
      const defaultAttire = eraObj ? `${eraObj.attire}, ${eraObj.hair}` : "";
      setCharacterAttire(activeProject.character_attire || defaultAttire);
    }
  }, [activeProject?.id]);

  // Sentence parser: split by Khmer punctuation (។) and newlines
  const sentences = useMemo(() => {
    if (!scriptText.trim()) return [];
    const clean = scriptText.replace(/\(.*?\)/g, "").trim();
    return clean
      .split(/[។\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [scriptText]);

  // Calculate batch slices
  const batches = useMemo(() => {
    if (sentences.length === 0) return [];
    const chunks: { index: number; start: number; end: number; items: string[] }[] = [];
    for (let i = 0; i < sentences.length; i += batchSize) {
      const chunk = sentences.slice(i, i + batchSize);
      chunks.push({
        index: chunks.length,
        start: i + 1,
        end: i + chunk.length,
        items: chunk,
      });
    }
    return chunks;
  }, [sentences, batchSize]);

  const isAllScenes = selectedBatchIndex === -1;
  const activeBatch = !isAllScenes ? (batches[selectedBatchIndex] || batches[0] || null) : null;

  // Auto-save script changes on blur
  const handleScriptBlur = async () => {
    if (!activeProject?.id) return;
    if (scriptText !== (activeProject.script_narrative || "")) {
      await updateActiveProject({ script_narrative: scriptText });
    }
  };

  // Era selection handler: auto-populates character attire & hair
  const handleSelectEra = async (eraId: string) => {
    setSelectedEra(eraId);
    const eraObj = ERA_OPTIONS.find((e) => e.id === eraId);
    const defaultAttire = eraObj ? `${eraObj.attire}, ${eraObj.hair}` : "";
    setCharacterAttire(defaultAttire);
    if (activeProject?.id) {
      await updateActiveProject({ 
        theme_era: eraId,
        character_attire: defaultAttire
      });
    }
  };

  // Character attire blur handler
  const handleCharacterAttireBlur = async () => {
    if (!activeProject?.id) return;
    if (characterAttire !== (activeProject.character_attire || "")) {
      await updateActiveProject({ character_attire: characterAttire });
    }
  };

  // Reset character attire to era defaults
  const handleResetCharacterAttire = async () => {
    const eraObj = ERA_OPTIONS.find((e) => e.id === selectedEra);
    const defaultAttire = eraObj ? `${eraObj.attire}, ${eraObj.hair}` : "";
    setCharacterAttire(defaultAttire);
    if (activeProject?.id) {
      await updateActiveProject({ character_attire: defaultAttire });
    }
  };

  // Scene staging handler
  const handleSelectStaging = async (stagingId: "studio" | "environment") => {
    setSceneStaging(stagingId);
    if (activeProject?.id) {
      await updateActiveProject({ scene_staging: stagingId });
    }
  };

  // Mood selection handler
  const handleSelectMood = async (moodId: string) => {
    setSelectedMood(moodId);
    if (activeProject?.id) {
      await updateActiveProject({ theme_mood: moodId });
    }
  };

  // Aspect ratio selection handler
  const handleSelectAspectRatio = async (ratioId: string) => {
    setSelectedAspectRatio(ratioId);
    if (activeProject?.id) {
      await updateActiveProject({ aspect_ratio: ratioId });
    }
  };

  // Custom setting handler
  const handleCustomSettingBlur = async () => {
    if (!activeProject?.id) return;
    if (customSetting !== (activeProject.theme_custom || "")) {
      await updateActiveProject({ theme_custom: customSetting });
    }
  };

  // Build the complete frontier prompt for ChatGPT/Claude
  const generatePrompt = (batchIdx: number = selectedBatchIndex) => {
    const eraObj = ERA_OPTIONS.find((e) => e.id === selectedEra) || ERA_OPTIONS[0];
    const moodObj = MOOD_OPTIONS.find((m) => m.id === selectedMood) || MOOD_OPTIONS[0];
    const ratioObj = ASPECT_RATIO_OPTIONS.find((r) => r.id === selectedAspectRatio) || ASPECT_RATIO_OPTIONS[0];

    if (sentences.length === 0) {
      return "No script sentences detected. Please paste your Khmer script first.";
    }

    const isAll = batchIdx === -1;
    const currentBatch = !isAll ? (batches[batchIdx] || batches[0]) : null;

    const startNum = currentBatch ? currentBatch.start : 1;
    const endNum = currentBatch ? currentBatch.end : sentences.length;

    const targetSlice = currentBatch
      ? currentBatch.items.map((s, idx) => `  ${currentBatch.start + idx}. "${s}"`).join("\n")
      : sentences.map((s, idx) => `  ${idx + 1}. "${s}"`).join("\n");

    const taskTitle = currentBatch
      ? `YOUR TARGET TASK (BATCH ${currentBatch.index + 1}: SCENES ${startNum} TO ${endNum})`
      : `YOUR TARGET TASK (ALL SCENES 1 TO ${sentences.length})`;

    const attireText = characterAttire.trim() || `${eraObj.attire}, ${eraObj.hair}`;
    const stagingInstruction = sceneStaging === "studio"
      ? `Uniform seamless ${moodObj.label} (${moodObj.desc}) background. The character and key story elements are grounded with a clean subtle contact shadow/floor patch. Clean minimalist composition with zero border frames.`
      : `Full-bleed 2D illustrated ${eraObj.label} setting filling the frame edge-to-edge. Rich environmental context, vibrant flat colors. NO border margins, NO letterbox frames.`;

    return `You are the lead visual director and storyboard artist for an educational animated YouTube channel in the style of "Whatly".

### 1. CORE VISUAL STYLE (BALANCED WHATLY CARTOON-STICKMAN HYBRID):
- Minimalist 2D flat vector cartoon & stickman hybrid illustration in the signature "Whatly" educational YouTube style.
- BALANCED COMPLEXITY: Neither too basic (NO featureless naked stick figures) nor too complex (NO realistic anatomy, NO 3D rendering, NO muscular detail, NO gradients).
- HEAD & FACE: Simple round/oval cartoon head filled with flat skin tone. Two large round white circular cartoon eyes with black dot pupils. Simple expressive cartoon eyebrows and mouth (e.g. chattering shivering teeth, curious side-eye glance, wide shock, or deadpan smile).
- HAIR: Distinct chunky 2D vector hairstyle fitting the character and era: ${eraObj.hair}.
- TORSO & CLOTHING: Simple rounded capsule torso wearing flat-colored era attire: ${eraObj.attire}.
- LIMBS: Clean thin black stickman line arms and legs with dynamic cartoon posing.
- SCENE STAGING: ${stagingInstruction}
- COMPOSITION & FRAMING: ${ratioObj.label} (${ratioObj.desc}). Full-bleed edge-to-edge artwork. NO artificial border frames, NO margin cutouts, NO letterbox bars.
- ABSOLUTELY NO 3D shading, NO complex photorealism, NO muddy gradients, NO detailed anatomical rendering.

### 2. THEME & SETTING CONTEXT:
- Era: ${eraObj.label} (${eraObj.desc}).
- Palette / Backdrop: ${moodObj.label} (${moodObj.desc}).
- Video Aspect Ratio: ${ratioObj.label}.
${customSetting.trim() ? `- Key Story Props / Elements: ${customSetting.trim()}\n` : ""}
### 3. COMPLETE STORY SCRIPT BACKGROUND:
"""
${scriptText}
"""

### 4. ${taskTitle}:
Generate visual scene descriptions ONLY for the following target sentences. Do not skip or combine sentences.
Target sentences:
${targetSlice}

### 5. STRICT JSON OUTPUT FORMAT:
Output MUST be a valid JSON array of objects matching this schema exactly.
Do not wrap in extra markdown text, greetings, or explanations. RETURN ONLY VALID JSON:
[
  {
    "scene_number": ${startNum},
    "narration_khmer": "<exact Khmer sentence from target list>",
    "image_prompt_english": "2D flat vector cartoon explainer illustration, Whatly youtube channel art style, balanced cartoon stickman hybrid, clean bold black outlines. Stylized character with round skin-toned head, two large round white cartoon eyes with black dot pupils, expressive face, ${eraObj.hair}, simple rounded torso wearing ${eraObj.attire}, thin black stickman line arms and legs, <describe character action and key props in the ${eraObj.label} setting>, ${sceneStaging === 'studio' ? 'grounded on a seamless ' + moodObj.label + ' background' : 'full-bleed 2D illustrated ' + eraObj.label + ' environment'}, ${ratioObj.desc}, flat solid colors, high visual contrast, minimalist educational animation.",
    "negative_prompt": "naked, blank featureless circle head, photorealistic, 3D render, complex shading, detailed muscles, realistic face, gradients, blur, border, frame, margin, letterbox, cropped edges, jagged border"
  }
]`;
  };

  // Copy prompt to clipboard
  const handleCopyPrompt = async () => {
    const promptText = generatePrompt();
    try {
      await navigator.clipboard.writeText(promptText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy prompt:", err);
    }
  };

  // Validate JSON on the fly
  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setJsonInput(val);
    setImportSuccessMessage(null);
    if (!val.trim()) {
      setJsonError(null);
      return;
    }
    try {
      let clean = val.trim();
      if (clean.startsWith("```")) {
        const lines = clean.split("\n");
        if (lines[0].startsWith("```")) lines.shift();
        if (lines.length && lines[lines.length - 1].startsWith("```")) lines.pop();
        clean = lines.join("\n").trim();
      }
      const parsed = JSON.parse(clean);
      if (!Array.isArray(parsed)) {
        setJsonError("JSON must be an array of scene objects (e.g. [ { ... }, { ... } ])");
      } else {
        setJsonError(null);
      }
    } catch (err: any) {
      setJsonError("Invalid JSON syntax: " + err.message);
    }
  };

  // Ingest scenes into backend
  const handleImportScenes = async () => {
    if (!jsonInput.trim() || jsonError || !activeProject?.id) return;
    setIsImporting(true);
    setImportSuccessMessage(null);

    let clean = jsonInput.trim();
    if (clean.startsWith("```")) {
      const lines = clean.split("\n");
      if (lines[0].startsWith("```")) lines.shift();
      if (lines.length && lines[lines.length - 1].startsWith("```")) lines.pop();
      clean = lines.join("\n").trim();
    }

    try {
      const parsed = JSON.parse(clean);
      const res = await fetch(`http://localhost:8000/api/projects/${activeProject.id}/import-scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: parsed,
          mode: importMode,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setJsonInput("");
        setImportSuccessMessage(`Successfully ${importMode === "append" ? "appended" : "imported"} ${data.imported_count} scenes!`);
        if (refreshProjectData) {
          await refreshProjectData();
        }
        setTimeout(() => setImportSuccessMessage(null), 4000);
      } else {
        const err = await res.text();
        setJsonError("Failed to import: " + err);
      }
    } catch (err: any) {
      setJsonError("Error importing: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  // Delete scene handler
  const handleDeleteScene = async (sceneId: number) => {
    try {
      const updatedScenes = (activeProject?.scenes || [])
        .filter((s: any) => s.id !== sceneId)
        .map((s: any, idx: number) => ({
          scene_number: idx + 1,
          narration_khmer: s.narration_khmer,
          image_prompt_english: s.image_prompt_english,
          negative_prompt: s.negative_prompt,
        }));

      await fetch(`http://localhost:8000/api/projects/${activeProject.id}/import-scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: updatedScenes,
          mode: "replace",
        }),
      });
      if (refreshProjectData) await refreshProjectData();
    } catch (err) {
      console.error("Error deleting scene:", err);
    }
  };

  const scenes = activeProject?.scenes || [];

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full h-[calc(100vh-56px-48px)] pb-4 animate-in fade-in duration-300 overflow-hidden select-none">
        
        {/* ========================================================= */}
        {/* LEFT PANEL (COL 1-6): SCRIPT, THEMES & FRONTIER PROMPT */}
        {/* ========================================================= */}
        <div className="lg:col-span-6 flex flex-col h-full bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
          
          {/* Panel Header */}
          <div className="h-12 shrink-0 bg-panel-header/80 border-b border-border px-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass size={15} className="text-primary" />
              <span className="text-[12px] font-bold text-foreground uppercase tracking-wider">
                Script & Frontier Prompt Studio
              </span>
            </div>
            <span className="text-[11px] font-medium text-panel-text flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {sentences.length} {sentences.length === 1 ? "sentence" : "sentences"} detected
            </span>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-6">
            
            {/* 1. Khmer Narrative Script */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={13} className="text-primary" /> Narrative Script (Khmer)
                </label>
                <span className="text-[11px] text-panel-text">Paste your research script here</span>
              </div>
              <textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                onBlur={handleScriptBlur}
                rows={6}
                placeholder="កាលពី ២ ម៉ឺនឆ្នាំមុន ផែនដីបានធ្លាក់ក្នុងយុគសម័យទឹកកកដ៏ត្រជាក់បំផុត... (Separate sentences with ។ or newlines)"
                className="w-full p-4 bg-background rounded-xl border border-border text-[13px] text-foreground leading-relaxed placeholder:text-zinc-400/40 focus:border-primary focus:outline-none transition-all resize-none custom-scrollbar"
              />
            </div>

            {/* 2. Theme & Era Selector */}
            <div>
              <label className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider block mb-2">
                1. Choose Era & Setting
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {ERA_OPTIONS.map((era) => {
                  const isSelected = selectedEra === era.id;
                  return (
                    <button
                      key={era.id}
                      onClick={() => handleSelectEra(era.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "bg-primary/10 border-primary text-primary shadow-2xs"
                          : "bg-background border-border text-foreground/70 hover:border-zinc-300 dark:hover:border-zinc-700"
                      }`}
                    >
                      <span className="text-[12px] font-semibold tracking-tight">{era.label}</span>
                      <span className="text-[10px] text-panel-text line-clamp-1 mt-0.5">{era.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Character Attire & Hair */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-1.5">
                  <Shirt size={13} className="text-primary" /> 2. Character Attire & Hairstyle (Whatly Style)
                </label>
                <button
                  onClick={handleResetCharacterAttire}
                  className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  title="Reset to selected Era defaults"
                >
                  <RotateCcw size={11} /> Reset to Era Default
                </button>
              </div>
              <textarea
                value={characterAttire}
                onChange={(e) => setCharacterAttire(e.target.value)}
                onBlur={handleCharacterAttireBlur}
                rows={2}
                placeholder="e.g. Thick woolly mammoth fur pelt wrap, ragged animal hide tunic, wild messy prehistoric caveman hair"
                className="w-full px-3.5 py-2 bg-background rounded-xl border border-border text-[12px] text-foreground placeholder:text-zinc-400/40 focus:border-primary focus:outline-none transition-all resize-none"
              />
              <p className="text-[10px] text-panel-text mt-1">
                Injected into prompts so characters have era-authentic hair & clothing instead of a naked stickman.
              </p>
            </div>

            {/* 3. Scene Staging */}
            <div>
              <label className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider block mb-2">
                3. Scene Staging & Staging Style
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SCENE_STAGING_OPTIONS.map((staging) => {
                  const isSelected = sceneStaging === staging.id;
                  return (
                    <button
                      key={staging.id}
                      onClick={() => handleSelectStaging(staging.id as any)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "bg-primary/10 border-primary text-primary shadow-2xs"
                          : "bg-background border-border text-foreground/70 hover:border-zinc-300 dark:hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${isSelected ? "border-primary bg-primary" : "border-zinc-400"}`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span className="text-[12px] font-semibold tracking-tight">{staging.label}</span>
                      </div>
                      <span className="text-[10px] text-panel-text mt-1 pl-5">{staging.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Solid Backdrop Atmosphere */}
            <div>
              <label className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider block mb-2">
                4. Backdrop Color Palette
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {MOOD_OPTIONS.map((mood) => {
                  const isSelected = selectedMood === mood.id;
                  return (
                    <button
                      key={mood.id}
                      onClick={() => handleSelectMood(mood.id)}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 ${
                        isSelected
                          ? "bg-primary/10 border-primary shadow-2xs"
                          : "bg-background border-border hover:border-zinc-300 dark:hover:border-zinc-700"
                      }`}
                    >
                      <div 
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs border border-zinc-400/30" 
                        style={{ backgroundColor: mood.color }} 
                      />
                      <span className={`text-[11px] font-medium truncate ${isSelected ? "text-primary font-semibold" : "text-foreground/80"}`}>
                        {mood.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. Video Aspect Ratio & Framing */}
            <div>
              <label className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider block mb-2">
                5. Video Aspect Ratio & Framing
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {ASPECT_RATIO_OPTIONS.map((ratio) => {
                  const isSelected = selectedAspectRatio === ratio.id;
                  return (
                    <button
                      key={ratio.id}
                      onClick={() => handleSelectAspectRatio(ratio.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "bg-primary/10 border-primary text-primary shadow-2xs"
                          : "bg-background border-border text-foreground/70 hover:border-zinc-300 dark:hover:border-zinc-700"
                      }`}
                    >
                      <span className="text-[12px] font-semibold tracking-tight">{ratio.label}</span>
                      <span className="text-[10px] text-panel-text truncate mt-0.5">{ratio.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 6. Custom Props & Detail Notes */}
            <div>
              <label className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider block mb-1.5">
                6. Specific Props / Environmental Detail (Optional)
              </label>
              <input
                type="text"
                value={customSetting}
                onChange={(e) => setCustomSetting(e.target.value)}
                onBlur={handleCustomSettingBlur}
                placeholder="e.g. mammoth bone needles, snowstorm wind, campfire"
                className="w-full px-3.5 py-2.5 bg-background rounded-xl border border-border text-[12px] text-foreground placeholder:text-zinc-400/40 focus:border-primary focus:outline-none transition-all"
              />
            </div>

            {/* 5. Batch Controller (Option A) */}
            <div className="bg-background rounded-xl p-4 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders size={14} className="text-primary" />
                  <span className="text-[12px] font-bold text-foreground">
                    Frontier LLM Batch Controller
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-panel-text">
                  <span>Batch Size:</span>
                  <select
                    value={batchSize}
                    onChange={(e) => {
                      setBatchSize(Number(e.target.value));
                      setSelectedBatchIndex(0);
                    }}
                    className="bg-card border border-border rounded-lg px-2 py-1 text-[11px] font-semibold text-foreground outline-none cursor-pointer"
                  >
                    <option value={3}>3 scenes</option>
                    <option value={5}>5 scenes (Recommended)</option>
                    <option value={8}>8 scenes</option>
                    <option value={10}>10 scenes</option>
                  </select>
                </div>
              </div>

              {/* Batch Chips Selector */}
              {batches.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {/* Option to target all scenes */}
                  <button
                    onClick={() => setSelectedBatchIndex(-1)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                      selectedBatchIndex === -1
                        ? "bg-primary text-white font-semibold shadow-xs"
                        : "bg-card border border-border text-foreground/70 hover:bg-panel-header"
                    }`}
                  >
                    🌐 All Scenes (1–{sentences.length})
                  </button>

                  {/* Individual Batches */}
                  {batches.map((batch, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedBatchIndex(idx)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                        selectedBatchIndex === idx
                          ? "bg-primary text-white font-semibold shadow-xs"
                          : "bg-card border border-border text-foreground/70 hover:bg-panel-header"
                      }`}
                    >
                      Batch {idx + 1} ({batch.start}–{batch.end})
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-panel-text italic">
                  Paste your Khmer script above to generate scene batches.
                </p>
              )}

              {/* Target Slice Preview */}
              {sentences.length > 0 && (
                <div className="mt-2 bg-card/70 border border-border/80 rounded-lg p-3 text-[11px] text-panel-text space-y-1">
                  <div className="font-semibold text-foreground text-[10px] uppercase tracking-wider flex items-center justify-between">
                    <span>
                      {selectedBatchIndex === -1 
                        ? `Targeting All ${sentences.length} Sentences for Prompt` 
                        : `Target Sentences for Batch ${selectedBatchIndex + 1} (Scenes ${activeBatch?.start}–${activeBatch?.end}):`}
                    </span>
                    <span className="text-primary font-mono text-[10px]">
                      {selectedBatchIndex === -1 ? `Total: ${sentences.length}` : `${activeBatch?.items.length} items`}
                    </span>
                  </div>
                  {selectedBatchIndex === -1 ? (
                    <div className="truncate text-foreground/70 italic">
                      All {sentences.length} sentences will be sent to the LLM at once.
                    </div>
                  ) : (
                    activeBatch?.items.map((sent, i) => (
                      <div key={i} className="truncate">
                        <span className="font-bold text-primary mr-1.5">#{activeBatch.start + i}</span>
                        {sent}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Panel Footer: Action Buttons (Preview + Copy) */}
          <div className="p-4 bg-panel-header/50 border-t border-border shrink-0 flex items-center justify-between gap-3">
            <p className="text-[11px] text-panel-text hidden sm:block">
              {selectedBatchIndex === -1 
                ? `Ready to prompt for all ${sentences.length} scenes` 
                : `Batch ${selectedBatchIndex + 1} ready (${activeBatch?.start}–${activeBatch?.end})`}
            </p>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Preview Button */}
              <button
                onClick={() => setIsPreviewOpen(true)}
                disabled={sentences.length === 0}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-panel-header text-[13px] font-semibold text-foreground flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                title="Preview the exact prompt before copying"
              >
                <Eye size={15} className="text-primary" />
                <span>Preview Prompt</span>
              </button>

              {/* Copy Button */}
              <button
                onClick={handleCopyPrompt}
                disabled={sentences.length === 0}
                className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-semibold text-[13px] transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isCopied
                    ? "bg-emerald-600 text-white"
                    : "bg-primary hover:bg-primary/90 text-white shadow-xs active:scale-98 disabled:opacity-50 disabled:pointer-events-none"
                }`}
              >
                {isCopied ? (
                  <>
                    <Check size={16} />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span>
                      Copy {selectedBatchIndex === -1 ? "All Scenes" : `Batch ${selectedBatchIndex + 1}`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

        </div>

        {/* ========================================================= */}
        {/* RIGHT PANEL (COL 7-12): INGESTION & LIVE STORYBOARD DECK */}
        {/* ========================================================= */}
        <div className="lg:col-span-6 flex flex-col h-full bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
          
          {/* Panel Header */}
          <div className="h-12 shrink-0 bg-panel-header/80 border-b border-border px-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={15} className="text-primary" />
              <span className="text-[12px] font-bold text-foreground uppercase tracking-wider">
                Scene Ingestion & Storyboard Deck
              </span>
            </div>
            <span className="text-[11px] font-semibold text-foreground/80 bg-background px-2.5 py-1 rounded-lg border border-border">
              {scenes.length} {scenes.length === 1 ? "Scene" : "Scenes"} in Timeline
            </span>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-6">
            
            {/* JSON Ingestion Box */}
            <div className="bg-background rounded-xl p-4 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <FileCode2 size={13} className="text-primary" /> Paste Frontier JSON
                </label>

                {/* Append vs Replace Toggle */}
                <div className="flex items-center gap-1 bg-card p-1 rounded-lg border border-border">
                  <button
                    onClick={() => setImportMode("replace")}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                      importMode === "replace"
                        ? "bg-red-500/10 text-red-500 border border-red-500/20"
                        : "text-panel-text hover:text-foreground"
                    }`}
                    title="Wipe existing scenes and start from Scene 1"
                  >
                    🔄 Replace All
                  </button>
                  <button
                    onClick={() => setImportMode("append")}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                      importMode === "append"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "text-panel-text hover:text-foreground"
                    }`}
                    title="Append new scenes to the end of timeline"
                  >
                    ➕ Append
                  </button>
                </div>
              </div>

              <textarea
                value={jsonInput}
                onChange={handleJsonChange}
                rows={4}
                placeholder='Paste the JSON response from ChatGPT/Claude here: [ { "scene_number": 1, "narration_khmer": "...", "image_prompt_english": "...", "negative_prompt": "..." } ]'
                className="w-full p-3 bg-card rounded-lg border border-border font-mono text-[11px] text-foreground placeholder:text-zinc-400/40 focus:border-primary focus:outline-none transition-all resize-none custom-scrollbar"
              />

              {/* Error or Success notification */}
              {jsonError && (
                <div className="text-[11px] text-red-500 flex items-center gap-1.5 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                  <AlertCircle size={13} className="shrink-0" />
                  <span className="truncate">{jsonError}</span>
                </div>
              )}
              {importSuccessMessage && (
                <div className="text-[11px] text-emerald-500 flex items-center gap-1.5 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                  <CheckCircle2 size={13} className="shrink-0" />
                  <span>{importSuccessMessage}</span>
                </div>
              )}

              <button
                onClick={handleImportScenes}
                disabled={!jsonInput.trim() || !!jsonError || isImporting}
                className="w-full py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-[12px] font-semibold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
              >
                {isImporting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Ingesting Scenes...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight size={14} />
                    <span>Ingest {importMode === "append" ? "and Append" : "and Replace"} into Timeline</span>
                  </>
                )}
              </button>
            </div>

            {/* Live Storyboard Scene Cards */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider">
                  Current Scenes in Project ({scenes.length})
                </span>
              </div>

              {scenes.length === 0 ? (
                <div className="text-center p-10 border border-dashed border-border rounded-xl text-panel-text space-y-2">
                  <Layers size={24} className="mx-auto opacity-30" />
                  <p className="text-[12px] font-medium">Timeline is currently empty.</p>
                  <p className="text-[11px] text-panel-text/70 max-w-xs mx-auto">
                    1. Copy the frontier prompt on the left.
                    <br />2. Paste into ChatGPT/Claude.
                    <br />3. Paste the returned JSON above and click Ingest.
                  </p>
                </div>
              ) : (
                scenes.map((scene: any) => (
                  <div 
                    key={scene.id || scene.scene_number} 
                    className="bg-background rounded-xl p-3.5 border border-border hover:border-zinc-300 dark:hover:border-zinc-700 transition-all space-y-2.5"
                  >
                    {/* Scene Card Header */}
                    <div className="flex items-center justify-between border-b border-border/50 pb-2">
                      <span className="text-[11px] font-bold text-primary tracking-wide">
                        Scene #{String(scene.scene_number).padStart(2, "0")}
                      </span>
                      <button
                        onClick={() => handleDeleteScene(scene.id)}
                        className="text-panel-text hover:text-red-500 transition-colors p-1 rounded cursor-pointer"
                        title="Delete this scene"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Khmer Narration */}
                    <div>
                      <label className="text-[10px] font-semibold text-panel-text uppercase tracking-wider block mb-1">
                        Voiceover Script (Khmer)
                      </label>
                      <textarea
                        defaultValue={scene.narration_khmer || ""}
                        onBlur={(e) => updateSingleScene(scene.id, { narration_khmer: e.target.value })}
                        rows={2}
                        className="w-full p-2 bg-card rounded-lg border border-border text-[12px] text-foreground leading-relaxed focus:border-primary focus:outline-none transition-all resize-none"
                      />
                    </div>

                    {/* English Image Prompt */}
                    <div>
                      <label className="text-[10px] font-semibold text-panel-text uppercase tracking-wider block mb-1">
                        Stickman Visual Prompt (English)
                      </label>
                      <textarea
                        defaultValue={scene.image_prompt_english || ""}
                        onBlur={(e) => updateSingleScene(scene.id, { image_prompt_english: e.target.value })}
                        rows={2}
                        className="w-full p-2 bg-card rounded-lg border border-border text-[11px] text-foreground/80 font-mono leading-relaxed focus:border-primary focus:outline-none transition-all resize-none"
                      />
                    </div>

                    {/* Negative Prompt / Exclusions */}
                    <div>
                      <label className="text-[10px] font-semibold text-panel-text uppercase tracking-wider block mb-1">
                        Negative Constraints / Exclusions
                      </label>
                      <textarea
                        defaultValue={scene.negative_prompt || ""}
                        onBlur={(e) => updateSingleScene(scene.id, { negative_prompt: e.target.value })}
                        rows={1}
                        placeholder="e.g. photorealistic, 3D render, gradient, complex textures..."
                        className="w-full p-2 bg-card rounded-lg border border-border text-[11px] text-foreground/70 font-mono leading-relaxed focus:border-primary focus:outline-none transition-all resize-none"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>

        </div>

      </div>

      {/* ========================================================= */}
      {/* MODAL: PROMPT PREVIEW WITH INTERACTIVE BATCH SELECTOR     */}
      {/* ========================================================= */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="h-14 px-6 border-b border-border bg-panel-header flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Eye size={17} className="text-primary" />
                <div>
                  <h3 className="text-[13px] font-bold text-foreground">Frontier Prompt Preview</h3>
                  <p className="text-[10px] text-panel-text">Exact text formatted for ChatGPT / Claude web chat</p>
                </div>
              </div>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="text-panel-text hover:text-foreground p-1 rounded-lg hover:bg-card transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Batch Switcher inside Modal */}
            <div className="px-6 py-2.5 bg-background border-b border-border flex items-center justify-between gap-3 overflow-x-auto shrink-0 custom-scrollbar">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-bold text-panel-text uppercase tracking-wider mr-1">
                  Batch:
                </span>
                <button
                  onClick={() => setSelectedBatchIndex(-1)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                    selectedBatchIndex === -1
                      ? "bg-primary text-white font-semibold shadow-2xs"
                      : "bg-card border border-border text-panel-text hover:text-foreground"
                  }`}
                >
                  🌐 All Scenes (1–{sentences.length})
                </button>
                {batches.map((b, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedBatchIndex(idx)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                      selectedBatchIndex === idx
                        ? "bg-primary text-white font-semibold shadow-2xs"
                        : "bg-card border border-border text-panel-text hover:text-foreground"
                    }`}
                  >
                    Batch {idx + 1} ({b.start}–{b.end})
                  </button>
                ))}
              </div>
            </div>

            {/* Code Text Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-zinc-950 text-zinc-100 font-mono text-[12px] leading-relaxed custom-scrollbar whitespace-pre-wrap select-text">
              {generatePrompt()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-panel-header border-t border-border flex items-center justify-between shrink-0">
              <span className="text-[11px] text-panel-text">
                Currently showing: <strong className="text-foreground">{selectedBatchIndex === -1 ? `All Scenes (1–${sentences.length})` : `Batch ${selectedBatchIndex + 1} (Scenes ${activeBatch?.start}–${activeBatch?.end})`}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="px-4 py-2 rounded-xl text-[12px] font-medium text-panel-text hover:text-foreground hover:bg-card transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={handleCopyPrompt}
                  className={`px-5 py-2 rounded-xl text-[12px] font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                    isCopied ? "bg-emerald-600 text-white" : "bg-primary hover:bg-primary/90 text-white shadow-xs"
                  }`}
                >
                  {isCopied ? <Check size={15} /> : <Copy size={15} />}
                  <span>{isCopied ? "Copied to Clipboard!" : "Copy this Prompt"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
