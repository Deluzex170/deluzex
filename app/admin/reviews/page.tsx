"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./reviews.module.css";
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
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReview, setSelectedReview] = useState<ProductReviewItem | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [revs, st] = await Promise.all([
        fetchAdminReviews({
          status: activeTab !== "all" ? activeTab : undefined,
          search: searchQuery || undefined,
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleApprovalToggle = async (reviewId: string, currentApproved: boolean) => {
    setIsUpdating(reviewId);
    const newStatus = !currentApproved;
    try {
      await updateReviewApproval(reviewId, newStatus);
      // Optimistic state update
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, is_approved: newStatus } : r))
      );
      if (selectedReview && selectedReview.id === reviewId) {
        setSelectedReview((prev) => (prev ? { ...prev, is_approved: newStatus } : null));
      }
      // Refresh stats in background
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
          <span>↻</span> {loading ? "Refreshing..." : "Refresh"}
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
          <div className={styles.kpiValue} style={{ color: "#4ade80" }}>
            {stats.approved}
          </div>
          <div className={styles.kpiDesc}>Published and visible on storefront</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Pending / Hidden Reviews</div>
          <div className={styles.kpiValue} style={{ color: "#facc15" }}>
            {stats.pending}
          </div>
          <div className={styles.kpiDesc}>Awaiting moderation or unapproved</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Average Catalog Rating</div>
          <div className={styles.kpiValue}>
            <span className={styles.kpiRatingVal}>{stats.average_rating.toFixed(1)}</span>
            <span style={{ fontSize: "1rem", color: "#8c8c8c" }}>/ 5.0</span>
          </div>
          <div className={styles.kpiStarsRow}>{renderStars(Math.round(stats.average_rating))}</div>
        </div>
      </div>

      {/* Controls: Tabs & Search */}
      <div className={styles.controlsBar}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tabBtn} ${activeTab === "all" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All Reviews <span className={styles.tabBadge}>{stats.total}</span>
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "approved" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("approved")}
          >
            Approved <span className={styles.tabBadge}>{stats.approved}</span>
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "pending" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("pending")}
          >
            Hidden / Pending <span className={styles.tabBadge}>{stats.pending}</span>
          </button>
        </div>

        <form className={styles.searchForm} onSubmit={handleSearchSubmit}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search author, email, product or review text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className={styles.searchBtn}>
            Search
          </button>
        </form>
      </div>

      {/* Reviews Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Product</th>
              <th>Customer</th>
              <th>Rating</th>
              <th>Review Comment</th>
              <th>Date</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "3rem", color: "#888" }}>
                  Loading product reviews...
                </td>
              </tr>
            ) : reviews.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>★</div>
                    <h3>No reviews found</h3>
                    <p>There are no reviews matching the selected filter or query.</p>
                  </div>
                </td>
              </tr>
            ) : (
              reviews.map((r) => {
                const isApproved = r.is_approved !== false;
                const prodName = r.product?.name || `Product #${r.product_id?.slice(0, 8)}`;
                const prodImage = r.product?.image;

                return (
                  <tr key={r.id}>
                    {/* Product Cell */}
                    <td>
                      <div className={styles.productCell}>
                        {prodImage ? (
                          <img
                            src={prodImage}
                            alt={prodName}
                            className={styles.prodThumb}
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className={styles.prodThumbFallback}>✦</div>
                        )}
                        <div>
                          <div className={styles.prodName} title={prodName}>
                            {prodName}
                          </div>
                          <div className={styles.prodId}>{r.product_id?.slice(0, 10)}...</div>
                        </div>
                      </div>
                    </td>

                    {/* Customer Cell */}
                    <td>
                      <div className={styles.authorName}>{r.author_name}</div>
                      {r.author_email && (
                        <div className={styles.authorEmail}>{r.author_email}</div>
                      )}
                    </td>

                    {/* Rating Cell */}
                    <td>
                      <div className={styles.ratingRow}>
                        <span className={styles.stars}>{renderStars(r.rating)}</span>
                        <span className={styles.ratingNumber}>({r.rating})</span>
                      </div>
                    </td>

                    {/* Review Snippet */}
                    <td>
                      <div
                        className={styles.reviewSnippet}
                        onClick={() => setSelectedReview(r)}
                        title="Click to view full review"
                      >
                        {r.title && <div className={styles.reviewTitle}>{r.title}</div>}
                        <div className={styles.reviewTextPreview}>{r.text}</div>
                      </div>
                    </td>

                    {/* Date Cell */}
                    <td style={{ color: "#777", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                    </td>

                    {/* Status Badge */}
                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          isApproved ? styles.statusApproved : styles.statusPending
                        }`}
                      >
                        {isApproved ? "Approved" : "Hidden"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: "right" }}>
                      <div className={styles.actionBtns} style={{ justifyContent: "flex-end" }}>
                        <button
                          className={`${styles.toggleApproveBtn} ${
                            isApproved ? styles.btnHide : styles.btnApprove
                          }`}
                          onClick={() => handleApprovalToggle(r.id, isApproved)}
                          disabled={isUpdating === r.id}
                        >
                          {isUpdating === r.id
                            ? "Updating..."
                            : isApproved
                            ? "Hide"
                            : "Approve"}
                        </button>

                        <button
                          className={styles.iconBtn}
                          onClick={() => setSelectedReview(r)}
                          title="View Details"
                        >
                          👁
                        </button>

                        {deleteConfirmId === r.id ? (
                          <button
                            className={`${styles.toggleApproveBtn}`}
                            style={{ background: "#dc2626", color: "#fff", padding: "0.45rem 0.6rem" }}
                            onClick={() => handleDelete(r.id)}
                            disabled={isUpdating === r.id}
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            className={`${styles.iconBtn} ${styles.deleteBtn}`}
                            onClick={() => setDeleteConfirmId(r.id)}
                            title="Delete review"
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Review Detail Modal Drawer */}
      {selectedReview && (
        <div className={styles.modalOverlay} onClick={() => setSelectedReview(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setSelectedReview(null)}>
              ✕
            </button>

            <div className={styles.modalHeader}>
              <div className={styles.modalSectionLabel}>Review Inspection</div>
              <h2>
                {selectedReview.title || "Customer Review"}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.5rem" }}>
                <span className={styles.stars}>{renderStars(selectedReview.rating)}</span>
                <span style={{ color: "#c49a45", fontWeight: 600 }}>
                  {selectedReview.rating} out of 5 stars
                </span>
                <span
                  className={`${styles.statusBadge} ${
                    selectedReview.is_approved !== false
                      ? styles.statusApproved
                      : styles.statusPending
                  }`}
                >
                  {selectedReview.is_approved !== false ? "Approved & Live" : "Hidden"}
                </span>
              </div>
            </div>

            <div className={styles.modalBody}>
              <div>
                <div className={styles.modalSectionLabel}>Associated Product</div>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.25rem" }}>
                  {selectedReview.product?.image ? (
                    <img
                      src={selectedReview.product.image}
                      alt={selectedReview.product.name}
                      style={{ width: "48px", height: "48px", borderRadius: "6px", objectFit: "cover" }}
                    />
                  ) : (
                    <div className={styles.prodThumbFallback}>✦</div>
                  )}
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--admin-text-main)" }}>
                      {selectedReview.product?.name || "Product"}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--admin-text-muted)" }}>
                      ID: {selectedReview.product_id}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className={styles.modalSectionLabel}>Customer Information</div>
                <div style={{ color: "var(--admin-text-main)", fontWeight: 600 }}>{selectedReview.author_name}</div>
                {selectedReview.author_email && (
                  <div style={{ color: "#c49a45", fontSize: "0.85rem" }}>
                    <a href={`mailto:${selectedReview.author_email}`} style={{ color: "inherit", textDecoration: "none" }}>
                      ✉ {selectedReview.author_email}
                    </a>
                  </div>
                )}
                {selectedReview.created_at && (
                  <div style={{ fontSize: "0.8rem", color: "var(--admin-text-muted)", marginTop: "0.25rem" }}>
                    Submitted on: {new Date(selectedReview.created_at).toLocaleString()}
                  </div>
                )}
              </div>

              <div>
                <div className={styles.modalSectionLabel}>Review Body</div>
                <div className={styles.modalTextContent}>{selectedReview.text}</div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={`${styles.toggleApproveBtn} ${
                  selectedReview.is_approved !== false ? styles.btnHide : styles.btnApprove
                }`}
                style={{ padding: "0.6rem 1.25rem", fontSize: "0.9rem" }}
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
                style={{ color: "#dc2626", borderColor: "#fecaca", background: "#fef2f2" }}
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
