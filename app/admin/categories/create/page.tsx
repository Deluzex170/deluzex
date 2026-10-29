"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import styles from "../../admin.module.css";
import { createCategory } from "../../../services/api";
import { ArrowLeft, Save, Image as ImageIcon, AlertCircle } from "lucide-react";

export default function CreateCategory() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    image_url: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      await createCategory(formData);
      router.push("/admin/categories");
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error?.message || "Failed to create category");
      setLoading(false);
    }
  };

  return (
    <div className={styles.sectionContainer} style={{ width: "100%", maxWidth: "100%" }}>
      {/* Back Button & Title */}
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
        <h2 className={styles.sectionTitle}>Add New Category</h2>
        <p className={styles.sectionSubtitle}>
          Create a luxury lighting family with full catalog description and imagery.
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
              Category Information
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
                placeholder="e.g. Chandeliers, Pendant Lights, Wall Sconces"
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
                placeholder="e.g. /images/category_chandelier.jpg"
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
                placeholder="Describe this fixture collection for customers..."
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={styles.primaryButton}
              style={{ width: "100%", justifyContent: "center", height: "46px" }}
            >
              <Save size={18} />
              <span>{loading ? "Saving Category..." : "Save Category"}</span>
            </button>
          </div>

          {/* Right Column: Live Card Preview */}
          <div className={styles.card} style={{ padding: "2rem" }}>
            <h3 style={{ margin: "0 0 1.5rem", fontSize: "1.1rem", fontWeight: 700, color: "var(--admin-primary)" }}>
              Live Storefront Preview
            </h3>

            <div
              style={{
                position: "relative",
                height: "300px",
                borderRadius: "20px",
                overflow: "hidden",
                background: "#2A1F14",
                border: "1px solid rgba(200, 155, 96, 0.3)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                padding: "2rem",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.12)",
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
                  <span style={{ fontSize: "0.85rem" }}>Enter image URL to preview</span>
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
                  Collection Preview
                </span>
                <h4 style={{ margin: "0.25rem 0 0.5rem", fontSize: "1.4rem", fontFamily: "var(--font-libre), serif" }}>
                  {formData.name || "Category Title"}
                </h4>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "rgba(255,255,255,0.8)", lineHeight: 1.5, maxHeight: "3em", overflow: "hidden" }}>
                  {formData.description || "Category description will appear here on the storefront."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
