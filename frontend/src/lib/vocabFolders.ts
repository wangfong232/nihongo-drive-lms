"use client";

import { useState, useEffect, useCallback } from "react";

export interface VocabFolder {
  id: string;
  name: string;
  description?: string;
  color?: string; // Tailwind color e.g. "amber", "emerald", "indigo", "rose", "cyan"
  icon?: string;
  createdAt: string;
}

const FOLDERS_KEY = "nihongo_vocab_folders";
const FOLDERS_EVENT = "nihongo_vocab_folders_changed";

const DEFAULT_FOLDERS: VocabFolder[] = [
  {
    id: "default-minna",
    name: "Minna no Nihongo — Cơ Bản",
    description: "Bộ từ vựng giáo trình sơ cấp Minna",
    color: "orange",
    createdAt: new Date().toISOString(),
  },
  {
    id: "default-travel",
    name: "Giao Tiếp & Du Lịch",
    description: "Các mẫu câu và từ vựng thông dụng khi đi lại, ăn uống tại Nhật",
    color: "emerald",
    createdAt: new Date().toISOString(),
  },
  {
    id: "default-jlpt",
    name: "Chinh Phục JLPT N5 - N3",
    description: "Từ vựng trọng tâm hay ra trong các kỳ thi JLPT",
    color: "indigo",
    createdAt: new Date().toISOString(),
  },
];

function getStoredFolders(): VocabFolder[] {
  if (typeof window === "undefined") return DEFAULT_FOLDERS;
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    if (!raw) {
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(DEFAULT_FOLDERS));
      return DEFAULT_FOLDERS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_FOLDERS;
  }
}

function saveStoredFolders(folders: VocabFolder[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    window.dispatchEvent(new Event(FOLDERS_EVENT));
  } catch (e) {
    console.error("Failed to save folders to localStorage", e);
  }
}

export const vocabFolderService = {
  getFolders(): VocabFolder[] {
    return getStoredFolders();
  },

  createFolder(name: string, description = "", color = "indigo"): VocabFolder {
    const folders = getStoredFolders();
    const newFolder: VocabFolder = {
      id: `folder_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: name.trim(),
      description: description.trim(),
      color,
      createdAt: new Date().toISOString(),
    };
    folders.push(newFolder);
    saveStoredFolders(folders);
    return newFolder;
  },

  updateFolder(id: string, name: string, description?: string, color?: string): VocabFolder | null {
    const folders = getStoredFolders();
    const idx = folders.findIndex((f) => f.id === id);
    if (idx === -1) return null;
    folders[idx] = {
      ...folders[idx],
      name: name.trim(),
      description: description !== undefined ? description.trim() : folders[idx].description,
      color: color || folders[idx].color,
    };
    saveStoredFolders(folders);
    return folders[idx];
  },

  deleteFolder(id: string): boolean {
    const folders = getStoredFolders();
    const filtered = folders.filter((f) => f.id !== id);
    if (filtered.length === folders.length) return false;
    saveStoredFolders(filtered);
    return true;
  },
};

export function useVocabFolders() {
  const [folders, setFolders] = useState<VocabFolder[]>([]);

  const refresh = useCallback(() => {
    setFolders(vocabFolderService.getFolders());
  }, []);

  useEffect(() => {
    refresh();
    const handleUpdate = () => refresh();
    window.addEventListener(FOLDERS_EVENT, handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener(FOLDERS_EVENT, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [refresh]);

  return {
    folders,
    createFolder: vocabFolderService.createFolder,
    updateFolder: vocabFolderService.updateFolder,
    deleteFolder: vocabFolderService.deleteFolder,
  };
}
