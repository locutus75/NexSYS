/**
 * components/shared/ConfirmDialog.tsx
 * Modal dialog requiring explicit confirmation for high-risk actions.
 * Must be used for any BLOCK-tier or irreversible wallet action.
 */

import { useEffect, useRef } from "react";
import "./ConfirmDialog.css";

interface Props {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  confirmDisabled?: boolean;
  cancelDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  confirmDisabled = false,
  cancelDisabled = false,
  onConfirm,
  onCancel,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open && !cancelDisabled) onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel, cancelDisabled]);

  // Trap focus inside dialog when open
  useEffect(() => {
    if (open) {
      // Delay slightly so children with autoFocus can mount and grab focus first.
      // If focus is not already inside the dialog, focus the dialog container.
      setTimeout(() => {
        if (dialogRef.current && !dialogRef.current.contains(document.activeElement)) {
          dialogRef.current.focus();
        }
      }, 10);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div 
      className="dialog-overlay" 
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !cancelDisabled) {
          onCancel();
        }
      }} 
      role="presentation"
    >
      <div
        className="dialog"
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-desc"
        tabIndex={-1}
      >
        <div className="dialog__header">
          <span className="dialog__icon">{danger ? "⚠️" : "🔐"}</span>
          <h3 id="dialog-title" className="dialog__title">{title}</h3>
        </div>
        <div id="dialog-desc" className="dialog__desc">{description}</div>
        <div className="dialog__actions">
          <button
            id="dialog-cancel"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={cancelDisabled}
          >
            {cancelLabel}
          </button>
          <button
            id="dialog-confirm"
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
