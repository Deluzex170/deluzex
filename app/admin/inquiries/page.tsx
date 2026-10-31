"use client";

import React, { useEffect, useState, useMemo } from "react";
import styles from "./inquiries.module.css";
import AdminDataGrid from "../../components/admin/AdminDataGrid";
import type { ColDef } from "ag-grid-community";
import type { CustomCellRendererProps } from "ag-grid-react";
import { Eye, Trash2, Mail, MessageCircle, RefreshCw } from "lucide-react";
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

  const handleStatusChange = async (inquiryId: string, newStatus: string) => {
    setIsUpdating(inquiryId);
    try {
      await updateInquiryStatus(inquiryId, newStatus);
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

  const columnDefs = useMemo<ColDef<Inquiry>[]>(() => [
    {
      headerName: "Client",
      colId: "client",
      width: 175,
      minWidth: 160,
      valueGetter: (p) => p.data?.name || "Valued Client",
      cellRenderer: (p: CustomCellRendererProps<Inquiry>) => {
        const item = p.data;
        if (!item) return null;
        const inquiryId = item._id || item.id || "";
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontWeight: 600, color: "var(--admin-text-main)" }}>
              {item.name || "Valued Client"}
            </span>
            <span style={{ fontSize: "11px", color: "var(--admin-text-muted)" }}>
              ID: #{inquiryId.slice(-6).toUpperCase()}
            </span>
          </div>
        );
      },
    },
    {
      headerName: "Contact Details",
      colId: "contact",
      width: 200,
      minWidth: 180,
      valueGetter: (p) => [p.data?.email, p.data?.phone].filter(Boolean).join(" "),
      cellRenderer: (p: CustomCellRendererProps<Inquiry>) => {
        const item = p.data;
        if (!item) return null;
        const digits = (item.phone || "").replace(/\D/g, "");
        const waLink = digits.length >= 10 ? `https://wa.me/${digits.length === 10 ? '91' + digits : digits}` : null;

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <a
              href={`mailto:${item.email}`}
              style={{ color: "var(--admin-gold-text)", textDecoration: "none", fontSize: "12.5px", fontWeight: 500 }}
              title={item.email}
            >
              {item.email}
            </a>
            {item.phone && (
              waLink ? (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--admin-success-text)", textDecoration: "none" }}
                  title="WhatsApp chat"
                >
                  <MessageCircle size={10} />
                  <span>{item.phone}</span>
                </a>
              ) : (
                <span style={{ fontSize: "11px", color: "var(--admin-text-muted)" }}>{item.phone}</span>
              )
            )}
          </div>
        );
      },
    },
    {
      headerName: "Scope & Message",
      colId: "message",
      flex: 1.5,
      minWidth: 220,
      valueGetter: (p) => p.data?.message || "",
      cellRenderer: (p: CustomCellRendererProps<Inquiry>) => {
        const item = p.data;
        if (!item) return null;
        const scope = extractScope(item.message || "");
        const preview = cleanMessage(item.message || "");
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", overflow: "hidden" }}>
            {scope && <span className={styles.scopeBadge}>{scope}</span>}
            <span style={{ fontSize: "12px", color: "var(--admin-text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={preview}>
              {preview}
            </span>
          </div>
        );
      },
    },
    {
      headerName: "Status",
      colId: "status",
      width: 140,
      minWidth: 130,
      valueGetter: (p) => p.data?.status || "new",
      cellRenderer: (p: CustomCellRendererProps<Inquiry>) => {
        const item = p.data;
        if (!item) return null;
        const inquiryId = item._id || item.id || "";
        const currentStatus = (item.status || "new").toLowerCase();
        return (
          <select
            className={`${styles.statusSelect} ${styles[`status_${currentStatus}`] || styles.status_new}`}
            value={currentStatus}
            disabled={isUpdating === inquiryId}
            onChange={(e) => handleStatusChange(inquiryId, e.target.value)}
            style={{ height: "28px", padding: "0 8px", fontSize: "11px", borderRadius: "6px" }}
          >
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="resolved">Resolved</option>
            <option value="archived">Archived</option>
          </select>
        );
      },
    },
    {
      headerName: "Date",
      colId: "date",
      width: 120,
      minWidth: 110,
      valueGetter: (p) => p.data?.created_at || p.data?.createdAt || "",
      cellRenderer: (p: CustomCellRendererProps<Inquiry>) => formatDate(p.value),
    },
    {
      headerName: "Actions",
      colId: "actions",
      width: 100,
      minWidth: 90,
      pinned: "right",
      sortable: false,
      filter: false,
      resizable: false,
      cellRenderer: (p: CustomCellRendererProps<Inquiry>) => {
        const item = p.data;
        if (!item) return null;
        const inquiryId = item._id || item.id || "";
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "flex-end", height: "100%" }}>
            <button
              type="button"
              className={styles.viewBtn}
              onClick={() => setSelectedInquiry(item)}
              title="View Consultation Details"
              style={{ width: "28px", height: "28px", borderRadius: "6px", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }}
            >
              <Eye size={12} />
            </button>
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={() => handleDelete(inquiryId)}
              title="Delete Inquiry"
              style={{ width: "28px", height: "28px", borderRadius: "6px", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }}
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
      {/* HEADER */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>Inquiries &amp; Consultations</h1>
          <p>Bespoke client requests, custom design inquiries &amp; project collaborations.</p>
        </div>
        <button onClick={loadData} className={styles.refreshBtn} title="Refresh Inquiries">
          <RefreshCw size={13} />
          Refresh Data
        </button>
      </div>

      {/* KPI STAT CARDS */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Total Leads</div>
          <div className={styles.kpiValue}>{stats.total}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel} style={{ color: "var(--admin-warning-text)" }}>New / Unread</div>
          <div className={styles.kpiValue} style={{ color: "var(--admin-warning-text)" }}>{stats.new}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel} style={{ color: "var(--admin-info-text)" }}>Contacted</div>
          <div className={styles.kpiValue} style={{ color: "var(--admin-info-text)" }}>{stats.contacted}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel} style={{ color: "var(--admin-success-text)" }}>Resolved</div>
          <div className={styles.kpiValue} style={{ color: "var(--admin-success-text)" }}>{stats.resolved}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel} style={{ color: "var(--admin-text-muted)" }}>Archived</div>
          <div className={styles.kpiValue} style={{ color: "var(--admin-text-muted)" }}>{stats.archived}</div>
        </div>
      </div>

      {/* GRID */}
      <AdminDataGrid<Inquiry>
        ariaLabel="Inquiries table"
        rowData={inquiries}
        columnDefs={columnDefs}
        loading={loading}
        getRowId={(inq) => String(inq._id || inq.id || inq.email)}
        quickFilterText={searchQuery}
        onQuickFilterChange={setSearchQuery}
        searchPlaceholder="Search client, email, phone…"
        emptyTitle="No Consultation Inquiries Found"
        emptyDescription="No messages match the current status or filter criteria."
        toolbar={
          <>
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

          </>
        }
      />

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

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--admin-surface-muted)", border: "1px solid var(--admin-border)", padding: "0.85rem 1.25rem", borderRadius: "10px" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--admin-text-secondary)", fontWeight: 600 }}>Update Status:</span>
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
