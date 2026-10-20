"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import styles from "./orders.module.css";
import {
  fetchAdminOrders,
  fetchOrderStats,
  updateAdminOrderStatus,
  deleteAdminOrder,
  UserOrder,
  OrderStats,
} from "../../services/api";
import OrderInvoiceModal from "../../components/OrderInvoiceModal";

const STATUS_TABS = [
  { key: "All", label: "All Orders" },
  { key: "pending", label: "Pending / COD" },
  { key: "paid", label: "Processing / Paid" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
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
    setCourierPartner(order.courier_partner || "");
    setTrackingNumber(order.tracking_number || "");
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
    }

    return <span className={`${styles.statusBadge} ${badgeClass}`}>● {label}</span>;
  };

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
          <span className={styles.kpiValue} style={{ color: "#eab308" }}>{stats.pending}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>In Production</span>
          <span className={styles.kpiValue} style={{ color: "#60a5fa" }}>{stats.processing}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Dispatched</span>
          <span className={styles.kpiValue} style={{ color: "#c084fc" }}>{stats.shipped}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Delivered</span>
          <span className={styles.kpiValue} style={{ color: "#4ade80" }}>{stats.delivered}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Gross Revenue</span>
          <span className={`${styles.kpiValue} ${styles.kpiValueGold}`}>{formatCurrency(stats.total_revenue)}</span>
        </div>
      </div>

      {/* SEARCH AND FILTER TABS */}
      <div className={styles.controlsBar}>
        <div className={styles.searchWrapper}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by Order ID, customer, phone, or tracking..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={styles.tabsRow}>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`${styles.tabBtn} ${activeTab === tab.key ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ORDERS TABLE */}
      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.emptyState}>
            <p>Retrieving orders from MongoDB Atlas...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className={styles.emptyState}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <h3>No Orders Found</h3>
            <p>No orders match the current filter criteria or search query.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.ordersTable}>
              <thead>
                <tr>
                  <th>Order Reference</th>
                  <th>Date & Time</th>
                  <th>Customer Information</th>
                  <th>Articles</th>
                  <th>Total Amount</th>
                  <th>Payment Mode</th>
                  <th>Fulfillment Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((ord) => {
                  const idStr = ord.id || ord._id || ord.order_id || "DLX";
                  const displayId = idStr.length > 10 ? `#${idStr.slice(-8).toUpperCase()}` : `#${idStr}`;
                  const address = ord.shipping_address;
                  const customerName =
                    ord.customer_name ||
                    (address ? `${address.first_name || ""} ${address.last_name || ""}`.trim() : "") ||
                    "Valued Client";

                  return (
                    <tr key={idStr}>
                      <td>
                        <span className={styles.orderIdText}>{displayId}</span>
                        {ord.tracking_number && (
                          <div style={{ fontSize: "0.75rem", color: "#c084fc", marginTop: "2px" }}>
                            🚚 {ord.tracking_number}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ color: "#fff", fontSize: "0.85rem" }}>{formatDate(ord.created_at || ord.createdAt)}</div>
                      </td>
                      <td>
                        <div className={styles.customerName}>{customerName}</div>
                        <div className={styles.customerSub}>{ord.user_email || "No email"}</div>
                        {ord.user_phone && <div className={styles.customerSub}>📞 {ord.user_phone}</div>}
                      </td>
                      <td>
                        <div className={styles.itemThumbGroup}>
                          {ord.items && ord.items.slice(0, 2).map((item, idx) => (
                            <div key={idx} className={styles.itemThumb} title={`${item.title} (x${item.quantity})`}>
                              <Image
                                src={item.image || "/images/card1.jpg"}
                                alt={item.title || "Luminaire"}
                                fill
                                style={{ objectFit: "cover" }}
                              />
                            </div>
                          ))}
                          {ord.items && ord.items.length > 2 && (
                            <span className={styles.itemMoreBadge}>+{ord.items.length - 2}</span>
                          )}
                          <span style={{ fontSize: "0.82rem", color: "#8e8e93", marginLeft: "4px" }}>
                            ({ord.items?.reduce((acc, it) => acc + (it.quantity || 1), 0) || 0} pcs)
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={styles.amountText}>{formatCurrency(ord.total || ord.amount)}</span>
                      </td>
                      <td>
                        <span className={styles.paymentMethodBadge}>
                          {ord.payment_method?.toLowerCase() === "cod" ? "Cash on Delivery" : "Razorpay Online"}
                        </span>
                      </td>
                      <td>{renderStatusBadge(ord.status)}</td>
                      <td style={{ textAlign: "right" }}>
                        <div className={styles.actionBtnGroup} style={{ justifyContent: "flex-end" }}>
                          <button
                            className={styles.viewBtn}
                            onClick={() => handleOpenDrawer(ord)}
                          >
                            Manage
                          </button>
                          <button
                            className={styles.viewBtn}
                            onClick={() => setInvoiceOrder(ord)}
                            title="View and print GST Tax Invoice"
                            style={{ background: "rgba(196, 154, 69, 0.12)", color: "#c49a45", borderColor: "rgba(196, 154, 69, 0.3)" }}
                          >
                            📄 Invoice
                          </button>
                          <button
                            className={styles.deleteBtn}
                            onClick={() => handleDeleteOrder(idStr)}
                            title="Delete order record"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
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

      {/* DETAIL & FULFILLMENT DRAWER */}
      {selectedOrder && (
        <div className={styles.modalBackdrop} onClick={handleCloseDrawer}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div>
                <h2 className={styles.drawerTitle}>
                  Order #{((selectedOrder.id || selectedOrder._id || selectedOrder.order_id) || "").slice(-8).toUpperCase()}
                </h2>
                <span style={{ fontSize: "0.8rem", color: "#8e8e93" }}>
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

              {/* FULFILLMENT CONTROLS */}
              <div className={styles.sectionBlock}>
                <div className={styles.sectionBlockTitle}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="1" y="3" width="15" height="13" />
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                    <circle cx="5.5" cy="18.5" r="2.5" />
                    <circle cx="18.5" cy="18.5" r="2.5" />
                  </svg>
                  Order Status & Courier Dispatch
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

                  <div className={styles.formGroup}>
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
                  <div style={{ marginTop: "1rem", paddingTop: "0.8rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <label style={{ fontSize: "0.75rem", color: "#8e8e93", display: "block", marginBottom: "4px" }}>
                      Delivery Destination
                    </label>
                    <p style={{ margin: 0, color: "#fff", lineHeight: 1.5, fontSize: "0.9rem" }}>
                      {selectedOrder.shipping_address.street}, {selectedOrder.shipping_address.city},{" "}
                      {selectedOrder.shipping_address.state} —{" "}
                      <strong style={{ color: "#d4af37" }}>{selectedOrder.shipping_address.pin_code}</strong>
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
                <div className={styles.totalsList} style={{ marginTop: "1.2rem", paddingTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
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

            <div className={styles.drawerFooter}>
              <button
                className={styles.viewBtn}
                onClick={() => setInvoiceOrder(selectedOrder)}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", background: "rgba(196, 154, 69, 0.15)", color: "#c49a45", borderColor: "rgba(196, 154, 69, 0.4)" }}
              >
                📄 View GST Tax Invoice
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
    </div>
  );
}
