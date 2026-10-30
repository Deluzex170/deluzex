"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import type { ColDef } from "ag-grid-community";
import type { CustomCellRendererProps } from "ag-grid-react";
import styles from "./coupons.module.css";
import AdminDataGrid from "../../components/admin/AdminDataGrid";
import {
  ActionButtonsRenderer,
  CurrencyRenderer,
  StackedCell,
  StatusBadge,
  dateComparator,
  type ActionButtonsParams,
} from "../../components/admin/gridRenderers";
import {
  fetchAdminCoupons,
  createAdminCoupon,
  updateAdminCoupon,
  toggleAdminCoupon,
  deleteAdminCoupon,
  AdminCoupon,
  CouponCreateInput,
} from "../../services/api";

const PRESET_TEMPLATES: {
  label: string;
  template: Partial<CouponCreateInput>;
}[] = [
  {
    label: "✨ Launch 10% Off (Max ₹1,000, Min ₹1,999)",
    template: {
      code: "DELUZEX10",
      title: "10% Off Architectural Fixtures",
      description: "Launch celebration discount up to ₹1,000 on orders over ₹1,999",
      discount_type: "percentage",
      discount_value: 10,
      max_discount_cap: 1000,
      min_order_value: 1999,
      is_active: true,
      is_public: true,
      max_uses_per_user: 1,
    },
  },
  {
    label: "👑 VIP Flat ₹500 Off (Min ₹2,999)",
    template: {
      code: "DELUZEXVIP",
      title: "VIP Exclusive ₹500 Off",
      description: "Instant ₹500 luxury reward on orders above ₹2,999",
      discount_type: "flat",
      discount_value: 500,
      max_discount_cap: null,
      min_order_value: 2999,
      is_active: true,
      is_public: true,
      max_uses_per_user: 1,
    },
  },
  {
    label: "🚚 Free White-Glove Shipping (Min ₹999)",
    template: {
      code: "FREEDELUXE",
      title: "Complimentary Insured Delivery",
      description: "Free insured white-glove shipping on orders above ₹999",
      discount_type: "free_shipping",
      discount_value: 0,
      max_discount_cap: null,
      min_order_value: 999,
      is_active: true,
      is_public: true,
      max_uses_per_user: 3,
    },
  },
];

const INITIAL_FORM: CouponCreateInput = {
  code: "",
  title: "",
  description: "",
  discount_type: "percentage",
  discount_value: 10,
  max_discount_cap: null,
  min_order_value: 0,
  is_active: true,
  is_public: true,
  is_first_order_only: false,
  start_date: null,
  expiry_date: null,
  max_uses: null,
  max_uses_per_user: 1,
};

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "Never";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<AdminCoupon | null>(null);
  const [form, setForm] = useState<CouponCreateInput>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Delete Confirm State
  const [deleteTarget, setDeleteTarget] = useState<AdminCoupon | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast State
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  }, []);

  const loadCoupons = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await fetchAdminCoupons();
      setCoupons(data || []);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to load coupons", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  // Filtered Coupons
  const filteredCoupons = useMemo(() => {
    return coupons.filter((c) => {
      if (typeFilter !== "all" && c.discount_type !== typeFilter) return false;
      if (statusFilter === "active" && !c.is_active) return false;
      if (statusFilter === "inactive" && c.is_active) return false;
      return true;
    });
  }, [coupons, typeFilter, statusFilter]);

  // KPI Metrics
  const stats = useMemo(() => {
    const total = coupons.length;
    const active = coupons.filter((c) => c.is_active).length;
    const redemptions = coupons.reduce((sum, c) => sum + (c.times_used || 0), 0);
    const firstOrderOnly = coupons.filter((c) => c.is_first_order_only).length;
    return { total, active, redemptions, firstOrderOnly };
  }, [coupons]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingCoupon(null);
    setForm(INITIAL_FORM);
    setModalError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (c: AdminCoupon) => {
    setEditingCoupon(c);
    setForm({
      code: c.code,
      title: c.title,
      description: c.description || "",
      discount_type: c.discount_type,
      discount_value: c.discount_value,
      max_discount_cap: c.max_discount_cap ?? null,
      min_order_value: c.min_order_value,
      is_active: c.is_active,
      is_public: c.is_public,
      is_first_order_only: c.is_first_order_only,
      start_date: c.start_date || null,
      expiry_date: c.expiry_date ? c.expiry_date.slice(0, 10) : null,
      max_uses: c.max_uses ?? null,
      max_uses_per_user: c.max_uses_per_user,
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  // Apply Quick Template
  const handleApplyTemplate = (tmpl: Partial<CouponCreateInput>) => {
    setForm((prev) => ({
      ...prev,
      ...tmpl,
    }));
  };

  // Submit Create or Edit
  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) {
      setModalError("Coupon code is required");
      return;
    }
    if (!form.title.trim()) {
      setModalError("Coupon title is required");
      return;
    }

    setSaving(true);
    setModalError(null);

    try {
      const payload: CouponCreateInput = {
        ...form,
        code: form.code.trim().toUpperCase(),
        title: form.title.trim(),
        description: form.description?.trim() || undefined,
        discount_value: Number(form.discount_value) || 0,
        min_order_value: Number(form.min_order_value) || 0,
        max_discount_cap: form.discount_type === "percentage" && form.max_discount_cap ? Number(form.max_discount_cap) : null,
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        max_uses_per_user: Number(form.max_uses_per_user) || 1,
        expiry_date: form.expiry_date ? new Date(form.expiry_date).toISOString() : null,
      };

      if (editingCoupon) {
        const updated = await updateAdminCoupon(editingCoupon._id, payload);
        setCoupons((prev) => prev.map((c) => (c._id === editingCoupon._id ? updated : c)));
        showToast(`Coupon ${updated.code} updated successfully`);
      } else {
        const created = await createAdminCoupon(payload);
        setCoupons((prev) => [created, ...prev]);
        showToast(`Coupon ${created.code} created successfully`);
      }

      setIsModalOpen(false);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Failed to save coupon");
    } finally {
      setSaving(false);
    }
  };

  // Toggle Active Switch
  const handleToggleActive = async (coupon: AdminCoupon) => {
    // Optimistic UI update
    setCoupons((prev) =>
      prev.map((c) => (c._id === coupon._id ? { ...c, is_active: !c.is_active } : c))
    );

    try {
      const updated = await toggleAdminCoupon(coupon._id);
      setCoupons((prev) => prev.map((c) => (c._id === coupon._id ? updated : c)));
      showToast(`Coupon ${coupon.code} is now ${updated.is_active ? "ACTIVE" : "INACTIVE"}`);
    } catch (err: unknown) {
      // Revert optimistic update
      setCoupons((prev) =>
        prev.map((c) => (c._id === coupon._id ? { ...c, is_active: coupon.is_active } : c))
      );
      showToast(err instanceof Error ? err.message : "Failed to toggle status", "error");
    }
  };

  // Delete Coupon
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAdminCoupon(deleteTarget._id);
      setCoupons((prev) => prev.filter((c) => c._id !== deleteTarget._id));
      showToast(`Coupon ${deleteTarget.code} deleted permanently`);
      setDeleteTarget(null);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to delete coupon", "error");
    } finally {
      setDeleting(false);
    }
  };

  // Coupons grid columns — toggle, edit and delete use the same handlers as before
  const columnDefs = useMemo<ColDef<AdminCoupon>[]>(() => [
    {
      headerName: "Code",
      field: "code",
      minWidth: 220,
      flex: 1.5,
      getQuickFilterText: (p) => [p.data.code, p.data.title, p.data.description].filter(Boolean).join(" "),
      cellRenderer: (p: CustomCellRendererProps<AdminCoupon>) => {
        const c = p.data;
        if (!c) return null;
        return (
          <StackedCell
            title={
              <span className={styles.codeBadge}>
                <span>{c.code}</span>
                {c.is_first_order_only && <span className={styles.codeFlag}>1st Order</span>}
                {!c.is_public && <span className={styles.codeFlag}>Private</span>}
              </span>
            }
            subtitle={c.title}
          />
        );
      },
    },
    {
      headerName: "Discount",
      colId: "discount",
      minWidth: 180,
      valueGetter: (p) => {
        const c = p.data;
        if (!c) return "";
        if (c.discount_type === "percentage") return `${c.discount_value}% off`;
        if (c.discount_type === "flat") return `₹${c.discount_value.toLocaleString("en-IN")} flat off`;
        return "Free shipping";
      },
      cellRenderer: (p: CustomCellRendererProps<AdminCoupon>) => {
        const c = p.data;
        if (!c) return null;
        const cap = c.discount_type === "percentage" ? (c.max_discount_cap ? `Max ₹${c.max_discount_cap.toLocaleString("en-IN")}` : "No cap") : undefined;
        return <StackedCell title={<StatusBadge label={String(p.value).toUpperCase()} tone="gold" />} subtitle={cap} />;
      },
    },
    {
      headerName: "Min Spend",
      field: "min_order_value",
      minWidth: 120,
      type: "rightAligned",
      filter: "agNumberColumnFilter",
      cellRenderer: (p: CustomCellRendererProps<AdminCoupon>) =>
        p.value > 0 ? <CurrencyRenderer {...p} /> : <span style={{ color: "var(--admin-text-subtle)" }}>None</span>,
    },
    {
      headerName: "Expiry Date",
      field: "expiry_date",
      minWidth: 150,
      comparator: dateComparator,
      valueFormatter: (p) => formatDate(p.value),
    },
    {
      headerName: "Usage",
      colId: "usage",
      minWidth: 130,
      type: "rightAligned",
      filter: "agNumberColumnFilter",
      valueGetter: (p) => p.data?.times_used || 0,
      cellRenderer: (p: CustomCellRendererProps<AdminCoupon>) => {
        const c = p.data;
        if (!c) return null;
        const full = Boolean(c.max_uses && c.times_used >= c.max_uses);
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontVariantNumeric: "tabular-nums" }}>
            {c.times_used} / {c.max_uses ? c.max_uses : "∞"}
            {full && <StatusBadge label="QUOTA FULL" tone="danger" />}
          </span>
        );
      },
    },
    {
      headerName: "Status",
      colId: "status",
      minWidth: 140,
      valueGetter: (p) => (p.data?.is_active ? "Active" : "Inactive"),
      cellRenderer: (p: CustomCellRendererProps<AdminCoupon>) => {
        const c = p.data;
        if (!c) return null;
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <label className={styles.toggleSwitch} title={c.is_active ? "Deactivate coupon" : "Activate coupon"}>
              <input
                type="checkbox"
                checked={c.is_active}
                onChange={() => handleToggleActive(c)}
                aria-label={`${c.is_active ? "Deactivate" : "Activate"} coupon ${c.code}`}
              />
              <span className={styles.slider} />
            </label>
            <StatusBadge label={c.is_active ? "ACTIVE" : "INACTIVE"} />
          </span>
        );
      },
    },
    {
      headerName: "Actions",
      colId: "actions",
      width: 96,
      minWidth: 96,
      maxWidth: 96,
      flex: 0,
      sortable: false,
      filter: false,
      resizable: false,
      pinned: "right",
      cellRenderer: ActionButtonsRenderer<AdminCoupon>,
      cellRendererParams: {
        onEdit: (c: AdminCoupon) => handleOpenEdit(c),
        onDelete: (c: AdminCoupon) => setDeleteTarget(c),
        labelFor: (c: AdminCoupon) => "coupon " + c.code,
      } satisfies ActionButtonsParams<AdminCoupon>,
    },
  // Handlers only use state setters and the row they receive
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  return (
    <div className={styles.container}>
      {/* Toast Notification */}
      {toastMsg && (
        <div className={toastMsg.type === "success" ? styles.toastSuccess : styles.toastError}>
          {toastMsg.type === "success" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>Coupons & Promotions</h1>
          <p>Create and manage discount codes, order incentives, and luxury promotional campaigns.</p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => loadCoupons(true)}
            disabled={refreshing}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleOpenCreate}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Create Coupon</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Coupons</span>
          <span className={styles.kpiValue}>{stats.total}</span>
          <span className={styles.kpiSub}>Active & archived promo codes</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Active Promotions</span>
          <span className={`${styles.kpiValue} ${styles.kpiValueGold}`}>{stats.active}</span>
          <span className={styles.kpiSub}>Ready to be redeemed by buyers</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Redemptions</span>
          <span className={styles.kpiValue}>{stats.redemptions}</span>
          <span className={styles.kpiSub}>Orders with applied discounts</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>First-Order Exclusives</span>
          <span className={styles.kpiValue}>{stats.firstOrderOnly}</span>
          <span className={styles.kpiSub}>New customer acquisition codes</span>
        </div>
      </div>

      {/* COUPONS GRID (AG Grid Community) */}
      <AdminDataGrid<AdminCoupon>
        ariaLabel="Coupons and offers"
        rowData={filteredCoupons}
        columnDefs={columnDefs}
        loading={loading}
        getRowId={(c) => String(c._id)}
        searchPlaceholder="Search code, title or description…"
        emptyTitle="No coupons found"
        emptyDescription="Adjust your filters or create a new coupon code above."
        toolbar={
          <div className={styles.filterGroup}>
            <select
              className={styles.selectInput}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by discount type"
            >
              <option value="all">All Discount Types</option>
              <option value="percentage">Percentage (%)</option>
              <option value="flat">Flat Cash (₹)</option>
              <option value="free_shipping">Free Shipping</option>
            </select>
            <select
              className={styles.selectInput}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        }
      />

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className={styles.modalBackdrop} onClick={() => !saving && setIsModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : "Create Promotional Coupon"}</h2>
              <button
                type="button"
                className={styles.btnCloseModal}
                onClick={() => !saving && setIsModalOpen(false)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveCoupon}>
              <div className={styles.modalBody}>
                {modalError && (
                  <div style={{ padding: "0.75rem", background: "#7f1d1d", color: "#fecaca", borderRadius: "8px", fontSize: "0.85rem" }}>
                    {modalError}
                  </div>
                )}

                {!editingCoupon && (
                  <div className={styles.templatesRow}>
                    <span className={styles.templatesLabel}>Quick 1-Click Luxury Presets:</span>
                    <div className={styles.templatesChips}>
                      {PRESET_TEMPLATES.map((pt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={styles.templateChip}
                          onClick={() => handleApplyTemplate(pt.template)}
                        >
                          {pt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Coupon Code *</label>
                    <input
                      type="text"
                      className={`${styles.formInput} ${styles.formInputUppercase}`}
                      placeholder="e.g. DELUZEXVIP"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Discount Type *</label>
                    <select
                      className={styles.formInput}
                      value={form.discount_type}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          discount_type: e.target.value as "percentage" | "flat" | "free_shipping",
                        })
                      }
                    >
                      <option value="percentage">Percentage Discount (%)</option>
                      <option value="flat">Flat Cash Discount (₹)</option>
                      <option value="free_shipping">Free Insured Shipping</option>
                    </select>
                  </div>

                  <div className={styles.formGroupFull}>
                    <label className={styles.formLabel}>Promotion Title *</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. 10% Off Architectural Fixtures"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      required
                    />
                  </div>

                  <div className={styles.formGroupFull}>
                    <label className={styles.formLabel}>Description (Customer Facing)</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. Valid on orders above ₹1,999 during the launch celebration."
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      {form.discount_type === "percentage"
                        ? "Discount Percentage (%) *"
                        : form.discount_type === "flat"
                        ? "Discount Cash Amount (₹) *"
                        : "Shipping Value (₹)"}
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max={form.discount_type === "percentage" ? "100" : undefined}
                      className={styles.formInput}
                      value={form.discount_type === "free_shipping" ? 0 : form.discount_value}
                      disabled={form.discount_type === "free_shipping"}
                      onChange={(e) => setForm({ ...form, discount_value: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>

                  {form.discount_type === "percentage" ? (
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Max Discount Cap (₹)</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="Leave blank for uncapped"
                        className={styles.formInput}
                        value={form.max_discount_cap ?? ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            max_discount_cap: e.target.value ? parseFloat(e.target.value) : null,
                          })
                        }
                      />
                    </div>
                  ) : (
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Min Order Value (MOV in ₹)</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className={styles.formInput}
                        value={form.min_order_value}
                        onChange={(e) => setForm({ ...form, min_order_value: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  )}

                  {form.discount_type === "percentage" && (
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Min Order Value (MOV in ₹)</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className={styles.formInput}
                        value={form.min_order_value}
                        onChange={(e) => setForm({ ...form, min_order_value: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  )}

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Max Uses Per Customer</label>
                    <input
                      type="number"
                      min="1"
                      className={styles.formInput}
                      value={form.max_uses_per_user ?? 1}
                      onChange={(e) => setForm({ ...form, max_uses_per_user: parseInt(e.target.value) || 1 })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Total System Redemptions Limit</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Blank for unlimited"
                      className={styles.formInput}
                      value={form.max_uses ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, max_uses: e.target.value ? parseInt(e.target.value) : null })
                      }
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Expiry Date</label>
                    <input
                      type="date"
                      className={styles.formInput}
                      value={form.expiry_date || ""}
                      onChange={(e) => setForm({ ...form, expiry_date: e.target.value || null })}
                    />
                  </div>

                  <div className={styles.formGroupFull} style={{ marginTop: "0.5rem" }}>
                    <label className={styles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={form.is_active}
                        onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                      />
                      <span className={styles.checkboxLabel}>Active Immediately (Customers can apply this coupon)</span>
                    </label>

                    <label className={styles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={form.is_public}
                        onChange={(e) => setForm({ ...form, is_public: e.target.checked })}
                      />
                      <span className={styles.checkboxLabel}>Show in Storefront &quot;Available Offers&quot; List (1-Click Apply)</span>
                    </label>

                    <label className={styles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={form.is_first_order_only}
                        onChange={(e) => setForm({ ...form, is_first_order_only: e.target.checked })}
                      />
                      <span className={styles.checkboxLabel}>First Order Only (Valid only for new accounts / emails with 0 prior orders)</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={saving}>
                  {saving ? "Saving Coupon..." : editingCoupon ? "Update Coupon" : "Create Coupon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className={styles.modalBackdrop} onClick={() => !deleting && setDeleteTarget(null)}>
          <div className={styles.modalContent} style={{ maxWidth: "450px" }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 style={{ color: "#ef4444" }}>Delete Coupon Permanently</h2>
              <button
                type="button"
                className={styles.btnCloseModal}
                onClick={() => !deleting && setDeleteTarget(null)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ margin: 0, color: "#d1d5db" }}>
                Are you sure you want to permanently delete coupon{" "}
                <strong style={{ color: "#d4af37" }}>{deleteTarget.code}</strong>?
              </p>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#9ca3af" }}>
                This coupon has been redeemed {deleteTarget.times_used} times. Existing placed orders will not be affected, but future checkouts will no longer accept this code.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                style={{ background: "#dc2626", color: "#ffffff" }}
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
