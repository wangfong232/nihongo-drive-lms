import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes?: number, decimals = 2) {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Strips all file extension artifacts (.mp4.mp4_2, .mp4_2, .pdf, .mp3, etc.) to produce a clean lesson title
 */
export function cleanLessonTitle(rawName: string): string {
  if (!rawName) return "Bài học mới";
  let cleaned = rawName.trim();
  // Strip repetitive double extensions and artifacts e.g. .mp4.mp4_2, .mp4_2, .mkv.mp4, etc.
  cleaned = cleaned.replace(/(\.(mp4|mp3|m4a|wav|pdf|docx?|pptx?|txt|mkv|avi|webm|flv|part|zip|rar)(_\d+)?)+$/gi, "");
  cleaned = cleaned.replace(/\.(mp4|mp3|pdf|mkv|avi|docx?|txt)_\d+$/gi, "");
  cleaned = cleaned.replace(/\.[a-zA-Z0-9]{2,5}$/i, "");
  return cleaned.trim() || rawName;
}
