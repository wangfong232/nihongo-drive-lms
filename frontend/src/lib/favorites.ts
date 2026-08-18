"use client";

import { useState, useEffect, useCallback } from "react";

const VOCAB_FAV_KEY = "nihongo_fav_vocab_ids";
const KANJI_FAV_KEY = "nihongo_fav_kanji_list";
const CUSTOM_EVENT = "nihongo_favorites_changed";

function getLocalItem<T>(key: string, defaultVal: T): T {
  if (typeof window === "undefined") return defaultVal;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch {
    return defaultVal;
  }
}

function setLocalItem<T>(key: string, val: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
    window.dispatchEvent(new Event(CUSTOM_EVENT));
  } catch (e) {
    console.error("Failed to save favorites to localStorage", e);
  }
}

export const favoritesService = {
  getFavoriteVocabIds(): string[] {
    return getLocalItem<string[]>(VOCAB_FAV_KEY, []);
  },

  isVocabFavorite(vocabId: string): boolean {
    const list = getLocalItem<string[]>(VOCAB_FAV_KEY, []);
    return list.includes(vocabId);
  },

  toggleVocabFavorite(vocabId: string): boolean {
    const list = getLocalItem<string[]>(VOCAB_FAV_KEY, []);
    const idx = list.indexOf(vocabId);
    let isNowFav = false;
    if (idx >= 0) {
      list.splice(idx, 1);
      isNowFav = false;
    } else {
      list.push(vocabId);
      isNowFav = true;
    }
    setLocalItem(VOCAB_FAV_KEY, list);
    return isNowFav;
  },

  getFavoriteKanjis(): string[] {
    return getLocalItem<string[]>(KANJI_FAV_KEY, []);
  },

  isKanjiFavorite(char: string): boolean {
    const list = getLocalItem<string[]>(KANJI_FAV_KEY, []);
    return list.includes(char);
  },

  toggleKanjiFavorite(char: string): boolean {
    const list = getLocalItem<string[]>(KANJI_FAV_KEY, []);
    const idx = list.indexOf(char);
    let isNowFav = false;
    if (idx >= 0) {
      list.splice(idx, 1);
      isNowFav = false;
    } else {
      list.push(char);
      isNowFav = true;
    }
    setLocalItem(KANJI_FAV_KEY, list);
    return isNowFav;
  },
};

export function useFavorites() {
  const [favoriteVocabIds, setFavoriteVocabIds] = useState<string[]>([]);
  const [favoriteKanjis, setFavoriteKanjis] = useState<string[]>([]);

  const refresh = useCallback(() => {
    setFavoriteVocabIds(favoritesService.getFavoriteVocabIds());
    setFavoriteKanjis(favoritesService.getFavoriteKanjis());
  }, []);

  useEffect(() => {
    refresh();
    const handleUpdate = () => refresh();
    window.addEventListener(CUSTOM_EVENT, handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener(CUSTOM_EVENT, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [refresh]);

  return {
    favoriteVocabIds,
    favoriteKanjis,
    isVocabFavorite: (id: string) => favoriteVocabIds.includes(id),
    toggleVocabFavorite: favoritesService.toggleVocabFavorite,
    isKanjiFavorite: (char: string) => favoriteKanjis.includes(char),
    toggleKanjiFavorite: favoritesService.toggleKanjiFavorite,
  };
}
