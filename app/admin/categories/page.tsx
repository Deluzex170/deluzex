"use client";

import React, { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "../admin.module.css";
import { fetchCategories, deleteCategory, Category } from "../../services/api";
import { FolderTree, Plus, Search, Trash2, Edit3, Image as ImageIcon, AlertCircle } from "lucide-react";

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
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

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [categories, searchQuery]);

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
      <div className={styles.card} style={{ width: "100%", maxWidth: "100%" }}>
        {/* Search Bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--admin-border)" }}>
          <div style={{ position: "relative", width: "100%", maxWidth: "340px" }}>
            <Search size={16} color="var(--admin-text-muted)" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.formInput}
              style={{ paddingLeft: "36px", height: "38px", fontSize: "0.875rem" }}
            />
          </div>

          <span style={{ fontSize: "0.85rem", color: "var(--admin-text-muted)" }}>
            Showing {filteredCategories.length} of {categories.length} categories
          </span>
        </div>

        {loading ? (
          <div style={{ padding: "4rem 2rem", textAlign: "center", color: "var(--admin-text-muted)" }}>
            Loading catalog categories...
          </div>
        ) : filteredCategories.length === 0 ? (
          <div style={{ padding: "4rem 2rem", textAlign: "center", color: "var(--admin-text-muted)" }}>
            <FolderTree size={40} color="#cbd5e1" style={{ margin: "0 auto 1rem" }} />
            <h4 style={{ margin: "0 0 0.5rem", color: "var(--admin-primary)", fontSize: "1.05rem" }}>
              {searchQuery ? "No matching categories" : "No categories created yet"}
            </h4>
            <p style={{ margin: 0, fontSize: "0.875rem" }}>
              {searchQuery ? "Try refining your search query." : "Click Add Category above to populate the catalog."}
            </p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: "80px" }}>Image</th>
                  <th>Category Name</th>
                  <th>Description</th>
                  <th style={{ textAlign: "right", width: "160px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((cat, idx) => {
                  const catId = cat._id || cat.id || cat.category_id || idx;
                  return (
                    <tr key={catId}>
                      <td>
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: "8px",
                            overflow: "hidden",
                            position: "relative",
                            background: "var(--admin-surface-muted)",
                            border: "1px solid var(--admin-border)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {cat.image_url ? (
                            <Image
                              src={cat.image_url}
                              alt={cat.name}
                              fill
                              sizes="48px"
                              style={{ objectFit: "cover" }}
                            />
                          ) : (
                            <ImageIcon size={20} color="#94a3b8" />
                          )}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: "var(--admin-primary)", fontSize: "0.95rem" }}>
                          {cat.name}
                        </div>
                      </td>

                      <td style={{ color: "var(--admin-text-muted)", fontSize: "0.875rem", maxWidth: "420px" }}>
                        <div
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            lineHeight: 1.5,
                          }}
                        >
                          {cat.description || "No description provided."}
                        </div>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", alignItems: "center" }}>
                          <Link
                            href={`/admin/categories/edit/${catId}`}
                            className={styles.actionButton}
                            style={{ background: "var(--admin-surface-muted)", padding: "0.4rem 0.75rem", fontSize: "0.8rem", borderRadius: "6px" }}
                          >
                            <Edit3 size={13} color="#475569" />
                            <span>Edit</span>
                          </Link>

                          <button
                            type="button"
                            onClick={() => setItemToDelete(cat)}
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
  );
}
