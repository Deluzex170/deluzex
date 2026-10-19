"use client";
import React, { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import styles from "./newBlog.module.css";
import { createBlog } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";

export default function NewBlog() {
  const router = useRouter();
  const { user, isAuthenticated, openLoginModal } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Design Inspiration");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [coverImage, setCoverImage] = useState("/images/hero_bg_1784107713316.jpg");
  const [tags, setTags] = useState(["Chandelier", "Pendant", "Luxury"]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleChooseImage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCoverImage(url);
    }
  };

  const handleAddTag = () => {
    const newTag = window.prompt("Enter new tag name:");
    if (newTag && newTag.trim()) {
      setTags([...tags, newTag.trim()]);
    }
  };

  const handleSave = async (status: "Draft" | "Published") => {
    if (!isAuthenticated) {
      openLoginModal(undefined, "Please sign in to publish an article.");
      return;
    }

    if (!title.trim() || !content.trim()) {
      alert("Please enter a blog title and article content.");
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const authorName =
      (user as any)?.name ||
      `${(user as any)?.first_name || ""} ${(user as any)?.last_name || ""}`.trim() ||
      (user as any)?.email ||
      "Contributor";

    try {
      await createBlog({
        title: title.trim(),
        category,
        excerpt: excerpt.trim() || title.trim(),
        content: content.trim(),
        author: authorName,
        read_time: "5 min read",
        status,
        image: coverImage.startsWith("blob:") ? undefined : coverImage,
      });
      router.push("/dashboard/blogs");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to save your article. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Create New Blog</h1>
          <p className={styles.subtitle}>Write and publish inspiring articles about lighting and interior design</p>
        </div>
      </div>

      <div className={styles.breadcrumb}>
        Dashboard &gt; <Link href="/dashboard/blogs">Blogs</Link> &gt; <span>Add new blogs</span>
      </div>

      {feedback && (
        <div style={{ padding: "1rem", background: "#fef3c7", borderRadius: "8px", marginBottom: "1rem", color: "#92400e" }}>
          {feedback}
        </div>
      )}

      {/* Cover Image */}
      <div className={styles.section}>
        <div className={styles.uploadArea}>
          <div className={styles.uploadBox}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <p>Drag & Drop an image here</p>
            <span className={styles.uploadMeta}>PNG, SVG up to 2 MB</span>
            <button type="button" className={styles.btnChoose} onClick={handleChooseImage}>
              Choose Image
            </button>
          </div>
          <div className={styles.imagePreview}>
            <Image src={coverImage} alt="Preview" fill style={{ objectFit: "cover", borderRadius: "8px" }} />
          </div>
        </div>
      </div>

      {/* Blog Information */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Blog Information</h2>
        <div className={styles.formRow2}>
          <div className={styles.formGroup}>
            <label>Blog Title</label>
            <input
              type="text"
              placeholder="e.g. The Art of Modern Architectural Lighting"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option>Design Inspiration</option>
              <option>Buying Guide</option>
              <option>Lighting Tips</option>
              <option>Architectural Blogs</option>
              <option>Case Study</option>
            </select>
          </div>
        </div>
        <div className={styles.formGroup}>
          <label>Short Description</label>
          <textarea
            placeholder="A brief summary of your article..."
            rows={3}
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
          ></textarea>
        </div>
      </div>

      {/* Blog Content */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Blog Content</h2>
        <div className={styles.editor}>
          <div className={styles.editorToolbar}>
            <button type="button">Paragraph <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg></button>
            <div className={styles.divider}></div>
            <button type="button"><strong>B</strong></button>
            <button type="button"><em>I</em></button>
            <button type="button"><u>U</u></button>
            <div className={styles.divider}></div>
            <button type="button"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg></button>
            <div className={styles.divider}></div>
            <button type="button"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="21" y1="18" x2="3" y2="18"></line></svg></button>
          </div>
          <div className={styles.editorContent}>
            <textarea
              placeholder="Start writing your luxury article content here..."
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            ></textarea>
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Tags</h2>
        <div className={styles.tagsContainer}>
          {tags.map((tag, idx) => (
            <span key={idx} className={styles.tag}>
              {tag}
              <span
                onClick={() => setTags(tags.filter((_, i) => i !== idx))}
                style={{ marginLeft: "6px", cursor: "pointer", fontWeight: "bold" }}
              >
                ×
              </span>
            </span>
          ))}
          <button type="button" className={styles.btnAddTag} onClick={handleAddTag}>
            + Add Tag
          </button>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnDraft}
          disabled={isSubmitting}
          onClick={() => handleSave("Draft")}
        >
          Save Draft
        </button>
        <button
          type="button"
          className={styles.btnPublish}
          disabled={isSubmitting}
          onClick={() => handleSave("Published")}
        >
          {isSubmitting ? "Publishing..." : "Publish Blog"}
        </button>
      </div>
    </div>
  );
}
