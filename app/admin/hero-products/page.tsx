"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import Image from "next/image";
import styles from "../admin.module.css";
import { uploadFileToCloudinary } from "@/lib/upload";
import {
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Upload,
  AlertCircle,
  ImageIcon,
  X,
  ArrowLeft,
  Save,
  Search,
} from "lucide-react";
import {
  fetchHeroProducts,
  createHeroProduct,
  updateHeroProduct,
  deleteHeroProduct,
  HeroProduct,
} from "../../services/api";

export default function AdminHeroProducts() {
  const [heroProducts, setHeroProducts] = useState<HeroProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // View mode: 'table' | 'create' | 'edit' (100% full-page UI, zero modal popups)
  const [viewMode, setViewMode] = useState<"table" | "create" | "edit">("table");
  const [editingProduct, setEditingProduct] = useState<HeroProduct | null>(null);
  const [itemToDelete, setItemToDelete] = useState<HeroProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    alt: "",
    image: "",
  });
  const [imageTab, setImageTab] = useState("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadHeroProducts();
  }, []);

  async function loadHeroProducts() {
    setLoading(true);
    try {
      const data = await fetchHeroProducts();
      setHeroProducts(data);
    } catch (err) {
      console.error("Failed to load hero products:", err);
      setErrorMsg("Failed to load hero slider fixtures.");
    } finally {
      setLoading(false);
    }
  }

  function startCreate() {
    setErrorMsg("");
    setFormData({ name: "", price: "", alt: "", image: "" });
    setSelectedFile(null);
    setPreviewUrl("");
    setImageTab("file");
    setEditingProduct(null);
    setViewMode("create");
  }

  function startEdit(prod: HeroProduct) {
    setErrorMsg("");
    setFormData({
      name: prod.name || "",
      price: prod.price !== undefined ? String(prod.price) : "",
      alt: prod.alt || "",
      image: prod.image || "",
    });
    setSelectedFile(null);
    setPreviewUrl(prod.image || "");
    setImageTab(prod.image?.startsWith("http") || prod.image?.startsWith("/images") ? "url" : "file");
    setEditingProduct(prod);
    setViewMode("edit");
  }

  function backToTable() {
    setViewMode("table");
    setEditingProduct(null);
    setErrorMsg("");
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
    setFormData((prev) => ({ ...prev, image: val }));
    if (!selectedFile) {
      setPreviewUrl(val);
    }
  }

  function clearImage() {
    setSelectedFile(null);
    setPreviewUrl("");
    setFormData((prev) => ({ ...prev, image: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.price || !formData.alt.trim()) {
      setErrorMsg("Lamp name, price, and alt text are required.");
      return;
    }
    if (!formData.image.trim() && !selectedFile) {
      setErrorMsg("Please provide an image file or image URL.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      let finalImageUrl = formData.image.trim();
      if (selectedFile) {
        try {
          const uploadRes = await uploadFileToCloudinary(selectedFile, "cms");
          if (uploadRes?.url) {
            finalImageUrl = uploadRes.url;
          }
        } catch (uploadErr) {
          console.warn("Direct upload fallback:", uploadErr);
        }
      }

      const body = new FormData();
      body.append("name", formData.name.trim());
      body.append("price", String(Number(formData.price)));
      body.append("alt", formData.alt.trim());
      if (finalImageUrl) {
        body.append("image", finalImageUrl);
      } else if (selectedFile) {
        body.append("image_file", selectedFile);
      }

      await createHeroProduct(body);
      setSuccessMsg(`Hero product "${formData.name}" added successfully.`);
      setViewMode("table");
      await loadHeroProducts();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create hero product");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProduct) return;
    const prodId = editingProduct._id || editingProduct.id;
    if (!prodId) {
      setErrorMsg("Product identifier is missing.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      let finalImageUrl = formData.image.trim();
      if (selectedFile) {
        try {
          const uploadRes = await uploadFileToCloudinary(selectedFile, "cms");
          if (uploadRes?.url) {
            finalImageUrl = uploadRes.url;
          }
        } catch (uploadErr) {
          console.warn("Direct upload fallback:", uploadErr);
        }
      }

      const body = new FormData();
      body.append("name", formData.name.trim());
      body.append("price", String(Number(formData.price)));
      body.append("alt", formData.alt.trim());
      if (finalImageUrl) {
        body.append("image", finalImageUrl);
      } else if (selectedFile) {
        body.append("image_file", selectedFile);
      }

      await updateHeroProduct(prodId, body);
      setSuccessMsg(`Hero product "${formData.name}" updated successfully.`);
      setViewMode("table");
      setEditingProduct(null);
      await loadHeroProducts();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update hero product");
    } finally {
      setSubmitting(false);
    }
  }

  async function executeDelete() {
    if (!itemToDelete) return;
    const prodId = itemToDelete._id || itemToDelete.id;
    if (!prodId) return;

    setDeleting(true);
    setErrorMsg("");
    try {
      await deleteHeroProduct(prodId);
      setSuccessMsg(`Hero product "${itemToDelete.name}" deleted successfully.`);
      setItemToDelete(null);
      await loadHeroProducts();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete hero product");
    } finally {
      setDeleting(false);
    }
  }

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return heroProducts;
    const q = searchQuery.toLowerCase();
    return heroProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.alt && p.alt.toLowerCase().includes(q))
    );
  }, [heroProducts, searchQuery]);

  return (
    <div className={styles.sectionContainer} style={{ width: "100%", maxWidth: "100%" }}>
      {/* ===================== VIEW MODE: CREATE / EDIT (FULL PAGE) ===================== */}
      {viewMode !== "table" ? (
        <div>
          {/* Back Navigation */}
          <div style={{ marginBottom: "1.75rem" }}>
            <button
              type="button"
              onClick={backToTable}
              style={{
                color: "var(--admin-text-muted)",
                fontSize: "0.85rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                marginBottom: "0.75rem",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <ArrowLeft size={16} />
              <span>Back to Hero Products</span>
            </button>
            <h2 className={styles.sectionTitle}>
              {viewMode === "create" ? "Add Hero Product" : `Edit "${formData.name || "Hero Product"}"`}
            </h2>
            <p className={styles.sectionSubtitle}>
              {viewMode === "create"
                ? "Feature a standout fixture on the homepage hero carousel."
                : "Update carousel pricing, photography, and accessibility description."}
            </p>
          </div>

          {errorMsg && (
            <div
              style={{
                marginBottom: "1.5rem",
                padding: "0.9rem 1.25rem",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "10px",
                color: "#991b1b",
                fontSize: "0.9rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Full-Page 2-Column Form */}
          <form onSubmit={viewMode === "create" ? handleAddSubmit : handleEditSubmit}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(360px, 100%), 1fr))",
                gap: "2rem",
                alignItems: "start",
              }}
            >
              {/* Left Column: Form Fields */}
              <div className={styles.card} style={{ padding: "2rem" }}>
                <h3 style={{ margin: "0 0 1.5rem", fontSize: "1.1rem", fontWeight: 700, color: "var(--admin-primary)" }}>
                  Fixture Specifications
                </h3>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Lamp Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cylindrical Floor Lamp"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.gridCols2}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Price (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="231"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className={styles.formInput}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Accessibility Alt Text *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Modern gold floor lamp"
                      value={formData.alt}
                      onChange={(e) => setFormData({ ...formData, alt: e.target.value })}
                      className={styles.formInput}
                    />
                  </div>
                </div>

                <div className={styles.formGroup} style={{ marginBottom: "2rem" }}>
                  <label className={styles.formLabel}>Product Photograph *</label>

                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                    <button
                      type="button"
                      onClick={() => setImageTab("file")}
                      className={imageTab === "file" ? styles.tabBtnActive : styles.tabBtn}
                      style={{ padding: "0.4rem 0.9rem", fontSize: "0.85rem", borderRadius: "6px" }}
                    >
                      Upload File
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageTab("url")}
                      className={imageTab === "url" ? styles.tabBtnActive : styles.tabBtn}
                      style={{ padding: "0.4rem 0.9rem", fontSize: "0.85rem", borderRadius: "6px" }}
                    >
                      Image URL
                    </button>
                  </div>

                  {imageTab === "file" ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: "2px dashed #cbd5e1",
                        borderRadius: "10px",
                        padding: "1.5rem",
                        textAlign: "center",
                        cursor: "pointer",
                        background: "#f8fafc",
                        transition: "border-color 0.2s",
                      }}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={handleFileChange}
                      />
                      <Upload size={28} color="#94a3b8" style={{ margin: "0 auto 0.5rem" }} />
                      <p style={{ margin: "0 0 0.25rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--admin-primary)" }}>
                        {selectedFile ? selectedFile.name : "Click to select a photo"}
                      </p>
                      <span style={{ fontSize: "0.75rem", color: "var(--admin-text-muted)" }}>
                        PNG, JPG, WEBP up to 5MB
                      </span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="https://... or /images/..."
                      value={formData.image}
                      onChange={handleImageUrlChange}
                      className={styles.formInput}
                    />
                  )}
                </div>

                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button
                    type="button"
                    onClick={backToTable}
                    className={styles.btnCancel}
                    style={{ flex: 1, padding: "0.75rem" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={styles.primaryButton}
                    style={{ flex: 2, justifyContent: "center", padding: "0.75rem" }}
                  >
                    <Save size={18} />
                    <span>{submitting ? "Saving Fixture..." : viewMode === "create" ? "Add Hero Fixture" : "Save Changes"}</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Live Hero Carousel Card Preview */}
              <div className={styles.card} style={{ padding: "2rem" }}>
                <h3 style={{ margin: "0 0 1.5rem", fontSize: "1.1rem", fontWeight: 700, color: "var(--admin-primary)" }}>
                  Homepage Hero Preview
                </h3>

                <div
                  style={{
                    background: "#2A1F14",
                    borderRadius: "16px",
                    padding: "2rem",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "1.5rem",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      width: "200px",
                      height: "260px",
                      borderRadius: "18px",
                      background: "#fff",
                      overflow: "hidden",
                      boxShadow: "0 16px 36px rgba(0, 0, 0, 0.35)",
                      border: "1.5px solid rgba(255, 255, 255, 0.35)",
                    }}
                  >
                    {previewUrl ? (
                      <Image
                        src={previewUrl}
                        alt={formData.alt || "Preview"}
                        fill
                        style={{ objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#94a3b8",
                          gap: "0.5rem",
                        }}
                      >
                        <ImageIcon size={40} />
                        <span style={{ fontSize: "0.8rem" }}>Upload photo</span>
                      </div>
                    )}

                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: "16px 12px 10px",
                        background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
                        textAlign: "center",
                      }}
                    >
                      <span style={{ fontSize: "0.85rem", color: "#cb9856", fontWeight: 700 }}>
                        ₹{formData.price || "0"}
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: "center", color: "#fff" }}>
                    <h4 style={{ margin: "0 0 0.25rem", fontSize: "1.1rem", fontFamily: "var(--font-libre), serif" }}>
                      {formData.name || "Lamp Title"}
                    </h4>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "rgba(255,255,255,0.7)" }}>
                      {formData.alt || "Lamp accessibility caption"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      ) : (
        /* ===================== VIEW MODE: TABLE (FULL PAGE) ===================== */
        <div>
          {/* Top Header */}
          <div className={styles.headerRow}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "0.25rem" }}>
                <h2 className={styles.sectionTitle}>Hero Slider Management</h2>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    background: "rgba(196, 154, 69, 0.12)",
                    color: "#C49A45",
                    padding: "3px 10px",
                    borderRadius: "12px",
                  }}
                >
                  {heroProducts.length} Hero Items
                </span>
              </div>
              <p className={styles.sectionSubtitle}>
                Control the luxury lighting collection showcased in the interactive hero slider on the homepage.
              </p>
            </div>

            <button onClick={startCreate} className={styles.primaryButton}>
              <Plus size={18} />
              <span>Add Hero Product</span>
            </button>
          </div>

          {/* Success Banner */}
          {successMsg && (
            <div
              style={{
                marginBottom: "1.5rem",
                padding: "0.9rem 1.25rem",
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                borderRadius: "10px",
                color: "#065f46",
                fontSize: "0.9rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span>✓</span>
              <span>{successMsg}</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div
              style={{
                marginBottom: "1.5rem",
                padding: "0.9rem 1.25rem",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "10px",
                color: "#991b1b",
                fontSize: "0.9rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* INLINE DELETE CONFIRMATION BANNER (Strictly zero modal popup / zero background blur) */}
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
                    Confirm Slider Fixture Deletion
                  </h4>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "#B91C1C" }}>
                    Are you sure you want to remove <strong>&quot;{itemToDelete.name}&quot;</strong> from the homepage slider? This action cannot be undone.
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setItemToDelete(null)}
                  className={styles.btnCancel}
                  style={{ background: "#ffffff", border: "1px solid #E5E7EB", padding: "0.65rem 1.25rem" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={executeDelete}
                  className={styles.btnDeleteConfirm}
                  style={{ padding: "0.65rem 1.5rem", background: "#DC2626", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}
                >
                  {deleting ? "Removing..." : "Remove Fixture"}
                </button>
              </div>
            </div>
          )}

          {/* Main Table Card (Full Width) */}
          <div className={styles.card} style={{ width: "100%", maxWidth: "100%" }}>
            {/* Search Bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--admin-border)" }}>
              <div style={{ position: "relative", width: "100%", maxWidth: "340px" }}>
                <Search size={16} color="var(--admin-text-muted)" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Search hero fixtures..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.formInput}
                  style={{ paddingLeft: "36px", height: "38px", fontSize: "0.875rem" }}
                />
              </div>

              <span style={{ fontSize: "0.85rem", color: "var(--admin-text-muted)" }}>
                Showing {filteredProducts.length} of {heroProducts.length} hero fixtures
              </span>
            </div>

            {loading ? (
              <div style={{ padding: "4rem 2rem", textAlign: "center", color: "var(--admin-text-muted)" }}>
                Loading hero slider fixtures...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div style={{ padding: "4rem 2rem", textAlign: "center", color: "var(--admin-text-muted)" }}>
                <Sparkles size={40} color="#cbd5e1" style={{ margin: "0 auto 1rem" }} />
                <h4 style={{ margin: "0 0 0.5rem", color: "var(--admin-primary)", fontSize: "1.05rem" }}>
                  {searchQuery ? "No matching fixtures" : "No hero fixtures created yet"}
                </h4>
                <p style={{ margin: "0 0 1.25rem", fontSize: "0.875rem" }}>
                  {searchQuery ? "Try refining your search query." : "Add fixtures to appear in the rotating homepage hero card."}
                </p>
                {!searchQuery && (
                  <button onClick={startCreate} className={styles.primaryButton} style={{ margin: "0 auto" }}>
                    <Plus size={16} /> Add First Hero Fixture
                  </button>
                )}
              </div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: "80px" }}>Image</th>
                      <th>Fixture Name</th>
                      <th>Price</th>
                      <th>Accessibility Alt Text</th>
                      <th style={{ textAlign: "right", width: "160px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((prod, idx) => {
                      const prodId = prod._id || prod.id || idx;
                      return (
                        <tr key={prodId}>
                          <td>
                            <div
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: "8px",
                                overflow: "hidden",
                                position: "relative",
                                background: "#f1f5f9",
                                border: "1px solid var(--admin-border)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {prod.image ? (
                                <Image
                                  src={prod.image}
                                  alt={prod.alt || prod.name}
                                  fill
                                  sizes="48px"
                                  style={{ objectFit: "cover" }}
                                />
                              ) : (
                                <ImageIcon size={20} color="#94a3b8" />
                              )}
                            </div>
                          </td>

                          <td style={{ fontWeight: 600, color: "var(--admin-primary)", fontSize: "0.95rem" }}>
                            {prod.name}
                          </td>

                          <td style={{ fontWeight: 600, color: "var(--admin-primary)" }}>
                            ₹{Number(prod.price).toFixed(2)}
                          </td>

                          <td style={{ color: "var(--admin-text-muted)", maxWidth: "320px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.85rem" }}>
                            {prod.alt}
                          </td>

                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", alignItems: "center" }}>
                              <button
                                type="button"
                                onClick={() => startEdit(prod)}
                                className={styles.actionButton}
                                style={{ background: "#f1f5f9", padding: "0.4rem 0.75rem", fontSize: "0.8rem", borderRadius: "6px" }}
                              >
                                <Pencil size={13} color="#475569" />
                                <span>Edit</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setItemToDelete(prod)}
                                className={styles.actionButton}
                                style={{
                                  background: "#fef2f2",
                                  color: "#b91c1c",
                                  border: "1px solid #fee2e2",
                                  padding: "0.4rem 0.75rem",
                                  fontSize: "0.8rem",
                                  borderRadius: "6px",
                                }}
                              >
                                <Trash2 size={13} />
                                <span>Delete</span>
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
      )}
    </div>
  );
}
