"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import type { ColDef } from "ag-grid-community";
import type { CustomCellRendererProps } from "ag-grid-react";
import { FileText, Trash2 } from "lucide-react";
import styles from "./orders.module.css";
import AdminDataGrid from "../../components/admin/AdminDataGrid";
import {
  CurrencyRenderer,
  DateRenderer,
  ImageThumbnailRenderer,
  StackedCell,
  dateComparator,
} from "../../components/admin/gridRenderers";
import {
  fetchAdminOrders,
  fetchOrderStats,
  updateAdminOrderStatus,
  deleteAdminOrder,
  UserOrder,
  OrderStats,
} from "../../services/api";
import OrderInvoiceModal from "../../components/OrderInvoiceModal";
import ShiprocketFulfillmentModal from "../../components/ShiprocketFulfillmentModal";

const STATUS_TABS = [
  { key: "All", label: "All Orders" },
  { key: "pending", label: "Pending / COD" },
  { key: "paid", label: "Processing / Paid" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "return_requested", label: "Returns / Pickups" },
  { key: "cancelled", label: "Cancelled" },
];

const COURIER_OPTIONS = [
  "BlueDart Express",
  "Delhivery",
  "DTDC Courier",
  "FedEx India",
  "Shiprocket",
  "India Post (Speed Post)",
  "Ecom Express",
  "Shadowfax",
  "Other Local Logistics",
];

function orderDisplayId(ord: UserOrder): string {
  const idStr = ord.id || ord._id || ord.order_id || "DLX";
  if (ord.order_number) return `#${ord.order_number}`;
  if (idStr.length >= 24) {
    const d = new Date(ord.created_at || Date.now());
    return `#DLX-${d.getFullYear().toString().slice(-2)}${String(d.getMonth() + 1).padStart(2, "0")}-${idStr.slice(-4).toUpperCase()}`;
  }
  return `#${idStr}`;
}

function orderCustomerName(ord: UserOrder): string {
  const address = ord.shipping_address;
  return (
    ord.customer_name ||
    (address ? `${address.first_name || ""} ${address.last_name || ""}`.trim() : "") ||
    "Valued Client"
  );
}

function formatCurrency(val: number | string | undefined): string {
  if (val === undefined || val === null) return "₹0";
  const n = typeof val === "string" ? parseFloat(val.replace(/[^\d.]/g, "")) : val;
  if (isNaN(n)) return "₹0";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "N/A";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [stats, setStats] = useState<OrderStats>({
    total_orders: 0,
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    total_revenue: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<UserOrder | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<UserOrder | null>(null);
  const [shiprocketOrder, setShiprocketOrder] = useState<UserOrder | null>(null);

  // Fulfillment form state
  const [fulfillStatus, setFulfillStatus] = useState<string>("processing");
  const [courierPartner, setCourierPartner] = useState<string>("");
  const [trackingNumber, setTrackingNumber] = useState<string>("");
  const [fulfillNotes, setFulfillNotes] = useState<string>("");
  const [updating, setUpdating] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [statsData, ordersData] = await Promise.all([
        fetchOrderStats(),
        fetchAdminOrders({
          status: activeTab === "All" ? undefined : activeTab,
          search: searchQuery.trim() || undefined,
        }),
      ]);
      setStats(statsData);
      setOrders(ordersData);
    } catch (err) {
      console.error("Failed to load admin orders data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // When drawer opens, initialize form state
  const handleOpenDrawer = (order: UserOrder) => {
    setSelectedOrder(order);
    setFulfillStatus(order.status || "processing");
    setCourierPartner(order.courier_partner || order.courier_name || "");
    setTrackingNumber(order.tracking_number || order.awb_code || "");
    setFulfillNotes(order.notes || "");
    setToastMsg(null);
  };

  const handleCloseDrawer = () => {
    setSelectedOrder(null);
    setToastMsg(null);
  };

  // Submit fulfillment changes
  const handleFulfillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setUpdating(true);
    setToastMsg(null);

    const orderId = selectedOrder.id || selectedOrder._id || selectedOrder.order_id;
    const res = await updateAdminOrderStatus(orderId, {
      status: fulfillStatus,
      courier_partner: courierPartner.trim() || undefined,
      tracking_number: trackingNumber.trim() || undefined,
      notes: fulfillNotes.trim() || undefined,
    });

    setUpdating(false);

    if (res.success && res.order) {
      setToastMsg({ text: `Order updated to ${fulfillStatus.toUpperCase()}!`, type: "success" });
      setSelectedOrder(res.order);
      // Refresh list and stats in background
      loadData(true);
    } else {
      setToastMsg({ text: res.error || "Failed to update order status.", type: "error" });
    }
  };

  // Delete order
  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm(`Are you sure you want to delete order #${orderId}? This cannot be undone.`)) {
      return;
    }
    const res = await deleteAdminOrder(orderId);
    if (res.success) {
      setOrders((prev) => prev.filter((o) => (o.id || o._id || o.order_id) !== orderId));
      if (selectedOrder && (selectedOrder.id || selectedOrder._id || selectedOrder.order_id) === orderId) {
        setSelectedOrder(null);
      }
      fetchOrderStats().then(setStats);
    } else {
      alert("Failed to delete order. Please try again.");
    }
  };

  const renderStatusBadge = (status?: string) => {
    const s = (status || "pending").toLowerCase();
    let badgeClass = styles.statusPending;
    let label = status || "Pending";

    if (s === "paid" || s === "processing") {
      badgeClass = styles.statusProcessing;
      label = s === "paid" ? "Paid" : "Processing";
    } else if (s === "shipped" || s === "out_for_delivery") {
      badgeClass = styles.statusShipped;
      label = s === "out_for_delivery" ? "Out for Delivery" : "Shipped";
    } else if (s === "delivered") {
      badgeClass = styles.statusDelivered;
      label = "Delivered";
    } else if (s === "cancelled") {
      badgeClass = styles.statusCancelled;
      label = "Cancelled";
    } else if (s === "cod") {
      badgeClass = styles.statusPending;
      label = "COD (Pending)";
    } else if (s === "return_requested") {
      return (
        <span
          className={styles.statusBadge}
          style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", borderColor: "rgba(245, 158, 11, 0.35)" }}
        >
          ● Return Requested
        </span>
      );
    } else if (s === "return_in_transit" || s === "return_approved") {
      return (
        <span
          className={styles.statusBadge}
          style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", borderColor: "rgba(16, 185, 129, 0.35)" }}
        >
          ● Return In Transit
        </span>
      );
    } else if (s === "return_rejected") {
      return (
        <span
          className={styles.statusBadge}
          style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.35)" }}
        >
          ● Return Rejected
        </span>
      );
    } else if (s === "returned") {
      return (
        <span
          className={styles.statusBadge}
          style={{ background: "rgba(99, 102, 241, 0.15)", color: "#818cf8", borderColor: "rgba(99, 102, 241, 0.35)" }}
        >
          ● Returned & Restocked
        </span>
      );
    }

    return <span className={`${styles.statusBadge} ${badgeClass}`}>● {label}</span>;
  };

  // Orders grid columns — every action calls the same handlers as the old table
  const columnDefs = useMemo<ColDef<UserOrder>[]>(() => [
    {
      headerName: "Order ID",
      colId: "orderId",
      minWidth: 170,
      valueGetter: (p) => (p.data ? orderDisplayId(p.data) : ""),
      cellRenderer: (p: CustomCellRendererProps<UserOrder>) => (
        <StackedCell
          title={<span className={styles.orderIdText}>{p.value}</span>}
          subtitle={p.data?.tracking_number ? `AWB ${p.data.tracking_number}` : undefined}
        />
      ),
    },
    {
      headerName: "Date",
      colId: "date",
      minWidth: 180,
      sort: "desc",
      valueGetter: (p) => p.data?.created_at || p.data?.createdAt || "",
      comparator: dateComparator,
      filter: "agDateColumnFilter",
      filterValueGetter: (p) => {
        const v = p.data?.created_at || p.data?.createdAt;
        return v ? new Date(v) : null;
      },
      cellRenderer: DateRenderer,
    },
    {
      headerName: "Customer",
      colId: "customer",
      minWidth: 230,
      flex: 1.6,
      valueGetter: (p) => (p.data ? orderCustomerName(p.data) : ""),
      getQuickFilterText: (p) => [orderCustomerName(p.data), p.data.user_email, p.data.user_phone].filter(Boolean).join(" "),
      cellRenderer: (p: CustomCellRendererProps<UserOrder>) => (
        <StackedCell
          title={p.value}
          subtitle={[p.data?.user_email || "No email", p.data?.user_phone].filter(Boolean).join(" · ")}
        />
      ),
    },
    {
      headerName: "Items",
      colId: "items",
      minWidth: 140,
      filter: "agNumberColumnFilter",
      valueGetter: (p) => p.data?.items?.reduce((acc, it) => acc + (it.quantity || 1), 0) || 0,
      cellRenderer: (p: CustomCellRendererProps<UserOrder>) => {
        const items = p.data?.items || [];
        return (
          <div className={styles.itemThumbGroup}>
            {items.slice(0, 2).map((item, idx) => (
              <span key={idx} className={styles.itemThumb} title={`${item.title} (x${item.quantity})`}>
                <ImageThumbnailRenderer {...p} value={item.image || "/images/card1.jpg"} size={28} />
              </span>
            ))}
            {items.length > 2 && <span className={styles.itemMoreBadge}>+{items.length - 2}</span>}
            <span className={styles.itemPcs}>{p.value} pcs</span>
          </div>
        );
      },
    },
    {
      headerName: "Total",
      colId: "total",
      minWidth: 130,
      type: "rightAligned",
      filter: "agNumberColumnFilter",
      valueGetter: (p) => Number(p.data?.total || p.data?.amount || 0),
      cellRenderer: CurrencyRenderer,
    },
    {
      headerName: "Payment",
      colId: "payment",
      minWidth: 150,
      valueGetter: (p) => (p.data?.payment_method?.toLowerCase() === "cod" ? "Cash on Delivery" : "Online (Razorpay)"),
      cellRenderer: (p: CustomCellRendererProps<UserOrder>) => <span className={styles.paymentMethodBadge}>{p.value}</span>,
    },
    {
      headerName: "Status",
      colId: "status",
      minWidth: 170,
      valueGetter: (p) => p.data?.status || "pending",
      cellRenderer: (p: CustomCellRendererProps<UserOrder>) => renderStatusBadge(p.data?.status),
    },
    {
      headerName: "Actions",
      colId: "actions",
      width: 268,
      minWidth: 268,
      maxWidth: 268,
      flex: 0,
      sortable: false,
      filter: false,
      resizable: false,
      pinned: "right",
      cellRenderer: (p: CustomCellRendererProps<UserOrder>) => {
        const ord = p.data;
        if (!ord) return null;
        const idStr = ord.id || ord._id || ord.order_id || "DLX";
        const needsReturnReview = ord.return_details?.status === "PENDING_APPROVAL" || ord.status === "return_requested";
        return (
          <div className={styles.rowActions}>
            <button type="button" className={styles.rowActionBtn} onClick={() => handleOpenDrawer(ord)}>
              Manage
            </button>
            <button
              type="button"
              className={[styles.rowActionBtn, needsReturnReview ? styles.rowActionWarn : styles.rowActionGold].join(" ")}
              onClick={() => setShiprocketOrder(ord)}
              title="Ship with Shiprocket, generate AWB, print labels, live track & reverse returns"
            >
              {needsReturnReview ? "Review Return" : ord.awb_code ? "Shiprocket" : "Ship"}
            </button>
            <button
              type="button"
              className={styles.rowIconBtn}
              onClick={() => setInvoiceOrder(ord)}
              title="View and print GST Tax Invoice"
              aria-label={`Invoice for ${orderDisplayId(ord)}`}
            >
              <FileText size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={[styles.rowIconBtn, styles.rowIconDanger].join(" ")}
              onClick={() => handleDeleteOrder(idStr)}
              title="Delete order record"
              aria-label={`Delete order ${orderDisplayId(ord)}`}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        );
      },
    },
  // Handlers only use state setters and the orders list via functional updates
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [selectedOrder]);

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>Customer Orders & Fulfillment</h1>
          <p>Inspect client purchases, generate dispatches, and update delivery milestones.</p>
        </div>
        <button
          className={styles.refreshBtn}
          onClick={() => loadData(true)}
          disabled={refreshing}
          title="Refresh orders from database"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }}
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {refreshing ? "Refreshing..." : "Refresh Live"}
        </button>
      </div>

      {/* KPI METRIC CARDS */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Orders</span>
          <span className={styles.kpiValue}>{stats.total_orders}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Pending / COD</span>
          <span className={styles.kpiValue} style={{ color: "#d97706" }}>{stats.pending}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>In Production</span>
          <span className={styles.kpiValue} style={{ color: "#2563eb" }}>{stats.processing}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Dispatched</span>
          <span className={styles.kpiValue} style={{ color: "#9333ea" }}>{stats.shipped}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Delivered</span>
          <span className={styles.kpiValue} style={{ color: "#16a34a" }}>{stats.delivered}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Gross Revenue</span>
          <span className={`${styles.kpiValue} ${styles.kpiValueGold}`}>{formatCurrency(stats.total_revenue)}</span>
        </div>
      </div>

      {/* ORDERS GRID (AG Grid Community). Search + status tabs stay server-side. */}
      <AdminDataGrid<UserOrder>
        ariaLabel="Customer orders"
        rowData={orders}
        columnDefs={columnDefs}
        loading={loading}
        getRowId={(o) => String(o.id || o._id || o.order_id || o.order_number)}
        showSearch={false}
        emptyTitle="No orders found"
        emptyDescription="No orders match the current status filter or search."
        toolbar={
          <>
            <div className={styles.searchWrapper}>
              <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Search order ID, customer, phone, tracking…"
                aria-label="Search orders"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className={styles.tabsRow} role="tablist" aria-label="Filter orders by status">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  className={`${styles.tabBtn} ${activeTab === tab.key ? styles.tabBtnActive : ""}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </>
        }
      />

      {/* DETAIL & FULFILLMENT DRAWER */}
      {selectedOrder && (
        <div className={styles.modalBackdrop} onClick={handleCloseDrawer}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div>
                <h2 className={styles.drawerTitle}>
                  Order #{((selectedOrder.id || selectedOrder._id || selectedOrder.order_id) || "").slice(-8).toUpperCase()}
                </h2>
                <span className={styles.drawerSubtitle}>
                  Placed on {formatDate(selectedOrder.created_at || selectedOrder.createdAt)}
                </span>
              </div>
              <button className={styles.closeBtn} onClick={handleCloseDrawer} aria-label="Close">
                ✕
              </button>
            </div>

            <div className={styles.drawerBody}>
              {/* TOAST MESSAGE */}
              {toastMsg && (
                <div
                  style={{
                    padding: "0.8rem 1rem",
                    borderRadius: "8px",
                    fontSize: "0.88rem",
                    background: toastMsg.type === "success" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                    border: `1px solid ${toastMsg.type === "success" ? "#22c55e" : "#ef4444"}`,
                    color: toastMsg.type === "success" ? "#4ade80" : "#f87171",
                  }}
                >
                  {toastMsg.text}
                </div>
              )}

              {/* SHIPROCKET 1-CLICK INTEGRATION BANNER */}
              <div className={styles.drawerColumns}>
              <div className={styles.drawerColumn}>
              <div className={styles.logisticsCard}>
                <div className={styles.logisticsInfo}>
                  <span className={styles.logisticsIcon} aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="3" width="15" height="13" />
                      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                      <circle cx="5.5" cy="18.5" r="2.5" />
                      <circle cx="18.5" cy="18.5" r="2.5" />
                    </svg>
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className={styles.logisticsTitle}>
                      <span>Shiprocket Automated Logistics</span>
                      {selectedOrder.awb_code && <span className={styles.logisticsBadge}>Active</span>}
                    </div>
                    <div className={styles.logisticsText}>
                      {selectedOrder.awb_code
                        ? `AWB: ${selectedOrder.awb_code} • ${selectedOrder.courier_name || "Assigned Courier"}`
                        : "Create shipment, generate AWB, print barcode labels, track live & initiate returns."}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShiprocketOrder(selectedOrder)}
                  className={styles.logisticsBtn}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {selectedOrder.awb_code ? (
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    ) : (
                      <>
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                        <line x1="12" y1="22.08" x2="12" y2="12" />
                      </>
                    )}
                  </svg>
                  {selectedOrder.awb_code ? "Track & Manage" : "Ship with Shiprocket"}
                </button>
              </div>

              {/* FULFILLMENT CONTROLS */}
              <div className={styles.sectionBlock}>
                <div className={styles.sectionBlockTitle} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="1" y="3" width="15" height="13" />
                      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                      <circle cx="5.5" cy="18.5" r="2.5" />
                      <circle cx="18.5" cy="18.5" r="2.5" />
                    </svg>
                    Order Status & Courier Dispatch
                  </div>
                  {selectedOrder.awb_code && (
                    <span className={styles.logisticsBadge}>
                      Auto-synced with Shiprocket
                    </span>
                  )}
                </div>

                <form className={styles.fulfillForm} onSubmit={handleFulfillSubmit}>
                  <div className={styles.formGroup}>
                    <label>Fulfillment Stage</label>
                    <select
                      className={styles.selectInput}
                      value={fulfillStatus}
                      onChange={(e) => setFulfillStatus(e.target.value)}
                    >
                      <option value="pending">Pending (Awaiting Confirmation)</option>
                      <option value="paid">Paid (Payment Received)</option>
                      <option value="processing">In Production / Processing</option>
                      <option value="shipped">Shipped (Dispatched to Courier)</option>
                      <option value="out_for_delivery">Out for Delivery</option>
                      <option value="delivered">Delivered Successfully</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Logistics Partner</label>
                    <input
                      type="text"
                      list="courier-list"
                      className={styles.textInput}
                      placeholder="Select or enter courier name..."
                      value={courierPartner}
                      onChange={(e) => setCourierPartner(e.target.value)}
                    />
                    <datalist id="courier-list">
                      {COURIER_OPTIONS.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Consignment / Tracking Number (AWB)</label>
                    <input
                      type="text"
                      className={styles.textInput}
                      placeholder="e.g. BLUEDART-98721345"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                    />
                  </div>

                  <div className={`${styles.formGroup} ${styles.fulfillFormWide}`}>
                    <label>Internal Dispatch Notes (Optional)</label>
                    <input
                      type="text"
                      className={styles.textInput}
                      placeholder="e.g. Dispatched in wooden crate with fragile glass stickers"
                      value={fulfillNotes}
                      onChange={(e) => setFulfillNotes(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    className={styles.submitFulfillBtn}
                    disabled={updating}
                  >
                    {updating ? "Saving Changes..." : "Save & Update Order Status"}
                  </button>
                </form>
              </div>

              </div>

              <div className={styles.drawerColumn}>
              {/* CLIENT & SHIPPING ADDRESS */}
              <div className={styles.sectionBlock}>
                <div className={styles.sectionBlockTitle}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Client & Shipping Address
                </div>

                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <label>Client Name</label>
                    <p>
                      {selectedOrder.customer_name ||
                        (selectedOrder.shipping_address
                          ? `${selectedOrder.shipping_address.first_name || ""} ${selectedOrder.shipping_address.last_name || ""}`.trim()
                          : "Valued Client")}
                    </p>
                  </div>
                  <div className={styles.detailItem}>
                    <label>Email Address</label>
                    <p>{selectedOrder.user_email || "N/A"}</p>
                  </div>
                  <div className={styles.detailItem}>
                    <label>Contact Phone</label>
                    <p>{selectedOrder.user_phone || "N/A"}</p>
                  </div>
                  <div className={styles.detailItem}>
                    <label>Payment Mode</label>
                    <p style={{ textTransform: "uppercase" }}>{selectedOrder.payment_method || "Online"}</p>
                  </div>
                </div>

                {selectedOrder.shipping_address && (
                  <div className={styles.addressBlock}>
                    <span className={styles.addressLabel}>
                      Delivery Destination
                    </span>
                    <p className={styles.addressText}>
                      {selectedOrder.shipping_address.street}, {selectedOrder.shipping_address.city},{" "}
                      {selectedOrder.shipping_address.state} —{" "}
                      <strong className={styles.addressPin}>{selectedOrder.shipping_address.pin_code}</strong>
                    </p>
                  </div>
                )}
              </div>

              {/* LINE ITEMS */}
              <div className={styles.sectionBlock}>
                <div className={styles.sectionBlockTitle}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="21 8 21 21 3 21 3 8" />
                    <line x1="1" y1="3" x2="23" y2="3" />
                    <path d="M10 12h4" />
                  </svg>
                  Purchased Products ({selectedOrder.items?.length || 0})
                </div>

                <div className={styles.drawerItemsList}>
                  {selectedOrder.items && selectedOrder.items.map((item, idx) => (
                    <div key={idx} className={styles.drawerItemRow}>
                      <div className={styles.drawerItemImg}>
                        <Image
                          src={item.image || "/images/card1.jpg"}
                          alt={item.title || "Luminaire"}
                          fill
                          style={{ objectFit: "cover" }}
                        />
                      </div>
                      <div className={styles.drawerItemInfo}>
                        <div className={styles.drawerItemTitle}>{item.title}</div>
                        <div className={styles.drawerItemQtyPrice}>
                          Qty: {item.quantity} × {formatCurrency(item.price)}
                        </div>
                      </div>
                      <div className={styles.drawerItemTotal}>
                        {formatCurrency(Number(item.price || 0) * Number(item.quantity || 1))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* FINANCIAL BREAKDOWN */}
                <div className={styles.totalsList}>
                  <div className={styles.totalRow}>
                    <span>Subtotal</span>
                    <span>{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  <div className={styles.totalRow}>
                    <span>GST (18% Applicable)</span>
                    <span>{formatCurrency(selectedOrder.gst)}</span>
                  </div>
                  <div className={styles.totalRow}>
                    <span>Insured White-Glove Shipping</span>
                    <span>{selectedOrder.delivery === 0 ? "FREE" : formatCurrency(selectedOrder.delivery)}</span>
                  </div>
                  <div className={styles.grandTotalRow}>
                    <span>Total Amount</span>
                    <span className={styles.grandTotalAmount}>{formatCurrency(selectedOrder.total || selectedOrder.amount)}</span>
                  </div>
                </div>
              </div>
              </div>
              </div>
            </div>

            <div className={styles.drawerFooter}>
              <button
                className={styles.viewBtn}
                onClick={() => setInvoiceOrder(selectedOrder)}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", background: "var(--admin-primary-glow)", color: "var(--admin-primary)", borderColor: "var(--admin-border-gold)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                View GST Tax Invoice
              </button>
              <button
                className={styles.viewBtn}
                onClick={() => window.print()}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                Print Manifest
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Tax Invoice Modal */}
      {invoiceOrder && (
        <OrderInvoiceModal
          order={invoiceOrder}
          onClose={() => setInvoiceOrder(null)}
        />
      )}

      {/* Shiprocket Fulfillment & Returns Modal */}
      {shiprocketOrder && (
        <ShiprocketFulfillmentModal
          order={shiprocketOrder}
          isOpen={!!shiprocketOrder}
          onClose={() => setShiprocketOrder(null)}
          onOrderUpdated={() => {
            loadData(true);
            if (selectedOrder && (selectedOrder._id === shiprocketOrder._id || selectedOrder.id === shiprocketOrder.id)) {
              fetchAdminOrders({}).then((ordersList) => {
                const fresh = ordersList.find(
                  (o) => o._id === shiprocketOrder._id || o.id === shiprocketOrder.id
                );
                if (fresh) {
                  setSelectedOrder(fresh);
                  setFulfillStatus(fresh.status || "processing");
                  setCourierPartner(fresh.courier_partner || fresh.courier_name || "");
                  setTrackingNumber(fresh.tracking_number || fresh.awb_code || "");
                  setFulfillNotes(fresh.notes || "");
                }
              });
            }
          }}
        />
      )}
    </div>
  );
}
