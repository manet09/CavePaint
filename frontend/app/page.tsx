"use client";

import React from "react";
import Sidebar from "./components/Sidebar";
import { useProjectContext } from "./context/ProjectContext";
import { FileText, Sparkles, Mic, Film } from "lucide-react";
import OverviewTab from "./components/OverviewTab";
import ImagesTab from "./components/ImagesTab";

export default function Workspace() {
  const { activeProject, activeTab, setActiveTab, refreshProjects } = useProjectContext();

  const tabs = [
    { id: "overview", label: "Overview", icon: FileText },
    { id: "images", label: "Images", icon: Sparkles },
    { id: "voice", label: "Voice", icon: Mic },
    { id: "output", label: "Output", icon: Film },
  ];

  return (
    <div className="flex flex-1 w-full bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {activeProject ? (
          <>
            {/* Header / Tabs */}
            <header className="border-b border-border bg-card px-8 pt-8">
              <h1 className="text-3xl font-bold mb-6 tracking-tight text-card-foreground">
                {activeProject.topic || activeProject.name || "Untitled Project"}
              </h1>
              <div className="flex gap-8">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 pb-4 border-b-2 transition-colors duration-200 ${
                        isActive
                          ? "border-primary text-primary font-medium"
                          : "border-transparent text-foreground/50 hover:text-foreground hover:border-foreground/20"
                      }`}
                    >
                      <Icon size={18} className={isActive ? "text-primary" : "opacity-70"} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </header>
            
            {/* Tab Content Area */}
            <div className="flex-1 overflow-y-auto p-8 bg-background">
              {activeTab === "overview" && (
                <OverviewTab activeProject={activeProject} refreshProjectData={refreshProjects} />
              )}
              {activeTab === "images" && (
                <ImagesTab activeProject={activeProject} refreshProjectData={refreshProjects} />
              )}
              {activeTab === "voice" && (
                <div className="max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <h2 className="text-xl font-semibold mb-4">Voice & Audio</h2>
                  <p className="text-foreground/70 leading-relaxed">
                    Voice selection and audio generation controls go here.
                  </p>
                </div>
              )}
              {activeTab === "output" && (
                <div className="max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <h2 className="text-xl font-semibold mb-4">Final Output</h2>
                  <p className="text-foreground/70 leading-relaxed">
                    Video compilation, preview, and export controls go here.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-background animate-in fade-in duration-700">
            <div className="w-24 h-24 mb-8 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner shadow-primary/20">
              <Film size={48} className="text-primary opacity-90" />
            </div>
            <h2 className="text-4xl font-extrabold mb-4 tracking-tight text-foreground">
              Welcome to CavePaint
            </h2>
            <p className="text-lg text-foreground/60 max-w-md leading-relaxed">
              Your local content creation engine. Select an existing project from the sidebar or initialize a new one to get started.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
