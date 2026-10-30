"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "../admin.module.css";
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  AlertCircle,
  ImageIcon,
  ArrowLeft,
  CheckCircle2,
  Search,
  Eye,
  ArrowUp,
  ArrowDown,
  Building,
  Sparkles,
  Star,
  MapPin,
  ExternalLink,
  Video,
} from "lucide-react";
import {
  fetchProjects,
  createProject,
  updateProject,
  deleteProject,
  toggleProjectFeatured,
  swapProjectSequence,
  uploadCmsImage,
  Project,
} from "../../services/api";

type ViewMode = "list" | "create" | "edit";

const PRESET_CATEGORIES = [
  "Residential",
  "Commercial",
  "Hospitality",
  "Public Spaces",
];

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // View state: list, create, edit
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [movingId, setMovingId] = useState<string | number | null>(null);

  // Form fields
  const [formData, setFormData] = useState({
    title: "",
    location: "",
    category: "Residential",
    subtitle: "",
    description: "",
    installations_count: "",
    year: "2024",
    scope: "Architectural Lighting Design",
    area: "",
    image_url: "",
    is_featured: false,
    sequence: 1,
  });

  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [newGalleryUrl, setNewGalleryUrl] = useState("");
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const galleryFileInputRef = useRef<HTMLInputElement | null>(null);

  const [videos, setVideos] = useState<string[]>([]);
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);

  const [imageTab, setImageTab] = useState<"file" | "url">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const data = await fetchProjects();
      setProjects(data);
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoading(false);
    }
  }

  function startCreate() {
    setErrorMsg("");
    setSuccessMsg("");
    const nextSeq =
      projects.length > 0
        ? Math.max(...projects.map((p) => p.sequence || 0)) + 1
        : 1;
    setFormData({
      title: "",
      location: "",
      category: "Residential",
      subtitle: "",
      description: "",
      installations_count: "12 Custom Fixtures",
      year: new Date().getFullYear().toString(),
      scope: "Architectural Lighting Design",
      area: "",
      image_url: "",
      is_featured: false,
      sequence: nextSeq,
    });
    setGalleryImages([]);
    setNewGalleryUrl("");
    setVideos([]);
    setNewVideoUrl("");
    setSelectedFile(null);
    setPreviewUrl("");
    setImageTab("file");
    setEditingProject(null);
    setViewMode("create");
  }

  function startEdit(project: Project) {
    setErrorMsg("");
    setSuccessMsg("");
    setFormData({
      title: project.title || "",
      location: project.location || "",
      category: project.category || "Residential",
      subtitle: project.subtitle || "",
      description: project.description || "",
      installations_count: project.installations_count || "",
      year: project.year || "2024",
      scope: project.scope || "Architectural Lighting Design",
      area: project.area || "",
      image_url: project.image_url || "",
      is_featured: Boolean(project.is_featured),
      sequence: project.sequence || 1,
    });
    setGalleryImages(
      project.gallery_images && project.gallery_images.length > 0
        ? project.gallery_images
        : project.image_url
        ? [project.image_url]
        : []
    );
    setNewGalleryUrl("");
    setVideos(Array.isArray(project.videos) ? project.videos : []);
    setNewVideoUrl("");
    setSelectedFile(null);
    setPreviewUrl(project.image_url || "");
    setImageTab(
      project.image_url?.startsWith("http") || project.image_url?.startsWith("/images")
        ? "url"
        : "file"
    );
    setEditingProject(project);
    setViewMode("edit");
  }

  function backToList() {
    setViewMode("list");
    setEditingProject(null);
    setErrorMsg("");
    setSelectedFile(null);
    setPreviewUrl("");
    setGalleryImages([]);
    setNewGalleryUrl("");
    setVideos([]);
    setNewVideoUrl("");
  }

  const handleAddGalleryUrl = () => {
    if (!newGalleryUrl.trim()) return;
    setGalleryImages((prev) => [...prev, newGalleryUrl.trim()]);
    setNewGalleryUrl("");
  };

  const handleGalleryFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    setUploadingGallery(true);
    setErrorMsg("");
    try {
      for (const file of files) {
        const url = await uploadCmsImage(file);
        setGalleryImages((prev) => [...prev, url]);
      }
      setSuccessMsg(`Uploaded ${files.length} photo(s) to gallery.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to upload gallery image");
    } finally {
      setUploadingGallery(false);
      if (galleryFileInputRef.current) galleryFileInputRef.current.value = "";
    }
  };

  const handleRemoveGalleryImage = (indexToRemove: number) => {
    setGalleryImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleAddVideoUrl = () => {
    if (!newVideoUrl.trim()) return;
    setVideos((prev) => [...prev, newVideoUrl.trim()]);
    setNewVideoUrl("");
  };

  const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    setUploadingVideo(true);
    setErrorMsg("");
    try {
      for (const file of files) {
        const url = await uploadCmsImage(file);
        setVideos((prev) => [...prev, url]);
      }
      setSuccessMsg(`Uploaded ${files.length} video(s).`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to upload video");
    } finally {
      setUploadingVideo(false);
      if (videoFileInputRef.current) videoFileInputRef.current.value = "";
    }
  };

  const handleRemoveVideo = (indexToRemove: number) => {
    setVideos((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSetCover = (url: string) => {
    setFormData((prev) => ({ ...prev, image_url: url }));
    setPreviewUrl(url);
    setSelectedFile(null);
    setSuccessMsg("Cover image updated to selected gallery photo.");
  };

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  }

  function handleImageUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setFormData((prev) => ({ ...prev, image_url: val }));
    if (!selectedFile) {
      setPreviewUrl(val);
    }
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (!formData.title.trim()) {
      setErrorMsg("Project title is required.");
      return;
    }

    setSubmitting(true);
    try {
      const submitData = new FormData();
      submitData.append("title", formData.title.trim());
      if (formData.location.trim()) submitData.append("location", formData.location.trim());
      submitData.append("category", formData.category);
      if (formData.subtitle.trim()) submitData.append("subtitle", formData.subtitle.trim());
      if (formData.description.trim()) submitData.append("description", formData.description.trim());
      if (formData.installations_count.trim()) submitData.append("installations_count", formData.installations_count.trim());
      if (formData.year.trim()) submitData.append("year", formData.year.trim());
      if (formData.scope.trim()) submitData.append("scope", formData.scope.trim());
      if (formData.area.trim()) submitData.append("area", formData.area.trim());
      submitData.append("is_featured", String(formData.is_featured));
      submitData.append("sequence", String(formData.sequence || 1));
      submitData.append("gallery_images", JSON.stringify(galleryImages));
      submitData.append("videos", JSON.stringify(videos));

      if (selectedFile) {
        submitData.append("image_file", selectedFile);
      } else if (formData.image_url.trim()) {
        submitData.append("image_url", formData.image_url.trim());
      } else if (galleryImages.length > 0) {
        submitData.append("image_url", galleryImages[0]);
      } else {
        submitData.append("image_url", "/images/project_lounge_1784107767735.jpg");
      }

      await createProject(submitData);
      setSuccessMsg("Project published successfully.");
      await loadProjects();
      setViewMode("list");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create project";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProject) return;
    setErrorMsg("");

    if (!formData.title.trim()) {
      setErrorMsg("Project title is required.");
      return;
    }

    setSubmitting(true);
    try {
      const projId = editingProject.id || editingProject._id;
      if (!projId) throw new Error("Invalid project ID");

      const submitData = new FormData();
      submitData.append("title", formData.title.trim());
      submitData.append("location", formData.location.trim());
      submitData.append("category", formData.category);
      submitData.append("subtitle", formData.subtitle.trim());
      submitData.append("description", formData.description.trim());
      submitData.append("installations_count", formData.installations_count.trim());
      submitData.append("year", formData.year.trim());
      submitData.append("scope", formData.scope.trim());
      submitData.append("area", formData.area.trim());
      submitData.append("is_featured", String(formData.is_featured));
      submitData.append("sequence", String(formData.sequence || 1));
      submitData.append("gallery_images", JSON.stringify(galleryImages));
      submitData.append("videos", JSON.stringify(videos));

      if (selectedFile) {
        submitData.append("image_file", selectedFile);
      } else if (formData.image_url.trim()) {
        submitData.append("image_url", formData.image_url.trim());
      }

      await updateProject(projId, submitData);
      setSuccessMsg("Project updated successfully.");
      await loadProjects();
      setViewMode("list");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update project";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!projectToDelete) return;
    const projId = projectToDelete.id || projectToDelete._id;
    if (!projId) return;

    try {
      await deleteProject(projId);
      setSuccessMsg(`Project "${projectToDelete.title}" deleted.`);
      setProjectToDelete(null);
      await loadProjects();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete project";
      setErrorMsg(msg);
    }
  }

  async function handleToggleFeatured(project: Project) {
    const projId = project.id || project._id;
    if (!projId) return;

    try {
      const updated = await toggleProjectFeatured(projId);
      setProjects((prev) =>
        prev.map((p) =>
          (p.id || p._id) === projId ? { ...p, is_featured: updated.is_featured } : p
        )
      );
      setSuccessMsg(
        `Project "${project.title}" ${updated.is_featured ? "featured on homepage" : "unfeatured from homepage"}.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to toggle featured status";
      setErrorMsg(msg);
    }
  }

  async function handleSwap(project: Project, direction: "up" | "down") {
    const projId = project.id || project._id;
    if (!projId) return;

    setMovingId(projId);
    try {
      await swapProjectSequence(projId, direction);
      await loadProjects();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to move ${direction}`;
      setErrorMsg(msg);
    } finally {
      setMovingId(null);
    }
  }

  // Filtered list
  const filteredProjects = useMemo(() => {
    return projects.filter((proj) => {
      if (selectedCategory !== "All" && proj.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          proj.title?.toLowerCase().includes(q) ||
          proj.location?.toLowerCase().includes(q) ||
          proj.category?.toLowerCase().includes(q) ||
          proj.description?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [projects, selectedCategory, searchQuery]);

  // =========================================================================
  // VIEW: FULL-PAGE CREATE OR EDIT FORM
  // =========================================================================
  if (viewMode === "create" || viewMode === "edit") {
    const isEdit = viewMode === "edit";

    return (
      <div className={styles.sectionContainer} style={{ width: "100%", maxWidth: "100%", margin: 0 }}>
        {/* Navigation Breadcrumb */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <button
            onClick={backToList}
            type="button"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "var(--admin-surface)",
              border: "1px solid var(--admin-border)",
              borderRadius: "8px",
              color: "var(--admin-text-main)",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
              padding: "0.6rem 1rem",
              transition: "all 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--admin-primary)";
              e.currentTarget.style.color = "var(--admin-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--admin-border)";
              e.currentTarget.style.color = "var(--admin-text-main)";
            }}
          >
            <ArrowLeft size={16} />
            Back to All Projects
          </button>

          <span
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              padding: "4px 12px",
              borderRadius: "20px",
              background: isEdit ? "#eff6ff" : "#fefce8",
              color: isEdit ? "#1d4ed8" : "#854d0e",
              border: `1px solid ${isEdit ? "#bfdbfe" : "#fef08a"}`,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Sparkles size={13} />
            {isEdit ? "Editing Project" : "Creating New Project"}
          </span>
        </div>

        {/* Page Header */}
        <div className={styles.headerRow} style={{ marginBottom: "1.75rem" }}>
          <div>
            <h2 className={styles.sectionTitle} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              {isEdit ? <Pencil size={26} color="#2563eb" /> : <Plus size={26} color="#C49A45" />}
              {isEdit ? `Edit Project: ${editingProject?.title || ""}` : "Create New Architectural Project"}
            </h2>
            <p className={styles.sectionSubtitle}>
              {isEdit
                ? "Update project details, showcase photography, location, and featured portfolio placement."
                : "Add a luxury lighting installation to your commercial, residential, or hospitality portfolio."}
            </p>
          </div>
        </div>

        {/* Full-Page Form Card - 100% Width */}
        <div className={styles.card} style={{ width: "100%", maxWidth: "100%", background: "var(--admin-surface)", padding: 0, overflow: "hidden" }}>
          <form onSubmit={isEdit ? handleEditSubmit : handleCreateSubmit}>
            {errorMsg && (
              <div
                style={{
                  margin: "1.5rem 2rem 0",
                  padding: "0.85rem 1.25rem",
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: "8px",
                  color: "#991B1B",
                  fontSize: "0.875rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                }}
              >
                <AlertCircle size={18} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 2-Column Responsive Layout */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(360px, 100%), 1fr))",
                gap: "2.5rem",
                padding: "2rem",
              }}
            >
              {/* LEFT COLUMN: Project Details */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <div style={{ borderBottom: "1px solid var(--admin-border)", paddingBottom: "0.75rem" }}>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--admin-primary)" }}>
                    1. Project Information &amp; Classification
                  </h3>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.825rem", color: "var(--admin-text-muted)" }}>
                    Basic project identity, location, and categorization.
                  </p>
                </div>

                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.formLabel}>Project Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. The Grand Penthouse at Mayfair"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className={styles.formInput}
                    style={{ padding: "0.85rem 1rem", fontSize: "0.95rem" }}
                  />
                </div>

                <div className={styles.formGrid2} style={{ display: "grid", gap: "1.25rem" }}>
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.formLabel}>Location</label>
                    <input
                      type="text"
                      placeholder="e.g. London, UK"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className={styles.formInput}
                      style={{ padding: "0.85rem 1rem", fontSize: "0.95rem" }}
                    />
                  </div>

                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.formLabel}>Category *</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className={styles.formInput}
                      style={{ padding: "0.85rem 1rem", fontSize: "0.95rem" }}
                    >
                      {PRESET_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.formGrid2} style={{ display: "grid", gap: "1.25rem" }}>
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.formLabel}>Subtitle / Scope</label>
                    <input
                      type="text"
                      placeholder="e.g. Bespoke Residential Illumination"
                      value={formData.subtitle}
                      onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                      className={styles.formInput}
                      style={{ padding: "0.85rem 1rem", fontSize: "0.95rem" }}
                    />
                  </div>

                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.formLabel}>Installations / Fixture Count</label>
                    <input
                      type="text"
                      placeholder="e.g. 18 Bespoke Fixtures"
                      value={formData.installations_count}
                      onChange={(e) => setFormData({ ...formData, installations_count: e.target.value })}
                      className={styles.formInput}
                      style={{ padding: "0.85rem 1rem", fontSize: "0.95rem" }}
                    />
                  </div>
                </div>

                <div className={styles.formGrid3} style={{ display: "grid", gap: "1rem" }}>
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.formLabel}>Year / Completion</label>
                    <input
                      type="text"
                      placeholder="e.g. 2024"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                      className={styles.formInput}
                      style={{ padding: "0.85rem 1rem", fontSize: "0.95rem" }}
                    />
                  </div>

                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.formLabel}>Scope of Work</label>
                    <input
                      type="text"
                      placeholder="e.g. Architectural Lighting Design"
                      value={formData.scope}
                      onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                      className={styles.formInput}
                      style={{ padding: "0.85rem 1rem", fontSize: "0.95rem" }}
                    />
                  </div>

                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.formLabel}>Area / Scale</label>
                    <input
                      type="text"
                      placeholder="e.g. 8,500 sq ft"
                      value={formData.area}
                      onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                      className={styles.formInput}
                      style={{ padding: "0.85rem 1rem", fontSize: "0.95rem" }}
                    />
                  </div>
                </div>

                <div className={styles.formGrid2} style={{ display: "grid", gap: "1.25rem" }}>
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.formLabel}>Sequence Priority Number</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.sequence}
                      onChange={(e) =>
                        setFormData({ ...formData, sequence: parseInt(e.target.value, 10) || 1 })
                      }
                      className={styles.formInput}
                      style={{ padding: "0.85rem 1rem", fontSize: "0.95rem" }}
                    />
                    <span style={{ fontSize: "0.75rem", color: "var(--admin-text-muted)", marginTop: "0.25rem", display: "block" }}>
                      Lower numbers appear first on the Projects page.
                    </span>
                  </div>

                  <div className={styles.formGroup} style={{ marginBottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <label className={styles.formLabel} style={{ marginBottom: "0.5rem" }}>Homepage Feature</label>
                    <label
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.6rem",
                        cursor: "pointer",
                        fontSize: "0.9rem",
                        fontWeight: 600,
                        color: formData.is_featured ? "#b45309" : "var(--admin-text-muted)",
                        background: formData.is_featured ? "#fffbeb" : "#f8fafc",
                        border: `1px solid ${formData.is_featured ? "#fde68a" : "#e2e8f0"}`,
                        padding: "0.7rem 1rem",
                        borderRadius: "8px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={formData.is_featured}
                        onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                        style={{ width: "18px", height: "18px", accentColor: "#C49A45" }}
                      />
                      <span>Feature on Homepage Projects section</span>
                    </label>
                  </div>
                </div>

                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.formLabel}>Project Architectural Description</label>
                  <textarea
                    rows={4}
                    placeholder="Describe the design inspiration, lighting fixtures utilized, architectural challenges, and aesthetic atmosphere achieved..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className={styles.formInput}
                    style={{ padding: "0.85rem 1rem", fontSize: "0.925rem", lineHeight: 1.6 }}
                  />
                </div>
              </div>

              {/* RIGHT COLUMN: Imagery & Live Customer Preview */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <div style={{ borderBottom: "1px solid var(--admin-border)", paddingBottom: "0.75rem" }}>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--admin-primary)" }}>
                    2. Cover Photography &amp; Live Card Preview
                  </h3>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.825rem", color: "var(--admin-text-muted)" }}>
                    Upload an architectural photograph to ImageKit or specify a CDN URL.
                  </p>
                </div>

                {/* Tab selector for upload method */}
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    background: "var(--admin-surface-muted)",
                    padding: "4px",
                    borderRadius: "8px",
                    width: "fit-content",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setImageTab("file")}
                    style={{
                      padding: "0.45rem 1rem",
                      borderRadius: "6px",
                      border: "none",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      background: imageTab === "file" ? "#ffffff" : "transparent",
                      color: imageTab === "file" ? "var(--admin-primary)" : "var(--admin-text-muted)",
                      boxShadow: imageTab === "file" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                      transition: "all 0.15s",
                    }}
                  >
                    Upload File (ImageKit)
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageTab("url")}
                    style={{
                      padding: "0.45rem 1rem",
                      borderRadius: "6px",
                      border: "none",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      background: imageTab === "url" ? "#ffffff" : "transparent",
                      color: imageTab === "url" ? "var(--admin-primary)" : "var(--admin-text-muted)",
                      boxShadow: imageTab === "url" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                      transition: "all 0.15s",
                    }}
                  >
                    Image URL
                  </button>
                </div>

                {imageTab === "file" ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: "2px dashed var(--admin-border)",
                      borderRadius: "12px",
                      padding: "2rem 1.5rem",
                      textAlign: "center",
                      cursor: "pointer",
                      background: "#fafafa",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--admin-primary)";
                      e.currentTarget.style.background = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--admin-border)";
                      e.currentTarget.style.background = "#fafafa";
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      style={{ display: "none" }}
                    />
                    <Upload size={32} color="#C49A45" style={{ margin: "0 auto 0.75rem" }} />
                    <p style={{ margin: 0, fontWeight: 600, fontSize: "0.95rem", color: "var(--admin-text-main)" }}>
                      {selectedFile ? selectedFile.name : "Click to browse & upload project photograph"}
                    </p>
                    <p style={{ margin: "0.4rem 0 0", fontSize: "0.8rem", color: "var(--admin-text-muted)" }}>
                      Supports high-resolution PNG, JPG, WEBP (Automated ImageKit optimization)
                    </p>
                  </div>
                ) : (
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.formLabel}>Image Web URL / Path</label>
                    <input
                      type="text"
                      placeholder="https://ik.imagekit.io/... or /images/..."
                      value={formData.image_url}
                      onChange={handleImageUrlChange}
                      className={styles.formInput}
                      style={{ padding: "0.85rem 1rem", fontSize: "0.95rem" }}
                    />
                  </div>
                )}

                {/* Live Card Preview Box */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.75rem" }}>
                    <Eye size={16} color="#C49A45" />
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--admin-primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Live Project Card Preview (Customer View)
                    </span>
                  </div>

                  <div
                    style={{
                      borderRadius: "14px",
                      overflow: "hidden",
                      border: "1px solid var(--admin-border)",
                      background: "#121212",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                      position: "relative",
                      maxWidth: "420px",
                    }}
                  >
                    <div style={{ height: "260px", position: "relative", width: "100%", background: "#1e293b", overflow: "hidden" }}>
                      {previewUrl ? (
                        <Image
                          src={previewUrl}
                          alt="Project Preview"
                          fill
                          style={{ objectFit: "cover" }}
                          unoptimized={previewUrl.startsWith("blob:")}
                        />
                      ) : (
                        <div
                          style={{
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--admin-text-muted)",
                            gap: "0.5rem",
                          }}
                        >
                          <ImageIcon size={40} />
                          <span style={{ fontSize: "0.85rem" }}>No photograph selected</span>
                        </div>
                      )}

                      {/* Top Badges */}
                      <div
                        style={{
                          position: "absolute",
                          top: "12px",
                          left: "12px",
                          right: "12px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          pointerEvents: "none",
                        }}
                      >
                        <span
                          style={{
                            background: "rgba(0,0,0,0.65)",
                            backdropFilter: "blur(4px)",
                            color: "#ffffff",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            padding: "3px 10px",
                            borderRadius: "16px",
                            border: "1px solid rgba(255,255,255,0.2)",
                          }}
                        >
                          {formData.category}
                        </span>

                        {formData.is_featured && (
                          <span
                            style={{
                              background: "#C49A45",
                              color: "#000000",
                              fontSize: "0.725rem",
                              fontWeight: 700,
                              padding: "3px 9px",
                              borderRadius: "16px",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Star size={11} fill="#000000" /> Featured
                          </span>
                        )}
                      </div>

                      {/* Overlay Project Card Label */}
                      <div
                        style={{
                          position: "absolute",
                          bottom: "12px",
                          left: "12px",
                          right: "12px",
                          background: "rgba(18, 18, 18, 0.85)",
                          backdropFilter: "blur(8px)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          borderRadius: "10px",
                          padding: "10px 14px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ color: "#ffffff", fontWeight: 600, fontSize: "0.95rem" }}>
                            {formData.title || "Project Title Placeholder"}
                          </div>
                          <div style={{ color: "#a1a1aa", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                            <MapPin size={12} color="#C49A45" />
                            <span>{formData.location || "Location City, Country"}</span>
                            <span>•</span>
                            <span style={{ color: "#C49A45" }}>View Details &gt;</span>
                          </div>
                        </div>

                        <div
                          style={{
                            width: "30px",
                            height: "30px",
                            borderRadius: "50%",
                            background: "var(--admin-surface)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#000000",
                            flexShrink: 0,
                          }}
                        >
                          <ExternalLink size={14} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Project Gallery Images Section */}
                <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--admin-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                        <ImageIcon size={18} color="#C49A45" />
                        <span>3. Project Gallery Showcase Images ({galleryImages.length})</span>
                      </h3>
                      <p style={{ margin: "0.25rem 0 0", fontSize: "0.825rem", color: "var(--admin-text-muted)" }}>
                        Photos rendered on the project showcase page (2-column grid on laptop/desktop, 1-column stacked on mobile).
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        onClick={() => galleryFileInputRef.current?.click()}
                        disabled={uploadingGallery}
                        className={styles.secondaryButton}
                        style={{
                          fontSize: "0.825rem",
                          padding: "0.45rem 0.85rem",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          cursor: "pointer",
                        }}
                      >
                        <Upload size={14} />
                        <span>{uploadingGallery ? "Uploading..." : "Upload Photos"}</span>
                      </button>
                      <input
                        ref={galleryFileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: "none" }}
                        onChange={handleGalleryFileUpload}
                      />
                    </div>
                  </div>

                  {/* Add by URL input */}
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      type="text"
                      placeholder="Add photo by URL (e.g. /images/... or https://...)"
                      value={newGalleryUrl}
                      onChange={(e) => setNewGalleryUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddGalleryUrl();
                        }
                      }}
                      className={styles.formInput}
                      style={{ padding: "0.6rem 0.85rem", fontSize: "0.85rem", flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={handleAddGalleryUrl}
                      className={styles.primaryButton}
                      style={{ padding: "0.6rem 1rem", fontSize: "0.85rem", whiteSpace: "nowrap" }}
                    >
                      <Plus size={14} /> Add URL
                    </button>
                  </div>

                  {/* Gallery Thumbnails Grid */}
                  {galleryImages.length === 0 ? (
                    <div
                      style={{
                        padding: "1.5rem",
                        textAlign: "center",
                        background: "var(--admin-surface-muted)",
                        borderRadius: "10px",
                        border: "1px dashed var(--admin-border)",
                        color: "var(--admin-text-muted)",
                        fontSize: "0.85rem",
                      }}
                    >
                      No gallery photos added yet. Upload files or paste URLs above.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(min(140px, 100%), 1fr))",
                        gap: "0.75rem",
                        maxHeight: "340px",
                        overflowY: "auto",
                        padding: "4px",
                      }}
                    >
                      {galleryImages.map((imgUrl, imgIdx) => {
                        const isCover = formData.image_url === imgUrl;
                        return (
                          <div
                            key={imgIdx}
                            style={{
                              position: "relative",
                              height: "110px",
                              borderRadius: "10px",
                              overflow: "hidden",
                              border: isCover ? "2px solid #C49A45" : "1px solid var(--admin-border)",
                              background: "#000000",
                              boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                            }}
                          >
                            <Image
                              src={imgUrl}
                              alt={`Gallery ${imgIdx + 1}`}
                              fill
                              unoptimized
                              style={{ objectFit: "cover" }}
                            />

                            {isCover && (
                              <span
                                style={{
                                  position: "absolute",
                                  top: "6px",
                                  left: "6px",
                                  background: "#C49A45",
                                  color: "#000000",
                                  fontSize: "0.65rem",
                                  fontWeight: 700,
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  zIndex: 2,
                                }}
                              >
                                Cover
                              </span>
                            )}

                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                background: "rgba(0,0,0,0.45)",
                                opacity: 0,
                                transition: "opacity 0.2s",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px",
                                zIndex: 3,
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                            >
                              {!isCover && (
                                <button
                                  type="button"
                                  onClick={() => handleSetCover(imgUrl)}
                                  title="Set as Main Cover"
                                  style={{
                                    background: "var(--admin-surface)",
                                    color: "#111827",
                                    border: "none",
                                    borderRadius: "4px",
                                    padding: "4px 6px",
                                    fontSize: "0.7rem",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                >
                                  Make Cover
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveGalleryImage(imgIdx)}
                                title="Remove Image"
                                style={{
                                  background: "#ef4444",
                                  color: "#ffffff",
                                  border: "none",
                                  borderRadius: "4px",
                                  padding: "5px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 4. Project Videos Section */}
                <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--admin-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Video size={18} color="#C49A45" />
                        <span>4. Project Showcase Videos ({videos.length})</span>
                      </h3>
                      <p style={{ margin: "0.25rem 0 0", fontSize: "0.825rem", color: "var(--admin-text-muted)" }}>
                        Add as many architectural walkthrough or showcase videos as you want (YouTube, Vimeo, MP4 URLs, or video file uploads).
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        onClick={() => videoFileInputRef.current?.click()}
                        disabled={uploadingVideo}
                        className={styles.secondaryButton}
                        style={{
                          fontSize: "0.825rem",
                          padding: "0.45rem 0.85rem",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          cursor: "pointer",
                        }}
                      >
                        <Upload size={14} />
                        <span>{uploadingVideo ? "Uploading..." : "Upload Video File"}</span>
                      </button>
                      <input
                        ref={videoFileInputRef}
                        type="file"
                        accept="video/*"
                        multiple
                        style={{ display: "none" }}
                        onChange={handleVideoFileUpload}
                      />
                    </div>
                  </div>

                  {/* Add by Video URL input */}
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      type="text"
                      placeholder="Enter Video URL (e.g. https://www.youtube.com/watch?v=... or https://.../video.mp4)"
                      value={newVideoUrl}
                      onChange={(e) => setNewVideoUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddVideoUrl();
                        }
                      }}
                      className={styles.formInput}
                      style={{ padding: "0.6rem 0.85rem", fontSize: "0.85rem", flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={handleAddVideoUrl}
                      className={styles.primaryButton}
                      style={{ padding: "0.6rem 1rem", fontSize: "0.85rem", whiteSpace: "nowrap" }}
                    >
                      <Plus size={14} /> Add Video
                    </button>
                  </div>

                  {/* Videos List */}
                  {videos.length === 0 ? (
                    <div
                      style={{
                        padding: "1.5rem",
                        textAlign: "center",
                        background: "var(--admin-surface-muted)",
                        borderRadius: "10px",
                        border: "1px dashed var(--admin-border)",
                        color: "var(--admin-text-muted)",
                        fontSize: "0.85rem",
                      }}
                    >
                      No videos added yet. You can add as many video links or files as you want.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                      {videos.map((vidUrl, vidIdx) => (
                        <div
                          key={vidIdx}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0.75rem 1rem",
                            background: "var(--admin-surface)",
                            border: "1px solid var(--admin-border)",
                            borderRadius: "8px",
                            gap: "1rem",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", overflow: "hidden" }}>
                            <div
                              style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "6px",
                                background: "#fef3c7",
                                color: "#b45309",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                fontWeight: 700,
                                fontSize: "0.85rem",
                              }}
                            >
                              {vidIdx + 1}
                            </div>
                            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              <a
                                href={vidUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: "0.85rem",
                                  color: "#2563eb",
                                  textDecoration: "underline",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                {vidUrl}
                                <ExternalLink size={12} />
                              </a>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveVideo(vidIdx)}
                            title="Remove Video"
                            style={{
                              background: "#fee2e2",
                              color: "#dc2626",
                              border: "none",
                              borderRadius: "6px",
                              padding: "6px 8px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              flexShrink: 0,
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Form Actions */}
            <div
              style={{
                borderTop: "1px solid var(--admin-border)",
                padding: "1.25rem 2rem",
                background: "var(--admin-surface-muted)",
                display: "flex",
                justifyContent: "flex-end",
                gap: "1rem",
                alignItems: "center",
              }}
            >
              <button
                type="button"
                onClick={backToList}
                className={styles.btnCancel}
                style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)", padding: "0.75rem 1.5rem" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={styles.primaryButton}
                style={{ padding: "0.75rem 2rem", opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? (
                  "Saving Project..."
                ) : isEdit ? (
                  <>
                    <CheckCircle2 size={18} /> Update Project
                  </>
                ) : (
                  <>
                    <Plus size={18} /> Publish Project
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: LIST OF PROJECTS (100% WIDTH TABLE)
  // =========================================================================
  return (
    <div className={styles.sectionContainer} style={{ width: "100%", maxWidth: "100%", margin: 0 }}>
      {/* Top Header Row */}
      <div className={styles.headerRow} style={{ marginBottom: "1.5rem" }}>
        <div>
          <h2 className={styles.sectionTitle} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Building size={26} color="#C49A45" /> Architectural Projects
          </h2>
          <p className={styles.sectionSubtitle}>
            Manage your lighting portfolio installations, homepage featured selections, and sequence arrangement.
          </p>
        </div>
        <button onClick={startCreate} className={styles.primaryButton}>
          <Plus size={18} /> Add New Project
        </button>
      </div>

      {/* Success Notification */}
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

      {/* Error Notification */}
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

      {/* INLINE DELETE CONFIRMATION BANNER (Zero Popups/Blurs) */}
      {projectToDelete && (
        <div
          style={{
            background: "#FEF2F2",
            border: "2px solid #EF4444",
            borderRadius: "10px",
            padding: "1.25rem 1.75rem",
            marginBottom: "1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            boxShadow: "0 4px 12px rgba(239, 68, 68, 0.12)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                background: "#FEE2E2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#DC2626",
                flexShrink: 0,
              }}
            >
              <Trash2 size={22} />
            </div>
            <div>
              <h4 style={{ margin: 0, color: "#991B1B", fontSize: "1rem", fontWeight: 700 }}>
                Confirm Project Deletion
              </h4>
              <p style={{ margin: "0.25rem 0 0", color: "#7F1D1D", fontSize: "0.85rem" }}>
                Are you sure you want to delete the project &quot;{projectToDelete.title}&quot;? This cannot be undone.
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button
              onClick={() => setProjectToDelete(null)}
              className={styles.btnCancel}
              style={{ background: "var(--admin-surface)", border: "1px solid #E5E7EB", padding: "0.65rem 1.25rem" }}
            >
              Cancel
            </button>
            <button onClick={handleDelete} className={styles.btnDeleteConfirm} style={{ padding: "0.65rem 1.5rem" }}>
              Yes, Delete Project
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
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {["All", ...PRESET_CATEGORIES].map((cat) => {
            const isActive = selectedCategory === cat;
            const count =
              cat === "All" ? projects.length : projects.filter((p) => p.category === cat).length;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: "0.5rem 0.95rem",
                  borderRadius: "8px",
                  border: isActive ? "1px solid var(--admin-primary)" : "1px solid var(--admin-border)",
                  background: isActive ? "var(--admin-primary)" : "#ffffff",
                  color: isActive ? "#ffffff" : "var(--admin-text-main)",
                  fontWeight: 600,
                  fontSize: "0.825rem",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                {cat}
                <span
                  style={{
                    fontSize: "0.7rem",
                    padding: "1px 6px",
                    borderRadius: "10px",
                    background: isActive ? "rgba(255,255,255,0.2)" : "#f1f5f9",
                    color: isActive ? "#ffffff" : "var(--admin-text-muted)",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div style={{ position: "relative", minWidth: "min(260px, 100%)" }}>
          <Search
            size={16}
            style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--admin-text-subtle)" }}
          />
          <input
            type="text"
            placeholder="Search projects or locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.formInput}
            style={{ paddingLeft: "2.25rem", paddingRight: "1rem", margin: 0 }}
          />
        </div>
      </div>

      {/* FULL-WIDTH TABLE CARD */}
      <div className={styles.card} style={{ width: "100%", maxWidth: "100%" }}>
        <div
          style={{
            padding: "1.25rem 1.75rem",
            borderBottom: "1px solid var(--admin-border)",
            background: "var(--admin-surface-muted)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--admin-primary)", margin: 0 }}>
              Portfolio Installations
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--admin-text-muted)", margin: "0.25rem 0 0" }}>
              Projects display on customer pages strictly following sequence priority (#1 first).
            </p>
          </div>
          <span
            style={{
              fontSize: "0.75rem",
              background: "#f0fdf4",
              color: "#166534",
              border: "1px solid #bbf7d0",
              padding: "4px 12px",
              borderRadius: "20px",
              fontWeight: 600,
            }}
          >
            Sequence Ordered
          </span>
        </div>

        {loading ? (
          <div style={{ padding: "4rem", textAlign: "center", color: "var(--admin-text-muted)" }}>
            Loading projects...
          </div>
        ) : filteredProjects.length === 0 ? (
          <div style={{ padding: "4rem", textAlign: "center", color: "var(--admin-text-muted)" }}>
            <p style={{ fontSize: "1rem", marginBottom: "1rem" }}>
              No projects found. Click &quot;Add New Project&quot; to showcase your first installation.
            </p>
            <button onClick={startCreate} className={styles.primaryButton}>
              <Plus size={18} /> Add First Project
            </button>
          </div>
        ) : (
          <div className={styles.tableWrapper} style={{ width: "100%", overflowX: "auto" }}>
            <table className={styles.table} style={{ width: "100%", tableLayout: "auto" }}>
              <thead>
                <tr>
                  <th style={{ width: "130px", textAlign: "center" }}>Sequence Order</th>
                  <th style={{ width: "80px" }}>Photo</th>
                  <th style={{ width: "28%" }}>Project Title</th>
                  <th style={{ width: "18%" }}>Location</th>
                  <th style={{ width: "14%" }}>Category</th>
                  <th style={{ width: "120px", textAlign: "center" }}>Featured</th>
                  <th style={{ width: "140px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project, idx) => {
                  const projId = project.id || project._id;
                  const isMoving = movingId === projId;
                  const isFirst = idx === 0;
                  const isLast = idx === filteredProjects.length - 1;

                  return (
                    <tr key={projId || idx}>
                      {/* Sequence Column with Move Up / Move Down buttons */}
                      <td style={{ textAlign: "center" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            background: "var(--admin-surface-muted)",
                            padding: "4px 8px",
                            borderRadius: "8px",
                            border: "1px solid var(--admin-border)",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontWeight: 700,
                              fontSize: "0.85rem",
                              color: "var(--admin-primary)",
                              minWidth: "24px",
                            }}
                          >
                            #{project.sequence || idx + 1}
                          </span>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <button
                              type="button"
                              disabled={isFirst || isMoving}
                              onClick={() => handleSwap(project, "up")}
                              title="Move Up in Sequence"
                              style={{
                                background: "none",
                                border: "none",
                                cursor: isFirst ? "not-allowed" : "pointer",
                                padding: "1px 2px",
                                opacity: isFirst ? 0.25 : 0.8,
                                color: "var(--admin-text-main)",
                                lineHeight: 1,
                              }}
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              type="button"
                              disabled={isLast || isMoving}
                              onClick={() => handleSwap(project, "down")}
                              title="Move Down in Sequence"
                              style={{
                                background: "none",
                                border: "none",
                                cursor: isLast ? "not-allowed" : "pointer",
                                padding: "1px 2px",
                                opacity: isLast ? 0.25 : 0.8,
                                color: "var(--admin-text-main)",
                                lineHeight: 1,
                              }}
                            >
                              <ArrowDown size={13} />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Photo */}
                      <td>
                        <div
                          style={{
                            width: "56px",
                            height: "56px",
                            borderRadius: "8px",
                            overflow: "hidden",
                            position: "relative",
                            background: "var(--admin-surface-muted)",
                            border: "1px solid var(--admin-border)",
                          }}
                        >
                          {project.image_url ? (
                            <Image
                              src={project.image_url}
                              alt={project.title}
                              fill
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
                                color: "var(--admin-text-subtle)",
                              }}
                            >
                              <ImageIcon size={20} />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Title & Subtitle */}
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--admin-primary)", fontSize: "0.95rem" }}>
                          {project.title}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--admin-text-muted)", marginTop: "2px", display: "flex", gap: "6px", alignItems: "center" }}>
                          {project.subtitle && <span>{project.subtitle}</span>}
                          {project.gallery_images && project.gallery_images.length > 0 && (
                            <span style={{ color: "#C49A45", fontWeight: 600, fontSize: "0.75rem" }}>
                              • {project.gallery_images.length} photo{project.gallery_images.length > 1 ? "s" : ""}
                            </span>
                          )}
                          {project.videos && project.videos.length > 0 && (
                            <span style={{ color: "#2563eb", fontWeight: 600, fontSize: "0.75rem" }}>
                              • {project.videos.length} video{project.videos.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Location */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.85rem", color: "var(--admin-text-main)" }}>
                          <MapPin size={13} color="#C49A45" />
                          <span>{project.location || "—"}</span>
                        </div>
                        {project.installations_count && (
                          <div style={{ fontSize: "0.75rem", color: "var(--admin-text-muted)", marginTop: "2px" }}>
                            {project.installations_count}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td>
                        <span
                          style={{
                            fontSize: "0.775rem",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: "var(--admin-surface-muted)",
                            color: "var(--admin-text-main)",
                            fontWeight: 500,
                          }}
                        >
                          {project.category || "Residential"}
                        </span>
                      </td>

                      {/* Featured Toggle */}
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => handleToggleFeatured(project)}
                          title={project.is_featured ? "Featured on homepage (click to remove)" : "Click to feature on homepage"}
                          style={{
                            background: project.is_featured ? "#fffbeb" : "#f8fafc",
                            border: `1px solid ${project.is_featured ? "#fde68a" : "#e2e8f0"}`,
                            color: project.is_featured ? "#b45309" : "#94a3b8",
                            padding: "4px 10px",
                            borderRadius: "16px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            transition: "all 0.2s",
                          }}
                        >
                          <Star size={12} fill={project.is_featured ? "#b45309" : "none"} />
                          {project.is_featured ? "Featured" : "Standard"}
                        </button>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                          <Link
                            href={`/projects/${projId}`}
                            target="_blank"
                            className={styles.actionButton}
                            title="View Live Project Showcase"
                          >
                            <Eye size={15} />
                          </Link>
                          <button
                            type="button"
                            onClick={() => startEdit(project)}
                            className={styles.actionButton}
                            title="Edit Project"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setProjectToDelete(project)}
                            className={`${styles.actionButton} ${styles.actionButtonDelete}`}
                            title="Delete Project"
                          >
                            <Trash2 size={15} />
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
