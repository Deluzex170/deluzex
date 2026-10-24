"use client";

import React, { useEffect, useState, useMemo } from "react";
import styles from "./inquiries.module.css";
import {
  fetchInquiries,
  fetchInquiryStats,
  updateInquiryStatus,
  deleteInquiry,
  Inquiry,
  InquiryStats,
} from "../../services/api";

export default function AdminInquiries() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [stats, setStats] = useState<InquiryStats>({
    total: 0,
    new: 0,
    contacted: 0,
    resolved: 0,
    archived: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [inquiriesData, statsData] = await Promise.all([
        fetchInquiries({
          status: activeTab !== "all" ? activeTab : undefined,
          search: searchQuery || undefined,
        }),
        fetchInquiryStats(),
      ]);
      setInquiries(inquiriesData);
      setStats(statsData);
    } catch (err) {
      console.error("Failed to load inquiries:", err);
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

  const handleStatusChange = async (inquiryId: string, newStatus: string) => {
    setIsUpdating(inquiryId);
    try {
      await updateInquiryStatus(inquiryId, newStatus);
      // Update local state smoothly
      setInquiries((prev) =>
        prev.map((item) =>
          item._id === inquiryId || item.id === inquiryId
            ? { ...item, status: newStatus }
            : item
        )
      );
      if (selectedInquiry && (selectedInquiry._id === inquiryId || selectedInquiry.id === inquiryId)) {
        setSelectedInquiry((prev) => prev ? { ...prev, status: newStatus } : null);
      }
      // Refresh stats
      const updatedStats = await fetchInquiryStats();
      setStats(updatedStats);
    } catch (err) {
      console.error("Status update error:", err);
      alert(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setIsUpdating(null);
    }
  };

  const handleDelete = async (inquiryId: string) => {
    if (!window.confirm("Are you sure you wish to delete this consultation inquiry?")) {
      return;
    }
    try {
      await deleteInquiry(inquiryId);
      setInquiries((prev) => prev.filter((item) => item._id !== inquiryId && item.id !== inquiryId));
      if (selectedInquiry && (selectedInquiry._id === inquiryId || selectedInquiry.id === inquiryId)) {
        setSelectedInquiry(null);
      }
      const updatedStats = await fetchInquiryStats();
      setStats(updatedStats);
    } catch (err) {
      console.error("Delete inquiry error:", err);
      alert(err instanceof Error ? err.message : "Failed to delete inquiry");
    }
  };

  const extractScope = (message: string) => {
    const match = message.match(/^\[Project Scope:\s*([^\]]+)\]/i);
    return match ? match[1].trim() : null;
  };

  const cleanMessage = (message: string) => {
    return message.replace(/^\[Project Scope:\s*[^\]]+\]\s*/i, "").trim();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? "N/A"
      : d.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
  };

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>Inquiries &amp; Consultations</h1>
          <p>Bespoke client requests, custom design inquiries &amp; project collaborations.</p>
        </div>
        <button onClick={loadData} className={styles.refreshBtn} title="Refresh Inquiries">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
          Refresh Data
        </button>
      </div>

      {/* KPI STAT CARDS */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Total Inquiries</div>
          <div className={styles.kpiValue}>{stats.total}</div>
        </div>
        <div className={styles.kpiCard} style={{ borderColor: "rgba(234, 179, 8, 0.3)" }}>
          <div className={styles.kpiLabel} style={{ color: "#facc15" }}>New / Unread</div>
          <div className={styles.kpiValue} style={{ color: "#facc15" }}>{stats.new}</div>
        </div>
        <div className={styles.kpiCard} style={{ borderColor: "rgba(59, 130, 246, 0.3)" }}>
          <div className={styles.kpiLabel} style={{ color: "#60a5fa" }}>Contacted</div>
          <div className={styles.kpiValue} style={{ color: "#60a5fa" }}>{stats.contacted}</div>
        </div>
        <div className={styles.kpiCard} style={{ borderColor: "rgba(34, 197, 94, 0.3)" }}>
          <div className={styles.kpiLabel} style={{ color: "#4ade80" }}>Resolved</div>
          <div className={styles.kpiValue} style={{ color: "#4ade80" }}>{stats.resolved}</div>
        </div>
        <div className={styles.kpiCard} style={{ borderColor: "rgba(156, 163, 175, 0.3)" }}>
          <div className={styles.kpiLabel} style={{ color: "#9ca3af" }}>Archived</div>
          <div className={styles.kpiValue} style={{ color: "#9ca3af" }}>{stats.archived}</div>
        </div>
      </div>

      {/* CONTROLS (TABS + SEARCH) */}
      <div className={styles.controlsBar}>
        <div className={styles.filterTabs}>
          {[
            { id: "all", label: `All (${stats.total})` },
            { id: "new", label: `New (${stats.new})` },
            { id: "contacted", label: `Contacted (${stats.contacted})` },
            { id: "resolved", label: `Resolved (${stats.resolved})` },
            { id: "archived", label: `Archived (${stats.archived})` },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} className={styles.searchBox}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder="Search client, email, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
      </div>

      {/* TABLE */}
      <div className={styles.tableContainer}>
        {loading ? (
          <div className={styles.emptyState}>
            <p>Loading luxury inquiries...</p>
          </div>
        ) : inquiries.length === 0 ? (
          <div className={styles.emptyState}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#636366" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 1rem" }}>
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            <h3>No Consultation Inquiries Found</h3>
            <p>No messages match the current status or filter criteria.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Contact Details</th>
                  <th>Scope &amp; Message</th>
                  <th>Status Workflow</th>
                  <th>Date</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.map((inq) => {
                  const inquiryId = inq._id || inq.id || "";
                  const scope = extractScope(inq.message || "");
                  const preview = cleanMessage(inq.message || "");
                  const currentStatus = (inq.status || "new").toLowerCase();

                  return (
                    <tr key={inquiryId}>
                      <td>
                        <span className={styles.senderName}>{inq.name || "Valued Client"}</span>
                        <span className={styles.senderEmail}>ID: #{inquiryId.slice(-6).toUpperCase()}</span>
                      </td>
                      <td>
                        <div>
                          <a href={`mailto:${inq.email}`} style={{ color: "#d4af37", textDecoration: "none" }}>
                            {inq.email}
                          </a>
                        </div>
                        {inq.phone && (
                          <div style={{ fontSize: "0.8rem", color: "#8e8e93", marginTop: "2px" }}>
                            {inq.phone}
                          </div>
                        )}
                      </td>
                      <td>
                        {scope && <span className={styles.scopeBadge}>{scope}</span>}
                        <div className={styles.messageSnippet} title={preview}>
                          {preview || "No message body provided."}
                        </div>
                      </td>
                      <td>
                        <select
                          className={`${styles.statusSelect} ${styles[`status_${currentStatus}`] || styles.status_new}`}
                          value={currentStatus}
                          disabled={isUpdating === inquiryId}
                          onChange={(e) => handleStatusChange(inquiryId, e.target.value)}
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="resolved">Resolved</option>
                          <option value="archived">Archived</option>
                        </select>
                      </td>
                      <td style={{ color: "#8e8e93", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                        {formatDate(inq.created_at || inq.createdAt)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className={styles.actionBtnGroup} style={{ justifyContent: "flex-end" }}>
                          <button
                            className={styles.viewBtn}
                            onClick={() => setSelectedInquiry(inq)}
                            title="View Full Inquiry Details"
                          >
                            View
                          </button>
                          <button
                            className={styles.deleteBtn}
                            onClick={() => handleDelete(inquiryId)}
                            title="Delete Inquiry"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      {selectedInquiry && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedInquiry(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.scopeBadge} style={{ marginBottom: "4px" }}>
                  {extractScope(selectedInquiry.message || "") || "General Inquiry"}
                </span>
                <h3>Client Consultation Details</h3>
              </div>
              <button className={styles.closeBtn} onClick={() => setSelectedInquiry(null)}>&times;</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.metaGrid}>
                <div className={styles.metaItem}>
                  <label>Client Name</label>
                  <span>{selectedInquiry.name || "Valued Client"}</span>
                </div>
                <div className={styles.metaItem}>
                  <label>Submission Date</label>
                  <span>{formatDate(selectedInquiry.created_at || selectedInquiry.createdAt)}</span>
                </div>
                <div className={styles.metaItem}>
                  <label>Email Address</label>
                  <a href={`mailto:${selectedInquiry.email}`}>{selectedInquiry.email}</a>
                </div>
                <div className={styles.metaItem}>
                  <label>Phone Number</label>
                  <span>{selectedInquiry.phone ? <a href={`tel:${selectedInquiry.phone}`}>{selectedInquiry.phone}</a> : "Not Provided"}</span>
                </div>
              </div>

              <div className={styles.messageBlock}>
                <label>Message Transcript</label>
                <div className={styles.messageText}>
                  {cleanMessage(selectedInquiry.message || "")}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--admin-bg)", border: "1px solid var(--admin-border)", padding: "1rem 1.25rem", borderRadius: "10px" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--admin-text-muted)" }}>Update Status:</span>
                <select
                  className={`${styles.statusSelect} ${styles[`status_${(selectedInquiry.status || "new").toLowerCase()}`] || styles.status_new}`}
                  value={(selectedInquiry.status || "new").toLowerCase()}
                  onChange={(e) => handleStatusChange(selectedInquiry._id || selectedInquiry.id || "", e.target.value)}
                >
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="resolved">Resolved</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.deleteBtn}
                style={{ padding: "0.6rem 1rem" }}
                onClick={() => handleDelete(selectedInquiry._id || selectedInquiry.id || "")}
              >
                Delete Inquiry
              </button>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  className={styles.viewBtn}
                  style={{ padding: "0.6rem 1.25rem" }}
                  onClick={() => setSelectedInquiry(null)}
                >
                  Close
                </button>
                <a
                  href={`mailto:${selectedInquiry.email}?subject=Deluzex%20Lighting%20Consultation%20Follow-up`}
                  className={styles.replyBtn}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                  Reply via Email
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
