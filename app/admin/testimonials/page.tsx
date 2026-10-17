"use client";

import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";
import styles from "../admin.module.css";
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  AlertCircle,
  ImageIcon,
  Star,
  MessageSquareQuote,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Eye,
} from "lucide-react";
import {
  fetchTestimonials,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  Testimonial,
} from "../../services/api";

type ViewMode = "list" | "create" | "edit";

export default function AdminTestimonialsPage() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // View state: list, create, edit
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingItem, setEditingItem] = useState<Testimonial | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Testimonial | null>(null);

  // Form fields
  const [formData, setFormData] = useState({
    author_name: "",
    author_title: "",
    text: "",
    rating: 5,
    avatar_url: "",
  });
  const [imageTab, setImageTab] = useState<"file" | "url">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadTestimonials();
  }, []);

  async function loadTestimonials() {
    setLoading(true);
    try {
      const data = await fetchTestimonials();
      setTestimonials(data);
    } catch (err) {
      console.error("Failed to load testimonials:", err);
    } finally {
      setLoading(false);
    }
  }

  function startCreate() {
    setErrorMsg("");
    setSuccessMsg("");
    setFormData({
      author_name: "",
      author_title: "",
      text: "",
      rating: 5,
      avatar_url: "",
    });
    setSelectedFile(null);
    setPreviewUrl("");
    setImageTab("file");
    setEditingItem(null);
    setViewMode("create");
  }

  function startEdit(item: Testimonial) {
    setErrorMsg("");
    setSuccessMsg("");
    setFormData({
      author_name: item.author_name || "",
      author_title: item.author_title || "",
      text: item.text || "",
      rating: item.rating || 5,
      avatar_url: item.avatar_url || "",
    });
    setSelectedFile(null);
    setPreviewUrl(item.avatar_url || "");
    setImageTab(
      item.avatar_url?.startsWith("http") || item.avatar_url?.startsWith("/images")
        ? "url"
        : "file"
    );
    setEditingItem(item);
    setViewMode("edit");
  }

  function backToList() {
    setViewMode("list");
    setEditingItem(null);
    setErrorMsg("");
    setSelectedFile(null);
    setPreviewUrl("");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  }

  function handleImageUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setFormData((prev) => ({ ...prev, avatar_url: val }));
    if (!selectedFile) {
      setPreviewUrl(val);
    }
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (!formData.author_name.trim()) {
      setErrorMsg("Author name is required.");
      return;
    }
    if (!formData.text.trim()) {
      setErrorMsg("Review / story text is required.");
      return;
    }

    setSubmitting(true);
    try {
      const submitData = new FormData();
      submitData.append("author_name", formData.author_name.trim());
      submitData.append("text", formData.text.trim());
      if (formData.author_title.trim()) {
        submitData.append("author_title", formData.author_title.trim());
      }
      submitData.append("rating", String(formData.rating || 5));

      if (selectedFile) {
        submitData.append("avatar_file", selectedFile);
      } else if (formData.avatar_url.trim()) {
        submitData.append("avatar_url", formData.avatar_url.trim());
      } else {
        submitData.append("avatar_url", "/images/avatar_woman_1784107804209.jpg");
      }

      await createTestimonial(submitData);
      setSuccessMsg("Customer story published successfully.");
      await loadTestimonials();
      setViewMode("list");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create testimonial";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;
    setErrorMsg("");

    if (!formData.author_name.trim()) {
      setErrorMsg("Author name is required.");
      return;
    }
    if (!formData.text.trim()) {
      setErrorMsg("Review / story text is required.");
      return;
    }

    setSubmitting(true);
    try {
      const submitData = new FormData();
      submitData.append("author_name", formData.author_name.trim());
      submitData.append("text", formData.text.trim());
      submitData.append("author_title", formData.author_title.trim());
      submitData.append("rating", String(formData.rating || 5));

      if (selectedFile) {
        submitData.append("avatar_file", selectedFile);
      } else if (formData.avatar_url.trim()) {
        submitData.append("avatar_url", formData.avatar_url.trim());
      }

      const itemId = editingItem._id || editingItem.id || "";
      await updateTestimonial(itemId, submitData);
      setSuccessMsg("Customer story updated successfully.");
      await loadTestimonials();
      setViewMode("list");
      setEditingItem(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update testimonial";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!itemToDelete) return;
    const itemId = itemToDelete._id || itemToDelete.id || "";

    try {
      await deleteTestimonial(itemId);
      setItemToDelete(null);
      setSuccessMsg("Customer story deleted successfully.");
      await loadTestimonials();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete testimonial";
      alert(msg);
    }
  }

  const renderStars = (rating: number = 5) => {
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        stars.push(
          <span key={i} style={{ color: "#D79322" }}>
            ★
          </span>
        );
      } else if (i === fullStars + 1 && hasHalf) {
        stars.push(
          <span key={i} style={{ color: "#D79322" }}>
            ★
          </span>
        );
      } else {
        stars.push(
          <span key={i} style={{ color: "#E0D5C7" }}>
            ☆
          </span>
        );
      }
    }
    return stars;
  };

  // =========================================================================
  // VIEW 1: FULL-PAGE CREATE OR EDIT FORM (USES 100% OF PAGE WIDTH)
  // =========================================================================
  if (viewMode === "create" || viewMode === "edit") {
    const isEdit = viewMode === "edit";

    return (
      <div className={styles.sectionContainer} style={{ width: "100%", maxWidth: "100%", margin: 0 }}>
        {/* Navigation Breadcrumb */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <button
            onClick={backToList}
            type="button"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "#ffffff",
              border: "1px solid var(--admin-border)",
              borderRadius: "8px",
              color: "var(--admin-text-main)",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
              padding: "0.6rem 1rem",
              transition: "all 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--admin-primary)";
              e.currentTarget.style.color = "var(--admin-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--admin-border)";
              e.currentTarget.style.color = "var(--admin-text-main)";
            }}
          >
            <ArrowLeft size={16} />
            Back to Customer Stories
          </button>

          <span
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              padding: "4px 12px",
              borderRadius: "20px",
              background: isEdit ? "#eff6ff" : "#fefce8",
              color: isEdit ? "#1d4ed8" : "#854d0e",
              border: `1px solid ${isEdit ? "#bfdbfe" : "#fef08a"}`,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Sparkles size={13} />
            {isEdit ? "Editing Customer Story" : "Creating New Customer Story"}
          </span>
        </div>

        {/* Page Header */}
        <div className={styles.headerRow} style={{ marginBottom: "1.75rem" }}>
          <div>
            <h2 className={styles.sectionTitle} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              {isEdit ? <Pencil size={26} color="#2563eb" /> : <Plus size={26} color="#C49A45" />}
              {isEdit ? `Edit Customer Story: ${editingItem?.author_name || ""}` : "Add New Customer Story"}
            </h2>
            <p className={styles.sectionSubtitle}>
              {isEdit
                ? "Update client review content, author designation, portrait image, or star rating."
                : "Create and publish a new client quote to showcase on the homepage customer stories carousel."}
            </p>
          </div>
        </div>

        {/* Full-Page Form Card - 100% Full Width with Multi-Column Grid */}
        <div
          className={styles.card}
          style={{
            width: "100%",
            maxWidth: "100%",
            background: "#ffffff",
            padding: 0,
            overflow: "hidden",
          }}
        >
          <form onSubmit={isEdit ? handleEditSubmit : handleCreateSubmit}>
            {errorMsg && (
              <div
                style={{
                  margin: "1.5rem 2rem 0",
                  padding: "0.85rem 1.25rem",
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: "8px",
                  color: "#991B1B",
                  fontSize: "0.875rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                }}
              >
                <AlertCircle size={18} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 2-Column Responsive Layout Utilizing Whole Page Width */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
                gap: "2.5rem",
                padding: "2rem",
              }}
            >
              {/* LEFT COLUMN: Text & Story Content */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <div style={{ borderBottom: "1px solid var(--admin-border)", paddingBottom: "0.75rem" }}>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--admin-primary)" }}>
                    1. Author Information &amp; Review
                  </h3>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.825rem", color: "var(--admin-text-muted)" }}>
                    Enter client name, professional title, and their testimonial quote.
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.formLabel}>Author Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Anna Clark"
                      value={formData.author_name}
                      onChange={(e) => setFormData({ ...formData, author_name: e.target.value })}
                      className={styles.formInput}
                      style={{ padding: "0.85rem 1rem", fontSize: "0.95rem" }}
                    />
                  </div>

                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.formLabel}>Author Title / Role</label>
                    <input
                      type="text"
                      placeholder="e.g. Interior Designer, London"
                      value={formData.author_title}
                      onChange={(e) => setFormData({ ...formData, author_title: e.target.value })}
                      className={styles.formInput}
                      style={{ padding: "0.85rem 1rem", fontSize: "0.95rem" }}
                    />
                  </div>
                </div>

                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.formLabel}>Star Rating (1 - 5) *</label>
                  <select
                    value={formData.rating}
                    onChange={(e) => setFormData({ ...formData, rating: Number(e.target.value) })}
                    className={styles.formInput}
                    style={{ padding: "0.85rem 1rem", fontSize: "0.95rem" }}
                  >
                    <option value={5}>★★★★★ (5.0 Stars - Exceptional)</option>
                    <option value={4.5}>★★★★½ (4.5 Stars - Excellent)</option>
                    <option value={4}>★★★★☆ (4.0 Stars - Great)</option>
                    <option value={3.5}>★★★½☆ (3.5 Stars - Good)</option>
                    <option value={3}>★★★☆☆ (3.0 Stars - Average)</option>
                  </select>
                </div>

                <div className={styles.formGroup} style={{ marginBottom: 0, flex: 1 }}>
                  <label className={styles.formLabel}>Story / Review Text *</label>
                  <textarea
                    required
                    rows={6}
                    placeholder="Describe the client experience, fixture craftsmanship, illumination warmth, or residential project result..."
                    value={formData.text}
                    onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                    className={styles.formInput}
                    style={{
                      padding: "0.9rem 1rem",
                      fontSize: "0.95rem",
                      lineHeight: "1.6",
                      resize: "vertical",
                      minHeight: "140px",
                    }}
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--admin-text-muted)", marginTop: "0.35rem" }}>
                    Recommended length: 80 to 240 characters for optimal display in the homepage marquee.
                  </span>
                </div>
              </div>

              {/* RIGHT COLUMN: Avatar Upload & Real-Time Live Preview */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <div style={{ borderBottom: "1px solid var(--admin-border)", paddingBottom: "0.75rem" }}>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--admin-primary)" }}>
                    2. Author Avatar &amp; Live Preview
                  </h3>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.825rem", color: "var(--admin-text-muted)" }}>
                    Select a client portrait photo and view how the card will appear on the homepage.
                  </p>
                </div>

                {/* Avatar Photo Source Selector */}
                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                    <label className={styles.formLabel} style={{ margin: 0 }}>
                      Portrait Source
                    </label>
                    <div className={styles.tabSwitch}>
                      <button
                        type="button"
                        onClick={() => setImageTab("file")}
                        className={`${styles.tabSwitchBtn} ${imageTab === "file" ? styles.tabSwitchBtnActive : ""}`}
                      >
                        Upload File
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageTab("url")}
                        className={`${styles.tabSwitchBtn} ${imageTab === "url" ? styles.tabSwitchBtnActive : ""}`}
                      >
                        Image URL
                      </button>
                    </div>
                  </div>

                  {imageTab === "file" ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={styles.dropzone}
                      style={{ padding: "1.75rem 1.5rem" }}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        style={{ display: "none" }}
                      />
                      <Upload size={28} style={{ color: "#C49A45", marginBottom: "0.4rem" }} />
                      <p style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--admin-primary)", margin: 0 }}>
                        {selectedFile ? selectedFile.name : "Click to browse and upload portrait"}
                      </p>
                      <span style={{ fontSize: "0.8rem", color: "var(--admin-text-muted)" }}>
                        PNG, JPG, WEBP up to 5MB {isEdit ? "(leave empty to keep current)" : ""}
                      </span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. /images/avatar_woman_1784107804209.jpg"
                      value={formData.avatar_url}
                      onChange={handleImageUrlChange}
                      className={styles.formInput}
                      style={{ padding: "0.85rem 1rem" }}
                    />
                  )}
                </div>

                {/* REAL-TIME HOMEPAGE CARD PREVIEW */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
                    <Eye size={15} color="#C49A45" />
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--admin-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Live Homepage Carousel Card Preview
                    </span>
                  </div>

                  <div
                    style={{
                      background: "#FBF9F6",
                      borderRadius: "16px",
                      padding: "1.75rem",
                      border: "1px solid #EAE2D5",
                      boxShadow: "0 6px 20px rgba(0,0,0,0.03)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      minHeight: "220px",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "1.1rem", letterSpacing: "2px", marginBottom: "0.85rem" }}>
                        {renderStars(formData.rating || 5)}
                      </div>
                      <p
                        style={{
                          fontSize: "0.95rem",
                          lineHeight: 1.65,
                          color: "#3A3530",
                          fontStyle: "italic",
                          margin: 0,
                          minHeight: "56px",
                        }}
                      >
                        &ldquo;{formData.text || "Your testimonial quote will appear here in real time as you type..."}&rdquo;
                      </p>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                        marginTop: "1.25rem",
                        paddingTop: "1rem",
                        borderTop: "1px solid #ECE3D7",
                      }}
                    >
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: "50%",
                          overflow: "hidden",
                          position: "relative",
                          border: "2px solid #C49A45",
                          flexShrink: 0,
                          background: "#e2e8f0",
                        }}
                      >
                        {previewUrl ? (
                          <Image src={previewUrl} alt="Preview" fill sizes="52px" style={{ objectFit: "cover" }} />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <ImageIcon size={22} color="#94a3b8" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: "1rem", fontWeight: 700, color: "#1A1816" }}>
                          {formData.author_name || "Client Name"}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "#8C827A", fontWeight: 500 }}>
                          {formData.author_title || "Client Title / Location"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Row - Full Width */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "1.5rem 2rem",
                background: "#f8fafc",
                borderTop: "1px solid var(--admin-border)",
              }}
            >
              <button
                type="button"
                onClick={backToList}
                className={styles.btnCancel}
                style={{ padding: "0.75rem 1.5rem", fontSize: "0.95rem" }}
              >
                Cancel
              </button>
              <div style={{ display: "flex", gap: "1rem" }}>
                <button
                  type="submit"
                  disabled={submitting}
                  className={styles.primaryButton}
                  style={{ padding: "0.75rem 2rem", fontSize: "0.95rem" }}
                >
                  {submitting ? "Saving Story..." : isEdit ? "Save Changes" : "Publish Customer Story"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: FULL-PAGE TABLE LIST (USES 100% OF PAGE WIDTH)
  // =========================================================================
  return (
    <div className={styles.sectionContainer} style={{ width: "100%", maxWidth: "100%", margin: 0 }}>
      {/* HEADER ROW */}
      <div className={styles.headerRow} style={{ marginBottom: "1.75rem" }}>
        <div>
          <h2 className={styles.sectionTitle} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <MessageSquareQuote size={28} color="#C49A45" />
            Customer Stories &amp; Testimonials
          </h2>
          <p className={styles.sectionSubtitle}>
            Manage client testimonials and ratings displayed across the homepage customer stories carousel.
          </p>
        </div>
        <button onClick={startCreate} className={styles.primaryButton}>
          <Plus size={18} />
          Add Testimonial
        </button>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "0.9rem 1.25rem",
            background: "#F0FDF4",
            border: "1px solid #BBF7D0",
            borderRadius: "10px",
            color: "#166534",
            fontSize: "0.875rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
            boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <CheckCircle2 size={18} />
            <span style={{ fontWeight: 600 }}>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg("")}
            style={{ background: "transparent", border: "none", color: "#166534", cursor: "pointer", fontSize: "1rem" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Delete Confirmation Banner (Inline, no popups/overlays) */}
      {itemToDelete && (
        <div
          style={{
            marginBottom: "1.75rem",
            padding: "1.25rem 1.75rem",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1.5rem",
            flexWrap: "wrap",
            boxShadow: "0 4px 12px rgba(239, 68, 68, 0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "#FEE2E2",
                color: "#DC2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Trash2 size={22} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#991B1B" }}>
                Confirm Deletion
              </h4>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "#B91C1C" }}>
                Are you sure you want to delete the testimonial from &quot;{itemToDelete.author_name}&quot;? This cannot be undone.
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button
              onClick={() => setItemToDelete(null)}
              className={styles.btnCancel}
              style={{ background: "#ffffff", border: "1px solid #E5E7EB", padding: "0.65rem 1.25rem" }}
            >
              Cancel
            </button>
            <button onClick={handleDelete} className={styles.btnDeleteConfirm} style={{ padding: "0.65rem 1.5rem" }}>
              Yes, Delete Story
            </button>
          </div>
        </div>
      )}

      {/* FULL-WIDTH TABLE CARD - 100% OF PAGE */}
      <div className={styles.card} style={{ width: "100%", maxWidth: "100%" }}>
        <div
          style={{
            padding: "1.25rem 1.75rem",
            borderBottom: "1px solid var(--admin-border)",
            background: "#f8fafc",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--admin-primary)", margin: 0 }}>
              Published Customer Stories
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--admin-text-muted)", margin: "0.25rem 0 0" }}>
              {testimonials.length} client review{testimonials.length === 1 ? "" : "s"} active on the homepage carousel
            </p>
          </div>
          <span
            style={{
              fontSize: "0.75rem",
              background: "#f0fdf4",
              color: "#166534",
              border: "1px solid #bbf7d0",
              padding: "4px 12px",
              borderRadius: "20px",
              fontWeight: 600,
            }}
          >
            Live on Homepage
          </span>
        </div>

        {loading ? (
          <div style={{ padding: "4rem", textAlign: "center", color: "var(--admin-text-muted)" }}>
            Loading customer stories...
          </div>
        ) : testimonials.length === 0 ? (
          <div style={{ padding: "4rem", textAlign: "center", color: "var(--admin-text-muted)" }}>
            <MessageSquareQuote size={48} style={{ margin: "0 auto 1rem", opacity: 0.4 }} />
            <p style={{ marginBottom: "1.25rem", fontSize: "1rem" }}>
              No customer stories found. Click &quot;Add Testimonial&quot; to publish your first story.
            </p>
            <button onClick={startCreate} className={styles.primaryButton}>
              <Plus size={18} /> Add First Testimonial
            </button>
          </div>
        ) : (
          <div className={styles.tableWrapper} style={{ width: "100%", overflowX: "auto" }}>
            <table className={styles.table} style={{ width: "100%", tableLayout: "auto" }}>
              <thead>
                <tr>
                  <th style={{ width: "70px" }}>Avatar</th>
                  <th style={{ width: "16%" }}>Author</th>
                  <th style={{ width: "18%" }}>Role / Title</th>
                  <th style={{ width: "110px" }}>Rating</th>
                  <th style={{ width: "auto" }}>Story / Review</th>
                  <th style={{ width: "160px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {testimonials.map((item) => {
                  const itemId = item._id || item.id || "";
                  return (
                    <tr key={itemId}>
                      <td>
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            minWidth: 48,
                            borderRadius: "50%",
                            overflow: "hidden",
                            position: "relative",
                            background: "#f1f5f9",
                            border: "2px solid #E8E0D8",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                          }}
                        >
                          {item.avatar_url ? (
                            <Image
                              src={item.avatar_url}
                              alt={item.author_name || "Author"}
                              fill
                              sizes="48px"
                              style={{ objectFit: "cover" }}
                            />
                          ) : (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "100%",
                                height: "100%",
                                background: "#f8fafc",
                              }}
                            >
                              <ImageIcon size={20} color="#94a3b8" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--admin-primary)", fontSize: "0.95rem" }}>
                          {item.author_name}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            background: "#f1f5f9",
                            color: "#475569",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "0.825rem",
                            fontWeight: 500,
                          }}
                        >
                          {item.author_title || "Client"}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            background: "#FEF9C3",
                            color: "#854D0E",
                            border: "1px solid #FEF08A",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontWeight: 700,
                            fontSize: "0.825rem",
                          }}
                        >
                          <Star size={13} fill="#854D0E" strokeWidth={0} />
                          {Number(item.rating || 5).toFixed(1)}
                        </span>
                      </td>
                      <td>
                        <p
                          style={{
                            margin: 0,
                            color: "#475569",
                            fontSize: "0.9rem",
                            lineHeight: 1.6,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={item.text}
                        >
                          &ldquo;{item.text}&rdquo;
                        </p>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end", alignItems: "center" }}>
                          <button
                            onClick={() => startEdit(item)}
                            className={styles.actionLink}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.35rem",
                              border: "none",
                              cursor: "pointer",
                              padding: "0.45rem 0.85rem",
                            }}
                          >
                            <Pencil size={13} /> Edit
                          </button>
                          <button
                            onClick={() => setItemToDelete(item)}
                            className={styles.actionDelete}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.35rem",
                              border: "none",
                              cursor: "pointer",
                              padding: "0.45rem 0.85rem",
                            }}
                          >
                            <Trash2 size={13} /> Delete
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
    </div>
  );
}
