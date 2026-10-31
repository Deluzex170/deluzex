"use client";

import React, { useEffect, useState, useMemo } from "react";
import type { ColDef } from "ag-grid-community";
import { AdminDataGrid } from "../../components/admin/AdminDataGrid";
import styles from "../admin.module.css";
import {
  fetchCollaborations,
  updateCollaborationStatus,
  deleteCollaboration,
  CollaborationSubmission,
} from "../../services/api";
import {
  Sparkles,
  Search,
  Filter,
  Eye,
  Trash2,
  ExternalLink,
  Download,
  FileText,
  CheckCircle2,
  Clock,
  Archive,
  RefreshCw,
  X,
  User,
  Mail,
  Phone,
  MapPin,
  Building,
  Lightbulb,
  Image as ImageIcon,
  MessageCircle,
  FileCheck,
  Calendar,
  Layers,
  Check,
} from "lucide-react";

const isImageFile = (url?: string, fileName?: string): boolean => {
  if (!url && !fileName) return false;
  const target = (fileName || url || "").toLowerCase();
  return (
    target.endsWith(".png") ||
    target.endsWith(".jpg") ||
    target.endsWith(".jpeg") ||
    target.endsWith(".webp") ||
    target.endsWith(".svg") ||
    target.endsWith(".gif") ||
    target.includes("/image/upload/")
  );
};

const isPdfFile = (url?: string, fileName?: string): boolean => {
  if (!url && !fileName) return false;
  const target = (fileName || url || "").toLowerCase();
  return target.endsWith(".pdf") || target.includes(".pdf?") || target.includes("/raw/upload/");
};

export default function AdminCollaborationsPage() {
  const [submissions, setSubmissions] = useState<CollaborationSubmission[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState<CollaborationSubmission | null>(null);
  const [itemToDelete, setItemToDelete] = useState<CollaborationSubmission | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status_filter", statusFilter);
      if (roleFilter !== "all") params.append("role_filter", roleFilter);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const res = await fetchCollaborations(params.toString());
      setSubmissions(res.items || []);
      setTotalCount(res.total || 0);
    } catch (err) {
      console.error("Failed to load collaboration submissions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, [statusFilter, roleFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadSubmissions();
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      await updateCollaborationStatus(id, newStatus);
      setSubmissions((prev) =>
        prev.map((item) => (item._id === id || item.id === id ? { ...item, status: newStatus } : item))
      );
      if (selectedSubmission && (selectedSubmission._id === id || selectedSubmission.id === id)) {
        setSelectedSubmission((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
      setToastMsg(`Status updated to ${newStatus}`);
      setTimeout(() => setToastMsg(""), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    const id = itemToDelete._id || itemToDelete.id || "";
    try {
      await deleteCollaboration(id);
      setSubmissions((prev) => prev.filter((item) => item._id !== id && item.id !== id));
      if (selectedSubmission && (selectedSubmission._id === id || selectedSubmission.id === id)) {
        setSelectedSubmission(null);
      }
      setItemToDelete(null);
      setToastMsg("Submission deleted successfully");
      setTimeout(() => setToastMsg(""), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to delete submission");
    }
  };

  // Quick stats
  const pendingCount = submissions.filter((s) => s.status === "pending").length;
  const shortlistedCount = submissions.filter((s) => s.status === "shortlisted").length;
  const reviewedCount = submissions.filter((s) => s.status === "reviewed").length;

  const getStatusBadgeStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case "shortlisted":
        return { background: "rgba(16, 185, 129, 0.12)", color: "var(--admin-success-text)", border: "1px solid rgba(16, 185, 129, 0.3)" };
      case "reviewed":
        return { background: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", border: "1px solid rgba(59, 130, 246, 0.3)" };
      case "archived":
        return { background: "rgba(100, 116, 139, 0.12)", color: "var(--admin-text-muted)", border: "1px solid rgba(100, 116, 139, 0.3)" };
      default:
        return { background: "rgba(245, 158, 11, 0.12)", color: "var(--admin-warning-text)", border: "1px solid rgba(245, 158, 11, 0.3)" };
    }
  };

  const columnDefs = useMemo<ColDef<CollaborationSubmission>[]>(
    () => [
      {
        field: "name",
        headerName: "Designer",
        minWidth: 190,
        cellRenderer: (params: any) => {
          const sub = params.data as CollaborationSubmission;
          if (!sub) return null;
          return (
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", height: "100%" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, rgba(196, 154, 69, 0.25), rgba(196, 154, 69, 0.08))",
                  color: "var(--admin-gold-text)",
                  border: "1px solid rgba(196, 154, 69, 0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {sub.name ? sub.name.charAt(0).toUpperCase() : "D"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", overflow: "hidden" }}>
                <span style={{ fontWeight: 600, color: "var(--admin-text-main)", fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {sub.name}
                </span>
                {sub.city && (
                  <span style={{ fontSize: "0.72rem", color: "var(--admin-text-muted)", display: "flex", alignItems: "center", gap: "3px" }}>
                    <MapPin size={10} />
                    {sub.city}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        headerName: "Contact Details",
        minWidth: 200,
        cellRenderer: (params: any) => {
          const sub = params.data as CollaborationSubmission;
          if (!sub) return null;
          const cleanPhone = (sub.phone || "").replace(/[^0-9]/g, "");
          const waNumber = cleanPhone.length === 10 ? "91" + cleanPhone : cleanPhone;
          const waText = encodeURIComponent(
            `Hello ${sub.name}, thank you for submitting your lighting design concept "${sub.concept_title}" to Deluzex. We would love to discuss your design!`
          );
          return (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", fontSize: "0.8rem", gap: "2px" }}>
              {sub.email && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ color: "var(--admin-text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub.email}</span>
                  <a
                    href={`mailto:${sub.email}?subject=${encodeURIComponent(`Deluzex Collaboration - ${sub.concept_title}`)}`}
                    title={`Send email to ${sub.email}`}
                    style={{ color: "var(--admin-info-text)", display: "inline-flex", alignItems: "center", flexShrink: 0 }}
                  >
                    <Mail size={12} />
                  </a>
                </div>
              )}
              {sub.phone && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--admin-text-muted)", fontSize: "0.74rem" }}>
                  <span>{sub.phone}</span>
                  {waNumber && (
                    <a
                      href={`https://wa.me/${waNumber}?text=${waText}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Direct WhatsApp Chat"
                      style={{ color: "var(--admin-success-text)", display: "inline-flex", alignItems: "center", flexShrink: 0 }}
                    >
                      <MessageCircle size={12} />
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        },
      },
      {
        field: "concept_title",
        headerName: "Concept & Inspiration",
        flex: 1.5,
        minWidth: 220,
        cellRenderer: (params: any) => {
          const sub = params.data as CollaborationSubmission;
          if (!sub) return null;
          return (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", overflow: "hidden" }}>
              <div style={{ fontWeight: 600, color: "var(--admin-text-main)", fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {sub.concept_title}
              </div>
              {sub.description && (
                <div style={{ fontSize: "0.75rem", color: "var(--admin-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {sub.description}
                </div>
              )}
            </div>
          );
        },
      },
      {
        headerName: "Background / Firm",
        minWidth: 160,
        cellRenderer: (params: any) => {
          const sub = params.data as CollaborationSubmission;
          if (!sub) return null;
          return (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", fontSize: "0.8rem", gap: "2px" }}>
              <div style={{ color: "var(--admin-text-secondary)", fontWeight: 500 }}>{sub.role || "Designer / Creator"}</div>
              {sub.studio_or_college && (
                <div style={{ fontSize: "0.74rem", color: "var(--admin-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {sub.studio_or_college}
                </div>
              )}
            </div>
          );
        },
      },
      {
        headerName: "Prototyped?",
        width: 140,
        cellRenderer: (params: any) => {
          const sub = params.data as CollaborationSubmission;
          if (!sub) return null;
          const isYes = (sub.has_made_before || "").toLowerCase() === "yes";
          return (
            <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
              <span
                style={{
                  fontSize: "0.72rem",
                  padding: "0.2rem 0.55rem",
                  borderRadius: "6px",
                  fontWeight: 600,
                  background: isYes ? "rgba(245, 158, 11, 0.12)" : "rgba(100, 116, 139, 0.1)",
                  color: isYes ? "var(--admin-warning-text)" : "var(--admin-text-muted)",
                  border: isYes ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid rgba(100, 116, 139, 0.2)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {isYes ? "⚡ Made Before" : "💡 Fresh Concept"}
              </span>
            </div>
          );
        },
      },
      {
        headerName: "Attachment",
        minWidth: 155,
        cellRenderer: (params: any) => {
          const sub = params.data as CollaborationSubmission;
          if (!sub) return null;
          if (sub.file_url) {
            const isImg = isImageFile(sub.file_url, sub.file_name);
            const isPdf = isPdfFile(sub.file_url, sub.file_name);
            return (
              <a
                href={sub.file_url}
                target="_blank"
                rel="noopener noreferrer"
                title={sub.file_name || "View attachment"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  background: isImg ? "rgba(59, 130, 246, 0.08)" : isPdf ? "rgba(239, 68, 68, 0.08)" : "var(--admin-surface-muted)",
                  color: isImg ? "var(--admin-info-text)" : isPdf ? "var(--admin-danger-text)" : "var(--admin-text-main)",
                  border: isImg ? "1px solid rgba(59, 130, 246, 0.25)" : isPdf ? "1px solid rgba(239, 68, 68, 0.25)" : "1px solid var(--admin-border)",
                  padding: "0.25rem 0.6rem",
                  borderRadius: "6px",
                  fontSize: "0.76rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {isImg ? <ImageIcon size={13} /> : isPdf ? <FileText size={13} /> : <FileCheck size={13} />}
                <span>{isImg ? "Drawing / Img" : isPdf ? "PDF Spec" : "Design File"}</span>
                <ExternalLink size={10} style={{ opacity: 0.7 }} />
              </a>
            );
          }
          if (sub.portfolio_link) {
            return (
              <a
                href={sub.portfolio_link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  color: "var(--admin-info-text)",
                  fontSize: "0.76rem",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                <ExternalLink size={12} />
                Portfolio
              </a>
            );
          }
          return <span style={{ color: "var(--admin-text-subtle)", fontSize: "0.78rem" }}>—</span>;
        },
      },
      {
        field: "source",
        headerName: "Source",
        width: 120,
        cellRenderer: (params: any) => {
          const sub = params.data as CollaborationSubmission;
          if (!sub) return null;
          return (
            <span
              style={{
                fontSize: "0.72rem",
                padding: "0.2rem 0.5rem",
                borderRadius: "4px",
                background: sub.source === "homepage_modal" ? "rgba(196, 154, 69, 0.1)" : "var(--admin-surface-muted)",
                color: sub.source === "homepage_modal" ? "#9a762e" : "var(--admin-text-secondary)",
                border: "1px solid var(--admin-border)",
                fontWeight: 600,
              }}
            >
              {sub.source === "homepage_modal" ? "Home Modal" : "Collaborate"}
            </span>
          );
        },
      },
      {
        field: "created_at",
        headerName: "Date",
        width: 110,
        valueFormatter: (params) => {
          if (!params.value) return "N/A";
          try {
            return new Date(params.value).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            });
          } catch {
            return "N/A";
          }
        },
      },
      {
        field: "status",
        headerName: "Status",
        width: 135,
        cellRenderer: (params: any) => {
          const sub = params.data as CollaborationSubmission;
          if (!sub) return null;
          const subId = sub._id || sub.id || "";
          const badgeStyle = getStatusBadgeStyle(sub.status);
          return (
            <select
              value={sub.status}
              disabled={updatingId === subId}
              onChange={(e) => handleStatusChange(subId, e.target.value)}
              style={{
                ...badgeStyle,
                padding: "0.25rem 0.5rem",
                borderRadius: "6px",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="pending">Pending</option>
              <option value="reviewed">Reviewed</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="archived">Archived</option>
            </select>
          );
        },
      },
      {
        headerName: "Actions",
        width: 95,
        pinned: "right",
        cellRenderer: (params: any) => {
          const sub = params.data as CollaborationSubmission;
          if (!sub) return null;
          return (
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", height: "100%" }}>
              <button
                title="View Full Details"
                onClick={() => setSelectedSubmission(sub)}
                style={{
                  background: "var(--admin-surface-muted)",
                  border: "1px solid var(--admin-border)",
                  borderRadius: "6px",
                  padding: "0.35rem",
                  color: "var(--admin-text-secondary)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Eye size={14} />
              </button>
              <button
                title="Delete Submission"
                onClick={() => setItemToDelete(sub)}
                style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  borderRadius: "6px",
                  padding: "0.35rem",
                  color: "var(--admin-danger-text)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        },
      },
    ],
    [updatingId]
  );

  return (
    <div style={{ width: "100%", maxWidth: "100%", margin: 0, padding: 0 }}>
      {/* Toast Notification */}
      {toastMsg && (
        <div
          style={{
            position: "fixed",
            bottom: "2rem",
            right: "2rem",
            maxWidth: "calc(100vw - 4rem)",
            background: "#0f172a",
            color: "#ffffff",
            padding: "0.85rem 1.4rem",
            borderRadius: "10px",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            border: "1px solid #C49A45",
          }}
        >
          <CheckCircle2 size={18} color="#C49A45" />
          <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "space-between", alignItems: "center", marginBottom: "1.75rem" }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--admin-text-main)", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Lightbulb color="#C49A45" size={26} />
            Lighting Design Submissions
          </h1>
          <p style={{ color: "var(--admin-text-muted)", margin: "0.25rem 0 0 0", fontSize: "0.92rem" }}>
            Review, evaluate, and shortlist original lighting concepts and drawings submitted by architects, interior designers, and creators.
          </p>
        </div>
        <button
          onClick={loadSubmissions}
          disabled={loading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "var(--admin-surface)",
            border: "1px solid var(--admin-border)",
            borderRadius: "8px",
            padding: "0.55rem 1rem",
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "var(--admin-text-secondary)",
            cursor: "pointer",
          }}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(210px, 100%), 1fr))", gap: "1rem", marginBottom: "1.75rem" }}>
        <div style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)", borderRadius: "12px", padding: "1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--admin-text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Total Submissions</span>
          <div style={{ fontSize: "var(--a-fs-kpi)", fontWeight: 700, color: "var(--admin-text-main)", marginTop: "0.35rem" }}>{totalCount}</div>
        </div>
        <div style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)", borderRadius: "12px", padding: "1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--admin-warning-text)", fontWeight: 600, textTransform: "uppercase" }}>Pending Review</span>
          <div style={{ fontSize: "var(--a-fs-kpi)", fontWeight: 700, color: "var(--admin-warning-text)", marginTop: "0.35rem" }}>{pendingCount}</div>
        </div>
        <div style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)", borderRadius: "12px", padding: "1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--admin-success-text)", fontWeight: 600, textTransform: "uppercase" }}>Shortlisted</span>
          <div style={{ fontSize: "var(--a-fs-kpi)", fontWeight: 700, color: "var(--admin-success-text)", marginTop: "0.35rem" }}>{shortlistedCount}</div>
        </div>
        <div style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)", borderRadius: "12px", padding: "1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
          <span style={{ fontSize: "0.8rem", color: "#3b82f6", fontWeight: 600, textTransform: "uppercase" }}>Reviewed / Contacted</span>
          <div style={{ fontSize: "var(--a-fs-kpi)", fontWeight: 700, color: "#3b82f6", marginTop: "0.35rem" }}>{reviewedCount}</div>
        </div>
      </div>

      {/* AG-Grid Submissions */}
      <AdminDataGrid<CollaborationSubmission>
        ariaLabel="Design Submissions"
        rowData={submissions}
        columnDefs={columnDefs}
        loading={loading}
        getRowId={(s: CollaborationSubmission) => String(s._id || s.id || s.email)}
        quickFilterText={searchQuery}
        onQuickFilterChange={setSearchQuery}
        searchPlaceholder="Search designer, email, phone, concept…"
        emptyTitle="No submissions found"
        emptyDescription={
          statusFilter !== "all"
            ? "There are no submissions currently in '" + statusFilter + "' status."
            : "No designers have submitted concepts yet. Submissions from the website will appear here in real time."
        }
        toolbar={
          <>
            <div className={styles.segmented} role="tablist" aria-label="Filter submissions by status">
              {["all", "pending", "reviewed", "shortlisted", "archived"].map((st) => (
                <button
                  key={st}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === st}
                  onClick={() => setStatusFilter(st)}
                  className={[styles.segmentedBtn, statusFilter === st ? styles.segmentedBtnActive : ""].join(" ")}
                  style={{ textTransform: "capitalize" }}
                >
                  {st}
                </button>
              ))}
            </div>
          </>
        }
      />

      {/* DETAIL MODAL DRAWER */}
      {selectedSubmission && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(3px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setSelectedSubmission(null)}
        >
          <div
            style={{
              background: "var(--admin-surface)",
              borderRadius: "16px",
              maxWidth: "760px",
              width: "100%",
              maxHeight: "92vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid var(--admin-border)",
              padding: "1.75rem",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedSubmission(null)}
              style={{
                position: "absolute",
                top: "1.25rem",
                right: "1.25rem",
                background: "var(--admin-surface-muted)",
                border: "1px solid var(--admin-border)",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--admin-text-main)",
              }}
            >
              <X size={16} />
            </button>

            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "var(--admin-gold-text)", letterSpacing: "0.08em" }}>
                Submission Dossier
              </span>
              <span
                style={{
                  ...getStatusBadgeStyle(selectedSubmission.status),
                  fontSize: "0.72rem",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "4px",
                  fontWeight: 600,
                  textTransform: "capitalize",
                }}
              >
                {selectedSubmission.status}
              </span>
            </div>

            <h2 style={{ fontSize: "1.45rem", fontWeight: 700, color: "var(--admin-text-main)", margin: "0.2rem 0 1rem 0" }}>
              {selectedSubmission.concept_title}
            </h2>

            {/* Quick Action Bar for Instant Admin Outreach */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.6rem",
                alignItems: "center",
                padding: "0.75rem 1rem",
                background: "var(--admin-surface-muted)",
                borderRadius: "10px",
                border: "1px solid var(--admin-border)",
                marginBottom: "1.5rem",
              }}
            >
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--admin-text-secondary)" }}>
                Quick Outreach:
              </span>
              {selectedSubmission.phone && (
                <a
                  href={`https://wa.me/${selectedSubmission.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                    `Hello ${selectedSubmission.name}, thank you for submitting your lighting design concept "${selectedSubmission.concept_title}" to Deluzex. We would love to discuss the details and production possibilities with you!`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    background: "#16a34a",
                    color: "#ffffff",
                    padding: "0.4rem 0.85rem",
                    borderRadius: "6px",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  <MessageCircle size={14} />
                  WhatsApp Designer
                </a>
              )}
              {selectedSubmission.email && (
                <a
                  href={`mailto:${selectedSubmission.email}?subject=${encodeURIComponent(
                    `Deluzex Collaboration - ${selectedSubmission.concept_title}`
                  )}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    background: "#2563eb",
                    color: "#ffffff",
                    padding: "0.4rem 0.85rem",
                    borderRadius: "6px",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  <Mail size={14} />
                  Email Designer
                </a>
              )}
            </div>

            {/* Designer Profile Card */}
            <div style={{ background: "var(--admin-surface-muted)", borderRadius: "10px", padding: "1.25rem", marginBottom: "1.5rem", border: "1px solid var(--admin-border)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                <div>
                  <div style={{ fontSize: "0.74rem", color: "var(--admin-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Designer Full Name</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--admin-text-main)", marginTop: "0.15rem" }}>{selectedSubmission.name}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.74rem", color: "var(--admin-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Email Address</div>
                  <div style={{ fontSize: "0.92rem", color: "var(--admin-text-main)", marginTop: "0.15rem" }}>
                    <a href={`mailto:${selectedSubmission.email}`} style={{ color: "var(--admin-info-text)", textDecoration: "none", fontWeight: 500 }}>
                      {selectedSubmission.email}
                    </a>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.74rem", color: "var(--admin-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Phone / WhatsApp</div>
                  <div style={{ fontSize: "0.92rem", color: "var(--admin-text-main)", marginTop: "0.15rem" }}>
                    {selectedSubmission.phone ? (
                      <span style={{ fontWeight: 500 }}>{selectedSubmission.phone}</span>
                    ) : (
                      <span style={{ color: "var(--admin-text-subtle)" }}>Not provided</span>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.74rem", color: "var(--admin-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>City / Location</div>
                  <div style={{ fontSize: "0.92rem", color: "var(--admin-text-main)", marginTop: "0.15rem", fontWeight: 500 }}>
                    {selectedSubmission.city || "Not specified"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.74rem", color: "var(--admin-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Design Background</div>
                  <div style={{ fontSize: "0.92rem", color: "var(--admin-text-main)", marginTop: "0.15rem", fontWeight: 500 }}>
                    {selectedSubmission.role || "Architect / Designer"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.74rem", color: "var(--admin-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Studio / College</div>
                  <div style={{ fontSize: "0.92rem", color: "var(--admin-text-main)", marginTop: "0.15rem", fontWeight: 500 }}>
                    {selectedSubmission.studio_or_college || "Independent / Individual"}
                  </div>
                </div>
              </div>
            </div>

            {/* Concept Details & Inspiration */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "0.78rem", color: "var(--admin-text-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.4rem" }}>
                About the Design &amp; Inspiration
              </div>
              <p
                style={{
                  background: "var(--admin-surface-muted)",
                  padding: "1rem 1.25rem",
                  borderRadius: "8px",
                  border: "1px solid var(--admin-border)",
                  fontSize: "0.9rem",
                  lineHeight: "1.65",
                  color: "var(--admin-text-secondary)",
                  margin: 0,
                  whiteSpace: "pre-wrap",
                }}
              >
                {selectedSubmission.description || "No detailed description provided."}
              </p>
            </div>

            {/* Prototyped Status & Submission Source */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
              <div style={{ background: "var(--admin-surface-muted)", padding: "0.9rem 1.1rem", borderRadius: "8px", border: "1px solid var(--admin-border)" }}>
                <div style={{ fontSize: "0.74rem", color: "var(--admin-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                  Has this light been made before?
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "0.35rem" }}>
                  <span
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      padding: "0.2rem 0.6rem",
                      borderRadius: "6px",
                      background:
                        (selectedSubmission.has_made_before || "").toLowerCase() === "yes"
                          ? "rgba(245, 158, 11, 0.15)"
                          : "rgba(16, 185, 129, 0.15)",
                      color:
                        (selectedSubmission.has_made_before || "").toLowerCase() === "yes"
                          ? "#b45309"
                          : "#047857",
                      border:
                        (selectedSubmission.has_made_before || "").toLowerCase() === "yes"
                          ? "1px solid rgba(245, 158, 11, 0.3)"
                          : "1px solid rgba(16, 185, 129, 0.3)",
                    }}
                  >
                    {(selectedSubmission.has_made_before || "").toLowerCase() === "yes"
                      ? "⚡ Yes - Previously Prototyped / Manufactured"
                      : "💡 No - Brand New Original Concept"}
                  </span>
                </div>
              </div>

              <div style={{ background: "var(--admin-surface-muted)", padding: "0.9rem 1.1rem", borderRadius: "8px", border: "1px solid var(--admin-border)" }}>
                <div style={{ fontSize: "0.74rem", color: "var(--admin-text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                  Submission Context &amp; Date
                </div>
                <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--admin-text-main)", marginTop: "0.35rem" }}>
                  {selectedSubmission.source === "homepage_modal" ? "Homepage Modal" : "/collaborate Page Form"}
                  {selectedSubmission.created_at && (
                    <span style={{ fontSize: "0.78rem", color: "var(--admin-text-muted)", fontWeight: 400, marginLeft: "8px" }}>
                      • {new Date(selectedSubmission.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Design Attachments & Drawings Preview */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "0.78rem", color: "var(--admin-text-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.6rem" }}>
                Design Drawings &amp; Attachments
              </div>

              {selectedSubmission.file_url ? (
                <div
                  style={{
                    background: "var(--admin-surface-muted)",
                    borderRadius: "12px",
                    border: "1px solid var(--admin-border)",
                    padding: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                  }}
                >
                  {/* If it's an image: Render High-Resolution Visual Preview */}
                  {isImageFile(selectedSubmission.file_url, selectedSubmission.file_name) ? (
                    <div>
                      <div
                        style={{
                          background: "#0b0f19",
                          borderRadius: "10px",
                          overflow: "hidden",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          maxHeight: "360px",
                          border: "1px solid var(--admin-border)",
                        }}
                      >
                        <img
                          src={selectedSubmission.file_url}
                          alt={selectedSubmission.concept_title || "Design Concept"}
                          style={{
                            maxWidth: "100%",
                            maxHeight: "360px",
                            objectFit: "contain",
                            display: "block",
                          }}
                        />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                        <span style={{ fontSize: "0.82rem", color: "var(--admin-text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                          <ImageIcon size={14} />
                          {selectedSubmission.file_name || "Lighting Concept Drawing / Render"}
                        </span>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <a
                            href={selectedSubmission.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.4rem",
                              background: "var(--admin-primary)",
                              color: "#111111",
                              padding: "0.45rem 0.95rem",
                              borderRadius: "6px",
                              fontSize: "0.82rem",
                              fontWeight: 600,
                              textDecoration: "none",
                            }}
                          >
                            <ExternalLink size={13} />
                            Open Full Resolution
                          </a>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* If it's a PDF or Document: Render Document Preview Card */
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div
                          style={{
                            width: "44px",
                            height: "44px",
                            borderRadius: "8px",
                            background: "rgba(239, 68, 68, 0.12)",
                            color: "var(--admin-danger-text)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <FileText size={22} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--admin-text-main)", fontSize: "0.9rem" }}>
                            {selectedSubmission.file_name || "Design Blueprint & Specifications (PDF)"}
                          </div>
                          <div style={{ fontSize: "0.76rem", color: "var(--admin-text-muted)" }}>
                            Portable Document Format (.pdf)
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <a
                          href={selectedSubmission.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.4rem",
                            background: "var(--admin-primary)",
                            color: "#111111",
                            padding: "0.5rem 1rem",
                            borderRadius: "6px",
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                        >
                          <ExternalLink size={14} />
                          Open PDF in New Window
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Portfolio Link if provided */}
                  {selectedSubmission.portfolio_link && (
                    <div style={{ paddingTop: "0.75rem", borderTop: "1px solid var(--admin-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.82rem", color: "var(--admin-text-muted)" }}>External Designer Portfolio:</span>
                      <a
                        href={selectedSubmission.portfolio_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          color: "var(--admin-info-text)",
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        <ExternalLink size={13} />
                        {selectedSubmission.portfolio_link}
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    background: "var(--admin-surface-muted)",
                    borderRadius: "8px",
                    border: "1px dashed var(--admin-border)",
                    padding: "1rem",
                    color: "var(--admin-text-muted)",
                    fontSize: "0.85rem",
                    textAlign: "center",
                  }}
                >
                  No attachment uploaded for this concept.
                </div>
              )}
            </div>

            {/* Status Changer Footer */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "1.25rem", borderTop: "1px solid var(--admin-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--admin-text-secondary)" }}>Update Status:</span>
                <select
                  value={selectedSubmission.status}
                  onChange={(e) => handleStatusChange(selectedSubmission._id || selectedSubmission.id || "", e.target.value)}
                  style={{
                    padding: "0.45rem 0.85rem",
                    borderRadius: "6px",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    ...getStatusBadgeStyle(selectedSubmission.status),
                    cursor: "pointer",
                  }}
                >
                  <option value="pending">Pending Review</option>
                  <option value="reviewed">Reviewed &amp; Contacted</option>
                  <option value="shortlisted">Shortlisted for Production</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <button
                onClick={() => setSelectedSubmission(null)}
                style={{
                  background: "var(--admin-surface-muted)",
                  border: "1px solid var(--admin-border)",
                  borderRadius: "8px",
                  padding: "0.55rem 1.25rem",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  color: "var(--admin-text-main)",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {itemToDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.55)",
            backdropFilter: "blur(2px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setItemToDelete(null)}
        >
          <div
            style={{
              background: "var(--admin-surface)",
              borderRadius: "12px",
              maxWidth: "420px",
              width: "100%",
              padding: "1.75rem",
              textAlign: "center",
              border: "1px solid var(--admin-border)",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.1)",
                color: "var(--admin-danger-text)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1rem auto",
              }}
            >
              <Trash2 size={24} />
            </div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--admin-text-main)", margin: "0 0 0.5rem 0" }}>
              Delete Submission?
            </h3>
            <p style={{ fontSize: "0.88rem", color: "var(--admin-text-muted)", margin: "0 0 1.5rem 0", lineHeight: "1.5" }}>
              Are you sure you want to delete the submission for <strong>{itemToDelete.concept_title}</strong> by {itemToDelete.name}? This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                onClick={() => setItemToDelete(null)}
                style={{
                  background: "var(--admin-surface-muted)",
                  border: "1px solid var(--admin-border)",
                  borderRadius: "8px",
                  padding: "0.6rem 1.25rem",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  color: "var(--admin-text-main)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                style={{
                  background: "#ef4444",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "0.6rem 1.25rem",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
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
