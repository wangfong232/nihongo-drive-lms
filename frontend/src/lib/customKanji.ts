"use client";

import { useState, useEffect, useCallback } from "react";
import { KanjiItem, KanjiExample, RADICALS_LIST } from "./kanji-data";

const CUSTOM_KANJI_KEY = "nihongo_custom_kanji";
const CUSTOM_KANJI_EVENT = "nihongo_custom_kanji_changed";

export function getCustomKanjis(): KanjiItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_KANJI_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveCustomKanjis(list: KanjiItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CUSTOM_KANJI_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(CUSTOM_KANJI_EVENT));
  } catch (e) {
    console.error("Failed to save custom kanjis to localStorage", e);
  }
}

export const customKanjiService = {
  getAll(): KanjiItem[] {
    return getCustomKanjis();
  },

  add(item: Omit<KanjiItem, "id">): KanjiItem {
    const list = getCustomKanjis();
    const cleanChar = item.character.trim();
    
    // Check if existing in custom
    const existingIdx = list.findIndex((k) => k.character === cleanChar);
    const newItem: KanjiItem = {
      ...item,
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      character: cleanChar,
    };

    if (existingIdx !== -1) {
      list[existingIdx] = newItem;
    } else {
      list.unshift(newItem);
    }

    saveCustomKanjis(list);
    return newItem;
  },

  addMultiple(items: Array<Omit<KanjiItem, "id">>): number {
    const list = getCustomKanjis();
    let count = 0;

    for (const item of items) {
      const cleanChar = item.character.trim();
      if (!cleanChar) continue;

      const existingIdx = list.findIndex((k) => k.character === cleanChar);
      const newItem: KanjiItem = {
        ...item,
        id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        character: cleanChar,
      };

      if (existingIdx !== -1) {
        list[existingIdx] = newItem;
      } else {
        list.unshift(newItem);
      }
      count++;
    }

    if (count > 0) {
      saveCustomKanjis(list);
    }
    return count;
  },

  update(id: string, updated: Partial<KanjiItem>): KanjiItem | null {
    const list = getCustomKanjis();
    const idx = list.findIndex((k) => k.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updated };
    saveCustomKanjis(list);
    return list[idx];
  },

  delete(id: string): boolean {
    const list = getCustomKanjis();
    const filtered = list.filter((k) => k.id !== id);
    if (filtered.length === list.length) return false;
    saveCustomKanjis(filtered);
    return true;
  },

  /**
   * Syncs Kanji from vocabulary words.
   * If a vocabulary word contains Kanji characters, extract each character and register/update it.
   */
  syncKanjiFromVocab(vocabList: Array<{
    word: string;
    reading: string;
    meaning: string;
    jlptLevel?: string;
    tagsJson?: string;
  }>) {
    const customList = getCustomKanjis();
    let modified = false;

    for (const v of vocabList) {
      if (!v.word) continue;
      // Match all CJK Unified Ideographs
      const kanjiChars = v.word.match(/[\u4e00-\u9faf]/g);
      if (!kanjiChars) continue;

      let hanViet = "";
      if (v.tagsJson) {
        try {
          const parsed = JSON.parse(v.tagsJson);
          if (parsed.hanViet) hanViet = parsed.hanViet;
        } catch {}
      }

      for (const char of kanjiChars) {
        // Find radical
        const matchedRad = RADICALS_LIST.find((r) => r.radical === char) || {
          radical: char,
          name: `Bộ ${char}`,
          meaning: "",
          strokeCount: 4,
        };

        const existingCustom = customList.find((k) => k.character === char);
        const example: KanjiExample = {
          word: v.word,
          reading: v.reading || v.word,
          meaning: v.meaning || "",
        };

        const jlpt = (v.jlptLevel && ["N5", "N4", "N3", "N2", "N1"].includes(v.jlptLevel.toUpperCase()))
          ? (v.jlptLevel.toUpperCase() as "N5" | "N4" | "N3" | "N2" | "N1")
          : "N5";

        if (existingCustom) {
          // Check if example already exists
          const hasEx = existingCustom.examples.some((ex) => ex.word === v.word);
          if (!hasEx) {
            existingCustom.examples.push(example);
            if (!existingCustom.hanViet && hanViet) existingCustom.hanViet = hanViet;
            modified = true;
          }
        } else {
          customList.push({
            id: `synced-vocab-${char}-${Date.now()}`,
            character: char,
            hanViet: hanViet || "HÁN VIỆT",
            meaning: v.meaning || "Từ vựng tiếng Nhật",
            onyomi: [],
            kunyomi: [v.reading || ""],
            strokeCount: matchedRad.strokeCount || 4,
            jlpt,
            radical: matchedRad.radical,
            radicalName: matchedRad.name,
            examples: [example],
          });
          modified = true;
        }
      }
    }

    if (modified) {
      saveCustomKanjis(customList);
    }
  }
};

export function useCustomKanji() {
  const [customKanjis, setCustomKanjis] = useState<KanjiItem[]>([]);

  const refresh = useCallback(() => {
    setCustomKanjis(customKanjiService.getAll());
  }, []);

  useEffect(() => {
    refresh();
    const handleUpdate = () => refresh();
    window.addEventListener(CUSTOM_KANJI_EVENT, handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener(CUSTOM_KANJI_EVENT, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [refresh]);

  return {
    customKanjis,
    addCustomKanji: customKanjiService.add,
    addMultipleCustomKanji: customKanjiService.addMultiple,
    updateCustomKanji: customKanjiService.update,
    deleteCustomKanji: customKanjiService.delete,
    syncKanjiFromVocab: customKanjiService.syncKanjiFromVocab,
    refresh,
  };
}
