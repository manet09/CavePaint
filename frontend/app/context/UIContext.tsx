/* eslint-disable */
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Theme = "dark" | "light";

interface UIContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [sidebarCollapsed, setSidebarCollapsedState] = useState<boolean>(false);
  const [activeTab, setActiveTabState] = useState<string>("brainstorming");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      setThemeState(savedTheme);
    }
    const savedCollapsed = localStorage.getItem("sidebarCollapsed");
    if (savedCollapsed !== null) {
      setSidebarCollapsedState(savedCollapsed === "true");
    }
    const savedTab = localStorage.getItem("activeTab");
    if (savedTab) {
      setActiveTabState(savedTab === "overview" ? "brainstorming" : savedTab);
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if (typeof window !== "undefined") localStorage.setItem("theme", newTheme);
  };

  const setSidebarCollapsed = (collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    if (typeof window !== "undefined") localStorage.setItem("sidebarCollapsed", String(collapsed));
  };

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    if (typeof window !== "undefined") localStorage.setItem("activeTab", tab);
  };

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme]);

  return (
    <UIContext.Provider
      value={{
        theme,
        setTheme,
        sidebarCollapsed,
        setSidebarCollapsed,
        activeTab,
        setActiveTab,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

export const useUIContext = () => {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUIContext must be used within a UIProvider");
  return ctx;
};
