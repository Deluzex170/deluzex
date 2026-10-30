"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { CustomCellRendererProps } from "ag-grid-react";
import { Eye, ImageOff, Pencil, Trash2 } from "lucide-react";
import styles from "./gridRenderers.module.css";

/* ─── Formatting helpers (also usable as valueFormatters) ─── */

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatINR(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? inr.format(n) : "—";
}

export function formatDateTime(value: unknown): string {
  if (!value) return "—";
  const d = new Date(value as string | number | Date);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();
  return `${date}, ${time}`;
}

/** Comparator so date columns sort chronologically, not alphabetically. */
export function dateComparator(a: unknown, b: unknown): number {
  const ta = a ? new Date(a as string).getTime() : 0;
  const tb = b ? new Date(b as string).getTime() : 0;
  return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
}

/* ─── 1. Image thumbnail ─── */

/** Ask the image CDN for a small version instead of the full-size original. */
export function thumbnailUrl(src: string, px: number): string {
  const dim = Math.round(px * 2); // 2x for high-density screens
  try {
    if (/ik\.imagekit\.io\//.test(src) && !/[?&]tr=/.test(src)) {
      return src + (src.includes("?") ? "&" : "?") + `tr=w-${dim},h-${dim},c-at_max`;
    }
    if (/res\.cloudinary\.com\/.+\/image\/upload\//.test(src) && !/\/upload\/[a-z]_/.test(src)) {
      return src.replace("/image/upload/", `/image/upload/w_${dim},h_${dim},c_fill,f_auto,q_auto/`);
    }
  } catch {
    // fall through to the original URL
  }
  return src;
}

export function ImageThumbnailRenderer(props: CustomCellRendererProps & { size?: number; rounded?: boolean }) {
  const [failed, setFailed] = useState(false);
  const size = props.size ?? 36;
  const src = typeof props.value === "string" && props.value ? thumbnailUrl(props.value, size) : "";
  return (
    <span className={`${styles.thumb} ${props.rounded ? styles.thumbRound : ""}`} style={{ width: size, height: size }}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote CMS/Cloudinary URLs of unknown hosts
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <ImageOff size={Math.round(size / 2.4)} aria-hidden="true" />
      )}
    </span>
  );
}

/* ─── 2. Currency (₹1,249.00) ─── */

export function CurrencyRenderer(props: CustomCellRendererProps) {
  return <span className={styles.currency}>{formatINR(props.value)}</span>;
}

/* ─── 3. Status badge (orders + stock) ─── */

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "gold";

const STATUS_TONES: Array<[RegExp, Tone]> = [
  [/(cancel|fail|out of stock|refund|reject|inactive|expired|disabled)/i, "danger"],
  [/(deliver|in stock|active|paid|approved|success|live|published)/i, "success"],
  [/(low stock|pending|cod|awaiting|order|draft)/i, "warning"],
  [/(process|production|ship|dispatch|transit|out for delivery|return)/i, "info"],
  [/(featured|new arrival|vip)/i, "gold"],
];

export function toneFor(status: string): Tone {
  for (const [re, tone] of STATUS_TONES) if (re.test(status)) return tone;
  return "neutral";
}

export function StatusBadge({ label, tone }: { label: string; tone?: Tone }) {
  const t = tone ?? toneFor(label);
  return <span className={`${styles.badge} ${styles[`badge_${t}`]}`}>{label}</span>;
}

export function StatusBadgeRenderer(props: CustomCellRendererProps) {
  const raw = props.valueFormatted ?? props.value;
  if (raw === null || raw === undefined || raw === "") return <span className={styles.muted}>—</span>;
  const label = String(raw).replace(/_/g, " ").toUpperCase();
  return <StatusBadge label={label} />;
}

/* ─── 4. Action buttons (View / Edit / Delete) ─── */

export interface ActionButtonsParams<T> {
  /** Open the record (link). */
  viewHref?: (row: T) => string | undefined;
  viewInNewTab?: boolean;
  onView?: (row: T) => void;
  editHref?: (row: T) => string | undefined;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  /** Extra labels for screen readers, e.g. the product title. */
  labelFor?: (row: T) => string;
}

export function ActionButtonsRenderer<T>(props: CustomCellRendererProps<T> & ActionButtonsParams<T>) {
  const row = props.data;
  if (!row) return null;
  const name = props.labelFor?.(row) ?? "record";
  const viewHref = props.viewHref?.(row);
  const editHref = props.editHref?.(row);
  return (
    <div className={styles.actions}>
      {viewHref ? (
        <Link href={viewHref} target={props.viewInNewTab ? "_blank" : undefined} rel={props.viewInNewTab ? "noopener noreferrer" : undefined} className={styles.actionBtn} title={`View ${name}`} aria-label={`View ${name}`}>
          <Eye size={15} aria-hidden="true" />
        </Link>
      ) : props.onView ? (
        <button type="button" className={styles.actionBtn} onClick={() => props.onView?.(row)} title={`View ${name}`} aria-label={`View ${name}`}>
          <Eye size={15} aria-hidden="true" />
        </button>
      ) : null}
      {editHref ? (
        <Link href={editHref} className={styles.actionBtn} title={`Edit ${name}`} aria-label={`Edit ${name}`}>
          <Pencil size={14} aria-hidden="true" />
        </Link>
      ) : props.onEdit ? (
        <button type="button" className={styles.actionBtn} onClick={() => props.onEdit?.(row)} title={`Edit ${name}`} aria-label={`Edit ${name}`}>
          <Pencil size={14} aria-hidden="true" />
        </button>
      ) : null}
      {props.onDelete ? (
        <button type="button" className={`${styles.actionBtn} ${styles.actionDanger}`} onClick={() => props.onDelete?.(row)} title={`Delete ${name}`} aria-label={`Delete ${name}`}>
          <Trash2 size={14} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

/* ─── 5. Date (30 Oct 2026, 03:45 PM) ─── */

export function DateRenderer(props: CustomCellRendererProps) {
  return <span className={styles.date}>{formatDateTime(props.value)}</span>;
}

/* ─── Two-line cell (title + secondary text), used for names, customers, etc. ─── */

export function StackedCell({ title, subtitle, titleClassName }: { title: React.ReactNode; subtitle?: React.ReactNode; titleClassName?: string }) {
  return (
    <span className={styles.stacked}>
      <span className={`${styles.stackedTitle} ${titleClassName ?? ""}`}>{title}</span>
      {subtitle ? <span className={styles.stackedSub}>{subtitle}</span> : null}
    </span>
  );
}

export const rendererStyles = styles;
