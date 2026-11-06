"use client";

import React from "react";
import styles from "./ToastContainer.module.css";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

function ToastIcon({ type }: { type: ToastType }) {
  switch (type) {
    case "success":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case "error":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
    case "warning":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case "info":
    default:
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
  }
}

function getTypeLabel(type: ToastType): string {
  switch (type) {
    case "success":
      return "Success";
    case "error":
      return "Attention";
    case "warning":
      return "Notice";
    case "info":
      return "Information";
  }
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className={styles.container} aria-live="assertive" role="region" aria-label="Notifications">
      {toasts.map((toast) => {
        const typeClass =
          toast.type === "success"
            ? styles.typeSuccess
            : toast.type === "error"
            ? styles.typeError
            : toast.type === "warning"
            ? styles.typeWarning
            : styles.typeInfo;

        return (
          <div
            key={toast.id}
            className={`${styles.toastCard} ${typeClass}`}
            role="alert"
          >
            <div className={styles.iconWrapper} aria-hidden="true">
              <ToastIcon type={toast.type} />
            </div>

            <div className={styles.content}>
              <span className={styles.typeTitle}>{getTypeLabel(toast.type)}</span>
              <span className={styles.message}>{toast.message}</span>
            </div>

            <button
              type="button"
              className={styles.btnClose}
              onClick={() => onDismiss(toast.id)}
              aria-label="Close notification"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}

