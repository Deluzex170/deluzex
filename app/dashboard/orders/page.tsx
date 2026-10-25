"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { fetchUserOrders, cancelUserOrder, UserOrder } from "../../services/api";
import OrderInvoiceModal from "../../components/OrderInvoiceModal";
import styles from "./orders.module.css";

const TABS = ["All", "Processing", "Shipped", "Delivered", "Cancelled"];

const STEP_STAGES = [
  { key: "placed", label: "Order Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "shipped", label: "Shipped" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
];

function StatusBadge({ status }: { status: string }) {
  const s = (status || "Processing").toLowerCase();
  const cls =
    s === "delivered"
      ? styles.statusDelivered
      : s === "shipped"
      ? styles.statusShipped
      : s === "cancelled"
      ? styles.statusCancelled
      : s === "paid" || s === "processing" || s === "cod"
      ? styles.statusProcessing
      : styles.statusPending;

  const displayStatus =
    s === "paid"
      ? "Paid (Processing)"
      : s === "pending"
      ? "Processing"
      : status || "Processing";

  return (
    <span className={`${styles.statusBadge} ${cls}`}>
      ● {displayStatus}
    </span>
  );
}

function formatCurrency(num: number | string | undefined): string {
  if (num === undefined || num === null) return "₹0";
  const n = typeof num === "string" ? parseFloat(num.replace(/[^\d.]/g, "")) : num;
  if (isNaN(n)) return "₹0";
  return `₹${n.toLocaleString("en-IN")}`;
}

const isOrderProcessing = (status?: string) => {
  const s = (status || "").toLowerCase();
  return s === "processing" || s === "pending" || s === "paid" || s === "confirmed" || s === "cod" || s === "placed";
};

export default function OrdersPage() {
  const { user } = useAuth();
  const userEmail = (user as Record<string, string>)?.email || "";

  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");

  // Selected order for tracking & detail modal
  const [selectedOrder, setSelectedOrder] = useState<UserOrder | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<UserOrder | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<UserOrder | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchUserOrders(userEmail);
      setOrders(data || []);
    } catch (err) {
      console.error("Error loading user orders:", err);
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Compute tab counts
  const tabCounts: Record<string, number> = {
    All: orders.length,
    Processing: orders.filter((o) => isOrderProcessing(o.status)).length,
    Shipped: orders.filter((o) => (o.status || "").toLowerCase() === "shipped").length,
    Delivered: orders.filter((o) => (o.status || "").toLowerCase() === "delivered").length,
    Cancelled: orders.filter((o) => (o.status || "").toLowerCase() === "cancelled").length,
  };

  // Filter orders by search & tab
  const filteredOrders = orders.filter((order) => {
    const s = (order.status || "").toLowerCase();
    const statusMatch =
      activeTab === "All" ||
      s === activeTab.toLowerCase() ||
      (activeTab === "Processing" && isOrderProcessing(order.status));

    const q = search.toLowerCase().trim();
    if (!q) return statusMatch;

    const matchesId = (order.order_id || order.id || "").toLowerCase().includes(q);
    const matchesItem = (order.items || []).some((item) =>
      (item.title || "").toLowerCase().includes(q)
    );
    const matchesCustomer = (order.customer_name || "").toLowerCase().includes(q);

    return statusMatch && (matchesId || matchesItem || matchesCustomer);
  });

  const handleConfirmCancel = async (order: UserOrder) => {
    const orderId = order.order_id || order.id || "";
    if (!orderId) return;
    setCancelLoading(true);
    try {
      await cancelUserOrder(orderId, userEmail);
      await loadOrders();
      if (selectedOrder && (selectedOrder.order_id === orderId || selectedOrder.id === orderId)) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: "Cancelled" } : null));
      }
      setOrderToCancel(null);
    } catch (err: any) {
      console.error("Failed to cancel order:", err);
      alert(err?.message || "Failed to cancel order. Please try again.");
    } finally {
      setCancelLoading(false);
    }
  };

  // Determine active step in tracking stepper
  const getStepProgress = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "delivered") return 5;
    if (s === "shipped") return 3;
    if (s === "processing") return 2;
    if (s === "cancelled") return 0;
    return 1;
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My Orders</h1>
          <p className={styles.subtitle}>
            Track real-time shipment status, manage past purchases and view receipts.
          </p>
        </div>
        <button className={styles.btnRefresh} onClick={loadOrders} title="Refresh orders list">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by Order ID or Product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab(tab)}
            >
              <span>{tab}</span>
              <span className={styles.tabCount}>{tabCounts[tab] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Orders Content */}
      {loading ? (
        <div style={{ padding: "3rem 0", textAlign: "center", color: "#888" }}>
          Loading your orders from server...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <h3 className={styles.emptyTitle}>No orders found</h3>
          <p className={styles.emptySubtitle}>
            {search
              ? `No orders matching "${search}" found in ${activeTab}.`
              : `You don't have any ${activeTab !== "All" ? activeTab.toLowerCase() : ""} orders yet.`}
          </p>
          <Link href="/shop" className={styles.emptyBtn}>
            <span>Explore Lighting Collection</span>
            <span>→</span>
          </Link>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Product Item</th>
                <th>Order ID</th>
                <th>Date Placed</th>
                <th>Total Amount</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order, i) => {
                const firstItem = order.items && order.items.length > 0 ? order.items[0] : null;
                const extraItemsCount = (order.items?.length || 1) - 1;
                const orderTotal = order.total || order.amount || 0;
                const orderDate =
                  order.date ||
                  (order.created_at
                    ? new Date(order.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "Recent");

                return (
                  <tr key={order.order_id || order.id || i} onClick={() => setSelectedOrder(order)}>
                    <td>
                      <div className={styles.productCell}>
                        <div className={styles.productImgWrapper}>
                          {firstItem?.image ? (
                            <Image
                              src={firstItem.image}
                              alt={firstItem.title || "Product"}
                              fill
                              className={styles.productImg}
                            />
                          ) : (
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C89B60" strokeWidth="1.5">
                              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                            </svg>
                          )}
                        </div>
                        <div className={styles.productInfo}>
                          <h4>{firstItem?.title || "Luxury Luminaire"}</h4>
                          <p>{firstItem?.variant || `${order.items?.length || 1} item(s)`}</p>
                          {extraItemsCount > 0 && (
                            <div className={styles.moreItemsBadge}>+{extraItemsCount} more item(s)</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={styles.orderId}>#{order.order_id || order.id}</td>
                    <td className={styles.orderDate}>{orderDate}</td>
                    <td className={styles.amount}>
                      {formatCurrency(orderTotal)}
                      <span className={styles.paymentTag}>{order.payment_method || "UPI / Card"}</span>
                    </td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <button
                          className={styles.trackLink}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(order);
                          }}
                        >
                          <span>Track Order</span>
                          <span>→</span>
                        </button>
                        <button
                          className={styles.trackLink}
                          style={{ color: "#c49a45" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setInvoiceOrder(order);
                          }}
                          title="View and print official GST Tax Invoice"
                        >
                          <span>📄 Invoice</span>
                        </button>
                        {isOrderProcessing(order.status) && (
                          <button
                            className={styles.trackLink}
                            style={{ color: "#dc2626" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOrderToCancel(order);
                            }}
                            title="Cancel this active order"
                          >
                            <span>✕ Cancel</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Order Tracking & Details Modal */}
      {selectedOrder && (
        <div className={styles.modalOverlay} onClick={() => setSelectedOrder(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className={styles.modalHeader}>
              <div>
                <h3>Order #{selectedOrder.order_id || selectedOrder.id}</h3>
                <p>
                  Placed on {selectedOrder.date || (selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleDateString("en-IN") : "Recent")} • {selectedOrder.payment_status || "Paid"} via {selectedOrder.payment_method || "Online"}
                </p>
              </div>
              <button className={styles.closeBtn} onClick={() => setSelectedOrder(null)}>
                ×
              </button>
            </div>

            {/* Live Progress Stepper */}
            <div className={styles.stepperContainer}>
              <div className={styles.stepperTitle}>Live Shipment Progress</div>
              <div className={styles.stepper}>
                {STEP_STAGES.map((step, idx) => {
                  const currentProgress = getStepProgress(selectedOrder.status);
                  const isCompleted = idx + 1 < currentProgress || currentProgress === 5;
                  const isActive = idx + 1 === currentProgress && currentProgress !== 5;

                  return (
                    <div
                      key={step.key}
                      className={`${styles.step} ${
                        isCompleted ? styles.stepCompleted : isActive ? styles.stepActive : ""
                      }`}
                    >
                      <div className={styles.stepDot}>
                        {isCompleted ? "✓" : idx + 1}
                      </div>
                      <div className={styles.stepLabel}>{step.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ordered Items */}
            <div className={styles.modalSection}>
              <div className={styles.modalSectionTitle}>Items in this Order</div>
              <div className={styles.itemsList}>
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  selectedOrder.items.map((item, idx) => (
                    <div key={idx} className={styles.modalItemRow}>
                      <div className={styles.modalItemLeft}>
                        <div className={styles.modalItemThumb}>
                          {item.image ? (
                            <Image src={item.image} alt={item.title} fill style={{ objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              💡
                            </div>
                          )}
                        </div>
                        <div>
                          <div className={styles.modalItemTitle}>{item.title}</div>
                          <div className={styles.modalItemVariant}>
                            Qty: {item.quantity} {item.variant ? `• ${item.variant}` : ""}
                          </div>
                        </div>
                      </div>
                      <div className={styles.modalItemPrice}>{formatCurrency(item.price)}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: "#777", fontSize: "0.85rem" }}>Order details unavailable.</div>
                )}
              </div>
            </div>

            {/* Delivery Destination */}
            {selectedOrder.shipping_address && (
              <div className={styles.modalSection}>
                <div className={styles.modalSectionTitle}>Shipping Destination</div>
                <div className={styles.shippingInfoBox}>
                  <strong>
                    {selectedOrder.shipping_address.first_name} {selectedOrder.shipping_address.last_name}
                  </strong>
                  <br />
                  {selectedOrder.shipping_address.street}
                  <br />
                  {selectedOrder.shipping_address.city}, {selectedOrder.shipping_address.state} - {selectedOrder.shipping_address.pin_code}
                  {selectedOrder.user_phone && <><br />Contact: {selectedOrder.user_phone}</>}
                </div>
              </div>
            )}

            {/* Payment & Price Summary */}
            <div className={styles.modalSection}>
              <div className={styles.modalSectionTitle}>Payment Summary</div>
              <div className={styles.summaryBox}>
                <div className={styles.summaryRow}>
                  <span>Subtotal</span>
                  <span>{formatCurrency(selectedOrder.subtotal || (selectedOrder.total ? selectedOrder.total * 0.82 : 0))}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>GST (18% Tax)</span>
                  <span>{formatCurrency(selectedOrder.gst || (selectedOrder.total ? selectedOrder.total * 0.18 : 0))}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Shipping & Handling</span>
                  <span style={{ color: "#166534", fontWeight: 600 }}>FREE</span>
                </div>
                <div className={styles.summaryTotalRow}>
                  <span>Total Amount Paid</span>
                  <span>{formatCurrency(selectedOrder.total || selectedOrder.amount)}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className={styles.modalActions}>
              <button
                className={styles.btnCloseModal}
                style={{ background: "#C89B60", color: "#111", fontWeight: 600, border: "none" }}
                onClick={() => setInvoiceOrder(selectedOrder)}
              >
                📄 View GST Invoice
              </button>
              {isOrderProcessing(selectedOrder.status) && (
                <button
                  className={styles.btnCancelOrder}
                  disabled={cancelLoading}
                  onClick={() => setOrderToCancel(selectedOrder)}
                >
                  Cancel Order
                </button>
              )}
              <button className={styles.btnCloseModal} onClick={() => setSelectedOrder(null)}>
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Cancelling Order */}
      {orderToCancel && (
        <div
          className={styles.modalOverlay}
          style={{ zIndex: 10000 }}
          onClick={() => !cancelLoading && setOrderToCancel(null)}
        >
          <div
            className={styles.modalContent}
            style={{ maxWidth: "460px", textAlign: "center", padding: "2rem 1.75rem" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              color: "#DC2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.25rem",
              fontSize: "1.6rem",
              fontWeight: "bold",
            }}>
              ⚠️
            </div>
            <h3 style={{
              fontSize: "1.35rem",
              fontWeight: 600,
              color: "#1F2937",
              margin: "0 0 0.5rem",
              fontFamily: "var(--font-libre), Georgia, serif"
            }}>
              Cancel Order #{orderToCancel.order_id || orderToCancel.id}?
            </h3>
            <p style={{
              fontSize: "0.88rem",
              color: "#6B7280",
              lineHeight: 1.55,
              margin: "0 0 1.75rem"
            }}>
              Are you sure you want to cancel this order? This action will halt order fulfillment, restore inventory stock, and mark your order as cancelled.
            </p>
            <div style={{ display: "flex", gap: "0.85rem", justifyContent: "center" }}>
              <button
                type="button"
                disabled={cancelLoading}
                onClick={() => setOrderToCancel(null)}
                style={{
                  flex: 1,
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  border: "1px solid #D1D5DB",
                  background: "#FFFFFF",
                  color: "#374151",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                Keep Order
              </button>
              <button
                type="button"
                disabled={cancelLoading}
                onClick={() => handleConfirmCancel(orderToCancel)}
                style={{
                  flex: 1,
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  border: "none",
                  background: "#DC2626",
                  color: "#FFFFFF",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {cancelLoading ? "Cancelling..." : "Yes, Cancel Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Tax Invoice Modal */}
      {invoiceOrder && (
        <OrderInvoiceModal
          order={invoiceOrder}
          onClose={() => setInvoiceOrder(null)}
        />
      )}
    </div>
  );
}
