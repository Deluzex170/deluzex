"use client";

import React, { useEffect, useState } from "react";
import styles from "../admin.module.css";
import {
  fetchFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
  seedDefaultFaqs,
  FAQItem,
} from "../../services/api";
import {
  HelpCircle,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  CheckCircle2,
  X,
  Layers,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";

export default function AdminFaqsPage() {
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<FAQItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  const [formState, setFormState] = useState({
    question: "",
    answer: "",
    category: "collaborate",
    sequence: 1,
    is_active: true,
  });

  const loadFaqs = async () => {
    setLoading(true);
    try {
      const data = await fetchFaqs(categoryFilter !== "all" ? categoryFilter : undefined, true);
      setFaqs(data);
    } catch (err) {
      console.error("Failed to load FAQs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFaqs();
  }, [categoryFilter]);

  const openCreateModal = () => {
    setEditingFaq(null);
    setFormState({
      question: "",
      answer: "",
      category: categoryFilter !== "all" ? categoryFilter : "collaborate",
      sequence: faqs.length + 1,
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: FAQItem) => {
    setEditingFaq(item);
    setFormState({
      question: item.question,
      answer: item.answer,
      category: item.category || "collaborate",
      sequence: item.sequence || 1,
      is_active: item.is_active !== false,
    });
    setIsModalOpen(true);
  };

  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingFaq) {
        const id = editingFaq._id || String(editingFaq.id);
        const updated = await updateFaq(id, formState);
        setFaqs((prev) => prev.map((f) => (f._id === id || f.id === id ? updated : f)));
        setToastMsg("FAQ updated successfully");
      } else {
        const created = await createFaq(formState);
        setFaqs((prev) => [...prev, created]);
        setToastMsg("New FAQ created successfully");
      }
      setIsModalOpen(false);
      setTimeout(() => setToastMsg(""), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to save FAQ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (item: FAQItem) => {
    const id = item._id || String(item.id);
    const newStatus = !item.is_active;
    try {
      await updateFaq(id, { is_active: newStatus });
      setFaqs((prev) =>
        prev.map((f) => (f._id === id || f.id === id ? { ...f, is_active: newStatus } : f))
      );
      setToastMsg(`FAQ ${newStatus ? "activated" : "deactivated"}`);
      setTimeout(() => setToastMsg(""), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to update FAQ status");
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    const id = itemToDelete._id || String(itemToDelete.id);
    try {
      await deleteFaq(id);
      setFaqs((prev) => prev.filter((f) => f._id !== id && f.id !== id));
      setItemToDelete(null);
      setToastMsg("FAQ deleted successfully");
      setTimeout(() => setToastMsg(""), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to delete FAQ");
    }
  };

  const handleSeedDefaults = async () => {
    if (confirm("Do you want to verify and seed default Deluzex FAQs into MongoDB?")) {
      setLoading(true);
      try {
        await seedDefaultFaqs();
        await loadFaqs();
        setToastMsg("Default FAQs seeded successfully");
        setTimeout(() => setToastMsg(""), 3000);
      } catch (err: any) {
        alert(err.message || "Failed to seed default FAQs");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: "100%", margin: 0, padding: 0 }}>
      {/* Toast Notification */}
      {toastMsg && (
        <div
          style={{
            position: "fixed",
            bottom: "2rem",
            right: "2rem",
            maxWidth: "calc(100vw - 4rem)",
            background: "#0f172a",
            color: "#ffffff",
            padding: "0.85rem 1.4rem",
            borderRadius: "10px",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            border: "1px solid #C49A45",
          }}
        >
          <CheckCircle2 size={18} color="#C49A45" />
          <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.75rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <HelpCircle color="#C49A45" size={26} />
            Frequently Asked Questions (FAQ) Manager
          </h1>
          <p style={{ color: "#64748b", margin: "0.25rem 0 0 0", fontSize: "0.92rem" }}>
            Manage questions, answers, and ordering across the Collaborate and Customer Support pages.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={handleSeedDefaults}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "0.6rem 1rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#334155",
              cursor: "pointer",
            }}
          >
            <Sparkles size={15} color="#C49A45" />
            Seed Default FAQs
          </button>
          <button
            onClick={openCreateModal}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "#0f172a",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "0.6rem 1.25rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Plus size={16} />
            Add New Question
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {[
          { label: "All FAQs", value: "all" },
          { label: "Collaborate Page", value: "collaborate" },
          { label: "Customer Support", value: "support" },
          { label: "General", value: "general" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setCategoryFilter(tab.value)}
            style={{
              background: categoryFilter === tab.value ? "#0f172a" : "#ffffff",
              color: categoryFilter === tab.value ? "#ffffff" : "#64748b",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "0.5rem 1.1rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* FAQs Table */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
            <p>Loading FAQs...</p>
          </div>
        ) : faqs.length === 0 ? (
          <div style={{ padding: "3.5rem", textAlign: "center", color: "#64748b" }}>
            <HelpCircle size={40} color="#cbd5e1" style={{ margin: "0 auto 1rem auto" }} />
            <h3 style={{ fontSize: "1.1rem", color: "#334155", margin: "0 0 0.5rem 0" }}>No FAQs found</h3>
            <p style={{ fontSize: "0.88rem", maxWidth: "400px", margin: "0 auto 1.5rem auto" }}>
              Click "Seed Default FAQs" or "Add New Question" to add entries for your visitors.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", minWidth: "850px", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontWeight: 600 }}>
                  <th style={{ padding: "0.85rem 1rem", width: "70px" }}>Seq</th>
                  <th style={{ padding: "0.85rem 1.25rem" }}>Question &amp; Answer</th>
                  <th style={{ padding: "0.85rem 1rem", width: "130px" }}>Category</th>
                  <th style={{ padding: "0.85rem 1rem", width: "110px" }}>Status</th>
                  <th style={{ padding: "0.85rem 1.25rem", width: "130px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {faqs.map((faq, index) => {
                  const faqId = faq._id || String(faq.id || index);
                  return (
                    <tr
                      key={faqId}
                      style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "#64748b" }}>
                        #{faq.sequence || index + 1}
                      </td>
                      <td style={{ padding: "0.85rem 1.25rem" }}>
                        <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: "0.25rem" }}>
                          {faq.question}
                        </div>
                        <div style={{ color: "#64748b", fontSize: "0.82rem", lineHeight: "1.5", maxWidth: "680px" }}>
                          {faq.answer}
                        </div>
                      </td>
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <span
                          style={{
                            fontSize: "0.74rem",
                            fontWeight: 600,
                            padding: "0.25rem 0.6rem",
                            borderRadius: "5px",
                            textTransform: "capitalize",
                            background: faq.category === "collaborate" ? "rgba(196, 154, 69, 0.12)" : "#f1f5f9",
                            color: faq.category === "collaborate" ? "#9a762e" : "#475569",
                          }}
                        >
                          {faq.category || "collaborate"}
                        </span>
                      </td>
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <button
                          onClick={() => handleToggleActive(faq)}
                          style={{
                            background: faq.is_active ? "rgba(16, 185, 129, 0.1)" : "rgba(100, 116, 139, 0.1)",
                            color: faq.is_active ? "#10b981" : "#64748b",
                            border: "none",
                            borderRadius: "6px",
                            padding: "0.3rem 0.65rem",
                            fontSize: "0.76rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                          }}
                        >
                          {faq.is_active ? <Eye size={13} /> : <EyeOff size={13} />}
                          {faq.is_active ? "Active" : "Hidden"}
                        </button>
                      </td>
                      <td style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                          <button
                            title="Edit FAQ"
                            onClick={() => openEditModal(faq)}
                            style={{
                              background: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              borderRadius: "6px",
                              padding: "0.4rem",
                              color: "#334155",
                              cursor: "pointer",
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            title="Delete FAQ"
                            onClick={() => setItemToDelete(faq)}
                            style={{
                              background: "#fef2f2",
                              border: "1px solid #fecaca",
                              borderRadius: "6px",
                              padding: "0.4rem",
                              color: "#ef4444",
                              cursor: "pointer",
                            }}
                          >
                            <Trash2 size={14} />
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

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              maxWidth: "580px",
              width: "100%",
              maxHeight: "calc(100dvh - 2rem)",
              overflowY: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              padding: "clamp(1.25rem, 4vw, 2rem)",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsModalOpen(false)}
              style={{
                position: "absolute",
                top: "1.25rem",
                right: "1.25rem",
                background: "#f1f5f9",
                border: "none",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={16} />
            </button>

            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a", margin: "0 0 1.25rem 0" }}>
              {editingFaq ? "Edit FAQ" : "Add New FAQ"}
            </h2>

            <form onSubmit={handleSaveFaq}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "0.4rem" }}>
                  Question *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. How are royalties calculated?"
                  value={formState.question}
                  onChange={(e) => setFormState({ ...formState, question: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.65rem 0.85rem",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    fontSize: "0.9rem",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "0.4rem" }}>
                  Answer *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide a clear, detailed answer..."
                  value={formState.answer}
                  onChange={(e) => setFormState({ ...formState, answer: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.65rem 0.85rem",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    fontSize: "0.9rem",
                    outline: "none",
                    lineHeight: "1.5",
                  }}
                />
              </div>

              <div className={styles.formGrid2} style={{ display: "grid", gap: "1rem", marginBottom: "1.25rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "0.4rem" }}>
                    Category
                  </label>
                  <select
                    value={formState.category}
                    onChange={(e) => setFormState({ ...formState, category: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "0.65rem 0.85rem",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      fontSize: "0.9rem",
                      outline: "none",
                      background: "#ffffff",
                    }}
                  >
                    <option value="collaborate">Collaborate Page</option>
                    <option value="support">Customer Support</option>
                    <option value="general">General</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "0.4rem" }}>
                    Display Sequence
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formState.sequence}
                    onChange={(e) => setFormState({ ...formState, sequence: parseInt(e.target.value, 10) || 1 })}
                    style={{
                      width: "100%",
                      padding: "0.65rem 0.85rem",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      fontSize: "0.9rem",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.88rem", color: "#334155" }}>
                  <input
                    type="checkbox"
                    checked={formState.is_active}
                    onChange={(e) => setFormState({ ...formState, is_active: e.target.checked })}
                  />
                  <span>Active &amp; Visible to Visitors</span>
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    background: "#f1f5f9",
                    border: "none",
                    borderRadius: "8px",
                    padding: "0.65rem 1.25rem",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    background: "#0f172a",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "0.65rem 1.4rem",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {submitting ? "Saving..." : editingFaq ? "Update FAQ" : "Create FAQ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {itemToDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setItemToDelete(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              maxWidth: "420px",
              width: "100%",
              padding: "1.75rem",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "#fef2f2",
                color: "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1rem auto",
              }}
            >
              <Trash2 size={24} />
            </div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.5rem 0" }}>
              Delete FAQ?
            </h3>
            <p style={{ fontSize: "0.88rem", color: "#64748b", margin: "0 0 1.5rem 0" }}>
              Are you sure you want to delete this FAQ: &quot;{itemToDelete.question}&quot;?
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                onClick={() => setItemToDelete(null)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "8px",
                  padding: "0.6rem 1.25rem",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                style={{
                  background: "#ef4444",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "0.6rem 1.25rem",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
