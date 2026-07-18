 
"use client";

import React from "react";
import { Film } from "lucide-react";

export default function WelcomeScreen() {
  return (
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
  );
}
