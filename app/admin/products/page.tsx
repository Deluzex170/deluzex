"use client";
import React, { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
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
  Pencil,
  Trash2,
  Sparkles,
  CheckCircle2,
  Search,
  Flame,
  Check,
  Package,
} from "lucide-react";

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
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
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = p.product_title?.toLowerCase().includes(q);
        const catMatch = p.product_category?.toLowerCase().includes(q);
        return titleMatch || catMatch;
      }
      return true;
    });
  }, [products, filterTab, searchQuery, selectedCategory]);

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

      {/* FILTER TABS & SEARCH BAR */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "1.25rem",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => setFilterTab("all")}
            style={{
              padding: "0.6rem 1.15rem",
              borderRadius: "8px",
              border: filterTab === "all" ? "1px solid rgba(196, 154, 69, 0.5)" : "1px solid var(--admin-border)",
              background: filterTab === "all" ? "linear-gradient(135deg, #C49A45 0%, #A88132 100%)" : "var(--admin-surface)",
              color: filterTab === "all" ? "#0A0A0C" : "var(--admin-text-main)",
              fontWeight: 700,
              fontSize: "0.875rem",
              cursor: "pointer",
              transition: "all 0.2s",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              boxShadow: filterTab === "all" ? "0 4px 12px rgba(196, 154, 69, 0.2)" : "none",
            }}
          >
            All Products
            <span
              style={{
                fontSize: "0.75rem",
                padding: "2px 8px",
                borderRadius: "12px",
                background: filterTab === "all" ? "rgba(0, 0, 0, 0.2)" : "rgba(255, 255, 255, 0.08)",
                color: filterTab === "all" ? "#0A0A0C" : "var(--admin-text-muted)",
                fontWeight: 700,
              }}
            >
              {products.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab("new_arrivals")}
            style={{
              padding: "0.6rem 1.15rem",
              borderRadius: "8px",
              border: filterTab === "new_arrivals" ? "1px solid rgba(196, 154, 69, 0.5)" : "1px solid var(--admin-border)",
              background: filterTab === "new_arrivals" ? "linear-gradient(135deg, #C49A45 0%, #A88132 100%)" : "var(--admin-surface)",
              color: filterTab === "new_arrivals" ? "#0A0A0C" : "var(--admin-text-main)",
              fontWeight: 700,
              fontSize: "0.875rem",
              cursor: "pointer",
              transition: "all 0.2s",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              boxShadow: filterTab === "new_arrivals" ? "0 4px 12px rgba(196, 154, 69, 0.2)" : "none",
            }}
          >
            <Sparkles size={15} />
            New Arrivals Only
            <span
              style={{
                fontSize: "0.75rem",
                padding: "2px 8px",
                borderRadius: "12px",
                background: filterTab === "new_arrivals" ? "rgba(0, 0, 0, 0.2)" : "rgba(196, 154, 69, 0.15)",
                color: filterTab === "new_arrivals" ? "#0A0A0C" : "#E5B869",
                fontWeight: 700,
              }}
            >
              {newArrivalsCount}
            </span>
          </button>
        </div>

        {/* Filters Group (Category Filter + Search) */}
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={styles.formInput}
            style={{ margin: 0, height: "42px", padding: "0 0.85rem", minWidth: "160px", fontSize: "0.85rem" }}
          >
            <option value="all">All Categories</option>
            {categories.map((c, idx) => (
              <option key={c.id || c._id || c.name || idx} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Search */}
          <div style={{ position: "relative", minWidth: "min(260px, 100%)" }}>
            <Search
              size={16}
              style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
            />
            <input
              type="text"
              placeholder="Search by title or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.formInput}
              style={{ paddingLeft: "2.25rem", paddingRight: "1rem", margin: 0, height: "42px" }}
            />
          </div>
        </div>
      </div>

      {/* FULL-WIDTH TABLE CARD */}
      <div className={styles.card} style={{ width: "100%", maxWidth: "100%" }}>
        {loading ? (
          <div style={{ padding: "4rem", textAlign: "center", color: "var(--admin-text-muted)" }}>
            Loading products catalog...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div style={{ padding: "4rem", textAlign: "center", color: "var(--admin-text-muted)" }}>
            <p style={{ fontSize: "1rem", marginBottom: "1rem" }}>
              {filterTab === "new_arrivals"
                ? "No products currently selected for New Arrivals. Switch to 'All Products' and click '+ Add to New Arrivals' on any product!"
                : "No products found matching your criteria."}
            </p>
            {filterTab === "new_arrivals" && (
              <button onClick={() => setFilterTab("all")} className={styles.primaryButton}>
                View All Products
              </button>
            )}
          </div>
        ) : (
          <div className={styles.tableWrapper} style={{ width: "100%", overflowX: "auto" }}>
            <table className={styles.table} style={{ width: "100%", tableLayout: "auto" }}>
              <thead>
                <tr>
                  <th style={{ width: "70px" }}>Image</th>
                  <th style={{ width: "30%" }}>Product Name</th>
                  <th style={{ width: "18%" }}>Category</th>
                  <th style={{ width: "14%" }}>Price</th>
                  <th style={{ width: "220px", textAlign: "center" }}>New Arrival Showcase</th>
                  <th style={{ width: "150px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((prod) => {
                  const prodId = prod._id || prod.id || "";
                  const isNewArrival = Boolean(prod.is_new_arrival);
                  const isToggling = togglingId === prodId;

                  return (
                    <tr key={String(prodId)}>
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
                          }}
                        >
                          {prod.product_main_image ? (
                            <Image
                              src={prod.product_main_image}
                              alt={prod.product_title || "Product"}
                              fill
                              sizes="48px"
                              style={{ objectFit: "cover" }}
                            />
                          ) : (
                            <div
                              style={{
                                width: "100%",
                                height: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#94a3b8",
                              }}
                            >
                              <Package size={20} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--admin-primary)", fontSize: "0.95rem" }}>
                          {prod.product_title}
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "4px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 600 }}>
                            SKU: {prod.sku || "ME-DP-105"}
                          </span>
                          <span style={{
                            fontSize: "0.7rem",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            fontWeight: 700,
                            background: prod.stock_status?.toLowerCase().includes("out") ? "#FEE2E2" : prod.stock_status?.toLowerCase().includes("order") ? "#FFEDD5" : "#DCFCE7",
                            color: prod.stock_status?.toLowerCase().includes("out") ? "#991B1B" : prod.stock_status?.toLowerCase().includes("order") ? "#9A3412" : "#166534",
                          }}>
                            {prod.stock_status || "IN STOCK"}
                          </span>
                        </div>
                        {prod.product_description && (
                          <div
                            style={{
                              fontSize: "0.8rem",
                              color: "var(--admin-text-muted)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: "340px",
                              marginTop: "3px",
                            }}
                          >
                            {prod.product_description}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            background: "rgba(255, 255, 255, 0.05)",
                            color: "#D1D5DB",
                            border: "1px solid var(--admin-border)",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "0.825rem",
                            fontWeight: 500,
                          }}
                        >
                          {prod.product_category || "Unassigned"}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: "#C49A45", fontSize: "0.95rem" }}>
                          ₹{Number(prod.product_price || 0).toLocaleString()}
                        </span>
                        {prod.price_note && (
                          <div style={{ fontSize: "0.72rem", color: "#64748B", marginTop: "2px" }}>
                            {prod.price_note}
                          </div>
                        )}
                      </td>

                      {/* DYNAMIC NEW ARRIVAL TOGGLE BUTTON & BADGE */}
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          disabled={isToggling}
                          onClick={() => handleToggleNewArrival(prod)}
                          title={isNewArrival ? "Click to remove from homepage New Arrivals" : "Click to feature in homepage New Arrivals"}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.45rem",
                            padding: "0.45rem 0.95rem",
                            borderRadius: "20px",
                            fontSize: "0.825rem",
                            fontWeight: 600,
                            cursor: isToggling ? "wait" : "pointer",
                            transition: "all 0.2s",
                            border: isNewArrival ? "1px solid rgba(196, 154, 69, 0.5)" : "1px solid var(--admin-border)",
                            background: isNewArrival ? "rgba(196, 154, 69, 0.16)" : "var(--admin-surface)",
                            color: isNewArrival ? "#E5B869" : "var(--admin-text-muted)",
                          }}
                          onMouseEnter={(e) => {
                            if (!isNewArrival) {
                              e.currentTarget.style.borderColor = "#C49A45";
                              e.currentTarget.style.color = "#FFFFFF";
                              e.currentTarget.style.background = "rgba(196, 154, 69, 0.08)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isNewArrival) {
                              e.currentTarget.style.borderColor = "var(--admin-border)";
                              e.currentTarget.style.color = "var(--admin-text-muted)";
                              e.currentTarget.style.background = "var(--admin-surface)";
                            }
                          }}
                        >
                          {isToggling ? (
                            <span>Updating...</span>
                          ) : isNewArrival ? (
                            <>
                              <Sparkles size={14} color="#C49A45" />
                              <span>★ In New Arrivals</span>
                            </>
                          ) : (
                            <>
                              <Plus size={14} />
                              <span>+ Add to New Arrivals</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end", alignItems: "center" }}>
                          <Link href={`/product/${prodId}`} target="_blank" className={styles.actionLink} style={{ color: "#E0531C", borderColor: "rgba(224, 83, 28, 0.3)" }}>
                            View
                          </Link>
                          <Link href={`/admin/products/edit/${prodId}`} className={styles.actionLink}>
                            <Pencil size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: "3px" }} />
                            Edit
                          </Link>
                          <button onClick={() => setItemToDelete(prod)} className={styles.actionDelete}>
                            <Trash2 size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: "3px" }} />
                            Delete
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

