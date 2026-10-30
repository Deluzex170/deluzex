"use client";
import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import type { ColDef } from "ag-grid-community";
import type { CustomCellRendererProps } from "ag-grid-react";
import AdminDataGrid from "../../components/admin/AdminDataGrid";
import {
  ActionButtonsRenderer,
  CurrencyRenderer,
  ImageThumbnailRenderer,
  StatusBadgeRenderer,
  type ActionButtonsParams,
} from "../../components/admin/gridRenderers";
import styles from "../admin.module.css";
import {
  fetchProducts,
  deleteProduct,
  toggleProductNewArrival,
  fetchCategories,
  Category,
  Product,
} from "../../services/api";
import {
  Plus,
  Trash2,
  Sparkles,
  CheckCircle2,
  Package,
} from "lucide-react";

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<"all" | "new_arrivals">("all");
  const [itemToDelete, setItemToDelete] = useState<Product | null>(null);
  const [togglingId, setTogglingId] = useState<string | number | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    loadProducts();
    fetchCategories().then(setCategories).catch(console.error);
  }, []);

  async function loadProducts() {
    setLoading(true);
    try {
      const data = await fetchProducts();
      setProducts(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleNewArrival(product: Product) {
    const prodId = product._id || product.id;
    if (!prodId) return;

    setTogglingId(prodId);
    const nextStatus = !product.is_new_arrival;

    try {
      await toggleProductNewArrival(prodId, nextStatus);
      setProducts((prev) =>
        prev.map((p) =>
          (p._id || p.id) === prodId ? { ...p, is_new_arrival: nextStatus } : p
        )
      );

      setSuccessMsg(
        nextStatus
          ? `"${product.product_title}" is now added to New Arrivals and live on the homepage!`
          : `"${product.product_title}" removed from New Arrivals.`
      );

      // Auto-clear message after 4s
      setTimeout(() => {
        setSuccessMsg((curr) => (curr ? "" : curr));
      }, 4000);
    } catch (error) {
      console.error("Failed to toggle new arrival:", error);
      alert("Failed to update New Arrival status. Please try again.");
    } finally {
      setTogglingId(null);
    }
  }

  async function executeDelete() {
    if (!itemToDelete) return;
    const prodId = itemToDelete._id || itemToDelete.id;
    if (!prodId) return;

    try {
      await deleteProduct(prodId);
      setItemToDelete(null);
      setSuccessMsg(`"${itemToDelete.product_title}" deleted successfully.`);
      loadProducts();
    } catch (error) {
      alert("Failed to delete product. " + error);
    }
  }

  const newArrivalsCount = useMemo(
    () => products.filter((p) => p.is_new_arrival).length,
    [products]
  );

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (filterTab === "new_arrivals" && !p.is_new_arrival) return false;
      if (selectedCategory !== "all" && p.product_category !== selectedCategory) return false;
      return true;
    });
  }, [products, filterTab, selectedCategory]);

  // Column definitions for the products grid (actions call the same handlers as before)
  const columnDefs = useMemo<ColDef<Product>[]>(() => [
    {
      headerName: "Image",
      field: "product_main_image",
      cellRenderer: ImageThumbnailRenderer,
      width: 76,
      minWidth: 76,
      maxWidth: 76,
      flex: 0,
      sortable: false,
      filter: false,
      resizable: false,
    },
    {
      headerName: "Title",
      field: "product_title",
      minWidth: 220,
      flex: 2,
      tooltipField: "product_title",
      cellRenderer: (p: CustomCellRendererProps<Product>) => (
        <span style={{ fontWeight: 600, color: "var(--admin-text-main)" }}>{p.value}</span>
      ),
    },
    { headerName: "SKU", colId: "sku", minWidth: 120, valueGetter: (p) => p.data?.sku || "—" },
    { headerName: "Category", colId: "category", minWidth: 150, valueGetter: (p) => p.data?.product_category || "Unassigned" },
    {
      headerName: "Price",
      colId: "price",
      minWidth: 120,
      type: "rightAligned",
      filter: "agNumberColumnFilter",
      valueGetter: (p) => Number(p.data?.product_price || 0),
      cellRenderer: CurrencyRenderer,
    },
    {
      headerName: "Stock",
      field: "stock_count",
      minWidth: 100,
      type: "rightAligned",
      filter: "agNumberColumnFilter",
      valueFormatter: (p) => (p.value === undefined || p.value === null ? "—" : String(p.value)),
    },
    {
      headerName: "Featured",
      colId: "featured",
      minWidth: 190,
      valueGetter: (p) => (p.data?.is_new_arrival ? "In New Arrivals" : "Not featured"),
      cellRenderer: (p: CustomCellRendererProps<Product>) => {
        const prod = p.data;
        if (!prod) return null;
        const prodId = prod._id || prod.id || "";
        const isNewArrival = Boolean(prod.is_new_arrival);
        const isToggling = togglingId === prodId;
        return (
          <button
            type="button"
            disabled={isToggling}
            onClick={() => handleToggleNewArrival(prod)}
            title={isNewArrival ? "Click to remove from homepage New Arrivals" : "Click to feature in homepage New Arrivals"}
            className={[styles.featureToggle, isNewArrival ? styles.featureToggleOn : ""].join(" ")}
          >
            {isToggling ? (
              "Updating…"
            ) : isNewArrival ? (
              <>
                <Sparkles size={13} aria-hidden="true" /> In New Arrivals
              </>
            ) : (
              <>
                <Plus size={13} aria-hidden="true" /> Add to New Arrivals
              </>
            )}
          </button>
        );
      },
    },
    {
      headerName: "Status",
      colId: "status",
      minWidth: 130,
      valueGetter: (p) => p.data?.stock_status || (p.data?.in_stock === false ? "OUT OF STOCK" : "IN STOCK"),
      cellRenderer: StatusBadgeRenderer,
    },
    {
      headerName: "Actions",
      colId: "actions",
      width: 124,
      minWidth: 124,
      maxWidth: 124,
      flex: 0,
      sortable: false,
      filter: false,
      resizable: false,
      pinned: "right",
      cellRenderer: ActionButtonsRenderer<Product>,
      cellRendererParams: {
        viewHref: (p: Product) => "/product/" + (p._id || p.id),
        viewInNewTab: true,
        editHref: (p: Product) => "/admin/products/edit/" + (p._id || p.id),
        onDelete: (p: Product) => setItemToDelete(p),
        labelFor: (p: Product) => p.product_title || "product",
      } satisfies ActionButtonsParams<Product>,
    },
  // handleToggleNewArrival only reads stable setters; togglingId drives the "Updating…" state
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [togglingId]);

  return (
    <div className={styles.sectionContainer} style={{ width: "100%", maxWidth: "100%" }}>
      {/* HEADER ROW */}
      <div className={styles.headerRow} style={{ marginBottom: "1.75rem" }}>
        <div>
          <h2 className={styles.sectionTitle} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Package size={28} color="#C49A45" />
            Products Management
          </h2>
          <p className={styles.sectionSubtitle}>
            Manage your catalog and feature any product into the homepage New Arrivals carousel.
          </p>
        </div>
        <Link href="/admin/products/create" className={styles.primaryButton}>
          <Plus size={18} />
          Add Product
        </Link>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "0.9rem 1.25rem",
            background: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: "10px",
            color: "#34D399",
            fontSize: "0.875rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
            boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <CheckCircle2 size={18} />
            <span style={{ fontWeight: 600 }}>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg("")}
            style={{ background: "transparent", border: "none", color: "#34D399", cursor: "pointer", fontSize: "1rem" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Inline Delete Confirmation (No modal popup/blur) */}
      {itemToDelete && (
        <div
          style={{
            marginBottom: "1.75rem",
            padding: "1.25rem 1.75rem",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.35)",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1.5rem",
            flexWrap: "wrap",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.2)",
                color: "#F87171",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                border: "1px solid rgba(239, 68, 68, 0.3)"
              }}
            >
              <Trash2 size={22} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#FFFFFF" }}>
                Confirm Deletion
              </h4>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "#FCA5A5" }}>
                Are you sure you want to delete &quot;{itemToDelete.product_title}&quot;? This cannot be undone.
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button
              onClick={() => setItemToDelete(null)}
              className={styles.btnCancel}
              style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)", color: "var(--admin-text-main)", padding: "0.65rem 1.25rem" }}
            >
              Cancel
            </button>
            <button onClick={executeDelete} className={styles.btnDeleteConfirm} style={{ padding: "0.65rem 1.5rem" }}>
              Yes, Delete Product
            </button>
          </div>
        </div>
      )}

      {/* PRODUCTS GRID (AG Grid Community) */}
      <AdminDataGrid<Product>
        ariaLabel="Products catalog"
        rowData={filteredProducts}
        columnDefs={columnDefs}
        loading={loading}
        getRowId={(p) => String(p._id || p.id || p.sku || p.product_title)}
        searchPlaceholder="Search title, SKU, category…"
        emptyTitle={filterTab === "new_arrivals" ? "No New Arrivals yet" : "No products found"}
        emptyDescription={
          filterTab === "new_arrivals"
            ? "Switch to All Products and use “Add to New Arrivals” on any product."
            : "Add your first product to start building the catalog."
        }
        emptyAction={
          filterTab === "new_arrivals" ? (
            <button type="button" onClick={() => setFilterTab("all")} className={`${styles.btn} ${styles.btnSecondary}`}>
              View All Products
            </button>
          ) : undefined
        }
        toolbar={
          <>
            <div className={styles.segmented} role="tablist" aria-label="Product view">
              <button
                type="button"
                role="tab"
                aria-selected={filterTab === "all"}
                onClick={() => setFilterTab("all")}
                className={`${styles.segmentedBtn} ${filterTab === "all" ? styles.segmentedBtnActive : ""}`}
              >
                All Products <span className={styles.segmentedCount}>{products.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filterTab === "new_arrivals"}
                onClick={() => setFilterTab("new_arrivals")}
                className={`${styles.segmentedBtn} ${filterTab === "new_arrivals" ? styles.segmentedBtnActive : ""}`}
              >
                <Sparkles size={13} aria-hidden="true" />
                New Arrivals <span className={styles.segmentedCount}>{newArrivalsCount}</span>
              </button>
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={styles.control}
              style={{ width: "auto", minWidth: 170 }}
              aria-label="Filter by category"
            >
              <option value="all">All Categories</option>
              {categories.map((c, idx) => (
                <option key={c.id || c._id || c.name || idx} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        }
      />
    </div>
  );
}
