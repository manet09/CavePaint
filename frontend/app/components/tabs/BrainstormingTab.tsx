/* eslint-disable */
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useProjectContext } from "../../context/ProjectContext";
import { 
  Copy, 
  Check, 
  Sparkles, 
  Layers, 
  Sliders, 
  FileText, 
  PenLine, 
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
  ChevronDown,
  ChevronLeft,
  Eye,
  X,
  Shirt,
  RotateCcw,
  LayoutTemplate,
  CornerDownLeft,
  Columns2,
  Maximize2,
  Minimize2
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
    shortLabel: "🦖 Ancient",
    desc: "Stone Age, Ice Age, primitive caves, mammoth hunters, tribal camps",
    attire: "Thick woolly mammoth fur pelt wrap, ragged animal hide tunic, stitched leather boots",
    hair: "Wild, thick, messy prehistoric caveman hair",
    props: "Flint spear, bone tools, primitive campfire, mammoth tusks",
  },
  { 
    id: "medieval", 
    label: "🏰 Medieval / Feudal", 
    shortLabel: "🏰 Medieval",
    desc: "Stone castles, feudal kingdoms, muddy peasant villages, iron swords, dungeons",
    attire: "Coarse linen peasant tunic with leather belt, woolen trousers, worn leather boots",
    hair: "Shaggy medieval peasant haircut or hooded cloth cowl",
    props: "Iron lantern, wooden barrel, torch, quill and scroll",
  },
  { 
    id: "90s", 
    label: "📼 90s / Retro", 
    shortLabel: "📼 90s Retro",
    desc: "Analog era, chunky CRT monitors, messy bedrooms, floppy disks, dial-up internet",
    attire: "Oversized vintage color-block windbreaker, graphic t-shirt, baggy denim jeans, chunky retro sneakers",
    hair: "90s curtains/middle-parted haircut or backwards baseball cap",
    props: "Chunky CRT monitor, cassette Walkman, floppy disks, messy desk",
  },
  { 
    id: "modern", 
    label: "📱 Today / Modern", 
    shortLabel: "📱 Modern",
    desc: "Urban minimalist apartments, modern coffee shops, glass offices, smartphones",
    attire: "Clean modern hoodie or casual jacket, minimalist t-shirt, dark jeans, white sneakers",
    hair: "Neat styled contemporary haircut (textured crop or modern fade)",
    props: "Smartphone, laptop, minimalist ceramic mug, clean desk",
  },
  { 
    id: "scifi", 
    label: "🚀 Future / Sci-Fi", 
    shortLabel: "🚀 Sci-Fi",
    desc: "Cyberpunk neon alleys, orbital space stations, hologram servers, Martian colonies",
    attire: "Sleek minimalist form-fitting tech jumpsuit, tactical utility belt, magnetic boots",
    hair: "Sleek futuristic haircut, neon-tinted tips, or subtle cybernetic earpiece",
    props: "Glowing holographic datapad, neon UI panels, hovering drone",
  },
  { 
    id: "dystopian", 
    label: "☢️ Dystopian", 
    shortLabel: "☢️ Dystopian",
    desc: "Bleak post-apocalyptic wastelands, overgrown concrete ruins, fallout bunkers",
    attire: "Scavenged patchwork duster coat, ragged wrapped scarf, utility straps, combat boots",
    hair: "Windblown dusty hair, protective fabric bandana or goggles pushed onto forehead",
    props: "Geiger counter, cracked gas mask, rusted salvage tools",
  },
];

// Preset Atmosphere & Solid Backdrop Color Palettes (Pure Studio White as default)
const MOOD_OPTIONS = [
  { id: "pure_white", label: "Pure Studio White", shortLabel: "Pure White", color: "#ffffff", desc: "Crisp clean pure white background, signature YouTube explainer aesthetic" },
  { id: "pale_ice", label: "Pale Ice Blue", shortLabel: "Ice Blue", color: "#e0f2fe", desc: "Chilly crisp light blue, isolated and analytical" },
  { id: "parchment_cream", label: "Parchment Cream", shortLabel: "Parchment", color: "#fef3c7", desc: "Warm antique parchment, historical and academic" },
  { id: "muted_sand", label: "Muted Sand", shortLabel: "Muted Sand", color: "#f5ebe0", desc: "Warm desert earth, prehistoric and rugged" },
  { id: "slate_navy", label: "Slate Navy", shortLabel: "Slate Navy", color: "#1e293b", desc: "Deep dark navy blue, contemplative and serious" },
  { id: "dark_crimson", label: "Dark Crimson", shortLabel: "Dark Crimson", color: "#450a0a", desc: "Deep brooding burgundy, conflict and danger" },
];

// Preset Scene Staging options
const SCENE_STAGING_OPTIONS = [
  { 
    id: "studio", 
    label: "Studio Canvas (Seamless)", 
    shortLabel: "Studio Canvas",
    sub: "Grounded with floor contact shadow on seamless white/solid backdrop",
    desc: "Character & key props grounded with subtle floor shadow on seamless backdrop" 
  },
  { 
    id: "environment", 
    label: "Full Environment", 
    shortLabel: "Environment",
    sub: "Full-bleed 2D illustrated setting filling the entire canvas",
    desc: "Rich 2D illustrated setting filling the canvas edge-to-edge without border cutouts" 
  },
];

// Preset Video Aspect Ratio options matching Google Flow
const ASPECT_RATIO_OPTIONS = [
  { id: "16:9", label: "16:9", sub: "Widescreen", desc: "16:9 widescreen landscape composition, full-bleed framing" },
  { id: "4:3", label: "4:3", sub: "Standard", desc: "4:3 standard balanced composition, full-bleed framing" },
  { id: "1:1", label: "1:1", sub: "Square", desc: "1:1 square centered composition, full-bleed framing" },
  { id: "3:4", label: "3:4", sub: "Vertical", desc: "3:4 vertical composition, full-bleed framing" },
  { id: "9:16", label: "9:16", sub: "Portrait / Shorts", desc: "9:16 vertical orientation, full-bleed vertical composition" },
];

// Graphic Wireframe Icon for Aspect Ratios matching Google Flow UI
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
    default:
      return <div className={`w-[14px] h-[10px] rounded-[1.5px] border border-current shrink-0 ${className}`} />;
  }
}

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

export default function BrainstormingTab({ activeProject, refreshProjectData }: BrainstormingTabProps) {
  const { updateActiveProject, updateSingleScene } = useProjectContext();

  // Custom dropdown popovers state & click-outside refs
  const [openDropdown, setOpenDropdown] = useState<"era" | "staging" | "ratio" | "mood" | "batch" | "batchSize" | null>(null);
  const styleBarRef = useRef<HTMLDivElement>(null);
  const batchDropdownRef = useRef<HTMLDivElement>(null);
  const batchSizeRef = useRef<HTMLDivElement>(null);

  // Collapsible JSON Ingest drawer
  const [isJsonDrawerOpen, setIsJsonDrawerOpen] = useState(false);

  // Collapsible exclusions accordion state per scene
  const [expandedExclusions, setExpandedExclusions] = useState<Record<number, boolean>>({});
  const toggleExclusion = (sceneId: number) => {
    setExpandedExclusions((prev) => ({ ...prev, [sceneId]: !prev[sceneId] }));
  };

  // Local state for creative fields
  const [scriptText, setScriptText] = useState("");
  const [selectedEra, setSelectedEra] = useState("ancient");
  const [selectedMood, setSelectedMood] = useState("pure_white");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState("16:9");
  const [characterAttire, setCharacterAttire] = useState("");
  const [sceneStaging, setSceneStaging] = useState<"studio" | "environment">("studio");
  const [customSetting, setCustomSetting] = useState("");
  const [splitMode, setSplitMode] = useState<"enter" | "sentence" | "beat">("enter");

  // Batching controller state (Option A: sentence-based, -1 = All Scenes)
  const [batchSize, setBatchSize] = useState(5);
  const [selectedBatchIndex, setSelectedBatchIndex] = useState(0);

  // Copy & Modal state
  const [isCopied, setIsCopied] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // JSON Ingestion state
  const [jsonInput, setJsonInput] = useState("");
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  // Click-outside listener to close any open dropdown popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const isInsideStyleBar = styleBarRef.current && styleBarRef.current.contains(e.target as Node);
      const isInsideBatchDropdown = batchDropdownRef.current && batchDropdownRef.current.contains(e.target as Node);
      const isInsideBatchSize = batchSizeRef.current && batchSizeRef.current.contains(e.target as Node);
      if (!isInsideStyleBar && !isInsideBatchDropdown && !isInsideBatchSize) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  // Sentence / Visual Beat parser:
  // - "enter": split strictly by line breaks (Enter key). Each line is one scene.
  // - "sentence": standard split by Khmer full stop (។) and newlines
  // - "beat": also splits on commas, semicolons, and clause markers
  const sentences = useMemo(() => {
    if (!scriptText.trim()) return [];
    const clean = scriptText.replace(/\(.*?\)/g, "").trim();
    let regex: RegExp;
    if (splitMode === "enter") {
      regex = /\n+/;
    } else if (splitMode === "beat") {
      regex = /[។\n,;៖]+/;
    } else {
      regex = /[។\n]+/;
    }
    return clean
      .split(regex)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [scriptText, splitMode]);

  // Auto-break Khmer sentences (។) into separate lines (Enter)
  const handleAutoBreakToLines = async () => {
    if (!scriptText.trim()) return;
    const formatted = scriptText
      .replace(/([។])\s*/g, "$1\n")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .join("\n");
    setScriptText(formatted);
    setSplitMode("enter");
    if (activeProject?.id) {
      await updateActiveProject({ script_narrative: formatted });
    }
  };

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

    return `You are the lead visual director and storyboard artist for a top-tier educational animated explainer channel in the signature "Whatly" stickman doodle aesthetic.

### 1. CORE VISUAL ENGINE DIRECTIVE (LOCAL FLUX STICKMAN VECTOR SPEC):
- Target Image Engine: Local FLUX.1 vector diffusion.
- CRITICAL: DO NOT use the word "Whatly" in the prompts (the model does not recognize proper-noun channel tags).
- CORE STYLE FORMULA: "Minimalist 2D flat vector stickman doodle illustration, clean thick bold black marker outlines, flat solid color fills, zero shading, zero gradients, zero shadows, pure simple minimalist shapes, ${sceneStaging === 'studio' ? 'seamless ' + moodObj.label + ' studio background' : 'full-bleed flat 2D ' + eraObj.label + ' environment'}, ${ratioObj.desc}, zero 3D rendering, zero photorealism, zero comic book detail".
- PROMPT LENGTH: Concise and punchy (30 to 45 words max).

### 2. CHARACTER SPECIFICATION (TRUE WHATLY STICKMAN DOODLE):
When human characters appear, they MUST be simple, cute 2D stick figures:
- Round circle head filled with simple skin tone.
- Two large round white cartoon eyes with black dot pupils.
- Simple expressive line eyebrows and mouth (e.g. smiling, wide shock, shivering chattering teeth).
- Simple rounded torso wearing flat-colored attire: ${attireText}.
- Thin black stick-line arms and legs (pure stickman limbs).
- ABSOLUTELY NO muscular detail, NO realistic face, NO gritty comic book shading, NO crosshatching.

### 3. THE GOLDEN RULE OF WHATLY: CONCRETE PHYSICAL SCENES ONLY (NO ABSTRACT DIAGRAMS!):
Image diffusion models are camera renderers, NOT graphic designers. They CANNOT understand abstract symbols like "bare skin symbol", "visual transition from X to Y", or "fading silhouettes behind red Xs" (these produce bizarre flesh blobs and clipart mess).
EVERY PROMPT MUST DESCRIBE A REAL, CONCRETE, PHYSICAL SCENE:
- HOW TO DO COMPARISONS (The Whatly Character Gag): Put subjects side by side in the physical scene! E.g. To show humans had no thick fur like animals: Show a shivering blue stickman with chattering teeth and shivering lines looking enviously at a cozy fluffy woolly mammoth standing happily in the snow.
- HOW TO SHOW ABSTRACT IDEAS (Intelligence / Creativity): Draw a confident stickman winking with a bright glowing cartoon lightbulb and brain icon floating above his head, holding a simple stone tool.
- HOW TO SHOW INVENTIONS & TOOLS: Draw a concrete macro close-up of a sharp carved bone needle threading leather hide, or a stickman proudly holding a finished fur jacket.
- ZERO TEXT / ZERO WORDS: NEVER request words, letters, labels, or captions. Diffusion models cannot render text. Use only physical objects and simple visual icons.

### 4. 4 DIVERSE PHYSICAL SHOT TYPES:
Cycle through these 4 physical shot types to keep the storyboard exciting:
1. CHARACTER GAG / ACTION: Stickman interacting with animals, tools, or elements (e.g. freezing stickman beside warm mammoth; stickman striking flint sparks).
2. WIDE SCALE LANDSCAPE: Vast icy landscape where stickman is a tiny cute silhouette in the bottom corner dwarfed by colossal ice.
3. MACRO OBJECT STILL-LIFE: Clean close-up of a tangible tool or invention (e.g. sharp bone needle piercing hide; campfire with orange sparks).
4. WILDLIFE SCENE: A cute flat vector prehistoric beast (e.g. woolly mammoth with curved tusks walking across snowy plains; no humans).

### 5. THEME & SETTING CONTEXT:
- Era: ${eraObj.label} (${eraObj.desc}).
- Character Attire & Hair (WHEN CHARACTERS APPEAR): ${attireText}.
- Backdrop Palette: ${moodObj.label} (${moodObj.desc}).
- Video Framing: ${ratioObj.label} (${ratioObj.desc}).
${customSetting.trim() ? `- Key Story Props / Elements: ${customSetting.trim()}\n` : ""}
### 6. COMPLETE STORY SCRIPT BACKGROUND:
"""
${scriptText}
"""

### 7. ${taskTitle}:
Generate visual scene descriptions ONLY for the following target sentences. Do not skip or combine sentences.
Target sentences:
${targetSlice}

### 8. STRICT JSON OUTPUT FORMAT:
Output MUST be a valid JSON array of objects matching this schema exactly.
Do not wrap in extra conversational markdown text. RETURN ONLY VALID JSON:
[
  {
    "scene_number": ${startNum},
    "narration_khmer": "<exact Khmer sentence from target list>",
    "shot_type": "character_action | wide_scale | object_focus | wildlife",
    "image_prompt_english": "<concise 30-45 word prompt describing a CONCRETE physical scene in minimalist stickman doodle style, zero text, bold black outlines, flat solid colors>",
    "negative_prompt": "text, words, letters, labels, alphabet, captions, watermark, signature, comic book, gritty, realistic, muscular, detailed anatomy, 3D, render, shading, gradients, shadows, photorealistic"
  }
]

### REFERENCE EXAMPLES OF PROPER WHATLY SCENES (CONCRETE & CLEAN):
- Example Comparison (Physical Gag): "Minimalist 2D flat vector stickman illustration, a miserable stickman character shivering and hugging his thin arms with blue frost on his cheeks, standing next to a huge cozy woolly mammoth covered in thick fluffy fur smiling in the falling snow, bold black outlines, flat solid colors, seamless ${moodObj.label} background."
- Example Idea / Intelligence: "Minimalist 2D flat vector stickman illustration, a clever prehistoric stickman smiling proudly with a bright glowing yellow lightbulb and brain icon floating above his head, holding a sharp flint spearhead, thin stick limbs, bold black outlines, flat solid colors, seamless ${moodObj.label} background."
- Example Macro Tool: "Minimalist 2D flat vector doodle illustration, macro close-up of a sharp prehistoric carved bone needle with sinew thread puncturing thick animal hide leather, simple clean graphic lines, vibrant flat solid colors, bold black outlines, seamless ${moodObj.label} background."
- Example Wide Landscape: "Minimalist 2D flat vector illustration, a massive flat-colored blue glacial wall towering across the frame, a tiny cute stickman silhouette walking in the lower corner dwarfed by the giant ice, cold minimalist atmosphere, bold black outlines, flat solid colors, seamless ${moodObj.label} background."`;
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
  const currentEra = ERA_OPTIONS.find((e) => e.id === selectedEra) || ERA_OPTIONS[0];
  const currentMood = MOOD_OPTIONS.find((m) => m.id === selectedMood) || MOOD_OPTIONS[0];

  return (
    <div className="flex flex-col h-[calc(100vh-56px-48px)] max-h-[calc(100vh-56px-48px)] animate-in fade-in duration-200">
      
      {/* ========================================================= */}
      {/* MAIN WORKSPACE: PLAIN ON BACKGROUND (NO GIANT OUTER BOXES)*/}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full flex-1 min-h-0 pt-1">
        
        {/* ======================================================= */}
        {/* SCRIPT STUDIO (LEFT COLUMN)                             */}
        {/* ======================================================= */}
        <div className="lg:col-span-6 flex flex-col h-full pr-1">
          {/* Header Bar */}
          <div className="h-8 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2">
                <PenLine size={14} strokeWidth={1.8} className="text-primary" />
                <span className="text-[12px] font-bold text-foreground uppercase tracking-wider">
                  Narrative Script (Khmer)
                </span>
              </div>
              <span className="text-[10px] font-semibold text-panel-text bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                {sentences.length} {sentences.length === 1 ? "Line" : "Lines"}
              </span>
            </div>

            {/* Auto-Break to Lines */}
            <button
              type="button"
              onClick={handleAutoBreakToLines}
              className="text-[10px] font-medium text-primary hover:text-primary-hover bg-primary/10 hover:bg-primary/15 px-2.5 py-1 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all border border-primary/20 shadow-2xs"
              title="Automatically split sentences into separate lines at every Khmer full stop (។)"
            >
              <CornerDownLeft size={11} /> Auto-Break
            </button>
          </div>

          {/* Clean Writing Paper / Canvas (Box only where necessary!) */}
          <div className="flex-1 flex flex-col min-h-[260px] bg-card rounded-xl border border-border/80 shadow-2xs p-4 my-2 focus-within:border-primary/50 transition-all overflow-hidden">
            <textarea
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              onBlur={handleScriptBlur}
              placeholder={
                splitMode === "enter"
                  ? "Type or paste your narrative script here. Each new line (Enter ↵) becomes an individual scene..."
                  : "Paste your research script here... (Separate sentences with ។, commas, or newlines)"
              }
              className="w-full h-full bg-transparent text-[15px] text-foreground leading-relaxed placeholder:text-zinc-400/40 focus:outline-none resize-none custom-scrollbar"
            />
          </div>

          {/* Clean Minimalist Style Bar with Custom Upward-Popping Dropdowns */}
          <div ref={styleBarRef} className="py-2 flex items-center justify-between gap-2 text-xs flex-wrap shrink-0 border-t border-border/50">
            <div className="flex items-center gap-2 flex-wrap">
              {/* 1. Custom Era Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === "era" ? null : "era")}
                  className={`flex items-center gap-1.5 bg-card hover:bg-zinc-100 dark:hover:bg-zinc-800 border rounded-lg px-2 py-1 text-[11px] font-semibold text-foreground cursor-pointer transition-colors shadow-2xs ${
                    openDropdown === "era" ? "border-primary ring-1 ring-primary/30" : "border-border/70"
                  }`}
                  title="Select narrative era and setting"
                >
                  <span className="text-panel-text font-normal text-[11px]">Era:</span>
                  <span>{currentEra.shortLabel || currentEra.label}</span>
                  <ChevronDown size={11} className={`text-panel-text ml-0.5 transition-transform duration-150 ${openDropdown === "era" ? "rotate-180 text-primary" : ""}`} />
                </button>

                {openDropdown === "era" && (
                  <div className="absolute bottom-full mb-2 left-0 z-50 bg-card border border-border/80 rounded-xl shadow-2xl p-2 min-w-[270px] max-h-[250px] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
                    <div className="text-[10px] font-semibold text-panel-text uppercase tracking-wider px-2 pb-1.5 border-b border-border/40 mb-1">
                      Narrative Era & Setting
                    </div>
                    <div className="space-y-0.5">
                      {ERA_OPTIONS.map((era) => {
                        const isSelected = selectedEra === era.id;
                        return (
                          <button
                            key={era.id}
                            type="button"
                            onClick={() => {
                              handleSelectEra(era.id);
                              setOpenDropdown(null);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                              isSelected ? "bg-primary/10 text-primary font-semibold" : "text-foreground/85 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            }`}
                          >
                            <div className="pr-2 min-w-0">
                              <div className="text-[11px] font-semibold flex items-center gap-1.5 truncate">
                                {era.label}
                              </div>
                              <div className="text-[10px] text-panel-text leading-tight mt-0.5 truncate">
                                {era.desc}
                              </div>
                            </div>
                            {isSelected && <Check size={12} className="text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Custom Staging Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === "staging" ? null : "staging")}
                  className={`flex items-center gap-1.5 bg-card hover:bg-zinc-100 dark:hover:bg-zinc-800 border rounded-lg px-2 py-1 text-[11px] font-semibold text-foreground cursor-pointer transition-colors shadow-2xs ${
                    openDropdown === "staging" ? "border-primary ring-1 ring-primary/30" : "border-border/70"
                  }`}
                  title="Select scene staging style"
                >
                  <span className="text-panel-text font-normal text-[11px]">Staging:</span>
                  <span>{sceneStaging === "studio" ? "Studio Canvas" : "Environment"}</span>
                  <ChevronDown size={11} className={`text-panel-text ml-0.5 transition-transform duration-150 ${openDropdown === "staging" ? "rotate-180 text-primary" : ""}`} />
                </button>

                {openDropdown === "staging" && (
                  <div className="absolute bottom-full mb-2 left-0 z-50 bg-card border border-border/80 rounded-xl shadow-2xl p-2 min-w-[270px] max-h-[220px] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
                    <div className="text-[10px] font-semibold text-panel-text uppercase tracking-wider px-2 pb-1.5 border-b border-border/40 mb-1">
                      Scene Staging Style
                    </div>
                    <div className="space-y-0.5">
                      {SCENE_STAGING_OPTIONS.map((st) => {
                        const isSelected = sceneStaging === st.id;
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => {
                              handleSelectStaging(st.id as any);
                              setOpenDropdown(null);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                              isSelected ? "bg-primary/10 text-primary font-semibold" : "text-foreground/85 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            }`}
                          >
                            <div className="pr-2 min-w-0">
                              <div className="text-[11px] font-semibold truncate">
                                {st.label}
                              </div>
                              <div className="text-[10px] text-panel-text leading-tight mt-0.5 truncate">
                                {st.sub}
                              </div>
                            </div>
                            {isSelected && <Check size={12} className="text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Custom Aspect Ratio Dropdown with Graphic matching Google Flow */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === "ratio" ? null : "ratio")}
                  className={`flex items-center gap-1.5 bg-card hover:bg-zinc-100 dark:hover:bg-zinc-800 border rounded-lg px-2 py-1 text-[11px] font-semibold text-foreground cursor-pointer transition-colors shadow-2xs ${
                    openDropdown === "ratio" ? "border-primary ring-1 ring-primary/30" : "border-border/70"
                  }`}
                  title="Select video aspect ratio matching Google Flow"
                >
                  <span className="text-panel-text font-normal text-[11px]">Ratio:</span>
                  <AspectRatioGraphic ratio={selectedAspectRatio} className="text-primary" />
                  <span>{selectedAspectRatio}</span>
                  <ChevronDown size={11} className={`text-panel-text ml-0.5 transition-transform duration-150 ${openDropdown === "ratio" ? "rotate-180 text-primary" : ""}`} />
                </button>

                {openDropdown === "ratio" && (
                  <div className="absolute bottom-full mb-2 left-0 z-50 bg-card border border-border/80 rounded-xl shadow-2xl p-2.5 min-w-[250px] max-h-[250px] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
                    <div className="text-[10px] font-semibold text-panel-text uppercase tracking-wider px-1 pb-1.5 border-b border-border/40 mb-1.5">
                      Google Flow Aspect Ratio
                    </div>
                    
                    {/* Horizontal 5-graphic strip matching Google Flow UI */}
                    <div className="grid grid-cols-5 gap-1 p-1 bg-background/80 dark:bg-zinc-900/50 rounded-lg mb-2 border border-border/40">
                      {ASPECT_RATIO_OPTIONS.map((opt) => {
                        const isSelected = selectedAspectRatio === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              handleSelectAspectRatio(opt.id);
                              setOpenDropdown(null);
                            }}
                            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-md cursor-pointer transition-all ${
                              isSelected
                                ? "bg-primary text-white shadow-2xs font-bold"
                                : "text-panel-text hover:text-foreground hover:bg-card"
                            }`}
                            title={`${opt.id} - ${opt.sub}`}
                          >
                            <AspectRatioGraphic ratio={opt.id} className="mb-1" />
                            <span className="text-[10px] font-medium leading-none">{opt.id}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Detailed List */}
                    <div className="space-y-0.5">
                      {ASPECT_RATIO_OPTIONS.map((opt) => {
                        const isSelected = selectedAspectRatio === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              handleSelectAspectRatio(opt.id);
                              setOpenDropdown(null);
                            }}
                            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left text-[11px] transition-colors cursor-pointer ${
                              isSelected ? "bg-primary/10 text-primary font-semibold" : "text-foreground/85 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <AspectRatioGraphic ratio={opt.id} className={isSelected ? "text-primary" : "text-panel-text"} />
                              <span className="font-semibold">{opt.id}</span>
                              <span className="text-[10px] text-panel-text">({opt.sub})</span>
                            </div>
                            {isSelected && <Check size={12} className="text-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Custom Backdrop Color Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === "mood" ? null : "mood")}
                  className={`flex items-center gap-1.5 bg-card hover:bg-zinc-100 dark:hover:bg-zinc-800 border rounded-lg px-2 py-1 text-[11px] font-semibold text-foreground cursor-pointer transition-colors shadow-2xs ${
                    openDropdown === "mood" ? "border-primary ring-1 ring-primary/30" : "border-border/70"
                  }`}
                  title="Select studio backdrop color"
                >
                  <span className="text-panel-text font-normal text-[11px]">Backdrop:</span>
                  <div 
                    className="w-3.5 h-3.5 rounded-full border border-black/20 dark:border-white/30 shadow-2xs shrink-0" 
                    style={{ backgroundColor: currentMood.color }} 
                  />
                  <span>{currentMood.shortLabel || currentMood.label}</span>
                  <ChevronDown size={11} className={`text-panel-text ml-0.5 transition-transform duration-150 ${openDropdown === "mood" ? "rotate-180 text-primary" : ""}`} />
                </button>

                {openDropdown === "mood" && (
                  <div className="absolute bottom-full mb-2 left-0 z-50 bg-card border border-border/80 rounded-xl shadow-2xl p-2 min-w-[250px] max-h-[250px] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
                    <div className="text-[10px] font-semibold text-panel-text uppercase tracking-wider px-2 pb-1.5 border-b border-border/40 mb-1">
                      Studio Backdrop Color
                    </div>
                    <div className="space-y-0.5">
                      {MOOD_OPTIONS.map((m) => {
                        const isSelected = selectedMood === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              handleSelectMood(m.id);
                              setOpenDropdown(null);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                              isSelected ? "bg-primary/10 text-primary font-semibold" : "text-foreground/85 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 pr-2 min-w-0">
                              <div 
                                className="w-5 h-5 rounded-full border border-black/20 dark:border-white/30 shadow-xs ring-2 ring-black/5 dark:ring-white/10 shrink-0" 
                                style={{ backgroundColor: m.color }} 
                              />
                              <div className="min-w-0">
                                <div className="text-[11px] font-semibold truncate">
                                  {m.label}
                                </div>
                                <div className="text-[10px] text-panel-text leading-tight mt-0.5 truncate">
                                  {m.desc}
                                </div>
                              </div>
                            </div>
                            {isSelected && <Check size={12} className="text-primary shrink-0 ml-1" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Prompt Action Bar (Target Batches + Copy) */}
          <div className="pt-2 flex items-center justify-between gap-2 shrink-0 border-t border-border/40">
            {/* Left: Compact Batch Stepper & Popover (No horizontal scrolling!) */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-semibold text-panel-text uppercase tracking-wider shrink-0">
                Target:
              </span>
              
              {batches.length > 0 ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* All Scenes Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedBatchIndex(-1)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                      selectedBatchIndex === -1
                        ? "bg-primary text-white font-semibold shadow-2xs"
                        : "bg-card hover:bg-zinc-100 dark:hover:bg-zinc-800 text-panel-text border border-border/60"
                    }`}
                  >
                    All ({sentences.length})
                  </button>

                  {/* Batch Dropdown */}
                  <div className="relative" ref={batchDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === "batch" ? null : "batch")}
                      className={`flex items-center gap-1.5 bg-card hover:bg-zinc-100 dark:hover:bg-zinc-800 border rounded-lg px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition-colors shadow-2xs ${
                        selectedBatchIndex >= 0 ? "border-primary text-primary font-bold" : "border-border/70 text-panel-text hover:text-foreground"
                      }`}
                      title="Select target batch"
                    >
                      <span>
                        {selectedBatchIndex >= 0 && batches[selectedBatchIndex]
                          ? `B${selectedBatchIndex + 1} (${batches[selectedBatchIndex].start}–${batches[selectedBatchIndex].end})`
                          : `Batches (1–${batches.length})`}
                      </span>
                      <ChevronDown size={11} className={`transition-transform duration-150 ${openDropdown === "batch" ? "rotate-180 text-primary" : "text-panel-text"}`} />
                    </button>

                    {/* Upward Popover Grid */}
                    {openDropdown === "batch" && (
                      <div className="absolute bottom-full mb-2 left-0 z-50 bg-card border border-border/80 rounded-xl shadow-2xl p-2.5 min-w-[280px] max-w-[340px] max-h-[260px] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
                        <div className="flex items-center justify-between text-[10px] font-semibold text-panel-text uppercase tracking-wider px-1 pb-1.5 border-b border-border/40 mb-2">
                          <span>Select Target Batch</span>
                          <span className="text-[10px] text-panel-text font-medium">{batches.length} Batches Total</span>
                        </div>

                        {/* All Scenes Option */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBatchIndex(-1);
                            setOpenDropdown(null);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-[11px] mb-1.5 transition-colors cursor-pointer ${
                            selectedBatchIndex === -1 ? "bg-primary/10 text-primary font-bold" : "text-foreground/85 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          }`}
                        >
                          <span>All Scenes (1–{sentences.length})</span>
                          {selectedBatchIndex === -1 && <Check size={12} className="text-primary" />}
                        </button>

                        {/* Grid of Batches */}
                        <div className="grid grid-cols-2 gap-1.5">
                          {batches.map((batch, idx) => {
                            const isSelected = selectedBatchIndex === idx;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setSelectedBatchIndex(idx);
                                  setOpenDropdown(null);
                                }}
                                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-[11px] transition-all cursor-pointer border ${
                                  isSelected
                                    ? "bg-primary text-white border-primary shadow-2xs font-bold"
                                    : "bg-background/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-foreground/90 border-border/50"
                                }`}
                              >
                                <div className="flex items-baseline gap-1.5">
                                  <span className={isSelected ? "text-white font-bold" : "text-primary font-semibold"}>B{idx + 1}</span>
                                  <span className={`text-[10px] ${isSelected ? "text-white/80" : "text-panel-text"}`}>
                                    ({batch.start}–{batch.end})
                                  </span>
                                </div>
                                {isSelected && <Check size={12} className="text-white shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Custom Batch Size Dropdown (Beside stepper, appears above, plenty of options!) */}
                  <div className="relative" ref={batchSizeRef}>
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === "batchSize" ? null : "batchSize")}
                      className={`flex items-center gap-1.5 bg-card hover:bg-zinc-100 dark:hover:bg-zinc-800 border rounded-lg px-2 py-1 text-[11px] font-semibold text-foreground cursor-pointer transition-colors shadow-2xs ${
                        openDropdown === "batchSize" ? "border-primary ring-1 ring-primary/30" : "border-border/70"
                      }`}
                      title="Choose scenes per batch"
                    >
                      <span className="text-panel-text font-normal text-[11px]">Size:</span>
                      <span>{batchSize}/batch</span>
                      <ChevronDown size={11} className={`text-panel-text ml-0.5 transition-transform duration-150 ${openDropdown === "batchSize" ? "rotate-180 text-primary" : ""}`} />
                    </button>

                    {openDropdown === "batchSize" && (
                      <div className="absolute bottom-full mb-2 left-0 z-50 bg-card border border-border/80 rounded-xl shadow-2xl p-2 min-w-[150px] animate-in fade-in zoom-in-95 duration-100">
                        <div className="text-[10px] font-semibold text-panel-text uppercase tracking-wider px-2 pb-1.5 border-b border-border/40 mb-1">
                          Scenes Per Batch
                        </div>
                        <div className="space-y-0.5">
                          {[3, 5, 8, 10, 15, 20].map((sz) => {
                            const isSelected = batchSize === sz;
                            return (
                              <button
                                key={sz}
                                type="button"
                                onClick={() => {
                                  setBatchSize(sz);
                                  setSelectedBatchIndex(0);
                                  setOpenDropdown(null);
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-[11px] transition-colors cursor-pointer ${
                                  isSelected ? "bg-primary/10 text-primary font-semibold" : "text-foreground/85 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                }`}
                              >
                                <span>{sz} scenes</span>
                                {isSelected && <Check size={12} className="text-primary" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-[11px] text-panel-text italic">
                  Paste script to prompt
                </span>
              )}
            </div>

            {/* Right: Action Buttons (Preview + Copy Prompt with Merged Stepper) */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                disabled={sentences.length === 0}
                className="h-8 px-2.5 rounded-lg border border-border/80 bg-card hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11.5px] font-medium text-foreground flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none shadow-2xs"
                title="Preview prompt"
              >
                <Eye size={13} className="text-primary" />
                <span>Preview</span>
              </button>

              {/* Merged Stepper Copy Button */}
              <div className="flex items-center rounded-lg shadow-2xs overflow-hidden border border-primary/40 bg-primary h-8">
                {/* Prev Batch Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (selectedBatchIndex > 0) {
                      setSelectedBatchIndex(selectedBatchIndex - 1);
                    } else if (selectedBatchIndex === 0) {
                      setSelectedBatchIndex(-1);
                    }
                  }}
                  disabled={selectedBatchIndex === -1 || sentences.length === 0}
                  className="h-full px-2 bg-primary hover:bg-primary-hover active:bg-primary text-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer border-r border-white/20 flex items-center justify-center"
                  title={selectedBatchIndex > 0 ? `Previous batch (B${selectedBatchIndex})` : "Previous (All scenes)"}
                >
                  <ChevronLeft size={13} strokeWidth={2.5} />
                </button>

                {/* Middle Copy Button */}
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  disabled={sentences.length === 0}
                  className={`h-full px-3.5 bg-primary hover:bg-primary-hover active:bg-primary text-white font-semibold text-[11.5px] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${
                    isCopied ? "bg-emerald-600 hover:bg-emerald-600" : ""
                  }`}
                  title="Copy prompt for current target"
                >
                  {isCopied ? (
                    <>
                      <Check size={13} strokeWidth={2.5} />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Copy {selectedBatchIndex === -1 ? `All (${sentences.length})` : `B${selectedBatchIndex + 1}`}</span>
                    </>
                  )}
                </button>

                {/* Next Batch Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (selectedBatchIndex === -1) {
                      setSelectedBatchIndex(0);
                    } else if (selectedBatchIndex < batches.length - 1) {
                      setSelectedBatchIndex(selectedBatchIndex + 1);
                    }
                  }}
                  disabled={selectedBatchIndex >= batches.length - 1 || sentences.length === 0}
                  className="h-full px-2 bg-primary hover:bg-primary-hover active:bg-primary text-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer border-l border-white/20 flex items-center justify-center"
                  title={selectedBatchIndex < batches.length - 1 ? `Next batch (B${selectedBatchIndex + 2})` : "Next batch"}
                >
                  <ChevronRight size={13} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* ======================================================= */}
        {/* STORYBOARD DECK (RIGHT COLUMN)                          */}
        {/* ======================================================= */}
        <div className="lg:col-span-6 flex flex-col h-full overflow-hidden pl-5 border-l border-border/50">
          {/* Header Bar */}
          <div className="h-8 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-primary" />
              <span className="text-[12px] font-bold text-foreground uppercase tracking-wider">
                Storyboard Deck
              </span>
              <span className="text-[10px] font-semibold text-panel-text bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                {scenes.length} {scenes.length === 1 ? "Scene" : "Scenes"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsJsonDrawerOpen(!isJsonDrawerOpen)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                isJsonDrawerOpen
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "bg-card hover:bg-zinc-100 dark:hover:bg-zinc-800 text-panel-text hover:text-foreground border border-border/50"
              }`}
            >
              <FileCode2 size={12} />
              <span>{isJsonDrawerOpen ? "Close Ingest" : "Paste JSON"}</span>
              {isJsonDrawerOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
          </div>

          {/* Collapsible JSON Ingestion Drawer (Box only when open) */}
          {isJsonDrawerOpen && (
            <div className="bg-card rounded-xl p-3 my-2 border border-border/80 shadow-2xs space-y-2 animate-in fade-in duration-150 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wider">
                  Paste AI Response JSON
                </span>

                {/* Mode toggle */}
                <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800/80 p-0.5 rounded-md text-[10px]">
                  <button
                    type="button"
                    onClick={() => setImportMode("replace")}
                    className={`px-2 py-0.5 rounded font-medium transition-all cursor-pointer ${
                      importMode === "replace"
                        ? "bg-card text-red-500 shadow-2xs font-semibold"
                        : "text-panel-text hover:text-foreground"
                    }`}
                    title="Wipe existing scenes and replace"
                  >
                    Replace All
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode("append")}
                    className={`px-2 py-0.5 rounded font-medium transition-all cursor-pointer ${
                      importMode === "append"
                        ? "bg-card text-emerald-500 shadow-2xs font-semibold"
                        : "text-panel-text hover:text-foreground"
                    }`}
                    title="Append new scenes to end"
                  >
                    Append
                  </button>
                </div>
              </div>

              <textarea
                value={jsonInput}
                onChange={handleJsonChange}
                rows={3}
                placeholder='Paste JSON here: [ { "scene_number": 1, "narration_khmer": "...", "image_prompt_english": "...", "negative_prompt": "..." } ]'
                className="w-full p-2.5 bg-background/50 dark:bg-zinc-900/40 rounded-lg border border-border/60 font-mono text-[11px] text-foreground placeholder:text-zinc-400/40 focus:border-primary focus:outline-none transition-all resize-none custom-scrollbar"
              />

              {jsonError && (
                <div className="text-[11px] text-red-500 flex items-center gap-1.5 bg-red-500/10 p-2 rounded-md">
                  <AlertCircle size={12} className="shrink-0" />
                  <span className="truncate">{jsonError}</span>
                </div>
              )}
              {importSuccessMessage && (
                <div className="text-[11px] text-emerald-500 flex items-center gap-1.5 bg-emerald-500/10 p-2 rounded-md">
                  <CheckCircle2 size={12} className="shrink-0" />
                  <span>{importSuccessMessage}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleImportScenes}
                disabled={!jsonInput.trim() || !!jsonError || isImporting}
                className="w-full py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-[11px] font-semibold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
              >
                {isImporting ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Ingesting Scenes...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight size={12} />
                    <span>Ingest {importMode === "append" ? "and Append" : "and Replace"}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Storyboard Scene Cards List - Fully Displayed, NO internal scrollbars */}
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5 my-2 pr-1">
            {scenes.length === 0 ? (
              <div className="text-center py-12 px-4 border border-dashed border-border/70 rounded-xl text-panel-text space-y-2">
                <Layers size={22} className="mx-auto opacity-30" />
                <p className="text-[12px] font-medium text-foreground/80">Timeline is currently empty</p>
                <p className="text-[11px] text-panel-text max-w-xs mx-auto leading-relaxed">
                  1. Copy the frontier prompt on the left.
                  <br />2. Paste into ChatGPT / Claude.
                  <br />3. Click "Paste JSON" above to ingest scenes.
                </p>
              </div>
            ) : (
              scenes.map((scene: any) => (
                <div 
                  key={scene.id || scene.scene_number} 
                  className="group bg-card rounded-xl p-3.5 border border-border/70 hover:border-border transition-all shadow-2xs space-y-2"
                >
                  {/* Scene Header */}
                  <div className="flex items-center justify-between pb-1 border-b border-border/30">
                    <span className="text-[11px] font-bold text-primary tracking-wide">
                      Scene #{String(scene.scene_number).padStart(2, "0")}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteScene(scene.id)}
                      className="text-panel-text/60 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1 rounded cursor-pointer"
                      title="Delete scene"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Khmer Voiceover - Fully Displayed (AutoResize) */}
                  <div>
                    <label className="text-[9px] font-semibold text-panel-text uppercase tracking-wider block mb-0.5">
                      Voiceover (Khmer)
                    </label>
                    <AutoResizeTextarea
                      defaultValue={scene.narration_khmer || ""}
                      onBlur={(val) => updateSingleScene(scene.id, { narration_khmer: val })}
                      placeholder="Khmer voiceover narration..."
                      className="w-full bg-transparent text-[13px] text-foreground leading-relaxed outline-none border-b border-border/30 focus:border-primary transition-colors py-0.5"
                    />
                  </div>

                  {/* English Visual Prompt - Fully Displayed (AutoResize) */}
                  <div>
                    <label className="text-[9px] font-semibold text-panel-text uppercase tracking-wider block mb-0.5">
                      Stickman Visual Prompt (English)
                    </label>
                    <AutoResizeTextarea
                      defaultValue={scene.image_prompt_english || ""}
                      onBlur={(val) => updateSingleScene(scene.id, { image_prompt_english: val })}
                      placeholder="Stickman visual prompt in English..."
                      className="w-full bg-transparent font-mono text-[11px] text-foreground/80 leading-relaxed outline-none border-b border-border/30 focus:border-primary transition-colors py-0.5"
                    />
                  </div>

                  {/* Negative Constraints: Click-to-expand dropdown */}
                  <div className="pt-1 border-t border-border/30">
                    <button
                      type="button"
                      onClick={() => toggleExclusion(scene.id)}
                      className="flex items-center gap-1.5 text-[10px] font-medium text-panel-text hover:text-foreground cursor-pointer transition-colors py-0.5 w-full text-left"
                      title="Click to expand/collapse exclusions"
                    >
                      <ChevronRight 
                        size={11} 
                        className={`text-panel-text transition-transform duration-150 shrink-0 ${
                          expandedExclusions[scene.id] ? "rotate-90 text-primary" : ""
                        }`} 
                      />
                      <span className="uppercase tracking-wider text-[9px] font-semibold text-panel-text">
                        Exclusions
                      </span>
                      {!expandedExclusions[scene.id] && scene.negative_prompt && (
                        <span className="text-[10px] font-mono text-panel-text/60 truncate flex-1 ml-1">
                          — {scene.negative_prompt}
                        </span>
                      )}
                      {!expandedExclusions[scene.id] && !scene.negative_prompt && (
                        <span className="text-[10px] text-panel-text/40 italic flex-1 ml-1">
                          (none)
                        </span>
                      )}
                    </button>

                    {expandedExclusions[scene.id] && (
                      <div className="pt-1.5 pb-0.5 animate-in fade-in duration-100">
                        <AutoResizeTextarea
                          defaultValue={scene.negative_prompt || ""}
                          onBlur={(val) => updateSingleScene(scene.id, { negative_prompt: val })}
                          placeholder="e.g. text, words, labels, comic book, 3D, photorealistic..."
                          className="w-full bg-zinc-100/60 dark:bg-zinc-900/60 p-2 rounded-lg font-mono text-[10px] text-foreground leading-relaxed outline-none border border-border/60 focus:border-primary transition-colors"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

        </div>

      </div>

      {/* ========================================================= */}
      {/* MODAL: PROMPT PREVIEW WITH BATCH SWITCHER                */}
      {/* ========================================================= */}
      {isPreviewOpen && (
        <div 
          onClick={() => setIsPreviewOpen(false)}
          className="fixed inset-0 z-50 bg-black/35 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 cursor-default"
          >
            
            {/* Modal Header */}
            <div className="h-12 px-5 border-b border-border flex items-center justify-between shrink-0 bg-card">
              <div className="flex items-center gap-2">
                <Eye size={15} className="text-primary" />
                <div>
                  <h3 className="text-[13px] font-bold text-foreground">Frontier Prompt Preview</h3>
                  <p className="text-[10px] text-panel-text">Exact text formatted for ChatGPT / Claude web chat</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="text-panel-text hover:text-foreground p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Batch Switcher inside Modal - Wrapping without horizontal scroll */}
            <div className="px-5 py-2.5 bg-background/60 border-b border-border flex items-center gap-1.5 flex-wrap shrink-0">
              <span className="text-[10px] font-bold text-panel-text uppercase tracking-wider mr-1">
                Target:
              </span>
              <button
                type="button"
                onClick={() => setSelectedBatchIndex(-1)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                  selectedBatchIndex === -1
                    ? "bg-primary text-white font-semibold shadow-2xs"
                    : "bg-card border border-border text-panel-text hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                All ({sentences.length})
              </button>
              {batches.map((b, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedBatchIndex(idx)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                    selectedBatchIndex === idx
                      ? "bg-primary text-white font-semibold shadow-2xs"
                      : "bg-card border border-border text-panel-text hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  B{idx + 1} ({b.start}–{b.end})
                </button>
              ))}
            </div>

            {/* Prompt Text Body */}
            <div className="flex-1 overflow-y-auto p-5 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 font-mono text-[12px] leading-relaxed custom-scrollbar whitespace-pre-wrap select-text border-y border-border/80">
              {generatePrompt()}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-card border-t border-border flex items-center justify-end shrink-0">

              {/* Stepper Copy Button inside Modal */}
              <div className="flex items-center rounded-lg shadow-2xs overflow-hidden border border-primary/40 bg-primary h-8">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedBatchIndex > 0) {
                      setSelectedBatchIndex(selectedBatchIndex - 1);
                    } else if (selectedBatchIndex === 0) {
                      setSelectedBatchIndex(-1);
                    }
                  }}
                  disabled={selectedBatchIndex === -1}
                  className="h-full px-2.5 bg-primary hover:bg-primary-hover active:bg-primary text-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer border-r border-white/20 flex items-center justify-center"
                  title="Previous batch"
                >
                  <ChevronLeft size={13} strokeWidth={2.5} />
                </button>

                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className={`h-full px-4 bg-primary hover:bg-primary-hover active:bg-primary text-white font-semibold text-[11.5px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isCopied ? "bg-emerald-600 hover:bg-emerald-600" : ""
                  }`}
                  title="Copy prompt for current target"
                >
                  {isCopied ? (
                    <>
                      <Check size={13} strokeWidth={2.5} />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Copy {selectedBatchIndex === -1 ? `All (${sentences.length})` : `B${selectedBatchIndex + 1}`}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (selectedBatchIndex === -1) {
                      setSelectedBatchIndex(0);
                    } else if (selectedBatchIndex < batches.length - 1) {
                      setSelectedBatchIndex(selectedBatchIndex + 1);
                    }
                  }}
                  disabled={selectedBatchIndex >= batches.length - 1}
                  className="h-full px-2.5 bg-primary hover:bg-primary-hover active:bg-primary text-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer border-l border-white/20 flex items-center justify-center"
                  title="Next batch"
                >
                  <ChevronRight size={13} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
