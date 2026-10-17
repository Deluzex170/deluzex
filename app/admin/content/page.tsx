"use client";

import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";
import styles from "../admin.module.css";
import {
  Layout,
  FileText,
  Settings,
  Upload,
  CheckCircle2,
  AlertCircle,
  Eye,
  Sparkles,
  Save,
  Globe,
  Home,
  Info,
  Phone,
  Mail,
  MapPin,
  Clock,
  Share2,
} from "lucide-react";
import {
  fetchSiteContent,
  updateSiteContent,
  uploadCmsImage,
} from "../../services/api";

type TabKey = "homepage" | "about" | "site_settings";

export default function AdminContentPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("homepage");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Content state for each section
  const [homepageData, setHomepageData] = useState<any>(null);
  const [aboutData, setAboutData] = useState<any>(null);
  const [settingsData, setSettingsData] = useState<any>(null);

  // File upload state
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingUploadKey, setPendingUploadKey] = useState<{
    tab: TabKey;
    path: string;
  } | null>(null);

  useEffect(() => {
    loadAllContent();
  }, []);

  async function loadAllContent() {
    setLoading(true);
    try {
      const [home, abt, setts] = await Promise.all([
        fetchSiteContent("homepage"),
        fetchSiteContent("about"),
        fetchSiteContent("site_settings"),
      ]);
      setHomepageData(home);
      setAboutData(abt);
      setSettingsData(setts);
    } catch (err) {
      console.error("Failed to load CMS content:", err);
      setErrorMsg("Failed to load CMS content from server.");
    } finally {
      setLoading(false);
    }
  }

  function handleSave(tab: TabKey) {
    let payload: any = null;
    if (tab === "homepage") payload = homepageData;
    if (tab === "about") payload = aboutData;
    if (tab === "site_settings") payload = settingsData;

    if (!payload) return;

    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    updateSiteContent(tab, payload)
      .then(() => {
        setSuccessMsg(
          `${tab === "homepage" ? "Homepage" : tab === "about" ? "About Page" : "Site Settings"} content saved and published successfully!`
        );
      })
      .catch((err) => {
        console.error("Save failed:", err);
        setErrorMsg(err.message || "Failed to save content.");
      })
      .finally(() => {
        setSaving(false);
      });
  }

  function triggerImageUpload(tab: TabKey, path: string) {
    setPendingUploadKey({ tab, path });
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pendingUploadKey) return;

    setUploadingField(pendingUploadKey.path);
    try {
      const uploadedUrl = await uploadCmsImage(file);

      // Deep set image URL in state
      if (pendingUploadKey.tab === "homepage") {
        setHomepageData((prev: any) => {
          const copy = JSON.parse(JSON.stringify(prev));
          setNestedValue(copy, pendingUploadKey.path, uploadedUrl);
          return copy;
        });
      } else if (pendingUploadKey.tab === "about") {
        setAboutData((prev: any) => {
          const copy = JSON.parse(JSON.stringify(prev));
          setNestedValue(copy, pendingUploadKey.path, uploadedUrl);
          return copy;
        });
      } else if (pendingUploadKey.tab === "site_settings") {
        setSettingsData((prev: any) => {
          const copy = JSON.parse(JSON.stringify(prev));
          setNestedValue(copy, pendingUploadKey.path, uploadedUrl);
          return copy;
        });
      }

      setSuccessMsg("Image uploaded successfully via ImageKit!");
    } catch (err: any) {
      setErrorMsg(err.message || "Image upload failed.");
    } finally {
      setUploadingField(null);
      setPendingUploadKey(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function setNestedValue(obj: any, path: string, value: any) {
    const parts = path.split(".");
    let curr = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!curr[p]) curr[p] = {};
      curr = curr[p];
    }
    curr[parts[parts.length - 1]] = value;
  }

  if (loading) {
    return (
      <div className={styles.sectionContainer} style={{ width: "100%", maxWidth: "100%", padding: "4rem 0", textAlign: "center" }}>
        <p style={{ color: "var(--admin-text-muted)" }}>Loading Website CMS Content...</p>
      </div>
    );
  }

  return (
    <div className={styles.sectionContainer} style={{ width: "100%", maxWidth: "100%", margin: 0 }}>
      {/* Hidden File Input for ImageKit Uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelected}
        style={{ display: "none" }}
      />

      {/* Page Header */}
      <div className={styles.headerRow} style={{ marginBottom: "1.5rem" }}>
        <div>
          <h2 className={styles.sectionTitle} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Layout size={26} color="#C49A45" /> Website Content &amp; Media CMS
          </h2>
          <p className={styles.sectionSubtitle}>
            Update headlines, copy, imagery, statistics, and brand identity across all customer pages.
          </p>
        </div>

        <button
          onClick={() => handleSave(activeTab)}
          disabled={saving}
          className={styles.primaryButton}
          style={{ padding: "0.75rem 1.75rem", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
        >
          <Save size={18} />
          {saving ? "Saving Changes..." : `Save ${activeTab === "homepage" ? "Homepage" : activeTab === "about" ? "About Page" : "Settings"}`}
        </button>
      </div>

      {/* Status Notifications */}
      {successMsg && (
        <div
          style={{
            marginBottom: "1.25rem",
            padding: "0.85rem 1.25rem",
            background: "#ECFDF5",
            border: "1px solid #A7F3D0",
            borderRadius: "8px",
            color: "#065F46",
            fontSize: "0.875rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <CheckCircle2 size={18} color="#059669" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg("")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#065F46", fontWeight: 700 }}
          >
            ×
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            marginBottom: "1.25rem",
            padding: "0.85rem 1.25rem",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: "8px",
            color: "#991B1B",
            fontSize: "0.875rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <AlertCircle size={18} color="#DC2626" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg("")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#991B1B", fontWeight: 700 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Main CMS Tab Buttons */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          marginBottom: "1.75rem",
          borderBottom: "1px solid var(--admin-border)",
          paddingBottom: "0.75rem",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("homepage")}
          style={{
            padding: "0.65rem 1.5rem",
            borderRadius: "8px",
            border: activeTab === "homepage" ? "1px solid var(--admin-primary)" : "1px solid var(--admin-border)",
            background: activeTab === "homepage" ? "var(--admin-primary)" : "#ffffff",
            color: activeTab === "homepage" ? "#ffffff" : "var(--admin-text-main)",
            fontWeight: 600,
            fontSize: "0.9rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            transition: "all 0.2s",
          }}
        >
          <Home size={18} />
          Homepage Sections
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("about")}
          style={{
            padding: "0.65rem 1.5rem",
            borderRadius: "8px",
            border: activeTab === "about" ? "1px solid var(--admin-primary)" : "1px solid var(--admin-border)",
            background: activeTab === "about" ? "var(--admin-primary)" : "#ffffff",
            color: activeTab === "about" ? "#ffffff" : "var(--admin-text-main)",
            fontWeight: 600,
            fontSize: "0.9rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            transition: "all 0.2s",
          }}
        >
          <Info size={18} />
          About Page Sections
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("site_settings")}
          style={{
            padding: "0.65rem 1.5rem",
            borderRadius: "8px",
            border: activeTab === "site_settings" ? "1px solid var(--admin-primary)" : "1px solid var(--admin-border)",
            background: activeTab === "site_settings" ? "var(--admin-primary)" : "#ffffff",
            color: activeTab === "site_settings" ? "#ffffff" : "var(--admin-text-main)",
            fontWeight: 600,
            fontSize: "0.9rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            transition: "all 0.2s",
          }}
        >
          <Settings size={18} />
          Site Identity &amp; Footer
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: HOMEPAGE CMS */}
      {/* ========================================================================= */}
      {activeTab === "homepage" && homepageData && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* 1. HERO SECTION */}
          <div className={styles.card} style={{ width: "100%", maxWidth: "100%", padding: "2rem" }}>
            <div style={{ borderBottom: "1px solid var(--admin-border)", paddingBottom: "0.75rem", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--admin-primary)" }}>
                1. Hero Showcase Section
              </h3>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.825rem", color: "var(--admin-text-muted)" }}>
                First impression banner on homepage with cursive tagline and call to action.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "2rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.formLabel}>Cursive Tagline</label>
                  <input
                    type="text"
                    value={homepageData.hero?.tagline || ""}
                    onChange={(e) =>
                      setHomepageData((prev: any) => ({
                        ...prev,
                        hero: { ...prev.hero, tagline: e.target.value },
                      }))
                    }
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.formLabel}>Main Headline Title</label>
                  <input
                    type="text"
                    value={homepageData.hero?.title || ""}
                    onChange={(e) =>
                      setHomepageData((prev: any) => ({
                        ...prev,
                        hero: { ...prev.hero, title: e.target.value },
                      }))
                    }
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.formLabel}>Description Paragraph</label>
                  <textarea
                    rows={3}
                    value={homepageData.hero?.description || ""}
                    onChange={(e) =>
                      setHomepageData((prev: any) => ({
                        ...prev,
                        hero: { ...prev.hero, description: e.target.value },
                      }))
                    }
                    className={styles.formInput}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.formLabel}>Button 1 Label</label>
                    <input
                      type="text"
                      value={homepageData.hero?.btn_explore_text || ""}
                      onChange={(e) =>
                        setHomepageData((prev: any) => ({
                          ...prev,
                          hero: { ...prev.hero, btn_explore_text: e.target.value },
                        }))
                      }
                      className={styles.formInput}
                    />
                  </div>
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.formLabel}>Button 2 Label</label>
                    <input
                      type="text"
                      value={homepageData.hero?.btn_catalogue_text || ""}
                      onChange={(e) =>
                        setHomepageData((prev: any) => ({
                          ...prev,
                          hero: { ...prev.hero, btn_catalogue_text: e.target.value },
                        }))
                      }
                      className={styles.formInput}
                    />
                  </div>
                </div>
              </div>

              {/* Image Preview & Upload */}
              <div>
                <label className={styles.formLabel} style={{ marginBottom: "0.5rem" }}>
                  Hero Background Photography
                </label>
                <div
                  style={{
                    position: "relative",
                    height: "220px",
                    borderRadius: "12px",
                    overflow: "hidden",
                    background: "#1a1a1a",
                    border: "1px solid var(--admin-border)",
                    marginBottom: "1rem",
                  }}
                >
                  <Image
                    src={homepageData.hero?.bg_image || "/images/hero_bg.png"}
                    alt="Hero Preview"
                    fill
                    style={{ objectFit: "cover" }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: "10px",
                      left: "10px",
                      background: "rgba(0,0,0,0.7)",
                      color: "#fff",
                      fontSize: "0.75rem",
                      padding: "4px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    Current Background
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button
                    type="button"
                    onClick={() => triggerImageUpload("homepage", "hero.bg_image")}
                    className={styles.actionButton}
                    style={{
                      flex: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                      padding: "0.6rem 1rem",
                      background: "#f1f5f9",
                      borderRadius: "8px",
                    }}
                  >
                    <Upload size={16} color="#C49A45" />
                    <span>{uploadingField === "hero.bg_image" ? "Uploading to ImageKit..." : "Upload New Image"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2. STATEMENT SECTION */}
          <div className={styles.card} style={{ width: "100%", maxWidth: "100%", padding: "2rem" }}>
            <div style={{ borderBottom: "1px solid var(--admin-border)", paddingBottom: "0.75rem", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--admin-primary)" }}>
                2. Brand Statement Section
              </h3>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.825rem", color: "var(--admin-text-muted)" }}>
                Centerpiece quote displayed between Hero and Categories sections.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.formLabel}>Highlighted Gold Phrase</label>
                <textarea
                  rows={3}
                  value={homepageData.statement?.highlight_text || ""}
                  onChange={(e) =>
                    setHomepageData((prev: any) => ({
                      ...prev,
                      statement: { ...prev.statement, highlight_text: e.target.value },
                    }))
                  }
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.formLabel}>Secondary Text</label>
                <textarea
                  rows={3}
                  value={homepageData.statement?.sub_text || ""}
                  onChange={(e) =>
                    setHomepageData((prev: any) => ({
                      ...prev,
                      statement: { ...prev.statement, sub_text: e.target.value },
                    }))
                  }
                  className={styles.formInput}
                />
              </div>
            </div>
          </div>

          {/* 3. STORY & STATS SECTION */}
          <div className={styles.card} style={{ width: "100%", maxWidth: "100%", padding: "2rem" }}>
            <div style={{ borderBottom: "1px solid var(--admin-border)", paddingBottom: "0.75rem", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--admin-primary)" }}>
                3. Craftsmanship Story &amp; Numerical Stats
              </h3>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.825rem", color: "var(--admin-text-muted)" }}>
                The four metrics showcasing years of excellence, satisfaction rate, and lighting installations.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "2rem", marginBottom: "2rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.formLabel}>Section Headline</label>
                  <input
                    type="text"
                    value={homepageData.story?.title || ""}
                    onChange={(e) =>
                      setHomepageData((prev: any) => ({
                        ...prev,
                        story: { ...prev.story, title: e.target.value },
                      }))
                    }
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.formLabel}>Story Overview</label>
                  <textarea
                    rows={4}
                    value={homepageData.story?.description || ""}
                    onChange={(e) =>
                      setHomepageData((prev: any) => ({
                        ...prev,
                        story: { ...prev.story, description: e.target.value },
                      }))
                    }
                    className={styles.formInput}
                  />
                </div>
              </div>

              {/* Story Side Image */}
              <div>
                <label className={styles.formLabel} style={{ marginBottom: "0.5rem" }}>Story Showcase Image</label>
                <div
                  style={{
                    position: "relative",
                    height: "180px",
                    borderRadius: "12px",
                    overflow: "hidden",
                    background: "#1a1a1a",
                    border: "1px solid var(--admin-border)",
                    marginBottom: "0.75rem",
                  }}
                >
                  <Image
                    src={homepageData.story?.image || "/images/about_chandelier_1784107790569.jpg"}
                    alt="Story Showcase"
                    fill
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => triggerImageUpload("homepage", "story.image")}
                  className={styles.actionButton}
                  style={{ width: "100%", padding: "0.5rem", background: "#f1f5f9", borderRadius: "8px" }}
                >
                  <Upload size={14} color="#C49A45" /> {uploadingField === "story.image" ? "Uploading..." : "Replace Story Image"}
                </button>
              </div>
            </div>

            {/* 4 Stats Cards */}
            <label className={styles.formLabel} style={{ marginBottom: "0.75rem", display: "block" }}>
              Key Statistics Cards (4 Columns)
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
              {(homepageData.story?.stats || []).map((st: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid var(--admin-border)",
                    borderRadius: "10px",
                    padding: "1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--admin-primary)" }}>Stat #{idx + 1}</span>
                  <input
                    type="text"
                    placeholder="Number (e.g. 10+)"
                    value={st.number || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setHomepageData((prev: any) => {
                        const copy = JSON.parse(JSON.stringify(prev));
                        copy.story.stats[idx].number = val;
                        return copy;
                      });
                    }}
                    className={styles.formInput}
                    style={{ fontWeight: 700, fontSize: "1.1rem" }}
                  />
                  <input
                    type="text"
                    placeholder="Label (e.g. Years Of Excellence)"
                    value={st.label || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setHomepageData((prev: any) => {
                        const copy = JSON.parse(JSON.stringify(prev));
                        copy.story.stats[idx].label = val;
                        return copy;
                      });
                    }}
                    className={styles.formInput}
                    style={{ fontSize: "0.85rem" }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 4. CTA BANNER */}
          <div className={styles.card} style={{ width: "100%", maxWidth: "100%", padding: "2rem" }}>
            <div style={{ borderBottom: "1px solid var(--admin-border)", paddingBottom: "0.75rem", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--admin-primary)" }}>
                4. Call To Action Footer Banner
              </h3>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.formLabel}>Banner Title</label>
                <input
                  type="text"
                  value={homepageData.cta?.title || ""}
                  onChange={(e) =>
                    setHomepageData((prev: any) => ({
                      ...prev,
                      cta: { ...prev.cta, title: e.target.value },
                    }))
                  }
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.formLabel}>Banner Description</label>
                <input
                  type="text"
                  value={homepageData.cta?.description || ""}
                  onChange={(e) =>
                    setHomepageData((prev: any) => ({
                      ...prev,
                      cta: { ...prev.cta, description: e.target.value },
                    }))
                  }
                  className={styles.formInput}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ABOUT PAGE CMS */}
      {/* ========================================================================= */}
      {activeTab === "about" && aboutData && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* 1. HERO SECTION */}
          <div className={styles.card} style={{ width: "100%", maxWidth: "100%", padding: "2rem" }}>
            <div style={{ borderBottom: "1px solid var(--admin-border)", paddingBottom: "0.75rem", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--admin-primary)" }}>
                1. About Hero Section
              </h3>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "2rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.formLabel}>Hero Headline</label>
                  <textarea
                    rows={2}
                    value={aboutData.hero?.title || ""}
                    onChange={(e) =>
                      setAboutData((prev: any) => ({
                        ...prev,
                        hero: { ...prev.hero, title: e.target.value },
                      }))
                    }
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.formLabel}>Hero Subtitle / Description</label>
                  <textarea
                    rows={3}
                    value={aboutData.hero?.description || ""}
                    onChange={(e) =>
                      setAboutData((prev: any) => ({
                        ...prev,
                        hero: { ...prev.hero, description: e.target.value },
                      }))
                    }
                    className={styles.formInput}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.formLabel}>Hero Link Text</label>
                    <input
                      type="text"
                      placeholder="e.g. Signature peice"
                      value={aboutData.hero?.btn_text || ""}
                      onChange={(e) =>
                        setAboutData((prev: any) => ({
                          ...prev,
                          hero: { ...prev.hero, btn_text: e.target.value },
                        }))
                      }
                      className={styles.formInput}
                    />
                  </div>
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.formLabel}>Hero Link Target URL</label>
                    <input
                      type="text"
                      placeholder="e.g. /projects"
                      value={aboutData.hero?.btn_link || ""}
                      onChange={(e) =>
                        setAboutData((prev: any) => ({
                          ...prev,
                          hero: { ...prev.hero, btn_link: e.target.value },
                        }))
                      }
                      className={styles.formInput}
                    />
                  </div>
                </div>
              </div>

              {/* Hero Image */}
              <div>
                <label className={styles.formLabel} style={{ marginBottom: "0.5rem" }}>About Hero Background Image</label>
                <div
                  style={{
                    position: "relative",
                    height: "180px",
                    borderRadius: "12px",
                    overflow: "hidden",
                    background: "#1a1a1a",
                    border: "1px solid var(--admin-border)",
                    marginBottom: "0.75rem",
                  }}
                >
                  <Image
                    src={aboutData.hero?.bg_image || "/images/project_lobby_1784107778993.jpg"}
                    alt="About Hero"
                    fill
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => triggerImageUpload("about", "hero.bg_image")}
                  className={styles.actionButton}
                  style={{ width: "100%", padding: "0.5rem", background: "#f1f5f9", borderRadius: "8px" }}
                >
                  <Upload size={14} color="#C49A45" /> {uploadingField === "hero.bg_image" ? "Uploading..." : "Upload New Hero Background"}
                </button>
              </div>
            </div>
          </div>

          {/* 2. OUR STORY & 3 FEATURE ICONS */}
          <div className={styles.card} style={{ width: "100%", maxWidth: "100%", padding: "2rem" }}>
            <div style={{ borderBottom: "1px solid var(--admin-border)", paddingBottom: "0.75rem", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--admin-primary)" }}>
                2. Our Story &amp; Feature Highlights
              </h3>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "2rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.formLabel}>Story Headline</label>
                  <input
                    type="text"
                    value={aboutData.story?.title || ""}
                    onChange={(e) =>
                      setAboutData((prev: any) => ({
                        ...prev,
                        story: { ...prev.story, title: e.target.value },
                      }))
                    }
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.formLabel}>Detailed Story Narrative</label>
                  <textarea
                    rows={5}
                    value={aboutData.story?.description || ""}
                    onChange={(e) =>
                      setAboutData((prev: any) => ({
                        ...prev,
                        story: { ...prev.story, description: e.target.value },
                      }))
                    }
                    className={styles.formInput}
                  />
                </div>
              </div>

              <div>
                <label className={styles.formLabel} style={{ marginBottom: "0.5rem" }}>Story Showcase Photography</label>
                <div
                  style={{
                    position: "relative",
                    height: "200px",
                    borderRadius: "12px",
                    overflow: "hidden",
                    background: "#1a1a1a",
                    border: "1px solid var(--admin-border)",
                    marginBottom: "0.75rem",
                  }}
                >
                  <Image
                    src={aboutData.story?.image || "/images/project_lounge_1784107767735.jpg"}
                    alt="Story"
                    fill
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => triggerImageUpload("about", "story.image")}
                  className={styles.actionButton}
                  style={{ width: "100%", padding: "0.5rem", background: "#f1f5f9", borderRadius: "8px" }}
                >
                  <Upload size={14} color="#C49A45" /> {uploadingField === "story.image" ? "Uploading..." : "Replace Story Image"}
                </button>
              </div>
            </div>

            {/* 3 Circular Feature Highlights */}
            <label className={styles.formLabel} style={{ marginBottom: "0.75rem", display: "block" }}>
              3 Key Feature Highlights (Under Story)
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
              {(aboutData.story?.features || []).map((f: any, idx: number) => (
                <div key={idx} style={{ background: "#f8fafc", padding: "1rem", borderRadius: "10px", border: "1px solid var(--admin-border)" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--admin-primary)" }}>Feature #{idx + 1}</span>
                  <input
                    type="text"
                    value={f.title || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAboutData((prev: any) => {
                        const copy = JSON.parse(JSON.stringify(prev));
                        copy.story.features[idx].title = val;
                        return copy;
                      });
                    }}
                    className={styles.formInput}
                    style={{ marginTop: "0.4rem" }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 3. WHY CHOOSE US ACCORDIONS */}
          <div className={styles.card} style={{ width: "100%", maxWidth: "100%", padding: "2rem" }}>
            <div style={{ borderBottom: "1px solid var(--admin-border)", paddingBottom: "0.75rem", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--admin-primary)" }}>
                3. &quot;Why Choose Us&quot; Section &amp; 4 Value Pillars
              </h3>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "2rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.formLabel}>Section Title</label>
                  <input
                    type="text"
                    value={aboutData.why_choose_us?.title || ""}
                    onChange={(e) =>
                      setAboutData((prev: any) => ({
                        ...prev,
                        why_choose_us: { ...prev.why_choose_us, title: e.target.value },
                      }))
                    }
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.formLabel}>Section Overview</label>
                  <textarea
                    rows={3}
                    value={aboutData.why_choose_us?.description || ""}
                    onChange={(e) =>
                      setAboutData((prev: any) => ({
                        ...prev,
                        why_choose_us: { ...prev.why_choose_us, description: e.target.value },
                      }))
                    }
                    className={styles.formInput}
                  />
                </div>
              </div>

              <div>
                <label className={styles.formLabel} style={{ marginBottom: "0.5rem" }}>Section Side Image</label>
                <div
                  style={{
                    position: "relative",
                    height: "180px",
                    borderRadius: "12px",
                    overflow: "hidden",
                    background: "#1a1a1a",
                    border: "1px solid var(--admin-border)",
                    marginBottom: "0.75rem",
                  }}
                >
                  <Image
                    src={aboutData.why_choose_us?.image || "/images/about_chandelier_1784107790569.jpg"}
                    alt="Why Choose Us"
                    fill
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => triggerImageUpload("about", "why_choose_us.image")}
                  className={styles.actionButton}
                  style={{ width: "100%", padding: "0.5rem", background: "#f1f5f9", borderRadius: "8px" }}
                >
                  <Upload size={14} color="#C49A45" /> {uploadingField === "why_choose_us.image" ? "Uploading..." : "Replace Showcase Image"}
                </button>
              </div>
            </div>

            {/* 4 Pillars */}
            <label className={styles.formLabel} style={{ marginBottom: "0.75rem", display: "block" }}>
              4 Value Pillars (Title &amp; Description)
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
              {(aboutData.why_choose_us?.items || []).map((it: any, idx: number) => (
                <div key={idx} style={{ background: "#f8fafc", padding: "1rem", borderRadius: "10px", border: "1px solid var(--admin-border)" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--admin-primary)" }}>Pillar #{idx + 1}</span>
                  <input
                    type="text"
                    placeholder="Pillar Title"
                    value={it.title || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAboutData((prev: any) => {
                        const copy = JSON.parse(JSON.stringify(prev));
                        copy.why_choose_us.items[idx].title = val;
                        return copy;
                      });
                    }}
                    className={styles.formInput}
                    style={{ margin: "0.4rem 0", fontWeight: 600 }}
                  />
                  <textarea
                    rows={3}
                    placeholder="Pillar Description"
                    value={it.description || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAboutData((prev: any) => {
                        const copy = JSON.parse(JSON.stringify(prev));
                        copy.why_choose_us.items[idx].description = val;
                        return copy;
                      });
                    }}
                    className={styles.formInput}
                    style={{ fontSize: "0.85rem" }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SITE SETTINGS & FOOTER CMS */}
      {/* ========================================================================= */}
      {activeTab === "site_settings" && settingsData && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* Brand Identity & Contact */}
          <div className={styles.card} style={{ width: "100%", maxWidth: "100%", padding: "2rem" }}>
            <div style={{ borderBottom: "1px solid var(--admin-border)", paddingBottom: "0.75rem", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--admin-primary)" }}>
                Company Brand &amp; Concierge Contact Information
              </h3>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.formLabel}>Brand Name</label>
                <input
                  type="text"
                  value={settingsData.brand_name || ""}
                  onChange={(e) => setSettingsData({ ...settingsData, brand_name: e.target.value })}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.formLabel}>Tagline</label>
                <input
                  type="text"
                  value={settingsData.tagline || ""}
                  onChange={(e) => setSettingsData({ ...settingsData, tagline: e.target.value })}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.formLabel}>Concierge Phone</label>
                <input
                  type="text"
                  value={settingsData.phone || ""}
                  onChange={(e) => setSettingsData({ ...settingsData, phone: e.target.value })}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.formLabel}>Concierge Email</label>
                <input
                  type="email"
                  value={settingsData.email || ""}
                  onChange={(e) => setSettingsData({ ...settingsData, email: e.target.value })}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup} style={{ marginBottom: 0, gridColumn: "span 2" }}>
                <label className={styles.formLabel}>Flagship Studio Address</label>
                <input
                  type="text"
                  value={settingsData.address || ""}
                  onChange={(e) => setSettingsData({ ...settingsData, address: e.target.value })}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup} style={{ marginBottom: 0, gridColumn: "span 2" }}>
                <label className={styles.formLabel}>Operating Hours</label>
                <input
                  type="text"
                  value={settingsData.working_hours || ""}
                  onChange={(e) => setSettingsData({ ...settingsData, working_hours: e.target.value })}
                  className={styles.formInput}
                />
              </div>
            </div>
          </div>

          {/* Available On Platforms & Marketplaces (Footer Logos) */}
          <div className={styles.card} style={{ width: "100%", maxWidth: "100%", padding: "2rem" }}>
            <div style={{ borderBottom: "1px solid var(--admin-border)", paddingBottom: "0.75rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--admin-primary)" }}>
                  &quot;Available On&quot; Platform Links (Footer Logos)
                </h3>
              </div>
              <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.85rem", color: "var(--admin-text-muted)" }}>
                Configure the destination links for the Amazon and Flipkart logos displayed under &quot;Available On&quot; in the website footer.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
              {/* Amazon Link */}
              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.formLabel} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <img src="/images/logos/amazon.svg" alt="Amazon" width={22} height={22} style={{ borderRadius: "4px" }} />
                  Amazon Store Link
                </label>
                <input
                  type="text"
                  placeholder="https://www.amazon.in/deluzex"
                  value={settingsData.available_on?.amazon || ""}
                  onChange={(e) =>
                    setSettingsData({
                      ...settingsData,
                      available_on: {
                        ...(settingsData.available_on || {}),
                        amazon: e.target.value,
                      },
                    })
                  }
                  className={styles.formInput}
                />
              </div>

              {/* Flipkart Link */}
              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.formLabel} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <img src="/images/logos/flip.svg" alt="Flipkart" width={22} height={22} style={{ borderRadius: "4px" }} />
                  Flipkart Store Link
                </label>
                <input
                  type="text"
                  placeholder="https://www.flipkart.com/deluzex"
                  value={settingsData.available_on?.flipkart || ""}
                  onChange={(e) =>
                    setSettingsData({
                      ...settingsData,
                      available_on: {
                        ...(settingsData.available_on || {}),
                        flipkart: e.target.value,
                      },
                    })
                  }
                  className={styles.formInput}
                />
              </div>
            </div>
          </div>

          <div className={styles.card} style={{ width: "100%", maxWidth: "100%", padding: "2rem" }}>
            <div style={{ borderBottom: "1px solid var(--admin-border)", paddingBottom: "0.75rem", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--admin-primary)" }}>
                Social Media Links &amp; Footer Copyright
              </h3>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.formLabel}>WhatsApp URL / Number</label>
                <input
                  type="text"
                  placeholder="https://wa.me/918511682031 or +91 85116 82031"
                  value={settingsData.social_links?.whatsapp || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSettingsData({
                      ...settingsData,
                      social_links: { ...settingsData.social_links, whatsapp: val },
                    });
                  }}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.formLabel}>Instagram URL</label>
                <input
                  type="text"
                  value={settingsData.social_links?.instagram || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSettingsData({
                      ...settingsData,
                      social_links: { ...settingsData.social_links, instagram: val },
                    });
                  }}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.formLabel}>Facebook URL</label>
                <input
                  type="text"
                  value={settingsData.social_links?.facebook || ""}
                  onChange={(e) =>
                    setSettingsData({
                      ...settingsData,
                      social_links: { ...settingsData.social_links, facebook: e.target.value },
                    })
                  }
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.formLabel}>LinkedIn URL</label>
                <input
                  type="text"
                  value={settingsData.social_links?.linkedin || ""}
                  onChange={(e) =>
                    setSettingsData({
                      ...settingsData,
                      social_links: { ...settingsData.social_links, linkedin: e.target.value },
                    })
                  }
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.formLabel}>Twitter / X URL</label>
                <input
                  type="text"
                  value={settingsData.social_links?.twitter || ""}
                  onChange={(e) =>
                    setSettingsData({
                      ...settingsData,
                      social_links: { ...settingsData.social_links, twitter: e.target.value },
                    })
                  }
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.formLabel}>YouTube URL</label>
                <input
                  type="text"
                  placeholder="https://youtube.com/@deluzex"
                  value={settingsData.social_links?.youtube || ""}
                  onChange={(e) =>
                    setSettingsData({
                      ...settingsData,
                      social_links: { ...settingsData.social_links, youtube: e.target.value },
                    })
                  }
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.formLabel}>Pinterest URL</label>
                <input
                  type="text"
                  placeholder="https://pinterest.com/deluzex"
                  value={settingsData.social_links?.pinterest || ""}
                  onChange={(e) =>
                    setSettingsData({
                      ...settingsData,
                      social_links: { ...settingsData.social_links, pinterest: e.target.value },
                    })
                  }
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup} style={{ marginBottom: 0, gridColumn: "span 2" }}>
                <label className={styles.formLabel}>Footer Copyright Text</label>
                <input
                  type="text"
                  value={settingsData.footer_copyright || ""}
                  onChange={(e) => setSettingsData({ ...settingsData, footer_copyright: e.target.value })}
                  className={styles.formInput}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
