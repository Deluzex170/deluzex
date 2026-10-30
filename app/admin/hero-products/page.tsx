"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import Image from "next/image";
import type { ColDef } from "ag-grid-community";
import type { CustomCellRendererProps } from "ag-grid-react";
import styles from "../admin.module.css";
import AdminDataGrid from "../../components/admin/AdminDataGrid";
import {
  ActionButtonsRenderer,
  CurrencyRenderer,
  ImageThumbnailRenderer,
  type ActionButtonsParams,
} from "../../components/admin/gridRenderers";
import { uploadFileToCloudinary } from "@/lib/upload";
import {
  Plus,
  Trash2,
  Upload,
  AlertCircle,
  ImageIcon,
  X,
  ArrowLeft,
  Save,
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

  // Hero fixtures grid columns — Edit/Delete use the same handlers as before
  const columnDefs = useMemo<ColDef<HeroProduct>[]>(() => [
    {
      headerName: "Image",
      field: "image",
      width: 76,
      minWidth: 76,
      maxWidth: 76,
      flex: 0,
      sortable: false,
      filter: false,
      resizable: false,
      cellRenderer: ImageThumbnailRenderer,
    },
    {
      headerName: "Title",
      field: "name",
      minWidth: 200,
      flex: 1.5,
      cellRenderer: (p: CustomCellRendererProps<HeroProduct>) => (
        <span style={{ fontWeight: 600, color: "var(--admin-text-main)" }}>{p.value}</span>
      ),
    },
    {
      headerName: "Price",
      field: "price",
      minWidth: 120,
      type: "rightAligned",
      filter: "agNumberColumnFilter",
      valueGetter: (p) => Number(p.data?.price || 0),
      cellRenderer: CurrencyRenderer,
    },
    { headerName: "Alt Caption", field: "alt", minWidth: 240, flex: 2, tooltipField: "alt" },
    {
      headerName: "Actions",
      colId: "actions",
      width: 96,
      minWidth: 96,
      maxWidth: 96,
      flex: 0,
      sortable: false,
      filter: false,
      resizable: false,
      pinned: "right",
      cellRenderer: ActionButtonsRenderer<HeroProduct>,
      cellRendererParams: {
        onEdit: (p: HeroProduct) => startEdit(p),
        onDelete: (p: HeroProduct) => setItemToDelete(p),
        labelFor: (p: HeroProduct) => p.name,
      } satisfies ActionButtonsParams<HeroProduct>,
    },
  ], []);

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
                gap: "var(--a-space-5)",
                alignItems: "start",
              }}
            >
              {/* Left Column: Form Fields */}
              <div className={styles.panel}>
                <h3 className={styles.panelTitle}>Fixture Specifications</h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--a-space-4)" }}>
                  <div className={styles.field}>
                    <label htmlFor="hero-name" className={styles.fieldLabel}>Lamp Name *</label>
                    <input
                      id="hero-name"
                      type="text"
                      required
                      placeholder="e.g. Cylindrical Floor Lamp"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={styles.control}
                    />
                  </div>

                  <div className={styles.gridCols2}>
                    <div className={styles.field}>
                      <label htmlFor="hero-price" className={styles.fieldLabel}>Price (₹) *</label>
                      <input
                        id="hero-price"
                        type="number"
                        step="0.01"
                        required
                        placeholder="231"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        className={styles.control}
                      />
                    </div>

                    <div className={styles.field}>
                      <label htmlFor="hero-alt" className={styles.fieldLabel} title="Accessibility Alt Text">Alt Text *</label>
                      <input
                        id="hero-alt"
                        type="text"
                        required
                        placeholder="e.g. Modern gold floor lamp"
                        value={formData.alt}
                        onChange={(e) => setFormData({ ...formData, alt: e.target.value })}
                        className={styles.control}
                        title={formData.alt}
                      />
                    </div>
                  </div>

                  <div className={styles.field}>
                    <span className={styles.fieldLabel} id="hero-photo-label">Product Photograph *</span>

                    <div className={styles.segmented} role="tablist" aria-labelledby="hero-photo-label" style={{ alignSelf: "flex-start" }}>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={imageTab === "file"}
                        onClick={() => setImageTab("file")}
                        className={`${styles.segmentedBtn} ${imageTab === "file" ? styles.segmentedBtnActive : ""}`}
                      >
                        <Upload size={14} aria-hidden="true" />
                        Upload File
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={imageTab === "url"}
                        onClick={() => setImageTab("url")}
                        className={`${styles.segmentedBtn} ${imageTab === "url" ? styles.segmentedBtnActive : ""}`}
                      >
                        <ImageIcon size={14} aria-hidden="true" />
                        Image URL
                      </button>
                    </div>

                    {imageTab === "file" ? (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => fileInputRef.current?.click()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            fileInputRef.current?.click();
                          }
                        }}
                        className={styles.dropzone}
                        style={{ marginTop: 0 }}
                      >
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={handleFileChange}
                        />
                        <Upload size={22} color="var(--admin-text-subtle)" style={{ margin: "0 auto var(--a-space-2)" }} />
                        <p style={{ margin: "0 0 2px", fontSize: "var(--a-fs-sm)", fontWeight: 600, color: "var(--admin-primary)" }}>
                          {selectedFile ? selectedFile.name : "Click to select a photo"}
                        </p>
                        <span style={{ fontSize: "var(--a-fs-xs)", color: "var(--admin-text-muted)" }}>
                          PNG, JPG, WEBP up to 5MB
                        </span>
                      </div>
                    ) : (
                      <input
                        type="text"
                        aria-label="Image URL"
                        placeholder="https://... or /images/..."
                        value={formData.image}
                        onChange={handleImageUrlChange}
                        className={styles.control}
                      />
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "var(--a-space-3)", marginTop: "var(--a-space-2)" }}>
                    <button
                      type="button"
                      onClick={backToTable}
                      className={`${styles.btn} ${styles.btnSecondary}`}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      style={{ flex: 2 }}
                    >
                      <Save size={16} aria-hidden="true" />
                      <span>{submitting ? "Saving Fixture..." : viewMode === "create" ? "Add Hero Fixture" : "Save Changes"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Hero Carousel Card Preview */}
              <div className={styles.panel}>
                <h3 className={styles.panelTitle}>Homepage Hero Preview</h3>

                <div
                  style={{
                    background: "#2A1F14",
                    borderRadius: "16px",
                    padding: "var(--a-space-6)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "var(--a-space-4)",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      width: "200px",
                      height: "260px",
                      borderRadius: "18px",
                      background: "var(--admin-surface)",
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
                          color: "var(--admin-text-subtle)",
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
                    <h4 style={{ margin: "0 0 0.25rem", fontSize: "var(--a-fs-lg)", fontFamily: "var(--font-libre), serif", color: "#F5EFE6" }}>
                      {formData.name || "Lamp Title"}
                    </h4>
                    <p style={{ margin: 0, fontSize: "var(--a-fs-xs)", color: "rgba(245, 239, 230, 0.78)" }}>
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
                  style={{ background: "var(--admin-surface)", border: "1px solid #E5E7EB", padding: "0.65rem 1.25rem" }}
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

          {/* HERO FIXTURES GRID (AG Grid Community) */}
          <AdminDataGrid<HeroProduct>
            ariaLabel="Hero slider fixtures"
            rowData={heroProducts}
            columnDefs={columnDefs}
            loading={loading}
            getRowId={(p) => String(p._id || p.id || p.name)}
            searchPlaceholder="Search hero fixtures…"
            emptyTitle="No hero fixtures created yet"
            emptyDescription="Add fixtures to appear in the rotating homepage hero card."
            emptyAction={
              <button type="button" onClick={startCreate} className={`${styles.btn} ${styles.btnPrimary}`}>
                <Plus size={15} aria-hidden="true" /> Add First Hero Fixture
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}
