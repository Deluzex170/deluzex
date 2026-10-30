"use client";

import React, { useEffect, useState, useMemo } from "react";
import styles from "./newsletter.module.css";
import AdminDataGrid from "../../components/admin/AdminDataGrid";
import type { ColDef } from "ag-grid-community";
import type { CustomCellRendererProps } from "ag-grid-react";
import { Mail, Trash2, CheckCircle2, RotateCcw } from "lucide-react";
import {
  fetchNewsletterSubscribers,
  updateSubscriberNotified,
  deleteNewsletterSubscriber,
  getNewsletterCsvExportUrl,
  NewsletterSubscriberItem,
  NewsletterSubscribersResponse,
} from "../../services/api";

export default function AdminNewsletterPage() {
  const [data, setData] = useState<NewsletterSubscribersResponse>({
    total: 0,
    pending: 0,
    notified: 0,
    subscribers: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const notifiedFilter =
        activeTab === "notified" ? true : activeTab === "pending" ? false : undefined;

      const res = await fetchNewsletterSubscribers({
        notified: notifiedFilter,
        search: searchQuery || undefined,
        limit: 200,
      });
      setData(res);
    } catch (err) {
      console.error("Failed to load subscribers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleToggleNotified = async (subscriberId: string, currentStatus: boolean) => {
    setIsUpdating(subscriberId);
    try {
      const newStatus = !currentStatus;
      const res = await updateSubscriberNotified(subscriberId, newStatus);
      if (res.success && res.subscriber) {
        setData((prev) => ({
          ...prev,
          pending: newStatus ? Math.max(0, prev.pending - 1) : prev.pending + 1,
          notified: newStatus ? prev.notified + 1 : Math.max(0, prev.notified - 1),
          subscribers: prev.subscribers.map((s) =>
            (s.id === subscriberId || s._id === subscriberId) ? res.subscriber! : s
          ),
        }));
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleDeleteSubscriber = async (subscriberId: string) => {
    try {
      const res = await deleteNewsletterSubscriber(subscriberId);
      if (res.success) {
        const item = data.subscribers.find(
          (s) => s.id === subscriberId || s._id === subscriberId
        );
        setData((prev) => ({
          ...prev,
          total: Math.max(0, prev.total - 1),
          pending: item && !item.is_notified ? Math.max(0, prev.pending - 1) : prev.pending,
          notified: item && item.is_notified ? Math.max(0, prev.notified - 1) : prev.notified,
          subscribers: prev.subscribers.filter(
            (s) => (s.id !== subscriberId && s._id !== subscriberId)
          ),
        }));
        setDeleteConfirmId(null);
      }
    } catch (err) {
      console.error("Failed to delete subscriber:", err);
    }
  };

  const columnDefs = useMemo<ColDef<NewsletterSubscriberItem>[]>(() => [
    {
      headerName: "Subscriber Email",
      colId: "email",
      flex: 1.5,
      minWidth: 200,
      valueGetter: (p) => p.data?.email || "",
      cellRenderer: (p: CustomCellRendererProps<NewsletterSubscriberItem>) => {
        const email = p.value || "";
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Mail size={13} style={{ color: "#C49A45", flexShrink: 0 }} />
            <a href={`mailto:${email}`} style={{ color: "var(--admin-text-main)", textDecoration: "none", fontWeight: 500 }} title={email}>
              {email}
            </a>
          </div>
        );
      },
    },
    {
      headerName: "Source",
      colId: "source",
      width: 140,
      minWidth: 120,
      valueGetter: (p) => p.data?.source || "storefront",
      cellRenderer: (p: CustomCellRendererProps<NewsletterSubscriberItem>) => (
        <span className={styles.sourceBadge}>{p.value}</span>
      ),
    },
    {
      headerName: "Subscribed Date",
      colId: "subscribed_at",
      width: 140,
      minWidth: 130,
      valueGetter: (p) => p.data?.subscribed_at || "",
      cellRenderer: (p: CustomCellRendererProps<NewsletterSubscriberItem>) => {
        if (!p.value) return "—";
        try {
          return new Date(p.value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
        } catch {
          return p.value;
        }
      },
    },
    {
      headerName: "Status",
      colId: "status",
      width: 120,
      minWidth: 110,
      valueGetter: (p) => (p.data?.is_notified ? "Notified" : "Pending"),
      cellRenderer: (p: CustomCellRendererProps<NewsletterSubscriberItem>) => {
        const isNotified = Boolean(p.data?.is_notified);
        return (
          <span className={`${styles.statusBadge} ${isNotified ? styles.statusNotified : styles.statusPending}`}>
            {isNotified ? "Notified" : "Pending"}
          </span>
        );
      },
    },
    {
      headerName: "Notified Date",
      colId: "notified_at",
      width: 140,
      minWidth: 130,
      valueGetter: (p) => p.data?.notified_at || "",
      cellRenderer: (p: CustomCellRendererProps<NewsletterSubscriberItem>) => {
        if (!p.value) return "—";
        try {
          return new Date(p.value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
        } catch {
          return p.value;
        }
      },
    },
    {
      headerName: "Actions",
      colId: "actions",
      width: 140,
      minWidth: 130,
      pinned: "right",
      sortable: false,
      filter: false,
      resizable: false,
      cellRenderer: (p: CustomCellRendererProps<NewsletterSubscriberItem>) => {
        const item = p.data;
        if (!item) return null;
        const id = item.id || item._id || "";
        const isNotified = Boolean(item.is_notified);
        const updating = isUpdating === id;

        return (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "flex-end", height: "100%" }}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => handleToggleNotified(id, isNotified)}
              disabled={updating}
              title={isNotified ? "Mark as Pending" : "Mark as Notified"}
              style={{
                height: "28px",
                padding: "0 8px",
                fontSize: "11px",
                borderRadius: "6px",
                border: "1px solid var(--admin-border)",
                background: "var(--admin-surface)",
                color: isNotified ? "#10b981" : "#f59e0b",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                cursor: "pointer",
              }}
            >
              {isNotified ? <RotateCcw size={11} /> : <CheckCircle2 size={11} />}
              {isNotified ? "Unmark" : "Notify"}
            </button>
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={() => setDeleteConfirmId(id)}
              title="Delete subscriber"
              style={{
                height: "28px",
                width: "28px",
                borderRadius: "6px",
                border: "1px solid var(--admin-border)",
                background: "var(--admin-surface)",
                color: "#ef4444",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        );
      },
    },
  ], [isUpdating]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Newsletter Subscribers</h1>
          <p className={styles.subtitle}>
            Manage emails collected from storefront visitor registrations.
          </p>
        </div>
        <div className={styles.headerActions}>
          <a
            href={getNewsletterCsvExportUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.exportBtn}
          >
            Export CSV
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Audience</span>
          <span className={styles.kpiValue}>{data.total}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Pending Notice</span>
          <span className={styles.kpiValue} style={{ color: "#D79322" }}>
            {data.pending}
          </span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Notified</span>
          <span className={styles.kpiValue} style={{ color: "#10b981" }}>
            {data.notified}
          </span>
        </div>
      </div>

      {/* Grid */}
      <AdminDataGrid<NewsletterSubscriberItem>
        ariaLabel="Newsletter subscribers"
        rowData={data.subscribers}
        columnDefs={columnDefs}
        loading={loading}
        getRowId={(s) => String(s.id || s._id || s.email)}
        quickFilterText={searchQuery}
        emptyTitle="No subscribers found"
        emptyDescription="There are no email subscribers matching the current filter or search query."
        toolbar={
          <>
            <div className={styles.tabsRow}>
              <button
                className={`${styles.tabBtn} ${activeTab === "all" ? styles.activeTab : ""}`}
                onClick={() => setActiveTab("all")}
              >
                All <span className={styles.tabBadge}>{data.total}</span>
              </button>
              <button
                className={`${styles.tabBtn} ${activeTab === "pending" ? styles.activeTab : ""}`}
                onClick={() => setActiveTab("pending")}
              >
                Pending <span className={styles.tabBadge}>{data.pending}</span>
              </button>
              <button
                className={`${styles.tabBtn} ${activeTab === "notified" ? styles.activeTab : ""}`}
                onClick={() => setActiveTab("notified")}
              >
                Notified <span className={styles.tabBadge}>{data.notified}</span>
              </button>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Search email or source..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  height: "36px",
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--admin-border)",
                  background: "var(--admin-surface)",
                  color: "var(--admin-text-main)",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
            </div>
          </>
        }
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalBox}>
            <h3 className={styles.modalTitle}>Confirm Subscriber Deletion</h3>
            <p className={styles.modalText}>
              Are you sure you want to remove this subscriber from the newsletter database? This cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmDeleteBtn}
                onClick={() => handleDeleteSubscriber(deleteConfirmId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
