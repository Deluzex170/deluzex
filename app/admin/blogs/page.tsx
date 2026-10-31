"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import type { ColDef } from "ag-grid-community";
import { AdminDataGrid } from "../../components/admin/AdminDataGrid";
import Image from "next/image";
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
  Eye,
  ArrowUp,
  ArrowDown,
  BookOpen,
  Sparkles,
} from "lucide-react";
import {
  fetchBlogs,
  createBlog,
  updateBlog,
  deleteBlog,
  swapBlogSequence,
  Blog,
} from "../../services/api";

type ViewMode = "list" | "create" | "edit";

const PRESET_CATEGORIES = [
  "Design & Inspiration",
  "Architectural Blogs",
  "Products Blogs",
  "Buying Guide",
  "Case Study",
];

export default function AdminBlogsPage() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // View state: list, create, edit
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingBlog, setEditingBlog] = useState<Blog | null>(null);
  const [blogToDelete, setBlogToDelete] = useState<Blog | null>(null);
  const [movingId, setMovingId] = useState<string | number | null>(null);

  // Form fields
  const [formData, setFormData] = useState({
    title: "",
    category: "Design & Inspiration",
    author: "De Luzex Team",
    read_time: "5 min read",
    excerpt: "",
    content: "",
    image: "",
    status: "Published",
    sequence: 1,
    is_featured: false,
  });

  const [imageTab, setImageTab] = useState<"file" | "url">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadBlogs();
  }, []);

  async function loadBlogs() {
    setLoading(true);
    try {
      const data = await fetchBlogs();
      setBlogs(data);
    } catch (err) {
      console.error("Failed to load blogs:", err);
    } finally {
      setLoading(false);
    }
  }

  function startCreate() {
    setErrorMsg("");
    setSuccessMsg("");
    const nextSeq = blogs.length > 0 ? Math.max(...blogs.map((b) => b.sequence || 0)) + 1 : 1;
    setFormData({
      title: "",
      category: "Design & Inspiration",
      author: "De Luzex Team",
      read_time: "5 min read",
      excerpt: "",
      content: "",
      image: "",
      status: "Published",
      sequence: nextSeq,
      is_featured: false,
    });
    setSelectedFile(null);
    setPreviewUrl("");
    setImageTab("file");
    setEditingBlog(null);
    setViewMode("create");
  }

  function startEdit(blog: Blog) {
    setErrorMsg("");
    setSuccessMsg("");
    setFormData({
      title: blog.title || "",
      category: blog.category || "Design & Inspiration",
      author: blog.author || "De Luzex Team",
      read_time: blog.read_time || "5 min read",
      excerpt: blog.excerpt || "",
      content: blog.content || "",
      image: blog.image || "",
      status: blog.status || "Published",
      sequence: blog.sequence || 1,
      is_featured: Boolean(blog.is_featured),
    });
    setSelectedFile(null);
    setPreviewUrl(blog.image || "");
    setImageTab(
      blog.image?.startsWith("http") || blog.image?.startsWith("/images")
        ? "url"
        : "file"
    );
    setEditingBlog(blog);
    setViewMode("edit");
  }

  function backToList() {
    setViewMode("list");
    setEditingBlog(null);
    setErrorMsg("");
    setSelectedFile(null);
    setPreviewUrl("");
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

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (!formData.title.trim()) {
      setErrorMsg("Blog title is required.");
      return;
    }
    if (!formData.content.trim()) {
      setErrorMsg("Blog article content is required.");
      return;
    }

    setSubmitting(true);
    try {
      const submitData = new FormData();
      submitData.append("title", formData.title.trim());
      submitData.append("category", formData.category);
      submitData.append("author", formData.author.trim());
      submitData.append("read_time", formData.read_time.trim());
      if (formData.excerpt.trim()) submitData.append("excerpt", formData.excerpt.trim());
      submitData.append("content", formData.content.trim());
      submitData.append("status", formData.status);
      submitData.append("sequence", String(formData.sequence || 1));
      submitData.append("is_featured", String(formData.is_featured));

      if (selectedFile) {
        submitData.append("image_file", selectedFile);
      } else if (formData.image.trim()) {
        submitData.append("image", formData.image.trim());
      } else {
        submitData.append("image", "/images/category_chandelier_1784107756268.jpg");
      }

      await createBlog(submitData);
      setSuccessMsg("Blog published successfully.");
      await loadBlogs();
      setViewMode("list");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create blog";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBlog) return;
    setErrorMsg("");

    if (!formData.title.trim()) {
      setErrorMsg("Blog title is required.");
      return;
    }
    if (!formData.content.trim()) {
      setErrorMsg("Blog article content is required.");
      return;
    }

    setSubmitting(true);
    try {
      const submitData = new FormData();
      submitData.append("title", formData.title.trim());
      submitData.append("category", formData.category);
      submitData.append("author", formData.author.trim());
      submitData.append("read_time", formData.read_time.trim());
      submitData.append("excerpt", formData.excerpt.trim());
      submitData.append("content", formData.content.trim());
      submitData.append("status", formData.status);
      submitData.append("sequence", String(formData.sequence || 1));
      submitData.append("is_featured", String(formData.is_featured));

      if (selectedFile) {
        submitData.append("image_file", selectedFile);
      } else if (formData.image.trim()) {
        submitData.append("image", formData.image.trim());
      }

      const blogId = editingBlog._id || editingBlog.id || "";
      await updateBlog(blogId, submitData);
      setSuccessMsg("Blog updated successfully.");
      await loadBlogs();
      setViewMode("list");
      setEditingBlog(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update blog";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!blogToDelete) return;
    const blogId = blogToDelete._id || blogToDelete.id || "";

    try {
      await deleteBlog(blogId);
      setBlogToDelete(null);
      setSuccessMsg("Blog deleted successfully.");
      await loadBlogs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete blog";
      alert(msg);
    }
  }

  async function handleSwap(blog: Blog, direction: "up" | "down") {
    const blogId = blog._id || blog.id || "";
    if (!blogId) return;

    setMovingId(blogId);
    try {
      await swapBlogSequence(blogId, direction);
      await loadBlogs();
      setSuccessMsg(`Sequence updated: "${blog.title}" moved ${direction}.`);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Failed to swap sequence:", err);
      alert("Failed to swap sequence.");
    } finally {
      setMovingId(null);
    }
  }

  const filteredBlogs = useMemo(() => {
    return blogs.filter((b) => {
      if (selectedCategory !== "All" && b.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        
        return (
          b.title?.toLowerCase().includes(q) ||
          b.author?.toLowerCase().includes(q) ||
          b.category?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [blogs, selectedCategory, searchQuery]);

  const columnDefs = useMemo<ColDef<Blog>[]>(
    () => [
      {
        field: "sequence",
        headerName: "Seq Order",
        width: 130,
        cellRenderer: (params: any) => {
          const blog = params.data as Blog;
          if (!blog) return null;
          const idx = params.node?.rowIndex ?? 0;
          const isFirst = idx === 0;
          const isLast = idx === (filteredBlogs.length - 1);
          const blogId = blog._id || blog.id || "";
          const isMoving = movingId === blogId;
          return (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "100%" }}>
              <button
                type="button"
                disabled={isFirst || isMoving}
                onClick={() => handleSwap(blog, "up")}
                title="Move Up in sequence"
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "6px",
                  border: "1px solid var(--admin-border)",
                  background: isFirst ? "var(--admin-surface-muted)" : "var(--admin-surface)",
                  color: isFirst ? "#cbd5e1" : "var(--admin-primary)",
                  cursor: isFirst || isMoving ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ArrowUp size={13} />
              </button>
              <span
                style={{
                  minWidth: "32px",
                  padding: "2px 6px",
                  borderRadius: "10px",
                  background: "rgba(234, 179, 8, 0.14)",
                  color: "var(--admin-warning-text)",
                  border: "1px solid rgba(234, 179, 8, 0.35)",
                  fontWeight: 700,
                  fontSize: "0.78rem",
                  textAlign: "center",
                }}
              >
                #{blog.sequence}
              </span>
              <button
                type="button"
                disabled={isLast || isMoving}
                onClick={() => handleSwap(blog, "down")}
                title="Move Down in sequence"
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "6px",
                  border: "1px solid var(--admin-border)",
                  background: isLast ? "var(--admin-surface-muted)" : "var(--admin-surface)",
                  color: isLast ? "#cbd5e1" : "var(--admin-primary)",
                  cursor: isLast || isMoving ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ArrowDown size={13} />
              </button>
            </div>
          );
        },
      },
      {
        field: "image",
        headerName: "Cover",
        width: 70,
        cellRenderer: (params: any) => {
          const blog = params.data as Blog;
          if (!blog) return null;
          return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "6px",
                  overflow: "hidden",
                  position: "relative",
                  background: "var(--admin-surface-muted)",
                  border: "1px solid var(--admin-border)",
                }}
              >
                {blog.image ? (
                  <Image src={blog.image} alt={blog.title || "Blog"} fill sizes="36px" style={{ objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--admin-text-subtle)" }}>
                    <BookOpen size={16} />
                  </div>
                )}
              </div>
            </div>
          );
        },
      },
      {
        field: "title",
        headerName: "Article Title",
        flex: 1.5,
        minWidth: 240,
        cellRenderer: (params: any) => {
          const blog = params.data as Blog;
          if (!blog) return null;
          return (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", overflow: "hidden" }}>
              <div style={{ fontWeight: 600, color: "var(--admin-gold-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {blog.title}
              </div>
              {blog.excerpt && (
                <div style={{ fontSize: "0.78rem", color: "var(--admin-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {blog.excerpt}
                </div>
              )}
            </div>
          );
        },
      },
      {
        field: "category",
        headerName: "Category",
        width: 160,
        cellRenderer: (params: any) => {
          const blog = params.data as Blog;
          if (!blog) return null;
          return (
            <span
              style={{
                display: "inline-block",
                background: "var(--admin-surface-muted)",
                color: "var(--admin-text-secondary)",
                padding: "3px 8px",
                borderRadius: "6px",
                fontSize: "0.78rem",
                fontWeight: 500,
              }}
            >
              {blog.category}
            </span>
          );
        },
      },
      {
        field: "author",
        headerName: "Author",
        width: 130,
        cellRenderer: (params: any) => {
          const blog = params.data as Blog;
          return <span style={{ fontSize: "0.82rem", color: "var(--admin-text-main)", fontWeight: 500 }}>{blog?.author}</span>;
        },
      },
      {
        field: "status",
        headerName: "Status",
        width: 110,
        cellRenderer: (params: any) => {
          const blog = params.data as Blog;
          if (!blog) return null;
          const isPublished = blog.status === "Published";
          return (
            <span
              style={{
                display: "inline-block",
                padding: "3px 8px",
                borderRadius: "10px",
                fontSize: "0.74rem",
                fontWeight: 700,
                background: isPublished ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                color: isPublished ? "var(--admin-success-text)" : "var(--admin-warning-text)",
                border: `1px solid ${isPublished ? "#BBF7D0" : "#FDE68A"}`,
              }}
            >
              {blog.status}
            </span>
          );
        },
      },
      {
        headerName: "Actions",
        width: 140,
        pinned: "right",
        cellRenderer: (params: any) => {
          const blog = params.data as Blog;
          if (!blog) return null;
          return (
            <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end", alignItems: "center", height: "100%" }}>
              <button
                onClick={() => startEdit(blog)}
                className={styles.actionLink}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  border: "none",
                  cursor: "pointer",
                  padding: "0.35rem 0.65rem",
                  fontSize: "0.78rem",
                }}
              >
                <Pencil size={12} /> Edit
              </button>
              <button
                onClick={() => setBlogToDelete(blog)}
                className={styles.actionDelete}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  border: "none",
                  cursor: "pointer",
                  padding: "0.35rem 0.65rem",
                  fontSize: "0.78rem",
                }}
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          );
        },
      },
    ],
    [filteredBlogs, movingId]
  );




  // =========================================================================
  // VIEW 1: FULL-PAGE CREATE OR EDIT FORM
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
            Back to All Blogs
          </button>

          <span
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              padding: "4px 12px",
              borderRadius: "20px",
              background: isEdit ? "rgba(59, 130, 246, 0.1)" : "#fefce8",
              color: isEdit ? "var(--admin-info-text)" : "var(--admin-warning-text)",
              border: `1px solid ${isEdit ? "#bfdbfe" : "#fef08a"}`,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Sparkles size={13} />
            {isEdit ? "Editing Article" : "Creating New Article"}
          </span>
        </div>

        {/* Page Header */}
        <div className={styles.headerRow} style={{ marginBottom: "1.75rem" }}>
          <div>
            <h2 className={styles.sectionTitle} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              {isEdit ? <Pencil size={26} color="#2563eb" /> : <Plus size={26} color="#C49A45" />}
              {isEdit ? `Edit Article: ${editingBlog?.title || ""}` : "Create New Blog Post"}
            </h2>
            <p className={styles.sectionSubtitle}>
              {isEdit
                ? "Update editorial content, cover imagery, display sequence priority, or publishing status."
                : "Author and publish a luxury design article for the insights & inspiration section."}
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
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  borderRadius: "8px",
                  color: "var(--admin-danger-text)",
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
                padding: "var(--a-space-5)",
              }}
            >
              {/* LEFT COLUMN: Editorial Content */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <div style={{ borderBottom: "1px solid var(--admin-border)", paddingBottom: "0.75rem" }}>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--admin-gold-text)" }}>
                    1. Article Information &amp; Sequence
                  </h3>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.825rem", color: "var(--admin-text-muted)" }}>
                    Configure the title, category, reading duration, and display sequence priority.
                  </p>
                </div>

                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.formLabel}>Article Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. How To Choose The Perfect Chandelier For Your Home"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className={styles.formInput}
                    style={{ padding: "0.85rem 1rem", fontSize: "0.95rem" }}
                  />
                </div>

                <div className={styles.formGrid2} style={{ display: "grid", gap: "1.25rem" }}>
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

                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.formLabel}>Author</label>
                    <input
                      type="text"
                      placeholder="e.g. De Luzex Team"
                      value={formData.author}
                      onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      className={styles.formInput}
                      style={{ padding: "0.85rem 1rem", fontSize: "0.95rem" }}
                    />
                  </div>
                </div>

                <div className={styles.formGrid3} style={{ display: "grid", gap: "1.25rem" }}>
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.formLabel}>Read Time</label>
                    <input
                      type="text"
                      placeholder="e.g. 5 min read"
                      value={formData.read_time}
                      onChange={(e) => setFormData({ ...formData, read_time: e.target.value })}
                      className={styles.formInput}
                      style={{ padding: "0.85rem 1rem", fontSize: "0.95rem" }}
                    />
                  </div>

                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.formLabel}>Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className={styles.formInput}
                      style={{ padding: "0.85rem 1rem", fontSize: "0.95rem" }}
                    >
                      <option value="Published">Published (Live)</option>
                      <option value="Draft">Draft (Hidden)</option>
                    </select>
                  </div>

                  {/* SEQUENCE PRIORITY INPUT */}
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.formLabel}>Sequence / Order #</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.sequence}
                      onChange={(e) => setFormData({ ...formData, sequence: Number(e.target.value) || 1 })}
                      className={styles.formInput}
                      style={{ padding: "0.85rem 1rem", fontSize: "0.95rem", fontWeight: 700 }}
                    />
                  </div>
                </div>

                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label className={styles.formLabel}>Short Excerpt / Teaser</label>
                  <input
                    type="text"
                    placeholder="Brief summary to highlight on the card teaser..."
                    value={formData.excerpt}
                    onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                    className={styles.formInput}
                    style={{ padding: "0.85rem 1rem", fontSize: "0.95rem" }}
                  />
                </div>

                <div className={styles.formGroup} style={{ marginBottom: 0, flex: 1 }}>
                  <label className={styles.formLabel}>Full Article Content *</label>
                  <textarea
                    required
                    rows={8}
                    placeholder="Write detailed design guidance, fixture placement notes, lighting temperatures, and architectural tips..."
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className={styles.formInput}
                    style={{
                      padding: "0.9rem 1rem",
                      fontSize: "0.95rem",
                      lineHeight: "1.6",
                      resize: "vertical",
                      minHeight: "200px",
                    }}
                  />
                </div>
              </div>

              {/* RIGHT COLUMN: Cover Image & Real-Time Live Preview */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <div style={{ borderBottom: "1px solid var(--admin-border)", paddingBottom: "0.75rem" }}>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--admin-gold-text)" }}>
                    2. Cover Image &amp; Live Card Preview
                  </h3>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.825rem", color: "var(--admin-text-muted)" }}>
                    Upload an editorial cover image and see how this card appears in the blog directory.
                  </p>
                </div>

                {/* Cover Image Upload */}
                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                    <label className={styles.formLabel} style={{ margin: 0 }}>
                      Cover Image
                    </label>
                    <div className={styles.tabSwitch}>
                      <button
                        type="button"
                        onClick={() => setImageTab("file")}
                        className={`${styles.tabSwitchBtn} ${imageTab === "file" ? styles.tabSwitchBtnActive : ""}`}
                      >
                        Upload File
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageTab("url")}
                        className={`${styles.tabSwitchBtn} ${imageTab === "url" ? styles.tabSwitchBtnActive : ""}`}
                      >
                        Image URL
                      </button>
                    </div>
                  </div>

                  {imageTab === "file" ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={styles.dropzone}
                      style={{ padding: "1.75rem 1.5rem" }}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        style={{ display: "none" }}
                      />
                      <Upload size={28} style={{ color: "var(--admin-gold-text)", marginBottom: "0.4rem" }} />
                      <p style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--admin-gold-text)", margin: 0 }}>
                        {selectedFile ? selectedFile.name : "Click to browse and upload cover photo"}
                      </p>
                      <span style={{ fontSize: "0.8rem", color: "var(--admin-text-muted)" }}>
                        PNG, JPG, WEBP up to 5MB {isEdit ? "(leave empty to keep current)" : ""}
                      </span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. /images/category_chandelier_1784107756268.jpg"
                      value={formData.image}
                      onChange={handleImageUrlChange}
                      className={styles.formInput}
                      style={{ padding: "0.85rem 1rem" }}
                    />
                  )}
                </div>

                {/* REAL-TIME CARD PREVIEW */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
                    <Eye size={15} color="#C49A45" />
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--admin-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Live Customer-Facing Card Preview
                    </span>
                  </div>

                  <div
                    style={{
                      background: "var(--admin-surface)",
                      borderRadius: "16px",
                      overflow: "hidden",
                      border: "1px solid var(--admin-border)",
                      boxShadow: "0 6px 20px rgba(0,0,0,0.04)",
                      maxWidth: "420px",
                    }}
                  >
                    <div style={{ position: "relative", width: "100%", height: "200px", background: "var(--admin-surface-muted)", overflow: "hidden" }}>
                      {previewUrl ? (
                        <Image src={previewUrl} alt="Preview" fill sizes="420px" style={{ objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--admin-text-subtle)" }}>
                          <ImageIcon size={32} />
                        </div>
                      )}
                      <div
                        style={{
                          position: "absolute",
                          top: "12px",
                          left: "12px",
                          background: "rgba(15, 23, 42, 0.75)",
                          backdropFilter: "blur(4px)",
                          color: "#ffffff",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          padding: "4px 10px",
                          borderRadius: "14px",
                        }}
                      >
                        Sequence #{formData.sequence}
                      </div>
                    </div>
                    <div style={{ padding: "1.25rem" }}>
                      <span style={{ fontSize: "0.8rem", color: "var(--admin-gold-text)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {formData.category}
                      </span>
                      <h4 style={{ margin: "0.4rem 0", fontSize: "1.05rem", fontWeight: 700, color: "var(--admin-gold-text)", lineHeight: 1.4 }}>
                        {formData.title || "Your Blog Post Headline"}
                      </h4>
                      {formData.excerpt && (
                        <p style={{ margin: "0 0 0.75rem", fontSize: "0.85rem", color: "var(--admin-text-muted)", lineHeight: 1.5 }}>
                          {formData.excerpt}
                        </p>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.75rem", borderTop: "1px solid #f1f5f9", fontSize: "0.8rem", color: "var(--admin-text-muted)" }}>
                        <span>{formData.author}</span>
                        <span>{formData.read_time}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Row - Full Width */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "1rem",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "var(--a-space-4) var(--a-space-5)",
                background: "var(--admin-surface-muted)",
                borderTop: "1px solid var(--admin-border)",
              }}
            >
              <button
                type="button"
                onClick={backToList}
                className={styles.btnCancel}
                style={{ padding: "0.75rem 1.5rem", fontSize: "0.95rem" }}
              >
                Cancel
              </button>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
                <button
                  type="submit"
                  disabled={submitting}
                  className={styles.primaryButton}
                  style={{ padding: "0.75rem 2rem", fontSize: "0.95rem" }}
                >
                  {submitting ? "Saving Article..." : isEdit ? "Save Changes" : "Publish Article"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: FULL-PAGE TABLE LIST WITH SEQUENCE ARRANGEMENT
  // =========================================================================
  return (
    <div className={styles.sectionContainer} style={{ width: "100%", maxWidth: "100%", margin: 0 }}>
      {/* HEADER ROW */}
      <div className={styles.headerRow} style={{ marginBottom: "1.75rem" }}>
        <div>
          <h2 className={styles.sectionTitle} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <BookOpen size={28} color="#C49A45" />
            Blogs &amp; Insights Management
          </h2>
          <p className={styles.sectionSubtitle}>
            Publish articles, manage editorial content, and arrange display sequence order.
          </p>
        </div>
        <button onClick={startCreate} className={styles.primaryButton}>
          <Plus size={18} />
          Add New Blog
        </button>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "0.9rem 1.25rem",
            background: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.35)",
            borderRadius: "10px",
            color: "var(--admin-success-text)",
            fontSize: "0.875rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
            boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <CheckCircle2 size={18} />
            <span style={{ fontWeight: 600 }}>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg("")}
            style={{ background: "transparent", border: "none", color: "var(--admin-success-text)", cursor: "pointer", fontSize: "1rem" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Inline Delete Confirmation Banner */}
      {blogToDelete && (
        <div
          style={{
            marginBottom: "1.75rem",
            padding: "var(--a-space-4) var(--a-space-5)",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.35)",
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
                background: "rgba(239, 68, 68, 0.14)",
                color: "var(--admin-danger-text)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Trash2 size={22} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--admin-danger-text)" }}>
                Confirm Deletion
              </h4>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--admin-danger-text)" }}>
                Are you sure you want to delete the blog &quot;{blogToDelete.title}&quot;? This cannot be undone.
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button
              onClick={() => setBlogToDelete(null)}
              className={styles.btnCancel}
              style={{ background: "var(--admin-surface)", border: "1px solid #E5E7EB", padding: "0.65rem 1.25rem" }}
            >
              Cancel
            </button>
            <button onClick={handleDelete} className={styles.btnDeleteConfirm} style={{ padding: "0.65rem 1.5rem" }}>
              Yes, Delete Blog
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
            const count = cat === "All" ? blogs.length : blogs.filter((b) => b.category === cat).length;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: "0.5rem 0.95rem",
                  borderRadius: "8px",
                  border: isActive ? "1px solid var(--admin-primary)" : "1px solid var(--admin-border)",
                  background: isActive ? "var(--admin-primary)" : "var(--admin-surface)",
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
                    background: isActive ? "rgba(255,255,255,0.2)" : "var(--admin-surface-muted)",
                    color: isActive ? "#ffffff" : "var(--admin-text-muted)",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

      </div>

      {/* FULL-WIDTH TABLE CARD */}
      <div className={styles.card} style={{ width: "100%", maxWidth: "100%" }}>
        <div
          style={{
            padding: "var(--a-space-4) var(--a-space-5)",
            borderBottom: "1px solid var(--admin-border)",
            background: "var(--admin-surface-muted)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--admin-gold-text)", margin: 0 }}>
              Published &amp; Draft Articles
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--admin-text-muted)", margin: "0.25rem 0 0" }}>
              Articles display on the customer blog in strict order of their sequence priority (#1 first).
            </p>
          </div>
          <span
            style={{
              fontSize: "0.75rem",
              background: "rgba(16, 185, 129, 0.12)",
              color: "var(--admin-success-text)",
              border: "1px solid rgba(16, 185, 129, 0.35)",
              padding: "4px 12px",
              borderRadius: "20px",
              fontWeight: 600,
            }}
          >
            Ordered by Sequence
          </span>
        </div>

        <AdminDataGrid<Blog>
          ariaLabel="Articles & Blogs"
          rowData={filteredBlogs}
          columnDefs={columnDefs}
          loading={loading}
          getRowId={(s: Blog) => String(s._id || s.id || s.slug)}
          quickFilterText={searchQuery}
          onQuickFilterChange={setSearchQuery}
          searchPlaceholder="Search articles or authors…"
          emptyTitle="No blogs found"
          emptyDescription="Click 'Add New Blog' to publish your first article."
        />
      </div>
    </div>
  );
}