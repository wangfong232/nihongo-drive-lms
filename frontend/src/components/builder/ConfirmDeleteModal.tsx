"use client";

import React from "react";
import { AlertTriangle, X, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type DeleteVariant = "course" | "section" | "lesson";

interface ConfirmDeleteModalProps {
  variant: DeleteVariant;
  entityName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  variant,
  entityName,
  onConfirm,
  onCancel,
  isDeleting = false,
}) => {
  const { t } = useI18n();

  const warningKey =
    variant === "course"
      ? "deleteCourseWarning"
      : variant === "section"
      ? "deleteSectionWarning"
      : "deleteLessonWarning";

  const detailKey =
    variant === "course"
      ? "deleteCourseDetail"
      : variant === "section"
      ? "deleteSectionDetail"
      : "deleteLessonDetail";

  const titleKey =
    variant === "course"
      ? "deleteCourse"
      : variant === "section"
      ? "deleteSection"
      : "deleteLesson";

  const iconColor =
    variant === "course"
      ? "text-rose-500"
      : variant === "section"
      ? "text-orange-500"
      : "text-amber-500";

  const bgColor =
    variant === "course"
      ? "bg-rose-500/10 border-rose-500/20"
      : variant === "section"
      ? "bg-orange-500/10 border-orange-500/20"
      : "bg-amber-500/10 border-amber-500/20";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="bg-[#f8f9ff] dark:bg-[#0b1c30] rounded-3xl p-6 border-2 border-[#d3e4fe] dark:border-slate-800 max-w-md w-full flex flex-col gap-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b-2 border-[#d3e4fe] dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center shrink-0 shadow-inner ${bgColor}`}>
              <AlertTriangle className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div>
              <h3
                id="delete-modal-title"
                className="font-black text-sm text-[#0b1c30] dark:text-white"
              >
                {t("confirmDelete")} — {t(titleKey)}
              </h3>
              <p className="text-[11px] text-[#3c4a42] dark:text-slate-400 font-medium mt-0.5">
                {t("deleteWarning")}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 text-slate-500 hover:text-rose-500 border border-[#d3e4fe] dark:border-slate-700 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning body */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#d3e4fe] dark:border-slate-800 p-4 flex flex-col gap-2 shadow-xs">
          <p className="text-xs text-[#0b1c30] dark:text-slate-200 font-semibold">
            {t(warningKey)}{" "}
            <span className="font-black text-[#0b1c30] dark:text-white">
              &ldquo;{entityName}&rdquo;
            </span>
            ?
          </p>
          <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 p-2 rounded-xl border border-rose-200 dark:border-rose-900">
            ⚠ {t(detailKey)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-5 py-2 rounded-full text-xs font-black text-[#0b1c30] dark:text-slate-200 bg-white dark:bg-slate-800 border-2 border-[#d3e4fe] dark:border-slate-700 hover:bg-[#eff4ff] transition-all disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex items-center gap-2 px-6 py-2 rounded-full text-xs font-black text-white bg-rose-600 shadow-[0_4px_0_#9f1239] hover:shadow-[0_2px_0_#9f1239] hover:translate-y-[2px] active:translate-y-[4px] active:shadow-none transition-all disabled:opacity-60"
          >
            {isDeleting ? (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            {t("deleteConfirmButton")}
          </button>
        </div>
      </div>
    </div>
  );
};
