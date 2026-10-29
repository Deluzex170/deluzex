"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import styles from "../../../admin.module.css";
import { fetchCategories, updateCategory, Category } from "../../../../services/api";
import { ArrowLeft, Save, Image as ImageIcon, AlertCircle } from "lucide-react";

export default function EditCategory() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    image_url: "",
  });

  useEffect(() => {
    async function loadCategory() {
      if (!params.id) return;
      try {
        const allCategories = await fetchCategories();
        const currentId = Array.isArray(params.id) ? params.id[0] : params.id;
        const data = allCategories.find((category: Category) => {
          const catId = category.id ?? category._id ?? category.category_id;
          return catId !== undefined && catId.toString() === currentId;
        });

        if (data) {
          setFormData({
            name: data.name || "",
            description: data.description || "",
            image_url: data.image_url || "",
          });
        } else {
          setErrorMsg("Category not found");
        }
      } catch (error: any) {
        console.error(error);
        setErrorMsg("Failed to load category details");
      } finally {
        setLoading(false);
      }
    }
    loadCategory();
  }, [params.id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");
    try {
      await updateCategory(params.id as string, formData);
      router.push("/admin/categories");
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error?.message || "Failed to update category");
      setSaving(false);
    }
  };

  return (
    <div className={styles.sectionContainer} style={{ width: "100%", maxWidth: "100%" }}>
      {/* Back Button & Header */}
      <div style={{ marginBottom: "1.75rem" }}>
        <Link
          href="/admin/categories"
          style={{
            color: "var(--admin-text-muted)",
            fontSize: "0.85rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            marginBottom: "0.75rem",
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Categories</span>
        </Link>
        <h2 className={styles.sectionTitle}>Edit Category</h2>
        <p className={styles.sectionSubtitle}>
          Update category metadata, description narrative, and hero preview photography.
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

      {loading ? (
        <div className={styles.card} style={{ padding: "4rem 2rem", textAlign: "center", color: "var(--admin-text-muted)" }}>
          Loading category specifications...
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
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
                Category Details
              </h3>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Category Name *</label>
                <input
                  required
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Image URL</label>
                <input
                  type="text"
                  name="image_url"
                  value={formData.image_url}
                  onChange={handleChange}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup} style={{ marginBottom: "1.5rem" }}>
                <label className={styles.formLabel}>Category Description</label>
                <textarea
                  name="description"
                  rows={5}
                  value={formData.description}
                  onChange={handleChange}
                  className={styles.formInput}
                  style={{ height: "auto", resize: "vertical" }}
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className={styles.primaryButton}
                style={{ width: "100%", justifyContent: "center", height: "46px" }}
              >
                <Save size={18} />
                <span>{saving ? "Saving Changes..." : "Save Category Changes"}</span>
              </button>
            </div>

            {/* Right Column: Live Card Preview */}
            <div className={styles.card} style={{ padding: "2rem" }}>
              <h3 style={{ margin: "0 0 1.5rem", fontSize: "1.1rem", fontWeight: 700, color: "var(--admin-primary)" }}>
                Storefront Card Preview
              </h3>

              <div
                style={{
                  position: "relative",
                  height: "300px",
                  borderRadius: "20px",
                  overflow: "hidden",
                  background: "#2A1F14",
                  border: "1.5px solid #C89B60",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  padding: "2rem",
                  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.15)",
                }}
              >
                {formData.image_url ? (
                  <Image
                    src={formData.image_url}
                    alt={formData.name || "Preview"}
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
                      color: "rgba(255,255,255,0.4)",
                      gap: "0.5rem",
                    }}
                  >
                    <ImageIcon size={48} />
                    <span style={{ fontSize: "0.85rem" }}>No image assigned</span>
                  </div>
                )}

                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(180deg, rgba(17,17,17,0.1) 0%, rgba(17,17,17,0.85) 100%)",
                    zIndex: 1,
                  }}
                />

                <div style={{ position: "relative", zIndex: 2, color: "#fff" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "#C89B60",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Category Preview
                  </span>
                  <h4 style={{ margin: "0.25rem 0 0.5rem", fontSize: "1.4rem", fontFamily: "var(--font-libre), serif" }}>
                    {formData.name || "Category Title"}
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "rgba(255,255,255,0.8)", lineHeight: 1.5, maxHeight: "3em", overflow: "hidden" }}>
                    {formData.description || "No description provided."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
