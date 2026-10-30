"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import styles from "../../admin.module.css";
import { createCategory } from "../../../services/api";
import { ArrowLeft, Save, Image as ImageIcon, AlertCircle, UploadCloud, X } from "lucide-react";

export default function CreateCategory() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string>("");
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setFilePreview(previewUrl);
    }
  };

  const handleRemoveFile = () => {
    setImageFile(null);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
      setFilePreview("");
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      if (imageFile) {
        const payload = new FormData();
        payload.append("name", formData.name);
        payload.append("description", formData.description);
        payload.append("image_file", imageFile);
        if (formData.image_url) {
          payload.append("image_url", formData.image_url);
        }
        await createCategory(payload);
      } else {
        await createCategory(formData);
      }
      router.push("/admin/categories");
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error?.message || "Failed to create category");
      setLoading(false);
    }
  };

  const displayImage = filePreview || formData.image_url;

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
          Create a luxury lighting family with catalog description, photo upload, and imagery.
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
          <div className={styles.card} style={{ padding: "var(--a-space-5)" }}>
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

            {/* Direct File Upload */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Upload Category Photo</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: "2px dashed rgba(200, 155, 96, 0.4)",
                  borderRadius: "12px",
                  padding: "1.25rem",
                  textAlign: "center",
                  cursor: "pointer",
                  background: "rgba(200, 155, 96, 0.03)",
                  transition: "all 0.2s ease",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                <UploadCloud size={28} style={{ color: "var(--admin-primary)" }} />
                <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--admin-text-main)" }}>
                  {imageFile ? imageFile.name : "Click to select a photo from your computer"}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--admin-text-muted)" }}>
                  {imageFile
                    ? `${(imageFile.size / 1024 / 1024).toFixed(2)} MB • Ready to upload to ImageKit`
                    : "PNG, JPG, WEBP up to 10MB"}
                </div>
              </div>

              {imageFile && (
                <div style={{ marginTop: "0.5rem", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#b91c1c",
                      fontSize: "0.8rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      cursor: "pointer",
                      padding: "0.2rem 0.4rem",
                    }}
                  >
                    <X size={14} />
                    <span>Remove file</span>
                  </button>
                </div>
              )}
            </div>

            {/* Optional Image URL */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Or Image URL (Optional)</label>
              <input
                type="text"
                name="image_url"
                value={formData.image_url}
                onChange={handleChange}
                disabled={!!imageFile}
                className={styles.formInput}
                placeholder={imageFile ? "Using uploaded file above" : "e.g. https://... or /images/category.jpg"}
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
          <div className={styles.card} style={{ padding: "var(--a-space-5)" }}>
            <h3 style={{ margin: "0 0 1.5rem", fontSize: "1.1rem", fontWeight: 700, color: "var(--admin-primary)" }}>
              Live Storefront Preview
            </h3>

            <div
              style={{
                position: "relative",
                height: "320px",
                borderRadius: "20px",
                overflow: "hidden",
                background: "#1A1410",
                border: "1px solid rgba(200, 155, 96, 0.35)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                padding: "var(--a-space-5)",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.15)",
              }}
            >
              {displayImage ? (
                <Image
                  src={displayImage}
                  alt={formData.name || "Preview"}
                  fill
                  unoptimized={Boolean(filePreview)}
                  style={{ objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "radial-gradient(ellipse at 50% 35%, #2F1F13 0%, #17110C 65%, #0B0806 100%)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.6rem",
                    padding: "var(--a-space-5)",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "50%",
                      border: "1px solid rgba(200, 155, 96, 0.45)",
                      background: "rgba(200, 155, 96, 0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#D4AF37",
                      fontSize: "1.4rem",
                    }}
                  >
                    ✦
                  </div>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      letterSpacing: "0.14em",
                      color: "#C89B60",
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    Signature Lighting Family
                  </span>
                  <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.4)" }}>
                    (No photo uploaded yet — Storefront shows luxury placeholder)
                  </span>
                </div>
              )}

              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(180deg, rgba(17,17,17,0.05) 0%, rgba(17,17,17,0.85) 100%)",
                  zIndex: 1,
                  pointerEvents: "none",
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
                  Storefront Card
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
