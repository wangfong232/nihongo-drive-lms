"use client";

import { useState, useEffect, useCallback } from "react";

export interface UserSettings {
  trackVideoWatchTime: boolean;
  showResumePrompt: boolean;
}

const SETTINGS_KEY = "nihongo_user_settings";
const SETTINGS_EVENT = "nihongo_user_settings_changed";

const DEFAULT_SETTINGS: UserSettings = {
  trackVideoWatchTime: true,
  showResumePrompt: true,
};

export function getStoredUserSettings(): UserSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveStoredUserSettings(settings: UserSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  } catch (e) {
    console.error("Failed to save user settings", e);
  }
}

export const userSettingsService = {
  get(): UserSettings {
    return getStoredUserSettings();
  },

  update(partial: Partial<UserSettings>): UserSettings {
    const current = getStoredUserSettings();
    const updated = { ...current, ...partial };
    saveStoredUserSettings(updated);
    return updated;
  },

  setTrackVideoWatchTime(enabled: boolean): UserSettings {
    return this.update({ trackVideoWatchTime: enabled });
  },

  setShowResumePrompt(enabled: boolean): UserSettings {
    return this.update({ showResumePrompt: enabled });
  },
};

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  const refresh = useCallback(() => {
    setSettings(getStoredUserSettings());
  }, []);

  useEffect(() => {
    refresh();
    const handleUpdate = () => refresh();
    window.addEventListener(SETTINGS_EVENT, handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener(SETTINGS_EVENT, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [refresh]);

  return {
    settings,
    updateSettings: userSettingsService.update.bind(userSettingsService),
    setTrackVideoWatchTime: userSettingsService.setTrackVideoWatchTime.bind(userSettingsService),
    setShowResumePrompt: userSettingsService.setShowResumePrompt.bind(userSettingsService),
  };
}
