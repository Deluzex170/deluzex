"use client";

import React, { useEffect, useState } from "react";
import styles from "./newsletter.module.css";
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
        limit: 150,
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleToggleNotified = async (subId: string, currentNotified: boolean) => {
    setIsUpdating(subId);
    const newStatus = !currentNotified;
    try {
      await updateSubscriberNotified(subId, newStatus);
      setData((prev) => ({
        ...prev,
        pending: newStatus ? Math.max(0, prev.pending - 1) : prev.pending + 1,
        notified: newStatus ? prev.notified + 1 : Math.max(0, prev.notified - 1),
        subscribers: prev.subscribers.map((s) =>
          (s.id === subId || s._id === subId) ? { ...s, is_notified: newStatus } : s
        ),
      }));
    } catch (err) {
      alert("Failed to update notification status.");
    } finally {
      setIsUpdating(null);
    }
  };

  const handleDelete = async (subId: string) => {
    setIsUpdating(subId);
    try {
      await deleteNewsletterSubscriber(subId);
      setData((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
        subscribers: prev.subscribers.filter((s) => s.id !== subId && s._id !== subId),
      }));
      setDeleteConfirmId(null);
    } catch (err) {
      alert("Failed to delete subscriber.");
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>
            Newsletter <span className={styles.goldAccent}>Subscribers</span>
          </h1>
          <p className={styles.subtitle}>
            Manage VIP launch mailing list, track outreach notification status, and export subscriber emails.
          </p>
        </div>

        <div className={styles.headerActions}>
          <a
            href={getNewsletterCsvExportUrl()}
            download
            className={styles.exportBtn}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>📥</span> Export CSV
          </a>
          <button className={styles.refreshBtn} onClick={loadData} disabled={loading}>
            <span>↻</span> {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Total Audience Subscribers</div>
          <div className={styles.kpiValue}>{data.total}</div>
          <div className={styles.kpiDesc}>Cumulative signups across storefront & popups</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Pending Outreach</div>
          <div className={styles.kpiValue} style={{ color: "#facc15" }}>
            {data.pending}
          </div>
          <div className={styles.kpiDesc}>Subscribers waiting to receive announcement / catalog drop</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Notified Subscribers</div>
          <div className={styles.kpiValue} style={{ color: "#4ade80" }}>
            {data.notified}
          </div>
          <div className={styles.kpiDesc}>Subscribers sent campaigns or VIP notifications</div>
        </div>
      </div>

      {/* Controls Bar: Tabs & Search */}
      <div className={styles.controlsBar}>
        <div className={styles.tabs}>
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

        <form className={styles.searchForm} onSubmit={handleSearchSubmit}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search subscriber email or source..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className={styles.searchBtn}>
            Search
          </button>
        </form>
      </div>

      {/* Subscribers Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Subscriber Email</th>
              <th>Source</th>
              <th>Subscribed Date</th>
              <th>Status</th>
              <th>Notified Date</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "3rem", color: "#888" }}>
                  Loading newsletter subscribers...
                </td>
              </tr>
            ) : data.subscribers.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>✉</div>
                    <h3>No subscribers found</h3>
                    <p>There are no email subscribers matching the current filter or search query.</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.subscribers.map((s) => {
                const subId = s.id || s._id || "";
                return (
                  <tr key={subId}>
                    {/* Email Cell */}
                    <td>
                      <div className={styles.emailText}>
                        <a href={`mailto:${s.email}`} className={styles.emailLink}>
                          {s.email}
                        </a>
                      </div>
                    </td>

                    {/* Source Cell */}
                    <td>
                      <span className={styles.sourceBadge}>{s.source || "coming_soon"}</span>
                    </td>

                    {/* Subscribed At */}
                    <td style={{ color: "#888", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                      {s.subscribed_at ? new Date(s.subscribed_at).toLocaleDateString() : "—"}
                    </td>

                    {/* Status Badge */}
                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          s.is_notified ? styles.statusNotified : styles.statusPending
                        }`}
                      >
                        {s.is_notified ? "Notified" : "Pending"}
                      </span>
                    </td>

                    {/* Notified At */}
                    <td style={{ color: "#777", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                      {s.notified_at ? new Date(s.notified_at).toLocaleDateString() : "—"}
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: "right" }}>
                      <div className={styles.actionBtns}>
                        <button
                          className={`${styles.toggleNotifiedBtn} ${
                            s.is_notified ? styles.btnMarkPending : styles.btnMarkNotified
                          }`}
                          onClick={() => handleToggleNotified(subId, s.is_notified)}
                          disabled={isUpdating === subId}
                        >
                          {isUpdating === subId
                            ? "Updating..."
                            : s.is_notified
                            ? "Mark Pending"
                            : "Mark Notified"}
                        </button>

                        <a
                          href={`mailto:${s.email}?subject=De%20Luzex%20Exclusive%20Update`}
                          className={styles.iconBtn}
                          title="Compose email to subscriber"
                        >
                          ✉
                        </a>

                        {deleteConfirmId === subId ? (
                          <button
                            className={styles.confirmDeleteBtn}
                            onClick={() => handleDelete(subId)}
                            disabled={isUpdating === subId}
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            className={`${styles.iconBtn} ${styles.deleteBtn}`}
                            onClick={() => setDeleteConfirmId(subId)}
                            title="Remove subscriber"
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
    </div>
  );
}
