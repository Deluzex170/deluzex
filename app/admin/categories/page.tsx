"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import type { ColDef } from "ag-grid-community";
import type { CustomCellRendererProps } from "ag-grid-react";
import styles from "../admin.module.css";
import { fetchCategories, fetchProducts, deleteCategory, Category } from "../../services/api";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import AdminDataGrid from "../../components/admin/AdminDataGrid";
import { ActionButtonsRenderer, ImageThumbnailRenderer, type ActionButtonsParams } from "../../components/admin/gridRenderers";

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemToDelete, setItemToDelete] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);
    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch (error) {
      console.error(error);
      setErrorMsg("Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }

  async function executeDelete() {
    if (!itemToDelete) return;
    const catId = itemToDelete._id || itemToDelete.id || itemToDelete.category_id;
    if (!catId) return;

    setDeleting(true);
    setErrorMsg("");
    try {
      await deleteCategory(catId);
      setSuccessMsg(`Category "${itemToDelete.name}" deleted successfully.`);
      setItemToDelete(null);
      await loadCategories();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (error: any) {
      setErrorMsg(error?.message || "Failed to delete category.");
    } finally {
      setDeleting(false);
    }
  }

  // Product counts per category (read-only, from the catalog the Products page uses)
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    fetchProducts()
      .then((list) => {
        const counts: Record<string, number> = {};
        for (const p of list) {
          const key = (p.product_category || "").trim().toLowerCase();
          if (key) counts[key] = (counts[key] || 0) + 1;
        }
        setProductCounts(counts);
      })
      .catch(() => setProductCounts({}));
  }, []);

  // Categories grid columns — Edit/Delete use the same routes and confirmation as before
  const columnDefs = useMemo<ColDef<Category>[]>(() => [
    {
      headerName: "Image",
      field: "image_url",
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
      headerName: "Category Name",
      field: "name",
      minWidth: 180,
      cellRenderer: (p: CustomCellRendererProps<Category>) => (
        <span style={{ fontWeight: 600, color: "var(--admin-text-main)" }}>{p.value}</span>
      ),
    },
    {
      headerName: "Description",
      colId: "description",
      minWidth: 240,
      flex: 2,
      valueGetter: (p) => p.data?.description || "No description provided.",
      tooltipValueGetter: (p) => p.data?.description || "",
    },
    {
      headerName: "Total Products",
      colId: "productCount",
      minWidth: 140,
      type: "rightAligned",
      filter: "agNumberColumnFilter",
      valueGetter: (p) => productCounts[(p.data?.name || "").trim().toLowerCase()] ?? 0,
    },
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
      cellRenderer: ActionButtonsRenderer<Category>,
      cellRendererParams: {
        editHref: (c: Category) => "/admin/categories/edit/" + (c._id || c.id || c.category_id),
        onDelete: (c: Category) => setItemToDelete(c),
        labelFor: (c: Category) => c.name,
      } satisfies ActionButtonsParams<Category>,
    },
  ], [productCounts]);


  return (
    <div className={styles.sectionContainer}>
      {/* Top Header */}
      <div className={styles.headerRow}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "0.25rem" }}>
            <h2 className={styles.sectionTitle}>Categories Management</h2>
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
              {categories.length} Categories
            </span>
          </div>
          <p className={styles.sectionSubtitle}>
            Organize catalog fixtures and luxury lighting collections across the storefront.
          </p>
        </div>

        <Link href="/admin/categories/create" className={styles.primaryButton}>
          <Plus size={18} />
          <span>Add Category</span>
        </Link>
      </div>

      {/* Success Notification Banner */}
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

      {/* Error Notification Banner */}
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
                Confirm Category Deletion
              </h4>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "#B91C1C" }}>
                Are you sure you want to delete category <strong>&quot;{itemToDelete.name}&quot;</strong>? This action cannot be undone.
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
              {deleting ? "Deleting..." : "Delete Category"}
            </button>
          </div>
        </div>
      )}

      {/* Main Table Card (Full Width) */}
      {/* CATEGORIES GRID (AG Grid Community) */}
      <AdminDataGrid<Category>
        ariaLabel="Catalog categories"
        rowData={categories}
        columnDefs={columnDefs}
        loading={loading}
        getRowId={(c) => String(c._id || c.id || c.category_id || c.name)}
        searchPlaceholder="Search categories…"
        emptyTitle="No categories created yet"
        emptyDescription="Click Add Category above to populate the catalog."
      />
    </div>
  );
}
