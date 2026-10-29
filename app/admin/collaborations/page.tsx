"use client";

import React, { useEffect, useState } from "react";
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
} from "lucide-react";

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
        return { background: "rgba(16, 185, 129, 0.12)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)" };
      case "reviewed":
        return { background: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", border: "1px solid rgba(59, 130, 246, 0.3)" };
      case "archived":
        return { background: "rgba(100, 116, 139, 0.12)", color: "#64748b", border: "1px solid rgba(100, 116, 139, 0.3)" };
      default:
        return { background: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.3)" };
    }
  };

  return (
    <div style={{ padding: "1.5rem min(2rem, 4vw)", maxWidth: "1400px", margin: "0 auto" }}>
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
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Lightbulb color="#C49A45" size={26} />
            Lighting Design Submissions
          </h1>
          <p style={{ color: "#64748b", margin: "0.25rem 0 0 0", fontSize: "0.92rem" }}>
            Review, evaluate, and shortlist original lighting concepts submitted by designers, architects, and creators.
          </p>
        </div>
        <button
          onClick={loadSubmissions}
          disabled={loading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "0.55rem 1rem",
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "#334155",
            cursor: "pointer",
          }}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(210px, 100%), 1fr))", gap: "1rem", marginBottom: "1.75rem" }}>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
          <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Total Submissions</span>
          <div style={{ fontSize: "1.85rem", fontWeight: 700, color: "#0f172a", marginTop: "0.35rem" }}>{totalCount}</div>
        </div>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
          <span style={{ fontSize: "0.8rem", color: "#f59e0b", fontWeight: 600, textTransform: "uppercase" }}>Pending Review</span>
          <div style={{ fontSize: "1.85rem", fontWeight: 700, color: "#f59e0b", marginTop: "0.35rem" }}>{pendingCount}</div>
        </div>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
          <span style={{ fontSize: "0.8rem", color: "#10b981", fontWeight: 600, textTransform: "uppercase" }}>Shortlisted</span>
          <div style={{ fontSize: "1.85rem", fontWeight: 700, color: "#10b981", marginTop: "0.35rem" }}>{shortlistedCount}</div>
        </div>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
          <span style={{ fontSize: "0.8rem", color: "#3b82f6", fontWeight: 600, textTransform: "uppercase" }}>Reviewed / Contacted</span>
          <div style={{ fontSize: "1.85rem", fontWeight: 700, color: "#3b82f6", marginTop: "0.35rem" }}>{reviewedCount}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1rem 1.25rem", marginBottom: "1.25rem", display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "space-between", alignItems: "center" }}>
        {/* Status Tabs */}
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {["all", "pending", "reviewed", "shortlisted", "archived"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                background: statusFilter === st ? "#0f172a" : "transparent",
                color: statusFilter === st ? "#ffffff" : "#64748b",
                border: "none",
                borderRadius: "6px",
                padding: "0.45rem 0.9rem",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
                textTransform: "capitalize",
                transition: "all 0.2s",
              }}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search form */}
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "0.5rem", flex: 1, maxWidth: "380px" }}>
          <div style={{ position: "relative", width: "100%" }}>
            <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Search designer, email, concept..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem 0.5rem 2.25rem",
                fontSize: "0.85rem",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                outline: "none",
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              background: "#0f172a",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "0.5rem 1rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Search
          </button>
        </form>
      </div>

      {/* Submissions Table */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
            <p>Loading design submissions...</p>
          </div>
        ) : submissions.length === 0 ? (
          <div style={{ padding: "3.5rem", textAlign: "center", color: "#64748b" }}>
            <Lightbulb size={40} color="#cbd5e1" style={{ margin: "0 auto 1rem auto" }} />
            <h3 style={{ fontSize: "1.1rem", color: "#334155", margin: "0 0 0.5rem 0" }}>No submissions found</h3>
            <p style={{ fontSize: "0.88rem", maxWidth: "400px", margin: "0 auto" }}>
              {statusFilter !== "all"
                ? `There are no submissions currently in '${statusFilter}' status.`
                : "No designers have submitted concepts yet. Submissions from the website will appear here in real time."}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontWeight: 600 }}>
                  <th style={{ padding: "0.85rem 1.25rem" }}>Designer</th>
                  <th style={{ padding: "0.85rem 1rem" }}>Contact Details</th>
                  <th style={{ padding: "0.85rem 1rem" }}>Concept Title</th>
                  <th style={{ padding: "0.85rem 1rem" }}>Background / Firm</th>
                  <th style={{ padding: "0.85rem 1rem" }}>Attachment</th>
                  <th style={{ padding: "0.85rem 1rem" }}>Source</th>
                  <th style={{ padding: "0.85rem 1rem" }}>Date</th>
                  <th style={{ padding: "0.85rem 1rem" }}>Status</th>
                  <th style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => {
                  const subId = sub._id || sub.id || "";
                  const badgeStyle = getStatusBadgeStyle(sub.status);
                  const dateStr = sub.created_at
                    ? new Date(sub.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                    : "N/A";

                  return (
                    <tr
                      key={subId}
                      style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "0.85rem 1.25rem", fontWeight: 600, color: "#0f172a" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <div
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              background: "rgba(196, 154, 69, 0.15)",
                              color: "#C49A45",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.85rem",
                              fontWeight: 700,
                            }}
                          >
                            {sub.name.charAt(0).toUpperCase()}
                          </div>
                          <span>{sub.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <div style={{ color: "#0f172a" }}>{sub.email}</div>
                        {sub.phone && <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{sub.phone}</div>}
                      </td>
                      <td style={{ padding: "0.85rem 1rem", maxWidth: "220px" }}>
                        <div style={{ fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {sub.concept_title}
                        </div>
                        {sub.description && (
                          <div style={{ fontSize: "0.78rem", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {sub.description}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "0.85rem 1rem", color: "#475569" }}>
                        <div>{sub.role || "Designer"}</div>
                        {sub.studio_or_college && (
                          <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{sub.studio_or_college}</div>
                        )}
                      </td>
                      <td style={{ padding: "0.85rem 1rem" }}>
                        {sub.file_url ? (
                          <a
                            href={sub.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.3rem",
                              background: "#f1f5f9",
                              color: "#2563eb",
                              padding: "0.3rem 0.6rem",
                              borderRadius: "6px",
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              textDecoration: "none",
                            }}
                          >
                            <FileText size={13} />
                            View File
                          </a>
                        ) : sub.portfolio_link ? (
                          <a
                            href={sub.portfolio_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.3rem",
                              color: "#2563eb",
                              fontSize: "0.78rem",
                              textDecoration: "none",
                            }}
                          >
                            <ExternalLink size={13} />
                            Portfolio
                          </a>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>None</span>
                        )}
                      </td>
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            padding: "0.2rem 0.5rem",
                            borderRadius: "4px",
                            background: sub.source === "homepage_modal" ? "rgba(196, 154, 69, 0.1)" : "#f1f5f9",
                            color: sub.source === "homepage_modal" ? "#9a762e" : "#475569",
                            fontWeight: 600,
                          }}
                        >
                          {sub.source === "homepage_modal" ? "Home Modal" : "Collaborate Page"}
                        </span>
                      </td>
                      <td style={{ padding: "0.85rem 1rem", color: "#64748b", fontSize: "0.82rem" }}>
                        {dateStr}
                      </td>
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <select
                          value={sub.status}
                          disabled={updatingId === subId}
                          onChange={(e) => handleStatusChange(subId, e.target.value)}
                          style={{
                            ...badgeStyle,
                            padding: "0.3rem 0.6rem",
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
                      </td>
                      <td style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                          <button
                            title="View Full Details"
                            onClick={() => setSelectedSubmission(sub)}
                            style={{
                              background: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              borderRadius: "6px",
                              padding: "0.4rem",
                              color: "#334155",
                              cursor: "pointer",
                            }}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            title="Delete Submission"
                            onClick={() => setItemToDelete(sub)}
                            style={{
                              background: "#fef2f2",
                              border: "1px solid #fecaca",
                              borderRadius: "6px",
                              padding: "0.4rem",
                              color: "#ef4444",
                              cursor: "pointer",
                            }}
                          >
                            <Trash2 size={15} />
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

      {/* DETAIL MODAL DRAWER */}
      {selectedSubmission && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.6)",
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
              background: "#ffffff",
              borderRadius: "16px",
              maxWidth: "680px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              padding: "2rem",
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
                background: "#f1f5f9",
                border: "none",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={16} />
            </button>

            <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "#C49A45", letterSpacing: "0.08em" }}>
              Submission Details
            </span>
            <h2 style={{ fontSize: "1.45rem", fontWeight: 700, color: "#0f172a", margin: "0.3rem 0 1.25rem 0" }}>
              {selectedSubmission.concept_title}
            </h2>

            {/* Designer Profile Card */}
            <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "1.25rem", marginBottom: "1.5rem", border: "1px solid #e2e8f0" }}>
              <div className={styles.formGrid2} style={{ display: "grid", gap: "1rem" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Designer Name</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#0f172a", marginTop: "0.15rem" }}>{selectedSubmission.name}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Email Address</div>
                  <div style={{ fontSize: "0.95rem", color: "#0f172a", marginTop: "0.15rem" }}>
                    <a href={`mailto:${selectedSubmission.email}`} style={{ color: "#2563eb", textDecoration: "none" }}>
                      {selectedSubmission.email}
                    </a>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Phone / WhatsApp</div>
                  <div style={{ fontSize: "0.95rem", color: "#0f172a", marginTop: "0.15rem" }}>
                    {selectedSubmission.phone ? (
                      <a href={`https://wa.me/${selectedSubmission.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ color: "#10b981", textDecoration: "none" }}>
                        {selectedSubmission.phone}
                      </a>
                    ) : (
                      "N/A"
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>City / Location</div>
                  <div style={{ fontSize: "0.95rem", color: "#0f172a", marginTop: "0.15rem" }}>{selectedSubmission.city || "Not specified"}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Design Background</div>
                  <div style={{ fontSize: "0.95rem", color: "#0f172a", marginTop: "0.15rem" }}>{selectedSubmission.role || "Architect / Designer"}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Studio / Firm / College</div>
                  <div style={{ fontSize: "0.95rem", color: "#0f172a", marginTop: "0.15rem" }}>{selectedSubmission.studio_or_college || "Independent"}</div>
                </div>
              </div>
            </div>

            {/* Concept Details */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "0.8rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.4rem" }}>
                Concept Description &amp; Inspiration
              </div>
              <p style={{ background: "#f8fafc", padding: "1rem", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.9rem", lineHeight: "1.6", color: "#334155", margin: 0 }}>
                {selectedSubmission.description || "No detailed description provided."}
              </p>
            </div>

            {/* Additional Info */}
            <div className={styles.formGrid2} style={{ display: "grid", gap: "1rem", marginBottom: "1.5rem" }}>
              <div style={{ background: "#f8fafc", padding: "0.85rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Manufactured / Prototyped Before?</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#0f172a", marginTop: "0.2rem", textTransform: "capitalize" }}>
                  {selectedSubmission.has_made_before || "No"}
                </div>
              </div>
              <div style={{ background: "#f8fafc", padding: "0.85rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Submission Source</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#0f172a", marginTop: "0.2rem" }}>
                  {selectedSubmission.source === "homepage_modal" ? "Homepage Modal" : "/collaborate Page"}
                </div>
              </div>
            </div>

            {/* Portfolio Link & Files */}
            {(selectedSubmission.portfolio_link || selectedSubmission.file_url) && (
              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ fontSize: "0.8rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Design Attachments &amp; Portfolio
                </div>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  {selectedSubmission.file_url && (
                    <a
                      href={selectedSubmission.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        background: "#0f172a",
                        color: "#ffffff",
                        padding: "0.6rem 1.2rem",
                        borderRadius: "8px",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      <Download size={16} />
                      View Uploaded Design File
                    </a>
                  )}
                  {selectedSubmission.portfolio_link && (
                    <a
                      href={selectedSubmission.portfolio_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        background: "#f1f5f9",
                        color: "#0f172a",
                        padding: "0.6rem 1.2rem",
                        borderRadius: "8px",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        textDecoration: "none",
                        border: "1px solid #cbd5e1",
                      }}
                    >
                      <ExternalLink size={16} />
                      Open Portfolio Link
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Status Changer Footer */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "1.25rem", borderTop: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>Current Status:</span>
                <select
                  value={selectedSubmission.status}
                  onChange={(e) => handleStatusChange(selectedSubmission._id || selectedSubmission.id || "", e.target.value)}
                  style={{
                    padding: "0.45rem 0.85rem",
                    borderRadius: "6px",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    ...getStatusBadgeStyle(selectedSubmission.status),
                  }}
                >
                  <option value="pending">Pending</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="shortlisted">Shortlisted</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <button
                onClick={() => setSelectedSubmission(null)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "8px",
                  padding: "0.55rem 1.25rem",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
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
            background: "rgba(0, 0, 0, 0.5)",
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
              background: "#ffffff",
              borderRadius: "12px",
              maxWidth: "420px",
              width: "100%",
              padding: "1.75rem",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "#fef2f2",
                color: "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1rem auto",
              }}
            >
              <Trash2 size={24} />
            </div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.5rem 0" }}>
              Delete Submission?
            </h3>
            <p style={{ fontSize: "0.88rem", color: "#64748b", margin: "0 0 1.5rem 0" }}>
              Are you sure you want to delete the submission for <strong>{itemToDelete.concept_title}</strong> by {itemToDelete.name}? This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                onClick={() => setItemToDelete(null)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "8px",
                  padding: "0.6rem 1.25rem",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
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
