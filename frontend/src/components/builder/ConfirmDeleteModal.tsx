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
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 max-w-md w-full flex flex-col gap-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${bgColor}`}>
              <AlertTriangle className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div>
              <h3
                id="delete-modal-title"
                className="font-bold text-sm text-slate-900 dark:text-white"
              >
                {t("confirmDelete")} — {t(titleKey)}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {t("deleteWarning")}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning body */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-2">
          <p className="text-xs text-slate-700 dark:text-slate-300">
            {t(warningKey)}{" "}
            <span className="font-bold text-slate-900 dark:text-white">
              &ldquo;{entityName}&rdquo;
            </span>
            ?
          </p>
          <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
            ⚠ {t(detailKey)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 transition-all disabled:opacity-60 shadow-sm shadow-rose-500/20"
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
