"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface LevelInfo {
  code: string;
  label: string;
  description: string;
}

interface CourseLevelContextType {
  selectedLevel: string;
  setSelectedLevel: (level: string) => void;
  availableLevels: LevelInfo[];
}

const CourseLevelContext = createContext<CourseLevelContextType | undefined>(undefined);

export const AVAILABLE_LEVELS: LevelInfo[] = [
  { code: "N5", label: "JLPT N5", description: "Sơ cấp 1 (Cơ bản)" },
  { code: "N4", label: "JLPT N4", description: "Sơ cấp 2" },
  { code: "N3", label: "JLPT N3", description: "Trung cấp" },
  { code: "N2", label: "JLPT N2", description: "Thượng cấp" },
  { code: "N1", label: "JLPT N1", description: "Cao cấp" },
  { code: "ALL", label: "Tất Cả Khóa", description: "Xem toàn bộ giáo trình" },
];

export const CourseLevelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedLevel, setSelectedLevelState] = useState<string>("N5");

  useEffect(() => {
    const saved = localStorage.getItem("nihongo_selected_level");
    if (saved) {
      setSelectedLevelState(saved);
    }
  }, []);

  const setSelectedLevel = (level: string) => {
    setSelectedLevelState(level);
    localStorage.setItem("nihongo_selected_level", level);
  };

  return (
    <CourseLevelContext.Provider
      value={{
        selectedLevel,
        setSelectedLevel,
        availableLevels: AVAILABLE_LEVELS,
      }}
    >
      {children}
    </CourseLevelContext.Provider>
  );
};

export const useCourseLevel = () => {
  const context = useContext(CourseLevelContext);
  if (!context) {
    throw new Error("useCourseLevel must be used within a CourseLevelProvider");
  }
  return context;
};
