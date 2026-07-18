/* eslint-disable @next/next/no-img-element */
"use client";

import React from "react";
import { Project } from "../../context/ProjectContext";
import { FolderCheck, Image as ImageIcon, AudioLines } from "lucide-react";

interface OutputTabProps {
  activeProject: Project;
}

interface SceneData {
  id?: number;
  scene_number?: number;
  image_path?: string;
  image_prompt_english?: string;
  narration_khmer?: string;
  audio_path?: string;
  [key: string]: unknown;
}

export default function OutputTab({ activeProject }: OutputTabProps) {
  const getAssetUrl = (path: string) => {
    if (!path) return "";
    const filename = path.split("/").pop() || path.split("\\").pop();
    return `http://localhost:8000/static/${filename}`;
  };

  return (
    <div className="flex flex-col gap-6 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Asset Information Header */}
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-5 flex items-center gap-3">
        <FolderCheck size={24} className="text-primary flex-shrink-0" />
        <p className="text-sm font-mono text-primary font-medium break-all">
          📁 Local Workspace Path: ~/Code/video_studio/workspace/{activeProject.slug || "untitled"}/
        </p>
      </div>

      <div className="flex justify-between items-end mb-2">
        <h3 className="text-xl font-bold text-foreground">Vertical Production Timeline</h3>
        <p className="text-sm text-foreground/50">Finalized rendered output mapping</p>
      </div>

      {/* Vertical Timeline List */}
      <div className="space-y-4">
        {(!activeProject.scenes || activeProject.scenes.length === 0) ? (
          <div className="text-center p-12 border border-dashed border-border rounded-lg text-foreground/50">
            No scenes available in the timeline yet.
          </div>
        ) : (
          activeProject.scenes.map((scene: unknown, index: number) => {
            const sceneData = scene as SceneData;
            return (
            <div key={sceneData.id || index} className="flex gap-6 bg-card border border-border p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              
              {/* Left: Vertical Thumbnail Image */}
              <div className="w-24 h-40 bg-black rounded-md overflow-hidden flex-shrink-0 relative flex items-center justify-center">
                {sceneData.image_path ? (
                  <img 
                    src={getAssetUrl(sceneData.image_path)} 
                    alt={`Scene ${sceneData.scene_number}`} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center px-2 flex flex-col items-center">
                    <ImageIcon size={20} className="opacity-30 mb-2" />
                    <span className="text-[10px] text-foreground/40 font-medium uppercase tracking-wider">No Image</span>
                  </div>
                )}
              </div>

              {/* Center Column: Text & Audio */}
              <div className="flex flex-col flex-1 justify-between">
                <div>
                  <h4 className="font-bold text-sm tracking-wide text-primary mb-3 block">
                    Scene #{String(sceneData.scene_number || index + 1).padStart(2, '0')}
                  </h4>
                  
                  <div className="mb-3">
                    <span className="text-xs font-semibold text-foreground/50 uppercase tracking-wider block mb-1">
                      Visual Prompt (English)
                    </span>
                    <p className="text-sm text-foreground/80 line-clamp-2 leading-relaxed">
                      {sceneData.image_prompt_english || "N/A"}
                    </p>
                  </div>

                  <div className="mb-4">
                    <span className="text-xs font-semibold text-foreground/50 uppercase tracking-wider block mb-1">
                      Voiceover Script (Khmer)
                    </span>
                    <p className="text-sm text-foreground/90 font-medium line-clamp-2">
                      {sceneData.narration_khmer || "N/A"}
                    </p>
                  </div>
                </div>

                {/* Bottom of Center Column: Audio Player */}
                <div className="bg-background border border-border rounded-lg p-2 flex items-center gap-4">
                  {sceneData.audio_path ? (
                    <audio controls className="w-full h-8 outline-none custom-audio-player">
                      <source src={getAssetUrl(sceneData.audio_path)} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
                  ) : (
                    <div className="w-full h-8 flex items-center justify-center gap-2 text-xs text-foreground/40 font-medium">
                      <AudioLines size={14} /> No audio track rendered yet
                    </div>
                  )}
                </div>
              </div>
              
            </div>
            );
          })
        )}
      </div>

    </div>
  );
}
