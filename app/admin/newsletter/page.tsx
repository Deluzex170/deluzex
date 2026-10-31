"use client";

import React, { useEffect, useState, useMemo } from "react";
import styles from "./newsletter.module.css";
import AdminDataGrid from "../../components/admin/AdminDataGrid";
import type { ColDef } from "ag-grid-community";
import type { CustomCellRendererProps } from "ag-grid-react";
import {
  Mail,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Send,
  Eye,
  Sparkles,
  X,
  RefreshCw,
  AlertCircle,
  Edit3,
  Columns,
  ExternalLink,
} from "lucide-react";
import {
  fetchNewsletterSubscribers,
  updateSubscriberNotified,
  deleteNewsletterSubscriber,
  getNewsletterCsvExportUrl,
  broadcastNewsletter,
  previewNewsletterBroadcast,
  NewsletterBroadcastPayload,
  NewsletterSubscriberItem,
  NewsletterSubscribersResponse,
} from "../../services/api";

interface TemplatePreset {
  id: string;
  name: string;
  tag: string;
  subject: string;
  headline: string;
  subtitle: string;
  paragraphs: string[];
  promo_code: string;
  promo_text: string;
  cta_text: string;
  cta_url: string;
}

const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: "launch",
    name: "VIP Atelier Launch",
    tag: "Launch Announcement",
    subject: "✨ DeLuzex Atelier is Officially Live | Luxury Illuminations",
    headline: "We Are Live.",
    subtitle: "Curated Architectural Masterpieces For Discerning Spaces",
    paragraphs: [
      "We are honored to unveil the De Luzex Digital Atelier — a sanctuary where timeless Italian craft merges with state-of-the-art illumination design.",
      "From monolithic crystal pendants to bespoke chandeliers hand-finished in brushed brass and smoked bronze, each collection is engineered for private estates, penthouses, and architectural hospitality.",
      "As a founding subscriber, you enjoy privileged first-access to our newest limited-batch collections and private atelier appointments.",
    ],
    promo_code: "DELUZEXVIP",
    promo_text: "Use your private privilege code for complimentary white-glove design consultation.",
    cta_text: "Explore The Collections",
    cta_url: "https://deluzexlighting.com/collections",
  },
  {
    id: "new_arrivals",
    name: "New Masterpieces Drop",
    tag: "Collection Drop",
    subject: "🌟 Discover New Architectural Masterpieces | DeLuzex Atelier",
    headline: "New Masterpieces Unveiled.",
    subtitle: "Sculptural Brilliance & Handcrafted Luxury",
    paragraphs: [
      "We are thrilled to announce our latest drop of sculptural luminaires, meticulously crafted from aerospace-grade brass and artisan mouth-blown glass.",
      "Each piece has been curated to transform high-ceiling living rooms, luxury dining spaces, and architectural galleries into serene, luminous environments.",
      "Experience high-CRI illumination that elevates natural stone, architectural woodwork, and refined interior textures.",
    ],
    promo_code: "NEWLUMEN",
    promo_text: "Enjoy complimentary white-glove concierge delivery on your inaugural collection order.",
    cta_text: "View New Arrivals",
    cta_url: "https://deluzexlighting.com/collections",
  },
  {
    id: "festive",
    name: "Private Patron Privilege",
    tag: "Seasonal Privilege",
    subject: "🕯️ Exclusive Private Client Invitation | De Luzex Living",
    headline: "Illuminating Timeless Evenings.",
    subtitle: "An Exclusive Invitation For Our Discerning Patrons",
    paragraphs: [
      "The art of hospitality begins with intimate, warm, architectural light. As the season unfolds, elevate your residence with bespoke chandeliers and sculptural wall sconces.",
      "Our lighting design consultants are available for personalized residential consultations, luminaire scaling, and photometric planning.",
      "We invite you to discover our private reserve pieces with priority atelier access.",
    ],
    promo_code: "PRIVILEGE",
    promo_text: "Complimentary design consultation & private preview on your next luxury project.",
    cta_text: "Book Private Consultation",
    cta_url: "https://deluzexlighting.com/contact",
  },
  {
    id: "custom",
    name: "Custom Announcement",
    tag: "Custom Campaign",
    subject: "De Luzex Lighting Update",
    headline: "Lighting The Extraordinary.",
    subtitle: "An exclusive update from the DeLuzex Atelier team",
    paragraphs: [
      "We are pleased to share our newest architectural updates, design inspirations, and luxury lighting collections with you.",
      "Discover the art of bespoke illumination crafted to transform modern luxury living spaces.",
    ],
    promo_code: "",
    promo_text: "",
    cta_text: "Visit DeLuzex Atelier",
    cta_url: "https://deluzexlighting.com",
  },
];

export default function AdminNewsletterPage() {
  const [data, setData] = useState<NewsletterSubscribersResponse>({
    total: 0,
    pending: 0,
    notified: 0,
    subscribers: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Campaign Broadcast Modal State
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [viewMode, setViewMode] = useState<"split" | "edit" | "preview">("split");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("launch");
  const [subject, setSubject] = useState(TEMPLATE_PRESETS[0].subject);
  const [headline, setHeadline] = useState(TEMPLATE_PRESETS[0].headline);
  const [subtitle, setSubtitle] = useState(TEMPLATE_PRESETS[0].subtitle);
  const [paragraphsText, setParagraphsText] = useState(
    TEMPLATE_PRESETS[0].paragraphs.join("\n\n")
  );
  const [promoCode, setPromoCode] = useState(TEMPLATE_PRESETS[0].promo_code);
  const [promoText, setPromoText] = useState(TEMPLATE_PRESETS[0].promo_text);
  const [ctaText, setCtaText] = useState(TEMPLATE_PRESETS[0].cta_text);
  const [ctaUrl, setCtaUrl] = useState(TEMPLATE_PRESETS[0].cta_url);
  const [audience, setAudience] = useState<"all" | "pending" | "notified">("all");
  const [testEmail, setTestEmail] = useState("info@deluzexlighting.com");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Responsive mode check
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== "undefined") {
        if (window.innerWidth < 1080) {
          setViewMode((prev) => (prev === "split" ? "edit" : prev));
        }
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const notifiedFilter =
        activeTab === "notified" ? true : activeTab === "pending" ? false : undefined;

      const res = await fetchNewsletterSubscribers({
        notified: notifiedFilter,
        search: searchQuery || undefined,
        limit: 200,
      });
      setData(res);
    } catch (err) {
      console.error("Failed to load subscribers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleToggleNotified = async (subscriberId: string, currentStatus: boolean) => {
    setIsUpdating(subscriberId);
    try {
      const newStatus = !currentStatus;
      const res = await updateSubscriberNotified(subscriberId, newStatus);
      if (res && res.subscriber) {
        setData((prev) => ({
          ...prev,
          pending: newStatus ? Math.max(0, prev.pending - 1) : prev.pending + 1,
          notified: newStatus ? prev.notified + 1 : Math.max(0, prev.notified - 1),
          subscribers: prev.subscribers.map((s) =>
            s.id === subscriberId || s._id === subscriberId ? res.subscriber! : s
          ),
        }));
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleDeleteSubscriber = async (subscriberId: string) => {
    try {
      const res = await deleteNewsletterSubscriber(subscriberId);
      if (res) {
        const item = data.subscribers.find(
          (s) => s.id === subscriberId || s._id === subscriberId
        );
        setData((prev) => ({
          ...prev,
          total: Math.max(0, prev.total - 1),
          pending: item && !item.is_notified ? Math.max(0, prev.pending - 1) : prev.pending,
          notified: item && item.is_notified ? Math.max(0, prev.notified - 1) : prev.notified,
          subscribers: prev.subscribers.filter(
            (s) => s.id !== subscriberId && s._id !== subscriberId
          ),
        }));
        setDeleteConfirmId(null);
      }
    } catch (err) {
      console.error("Failed to delete subscriber:", err);
    }
  };

  // Helper to compile payload
  const buildPayload = (overrides?: Partial<NewsletterBroadcastPayload>): NewsletterBroadcastPayload => ({
    subject: subject.trim() || "De Luzex Lighting Update",
    headline: headline.trim() || "The Atelier is Live.",
    subtitle: subtitle.trim() || undefined,
    paragraphs: paragraphsText
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean),
    promo_code: promoCode.trim() || undefined,
    promo_text: promoText.trim() || undefined,
    cta_text: ctaText.trim() || "Explore DeLuzex",
    cta_url: ctaUrl.trim() || "https://deluzexlighting.com",
    audience,
    ...overrides,
  });

  // Load preview from backend
  const loadPreview = async (customPayload?: NewsletterBroadcastPayload) => {
    setIsLoadingPreview(true);
    try {
      const payload = customPayload || buildPayload();
      const res = await previewNewsletterBroadcast(payload);
      setPreviewHtml(res.html);
    } catch (err: any) {
      console.error("Failed to generate preview:", err);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleOpenCampaignModal = () => {
    setShowCampaignModal(true);
    setStatusMessage(null);
    if (!testEmail) {
      setTestEmail("info@deluzexlighting.com");
    }
    if (typeof window !== "undefined" && window.innerWidth < 1080) {
      setViewMode("edit");
    } else {
      setViewMode("split");
    }
    if (!previewHtml) {
      loadPreview();
    }
  };

  const handleSelectPreset = (preset: TemplatePreset) => {
    setSelectedTemplateId(preset.id);
    setSubject(preset.subject);
    setHeadline(preset.headline);
    setSubtitle(preset.subtitle);
    setParagraphsText(preset.paragraphs.join("\n\n"));
    setPromoCode(preset.promo_code);
    setPromoText(preset.promo_text);
    setCtaText(preset.cta_text);
    setCtaUrl(preset.cta_url);

    loadPreview({
      subject: preset.subject,
      headline: preset.headline,
      subtitle: preset.subtitle,
      paragraphs: preset.paragraphs,
      promo_code: preset.promo_code || undefined,
      promo_text: preset.promo_text || undefined,
      cta_text: preset.cta_text,
      cta_url: preset.cta_url,
      audience,
    });
  };

  const targetRecipientCount =
    audience === "all" ? data.total : audience === "pending" ? data.pending : data.notified;

  const handleSendTest = async () => {
    const target = (testEmail.trim() || "info@deluzexlighting.com").toLowerCase();
    if (!target.includes("@")) {
      setStatusMessage({
        type: "error",
        text: "Please enter a valid test recipient email address (e.g. info@deluzexlighting.com).",
      });
      return;
    }
    setIsSendingTest(true);
    setStatusMessage(null);
    try {
      const payload = buildPayload({ test_email: target });
      const res = await broadcastNewsletter(payload);
      if (res.success) {
        setStatusMessage({
          type: "success",
          text: `✓ Live test email successfully dispatched to ${target} via GoDaddy SMTP!`,
        });
      } else {
        setStatusMessage({
          type: "error",
          text: res.message || "Failed to dispatch test email.",
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Error sending test email. Please check SMTP connection.",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (targetRecipientCount === 0) {
      setStatusMessage({
        type: "error",
        text: `No subscribers match audience "${audience}". (0 recipients)`,
      });
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to broadcast this email campaign to ${targetRecipientCount} subscriber(s)?`
    );
    if (!confirmed) return;

    setIsSendingBroadcast(true);
    setStatusMessage(null);
    try {
      const payload = buildPayload();
      const res = await broadcastNewsletter(payload);
      if (res.success) {
        setStatusMessage({
          type: "success",
          text: `Campaign broadcast started! ${res.sent_count ?? targetRecipientCount} subscriber(s) are being notified.`,
        });
        loadData();
      } else {
        setStatusMessage({ type: "error", text: res.message || "Broadcast failed." });
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Error broadcasting campaign." });
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  const columnDefs = useMemo<ColDef<NewsletterSubscriberItem>[]>(() => [
    {
      headerName: "Subscriber Email",
      colId: "email",
      flex: 1.5,
      minWidth: 200,
      valueGetter: (p) => p.data?.email || "",
      cellRenderer: (p: CustomCellRendererProps<NewsletterSubscriberItem>) => {
        const email = p.value || "";
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Mail size={13} style={{ color: "var(--admin-gold-text)", flexShrink: 0 }} />
            <a
              href={`mailto:${email}`}
              style={{
                color: "var(--admin-text-main)",
                textDecoration: "none",
                fontWeight: 500,
              }}
              title={email}
            >
              {email}
            </a>
          </div>
        );
      },
    },
    {
      headerName: "Source",
      colId: "source",
      width: 140,
      minWidth: 120,
      valueGetter: (p) => p.data?.source || "storefront",
      cellRenderer: (p: CustomCellRendererProps<NewsletterSubscriberItem>) => (
        <span className={styles.sourceBadge}>{p.value}</span>
      ),
    },
    {
      headerName: "Subscribed Date",
      colId: "subscribed_at",
      width: 140,
      minWidth: 130,
      valueGetter: (p) => p.data?.subscribed_at || "",
      cellRenderer: (p: CustomCellRendererProps<NewsletterSubscriberItem>) => {
        if (!p.value) return "—";
        try {
          return new Date(p.value).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
        } catch {
          return p.value;
        }
      },
    },
    {
      headerName: "Status",
      colId: "status",
      width: 120,
      minWidth: 110,
      valueGetter: (p) => (p.data?.is_notified ? "Notified" : "Pending"),
      cellRenderer: (p: CustomCellRendererProps<NewsletterSubscriberItem>) => {
        const isNotified = Boolean(p.data?.is_notified);
        return (
          <span
            className={`${styles.statusBadge} ${
              isNotified ? styles.statusNotified : styles.statusPending
            }`}
          >
            {isNotified ? "Notified" : "Pending"}
          </span>
        );
      },
    },
    {
      headerName: "Notified Date",
      colId: "notified_at",
      width: 140,
      minWidth: 130,
      valueGetter: (p) => p.data?.notified_at || "",
      cellRenderer: (p: CustomCellRendererProps<NewsletterSubscriberItem>) => {
        if (!p.value) return "—";
        try {
          return new Date(p.value).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
        } catch {
          return p.value;
        }
      },
    },
    {
      headerName: "Actions",
      colId: "actions",
      width: 140,
      minWidth: 130,
      pinned: "right",
      sortable: false,
      filter: false,
      resizable: false,
      cellRenderer: (p: CustomCellRendererProps<NewsletterSubscriberItem>) => {
        const item = p.data;
        if (!item) return null;
        const id = item.id || item._id || "";
        const isNotified = Boolean(item.is_notified);
        const updating = isUpdating === id;

        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              justifyContent: "flex-end",
              height: "100%",
            }}
          >
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => handleToggleNotified(id, isNotified)}
              disabled={updating}
              title={isNotified ? "Mark as Pending" : "Mark as Notified"}
              style={{
                height: "28px",
                padding: "0 8px",
                fontSize: "11px",
                borderRadius: "6px",
                border: "1px solid var(--admin-border)",
                background: "var(--admin-surface)",
                color: isNotified ? "var(--admin-success-text)" : "#f59e0b",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                cursor: "pointer",
              }}
            >
              {isNotified ? <RotateCcw size={11} /> : <CheckCircle2 size={11} />}
              {isNotified ? "Unmark" : "Notify"}
            </button>
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={() => setDeleteConfirmId(id)}
              title="Delete subscriber"
              style={{
                height: "28px",
                width: "28px",
                borderRadius: "6px",
                border: "1px solid var(--admin-border)",
                background: "var(--admin-surface)",
                color: "var(--admin-danger-text)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        );
      },
    },
  ], [isUpdating]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Newsletter Subscribers</h1>
          <p className={styles.subtitle}>
            Manage emails collected from storefront visitor registrations.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.broadcastBtn}
            onClick={handleOpenCampaignModal}
          >
            <Send size={14} /> Send Newsletter Campaign
          </button>
          <a
            href={getNewsletterCsvExportUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.exportBtn}
          >
            Export CSV
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Audience</span>
          <span className={styles.kpiValue}>{data.total}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Pending Notice</span>
          <span className={styles.kpiValue} style={{ color: "#D79322" }}>
            {data.pending}
          </span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Notified</span>
          <span className={styles.kpiValue} style={{ color: "var(--admin-success-text)" }}>
            {data.notified}
          </span>
        </div>
      </div>

      {/* Grid */}
      <AdminDataGrid<NewsletterSubscriberItem>
        ariaLabel="Newsletter subscribers"
        rowData={data.subscribers}
        columnDefs={columnDefs}
        loading={loading}
        getRowId={(s) => String(s.id || s._id || s.email)}
        quickFilterText={searchQuery}
        onQuickFilterChange={setSearchQuery}
        searchPlaceholder="Search email or source…"
        emptyTitle="No subscribers found"
        emptyDescription="There are no email subscribers matching the current filter or search query."
        toolbar={
          <>
            <div className={styles.tabsRow}>
              <button
                className={`${styles.tabBtn} ${activeTab === "all" ? styles.activeTab : ""}`}
                onClick={() => setActiveTab("all")}
              >
                All <span className={styles.tabBadge}>{data.total}</span>
              </button>
              <button
                className={`${styles.tabBtn} ${activeTab === "pending" ? styles.activeTab : ""}`}
                onClick={() => setActiveTab("pending")}
              >
                Pending <span className={styles.tabBadge}>{data.pending}</span>
              </button>
              <button
                className={`${styles.tabBtn} ${activeTab === "notified" ? styles.activeTab : ""}`}
                onClick={() => setActiveTab("notified")}
              >
                Notified <span className={styles.tabBadge}>{data.notified}</span>
              </button>
            </div>
          </>
        }
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalBox}>
            <h3 className={styles.modalTitle}>Confirm Subscriber Deletion</h3>
            <p className={styles.modalText}>
              Are you sure you want to remove this subscriber from the newsletter database? This cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmDeleteBtn}
                onClick={() => handleDeleteSubscriber(deleteConfirmId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Broadcast Studio Modal */}
      {showCampaignModal && (
        <div className={styles.campaignModalOverlay}>
          <div className={styles.campaignModal}>
            {/* Modal Header with Title, Mode Switcher, and Close */}
            <div className={styles.campaignModalHeader}>
              <div className={styles.campaignModalTitleArea}>
                <div className={styles.modalIconBadge}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <h2>Broadcast Newsletter Campaign</h2>
                  <p>
                    Curate luxury announcements, live-preview styling, and dispatch with 1 click.
                  </p>
                </div>
              </div>

              {/* View Mode Segmented Controls */}
              <div className={styles.viewModeTabs}>
                <button
                  type="button"
                  className={`${styles.viewModeTab} ${
                    viewMode === "edit" ? styles.viewModeTabActive : ""
                  }`}
                  onClick={() => setViewMode("edit")}
                  title="Compose and edit email content"
                >
                  <Edit3 size={13} />
                  <span>Compose</span>
                </button>
                <button
                  type="button"
                  className={`${styles.viewModeTab} ${
                    viewMode === "preview" ? styles.viewModeTabActive : ""
                  }`}
                  onClick={() => {
                    setViewMode("preview");
                    loadPreview();
                  }}
                  title="Live recipient email rendering"
                >
                  <Eye size={13} />
                  <span>Live Preview</span>
                </button>
                <button
                  type="button"
                  className={`${styles.viewModeTab} ${
                    viewMode === "split" ? styles.viewModeTabActive : ""
                  }`}
                  onClick={() => {
                    setViewMode("split");
                    loadPreview();
                  }}
                  title="Side-by-side editor and live preview"
                >
                  <Columns size={13} />
                  <span>Split View</span>
                </button>
              </div>

              <button
                type="button"
                className={styles.closeModalBtn}
                onClick={() => setShowCampaignModal(false)}
                title="Close Studio"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body: Split or Single View */}
            <div
              className={`${styles.campaignModalBody} ${
                viewMode === "split"
                  ? styles.campaignModalBodySplit
                  : styles.campaignModalBodySingle
              }`}
            >
              {/* Form Pane (Rendered if viewMode is 'split' or 'edit') */}
              {(viewMode === "split" || viewMode === "edit") && (
                <div className={styles.campaignFormPane}>
                  {statusMessage && (
                    <div
                      style={{
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        fontSize: "0.85rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        background:
                          statusMessage.type === "success"
                            ? "rgba(16, 185, 129, 0.15)"
                            : "rgba(239, 68, 68, 0.15)",
                        border: `1px solid ${
                          statusMessage.type === "success" ? "#10b981" : "#ef4444"
                        }`,
                        color:
                          statusMessage.type === "success"
                            ? "var(--admin-success-text)"
                            : "var(--admin-danger-text)",
                      }}
                    >
                      {statusMessage.type === "success" ? (
                        <CheckCircle2 size={16} />
                      ) : (
                        <AlertCircle size={16} />
                      )}
                      <span>{statusMessage.text}</span>
                    </div>
                  )}

                  {/* Template Presets Selector */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Select Email Template</label>
                    <div className={styles.templateSelectGrid}>
                      {TEMPLATE_PRESETS.map((preset) => {
                        const isActive = selectedTemplateId === preset.id;
                        return (
                          <div
                            key={preset.id}
                            className={`${styles.templateCard} ${
                              isActive ? styles.templateCardActive : ""
                            }`}
                            onClick={() => handleSelectPreset(preset)}
                          >
                            <span className={styles.templateTag}>{preset.tag}</span>
                            <div className={styles.templateName}>{preset.name}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Audience Selection */}
                  <div className={styles.fieldGroup}>
                    <div className={styles.fieldLabel}>
                      <span>Target Audience</span>
                      <span style={{ color: "var(--admin-gold-text)", fontWeight: 700 }}>
                        {targetRecipientCount} Subscriber{targetRecipientCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <select
                      className={styles.fieldSelect}
                      value={audience}
                      onChange={(e) => setAudience(e.target.value as any)}
                    >
                      <option value="all">All Subscribers ({data.total})</option>
                      <option value="pending">Pending Notice Only ({data.pending})</option>
                      <option value="notified">Already Notified ({data.notified})</option>
                    </select>
                  </div>

                  {/* Subject Line */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Email Subject Line</label>
                    <input
                      type="text"
                      className={styles.fieldInput}
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. ✨ DeLuzex Atelier is Officially Live | Luxury Illuminations"
                    />
                  </div>

                  {/* Headline & Subtitle */}
                  <div className={styles.fieldRow}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Main Headline</label>
                      <input
                        type="text"
                        className={styles.fieldInput}
                        value={headline}
                        onChange={(e) => setHeadline(e.target.value)}
                        placeholder="e.g. We Are Live."
                      />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Subtitle</label>
                      <input
                        type="text"
                        className={styles.fieldInput}
                        value={subtitle}
                        onChange={(e) => setSubtitle(e.target.value)}
                        placeholder="e.g. Curated Architectural Masterpieces"
                      />
                    </div>
                  </div>

                  {/* Paragraphs */}
                  <div className={styles.fieldGroup}>
                    <div className={styles.fieldLabel}>
                      <span>Body Copy Paragraphs</span>
                      <span style={{ fontSize: "0.72rem", color: "#888" }}>
                        Separate paragraphs with blank lines
                      </span>
                    </div>
                    <textarea
                      rows={4}
                      className={styles.fieldTextarea}
                      value={paragraphsText}
                      onChange={(e) => setParagraphsText(e.target.value)}
                      placeholder="Write your email body copy..."
                    />
                  </div>

                  {/* Promo Code & Promo Text */}
                  <div className={styles.fieldRow}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Privilege / Promo Code (Optional)</label>
                      <input
                        type="text"
                        className={styles.fieldInput}
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        placeholder="e.g. DELUZEXVIP"
                      />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Promo Description (Optional)</label>
                      <input
                        type="text"
                        className={styles.fieldInput}
                        value={promoText}
                        onChange={(e) => setPromoText(e.target.value)}
                        placeholder="e.g. Complimentary consultation on your order"
                      />
                    </div>
                  </div>

                  {/* CTA Button Text & Target URL */}
                  <div className={styles.fieldRow}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>CTA Button Label</label>
                      <input
                        type="text"
                        className={styles.fieldInput}
                        value={ctaText}
                        onChange={(e) => setCtaText(e.target.value)}
                        placeholder="e.g. Explore The Collections"
                      />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>CTA Destination URL</label>
                      <input
                        type="text"
                        className={styles.fieldInput}
                        value={ctaUrl}
                        onChange={(e) => setCtaUrl(e.target.value)}
                        placeholder="https://deluzexlighting.com/..."
                      />
                    </div>
                  </div>

                  {/* Quick Test Email & Preview Toolbar inside Form */}
                  <div
                    style={{
                      background: "rgba(196, 154, 69, 0.08)",
                      border: "1px solid rgba(196, 154, 69, 0.22)",
                      borderRadius: "10px",
                      padding: "0.85rem 1rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.6rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          color: "var(--admin-gold-text)",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <Mail size={14} /> Send a Live Test Email
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "var(--admin-text-muted)" }}>
                        Verify in your inbox before full dispatch
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <input
                        type="email"
                        className={styles.testEmailInput}
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        placeholder="info@deluzexlighting.com"
                      />
                      <button
                        type="button"
                        className={styles.testEmailBtn}
                        onClick={handleSendTest}
                        disabled={isSendingTest}
                      >
                        {isSendingTest ? (
                          <>
                            <RefreshCw size={12} className="animate-spin" /> Dispatching...
                          </>
                        ) : (
                          <>
                            <Send size={12} /> Send Test Email
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Action buttons at form bottom */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingTop: "0.25rem",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => loadPreview()}
                      disabled={isLoadingPreview}
                      style={{
                        background: "var(--admin-surface)",
                        border: "1px solid var(--admin-border)",
                        color: "var(--admin-text-secondary)",
                        padding: "0.5rem 0.95rem",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                      }}
                    >
                      <RefreshCw size={13} className={isLoadingPreview ? "animate-spin" : ""} />
                      {isLoadingPreview ? "Rendering..." : "Refresh Preview"}
                    </button>

                    {viewMode === "edit" && (
                      <button
                        type="button"
                        onClick={() => {
                          loadPreview();
                          setViewMode("preview");
                        }}
                        style={{
                          background: "var(--admin-primary-glow)",
                          border: "1px solid var(--admin-border-gold)",
                          color: "var(--admin-gold-text)",
                          padding: "0.5rem 1.1rem",
                          borderRadius: "6px",
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.4rem",
                        }}
                      >
                        <Eye size={13} />
                        <span>View Live Preview →</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Preview Pane (Rendered if viewMode is 'split' or 'preview') */}
              {(viewMode === "split" || viewMode === "preview") && (
                <div className={styles.campaignPreviewPane}>
                  {/* Top Preview Bar */}
                  <div className={styles.previewHeader}>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <Eye size={14} /> Live Email Preview
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--admin-text-muted)" }}>
                        {isLoadingPreview ? "Rendering updates..." : "Actual recipient rendering"}
                      </span>
                      <button
                        type="button"
                        onClick={() => loadPreview()}
                        disabled={isLoadingPreview}
                        title="Reload live preview"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--admin-gold-text)",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                      >
                        <RefreshCw size={13} className={isLoadingPreview ? "animate-spin" : ""} />
                      </button>
                    </div>
                  </div>

                  {/* Inline Test Email Bar in Preview Header */}
                  <div className={styles.testEmailBar}>
                    <span className={styles.testEmailLabel}>
                      <Mail size={13} style={{ color: "var(--admin-gold-text)" }} />
                      <span>Send Live Test:</span>
                    </span>
                    <input
                      type="email"
                      className={styles.testEmailInput}
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="info@deluzexlighting.com"
                    />
                    <button
                      type="button"
                      className={styles.testEmailBtn}
                      onClick={handleSendTest}
                      disabled={isSendingTest}
                    >
                      {isSendingTest ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" /> Dispatching...
                        </>
                      ) : (
                        <>
                          <Send size={12} /> Send Test Email
                        </>
                      )}
                    </button>
                  </div>

                  {/* Iframe View */}
                  {previewHtml ? (
                    <iframe
                      className={styles.previewFrame}
                      title="Newsletter Preview"
                      srcDoc={previewHtml}
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        color: "var(--admin-text-muted)",
                        fontSize: "0.85rem",
                      }}
                    >
                      Loading luxury preview...
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className={styles.campaignModalFooter}>
              {/* Audience Pill (positioned safely away from Next.js N badge) */}
              <div className={styles.footerAudienceBadge}>
                <span className={styles.footerAudiencePulse} />
                <span>
                  Target: <strong>{targetRecipientCount} Subscriber{targetRecipientCount !== 1 ? "s" : ""}</strong>{" "}
                  ({audience === "all" ? "All" : audience === "pending" ? "Pending Only" : "Notified"})
                </span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                <button
                  type="button"
                  className={styles.cancelModalBtn}
                  onClick={() => setShowCampaignModal(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className={styles.sendBroadcastBtn}
                  onClick={handleSendBroadcast}
                  disabled={isSendingBroadcast || targetRecipientCount === 0}
                >
                  <Send size={15} />
                  {isSendingBroadcast
                    ? "Broadcasting Campaign..."
                    : `Broadcast to ${targetRecipientCount} Subscriber${
                        targetRecipientCount !== 1 ? "s" : ""
                      }`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
