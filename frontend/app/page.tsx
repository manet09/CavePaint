/* eslint-disable */
"use client";

import React from "react";
import Sidebar from "./components/Sidebar";
import { useProjectContext } from "./context/ProjectContext";
import { FileText, Sparkles, Mic, Film } from "lucide-react";
import OverviewTab from "./components/OverviewTab";
import ImagesTab from "./components/ImagesTab";
import VoiceTab from "./components/VoiceTab";
import OutputTab from "./components/OutputTab";

export default function Workspace() {
  const { activeProject, activeTab, setActiveTab, refreshProjects } = useProjectContext();

  const tabs = [
    { id: "overview", label: "Overview", icon: FileText },
    { id: "images", label: "Images", icon: Sparkles },
    { id: "voice", label: "Voice", icon: Mic },
    { id: "output", label: "Output", icon: Film },
  ];

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden select-none">
      <Sidebar />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-zinc-50/50 dark:bg-background">
        {activeProject ? (
          <>
            {/* High-Density Modern Header Bar */}
            <header className="h-14 min-h-[56px] border-b border-zinc-200/60 dark:border-zinc-800/40 bg-card/80 backdrop-blur-md px-6 flex items-center justify-between z-10 shrink-0">
              {/* Left Context: Project Path Title */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-panel-text text-[13px] font-medium tracking-tight">Projects</span>
                <span className="text-panel-text opacity-50 text-sm">/</span>
                <h1 className="text-[14px] font-semibold tracking-tight text-panel-icon truncate max-w-[200px]">
                  {activeProject.title || activeProject.slug || "Untitled Project"}
                </h1>
              </div>

              {/* Right Context: Clean Tab Control Links */}
              <div className="flex items-center gap-1 h-full">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-3 h-14 relative text-[13px] font-medium tracking-tight transition-all ${
                        isActive
                          ? "text-panel-icon"
                          : "text-panel-text hover:text-panel-icon"
                      }`}
                    >
                      <Icon size={14} className={isActive ? "opacity-100" : "opacity-60"} />
                      <span>{tab.label}</span>
                      {isActive && (
                        <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-panel-icon rounded-t-full" />
                      )}
                    </button>
                  );
                })}
              </div>
            </header>
            
            {/* Clean Tab Workspace Window */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {activeTab === "overview" && (
                <OverviewTab activeProject={activeProject} refreshProjectData={refreshProjects} />
              )}
              {activeTab === "images" && (
                <ImagesTab activeProject={activeProject} refreshProjectData={refreshProjects} />
              )}
              {activeTab === "voice" && (
                <VoiceTab activeProject={activeProject} refreshProjectData={refreshProjects} />
              )}
              {activeTab === "output" && (
                <OutputTab activeProject={activeProject} />
              )}
            </div>
          </>
        ) : (
          /* High-Density Modern Minimalist Welcome View */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-panel-header/30 animate-in fade-in duration-300">
            <div className="w-16 h-16 mb-6 rounded-2xl border border-border bg-panel-header flex items-center justify-center shadow-xs text-panel-icon">
              <Film size={28} className="opacity-80" />
            </div>
            <h2 className="text-xl font-semibold mb-2 tracking-tight text-panel-icon">
              Welcome to Studio
            </h2>
            <p className="text-[13.5px] text-panel-text max-w-sm leading-relaxed">
              Select an existing project timeline tracking panel from the sidebar menu or initialize a new draft sequence to begin compiling tracking blocks.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}