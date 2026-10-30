"use client";

import React, { useEffect, useState, useMemo } from "react";
import type { ColDef } from "ag-grid-community";
import type { CustomCellRendererProps } from "ag-grid-react";
import { Eye, Trash2, CheckCircle2, EyeOff, RotateCw, Sparkles, MessageSquare } from "lucide-react";
import AdminDataGrid from "../../components/admin/AdminDataGrid";
import { StatusBadge, dateComparator } from "../../components/admin/gridRenderers";
import styles from "./reviews.module.css";
import adminStyles from "../admin.module.css";
import {
  fetchAdminReviews,
  fetchReviewStats,
  updateReviewApproval,
  deleteReview,
  ProductReviewItem,
  ReviewStats,
} from "../../services/api";

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<ProductReviewItem[]>([]);
  const [stats, setStats] = useState<ReviewStats>({
    total: 0,
    approved: 0,
    pending: 0,
    average_rating: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "approved" | "pending">("all");
  const [selectedReview, setSelectedReview] = useState<ProductReviewItem | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [revs, st] = await Promise.all([
        fetchAdminReviews({
          status: activeTab !== "all" ? activeTab : undefined,
        }),
        fetchReviewStats(),
      ]);
      setReviews(revs);
      setStats(st);
    } catch (err) {
      console.error("Failed to load reviews:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleApprovalToggle = async (reviewId: string, currentApproved: boolean) => {
    setIsUpdating(reviewId);
    const newStatus = !currentApproved;
    try {
      await updateReviewApproval(reviewId, newStatus);
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, is_approved: newStatus } : r))
      );
      if (selectedReview && selectedReview.id === reviewId) {
        setSelectedReview((prev) => (prev ? { ...prev, is_approved: newStatus } : null));
      }
      fetchReviewStats().then(setStats).catch(() => {});
    } catch (err) {
      alert("Failed to update approval status. Please try again.");
    } finally {
      setIsUpdating(null);
    }
  };

  const handleDelete = async (reviewId: string) => {
    setIsUpdating(reviewId);
    try {
      await deleteReview(reviewId);
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      if (selectedReview && selectedReview.id === reviewId) {
        setSelectedReview(null);
      }
      setDeleteConfirmId(null);
      fetchReviewStats().then(setStats).catch(() => {});
    } catch (err) {
      alert("Failed to delete review.");
    } finally {
      setIsUpdating(null);
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} style={{ color: i < rating ? "#c49a45" : "#cbd5e1" }}>
        ★
      </span>
    ));
  };

  // Filter reviews client-side based on activeTab
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      const isApproved = r.is_approved !== false;
      if (activeTab === "approved") return isApproved;
      if (activeTab === "pending") return !isApproved;
      return true;
    });
  }, [reviews, activeTab]);

  // Column definitions for AG Grid
  const columnDefs = useMemo<ColDef<ProductReviewItem>[]>(() => [
    {
      headerName: "Product",
      field: "product.name",
      width: 210,
      minWidth: 170,
      cellRenderer: (params: CustomCellRendererProps<ProductReviewItem>) => {
        const p = params.data?.product;
        const img = p?.image;
        const name = p?.name || "Product";
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", overflow: "hidden" }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 6,
                overflow: "hidden",
                background: "var(--admin-surface-muted, #202026)",
                border: "1px solid var(--admin-border, rgba(255,255,255,0.08))",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ color: "#c49a45", fontSize: 13 }}>✦</span>
              )}
            </div>
            <span
              style={{
                fontWeight: 600,
                fontSize: 13,
                color: "var(--admin-text-main)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={name}
            >
              {name}
            </span>
          </div>
        );
      },
    },
    {
      headerName: "Customer",
      field: "author_name",
      width: 180,
      minWidth: 150,
      cellRenderer: (params: CustomCellRendererProps<ProductReviewItem>) => {
        const r = params.data;
        if (!r) return null;
        return (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", lineHeight: 1.25 }}>
            <span
              style={{
                fontWeight: 600,
                fontSize: 13,
                color: "var(--admin-text-main)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {r.author_name}
            </span>
            {r.author_email && (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--admin-text-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={r.author_email}
              >
                {r.author_email}
              </span>
            )}
            {r.author_phone && !r.author_email && (
              <span style={{ fontSize: 11, color: "var(--admin-text-muted)" }}>
                {r.author_phone}
              </span>
            )}
          </div>
        );
      },
    },
    {
      headerName: "Rating",
      field: "rating",
      width: 120,
      minWidth: 110,
      cellRenderer: (params: CustomCellRendererProps<ProductReviewItem>) => {
        const rating = Math.max(1, Math.min(5, Number(params.value || 5)));
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ color: "#c49a45", letterSpacing: 1, fontSize: 13 }}>
              {"★".repeat(rating)}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--admin-text-muted)" }}>
              ({rating})
            </span>
          </div>
        );
      },
    },
    {
      headerName: "Review Comment",
      field: "text",
      flex: 1,
      minWidth: 200,
      cellRenderer: (params: CustomCellRendererProps<ProductReviewItem>) => {
        const r = params.data;
        if (!r) return null;
        const text = r.text || "";
        return (
          <div
            onClick={() => setSelectedReview(r)}
            style={{
              cursor: "pointer",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: 12.5,
              color: "var(--admin-text-main)",
            }}
            title="Click to view full review"
          >
            {r.title ? <strong>{r.title} — </strong> : null}
            {text}
          </div>
        );
      },
    },
    {
      headerName: "Date",
      field: "created_at",
      width: 115,
      minWidth: 100,
      comparator: dateComparator,
      valueFormatter: (params) => {
        if (!params.value) return "—";
        const d = new Date(params.value);
        return isNaN(d.getTime())
          ? "—"
          : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      },
    },
    {
      headerName: "Status",
      field: "is_approved",
      width: 115,
      minWidth: 100,
      cellRenderer: (params: CustomCellRendererProps<ProductReviewItem>) => {
        const isApproved = params.value !== false;
        return (
          <StatusBadge
            label={isApproved ? "Approved" : "Pending"}
            tone={isApproved ? "success" : "warning"}
          />
        );
      },
    },
    {
      headerName: "Actions",
      width: 145,
      minWidth: 135,
      sortable: false,
      filter: false,
      cellRenderer: (params: CustomCellRendererProps<ProductReviewItem>) => {
        const r = params.data;
        if (!r) return null;
        const isApproved = r.is_approved !== false;
        const updating = isUpdating === r.id;
        const isConfirmingDelete = deleteConfirmId === r.id;

        return (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              disabled={updating}
              onClick={() => handleApprovalToggle(r.id, isApproved)}
              style={{
                height: 26,
                padding: "0 8px",
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 5,
                border: isApproved
                  ? "1px solid rgba(245, 158, 11, 0.45)"
                  : "1px solid rgba(34, 197, 94, 0.45)",
                background: isApproved ? "rgba(245, 158, 11, 0.1)" : "rgba(34, 197, 94, 0.12)",
                color: isApproved ? "#d97706" : "#16a34a",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title={isApproved ? "Hide from public storefront" : "Approve and publish live"}
            >
              {updating ? "..." : isApproved ? "Hide" : "Approve"}
            </button>

            <button
              type="button"
              onClick={() => setSelectedReview(r)}
              style={{
                width: 26,
                height: 26,
                padding: 0,
                borderRadius: 5,
                border: "1px solid var(--admin-border)",
                background: "var(--admin-surface)",
                color: "var(--admin-text-muted)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
              title="View full review details"
            >
              <Eye size={13} />
            </button>

            {isConfirmingDelete ? (
              <button
                type="button"
                disabled={updating}
                onClick={() => handleDelete(r.id)}
                style={{
                  height: 26,
                  padding: "0 7px",
                  borderRadius: 5,
                  border: "none",
                  background: "#dc2626",
                  color: "#ffffff",
                  fontSize: 10.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
                title="Confirm permanent deletion"
              >
                Yes
              </button>
            ) : (
              <button
                type="button"
                disabled={updating}
                onClick={() => setDeleteConfirmId(r.id)}
                style={{
                  width: 26,
                  height: 26,
                  padding: 0,
                  borderRadius: 5,
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  background: "rgba(239, 68, 68, 0.08)",
                  color: "#ef4444",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
                title="Delete review"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        );
      },
    },
  ], [isUpdating, deleteConfirmId]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>
            Product <span className={styles.goldAccent}>Reviews</span> Moderation
          </h1>
          <p className={styles.subtitle}>
            Moderate customer reviews, control live visibility, and maintain luxury presentation.
          </p>
        </div>
        <button className={styles.refreshBtn} onClick={loadData} disabled={loading}>
          <RotateCw size={14} className={loading ? styles.spinIcon : ""} /> {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Total Customer Reviews</div>
          <div className={styles.kpiValue}>{stats.total}</div>
          <div className={styles.kpiDesc}>Cumulative across all catalog products</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Live Approved Reviews</div>
          <div className={styles.kpiValue} style={{ color: "#22c55e" }}>
            {stats.approved}
          </div>
          <div className={styles.kpiDesc}>Published and visible on storefront</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Pending / Hidden Reviews</div>
          <div className={styles.kpiValue} style={{ color: "#f59e0b" }}>
            {stats.pending}
          </div>
          <div className={styles.kpiDesc}>Awaiting moderation or unapproved</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Average Catalog Rating</div>
          <div className={styles.kpiValue}>
            <span className={styles.kpiRatingVal}>{stats.average_rating.toFixed(1)}</span>
            <span style={{ fontSize: "1rem", color: "#8c8c8c" }}> / 5.0</span>
          </div>
          <div className={styles.kpiStarsRow}>{renderStars(Math.round(stats.average_rating))}</div>
        </div>
      </div>

      {/* REVIEWS GRID (AG-Grid Community via AdminDataGrid) */}
      <AdminDataGrid<ProductReviewItem>
        ariaLabel="Product reviews moderation"
        rowData={filteredReviews}
        columnDefs={columnDefs}
        loading={loading}
        getRowId={(r) => String(r.id)}
        searchPlaceholder="Search customer, email, product or review text…"
        emptyTitle={
          activeTab === "pending"
            ? "No Pending Reviews"
            : activeTab === "approved"
            ? "No Approved Reviews"
            : "No Reviews Found"
        }
        emptyDescription={
          activeTab === "pending"
            ? "All customer reviews have been reviewed and approved!"
            : "Customer reviews submitted on product pages will appear here for moderation."
        }
        toolbar={
          <div className={adminStyles.segmented} role="tablist" aria-label="Review moderation filter">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "all"}
              onClick={() => setActiveTab("all")}
              className={`${adminStyles.segmentedBtn} ${activeTab === "all" ? adminStyles.segmentedBtnActive : ""}`}
            >
              All Reviews <span className={adminStyles.segmentedCount}>{stats.total}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "approved"}
              onClick={() => setActiveTab("approved")}
              className={`${adminStyles.segmentedBtn} ${activeTab === "approved" ? adminStyles.segmentedBtnActive : ""}`}
            >
              Approved <span className={adminStyles.segmentedCount}>{stats.approved}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "pending"}
              onClick={() => setActiveTab("pending")}
              className={`${adminStyles.segmentedBtn} ${activeTab === "pending" ? adminStyles.segmentedBtnActive : ""}`}
            >
              Pending / Hidden <span className={adminStyles.segmentedCount}>{stats.pending}</span>
            </button>
          </div>
        }
      />

      {/* Review Detail Inspection Modal */}
      {selectedReview && (
        <div className={styles.modalOverlay} onClick={() => setSelectedReview(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setSelectedReview(null)}>
              ✕
            </button>

            <div className={styles.modalHeader}>
              <div className={styles.modalSectionLabel}>Review Inspection</div>
              <h2 style={{ margin: "4px 0", fontSize: "1.3rem" }}>
                {selectedReview.title || "Customer Review"}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.4rem" }}>
                <span className={styles.stars}>{renderStars(selectedReview.rating)}</span>
                <span style={{ color: "#c49a45", fontWeight: 600, fontSize: "0.9rem" }}>
                  {selectedReview.rating} out of 5 stars
                </span>
                <StatusBadge
                  label={selectedReview.is_approved !== false ? "Approved" : "Pending"}
                  tone={selectedReview.is_approved !== false ? "success" : "warning"}
                />
              </div>
            </div>

            <div className={styles.modalBody}>
              <div>
                <div className={styles.modalSectionLabel}>Associated Product</div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginTop: "0.25rem" }}>
                  {selectedReview.product?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedReview.product.image}
                      alt={selectedReview.product.name}
                      style={{ width: "42px", height: "42px", borderRadius: "6px", objectFit: "cover" }}
                    />
                  ) : (
                    <div className={styles.prodThumbFallback}>✦</div>
                  )}
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--admin-text-main)", fontSize: "0.95rem" }}>
                      {selectedReview.product?.name || "Product"}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className={styles.modalSectionLabel}>Customer Information</div>
                <div style={{ color: "var(--admin-text-main)", fontWeight: 600, fontSize: "0.95rem" }}>
                  {selectedReview.author_name}
                </div>
                {selectedReview.author_email && (
                  <div style={{ color: "#c49a45", fontSize: "0.85rem", marginTop: 2 }}>
                    <a href={`mailto:${selectedReview.author_email}`} style={{ color: "inherit", textDecoration: "none" }}>
                      ✉ {selectedReview.author_email}
                    </a>
                  </div>
                )}
                {selectedReview.author_phone && (
                  <div style={{ color: "var(--admin-text-muted)", fontSize: "0.85rem", marginTop: 2 }}>
                    ✆ {selectedReview.author_phone}
                  </div>
                )}
                {selectedReview.created_at && (
                  <div style={{ fontSize: "0.8rem", color: "var(--admin-text-muted)", marginTop: "0.35rem" }}>
                    Submitted on: {new Date(selectedReview.created_at).toLocaleString()}
                  </div>
                )}
              </div>

              <div>
                <div className={styles.modalSectionLabel}>Customer Review</div>
                <div className={styles.modalTextContent}>{selectedReview.text}</div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={`${styles.toggleApproveBtn} ${
                  selectedReview.is_approved !== false ? styles.btnHide : styles.btnApprove
                }`}
                style={{ padding: "0.55rem 1.25rem", fontSize: "0.88rem", fontWeight: 600, borderRadius: 6 }}
                onClick={() =>
                  handleApprovalToggle(
                    selectedReview.id,
                    selectedReview.is_approved !== false
                  )
                }
                disabled={isUpdating === selectedReview.id}
              >
                {selectedReview.is_approved !== false
                  ? "Hide From Storefront"
                  : "Approve & Publish Live"}
              </button>

              <button
                className={styles.refreshBtn}
                style={{ color: "#dc2626", borderColor: "rgba(220, 38, 38, 0.3)", background: "rgba(220, 38, 38, 0.08)" }}
                onClick={() => handleDelete(selectedReview.id)}
                disabled={isUpdating === selectedReview.id}
              >
                Delete Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
