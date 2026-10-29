"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import {
  fetchUserOrders,
  cancelUserOrder,
  requestCustomerReturn,
  uploadCmsImage,
  UserOrder,
} from "../../services/api";
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

const CUSTOMER_RETURN_REASONS = [
  "Damaged in transit / Broken glass or fixture",
  "Defective electrical component / Not turning on",
  "Incorrect item or finish color received",
  "Size / dimension mismatch with room ceiling",
  "Missing parts, screws or mounting accessories",
  "Other quality defect",
];

function StatusBadge({ status }: { status: string }) {
  const s = (status || "Processing").toLowerCase();

  if (s === "return_requested") {
    return (
      <span
        className={styles.statusBadge}
        style={{ background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" }}
      >
        ● Return Pending
      </span>
    );
  }
  if (s === "return_in_transit" || s === "return_approved") {
    return (
      <span
        className={styles.statusBadge}
        style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" }}
      >
        ● Return Approved
      </span>
    );
  }
  if (s === "return_rejected") {
    return (
      <span
        className={styles.statusBadge}
        style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}
      >
        ● Return Rejected
      </span>
    );
  }
  if (s === "returned") {
    return (
      <span
        className={styles.statusBadge}
        style={{ background: "#eef2ff", color: "#4338ca", border: "1px solid #c7d2fe" }}
      >
        ● Returned
      </span>
    );
  }

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

function formatOrderReference(order: any): string {
  if (order?.order_number) return `#${order.order_number}`;
  const rawId = String(order?.id || order?._id || order?.order_id || "");
  if (rawId.length >= 24) {
    const d = order?.created_at ? new Date(order.created_at) : new Date();
    const yymm = `${d.getFullYear().toString().slice(-2)}${String(d.getMonth() + 1).padStart(2, "0")}`;
    return `#DLX-${yymm}-${rawId.slice(-4).toUpperCase()}`;
  }
  return rawId ? `#${rawId}` : "#DLX";
}

export default function OrdersPage() {
  const { user } = useAuth();
  const userEmail = (user as Record<string, string>)?.email || "";

  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");

  const [selectedOrder, setSelectedOrder] = useState<UserOrder | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<UserOrder | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Return request modal state
  const [returnModalOrder, setReturnModalOrder] = useState<UserOrder | null>(null);
  const [returnReason, setReturnReason] = useState<string>(CUSTOMER_RETURN_REASONS[0]);
  const [customerNotes, setCustomerNotes] = useState<string>("");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState<boolean>(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnSuccessMsg, setReturnSuccessMsg] = useState<string | null>(null);

  const handleOpenReturnModal = (order: UserOrder) => {
    setReturnModalOrder(order);
    setReturnReason(CUSTOMER_RETURN_REASONS[0]);
    setCustomerNotes("");
    setUploadedImages([]);
    setReturnError(null);
    setReturnSuccessMsg(null);
  };

  const handleCloseReturnModal = () => {
    setReturnModalOrder(null);
    setReturnError(null);
    setReturnSuccessMsg(null);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setReturnError(null);

    try {
      const uploadPromises = Array.from(files).map((file) => uploadCmsImage(file));
      const urls = await Promise.all(uploadPromises);
      setUploadedImages((prev) => [...prev, ...urls]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to upload photo";
      setReturnError(msg);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleRemoveUploadedPhoto = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitReturn = async () => {
    if (!returnModalOrder) return;
    const orderId = returnModalOrder.order_id || returnModalOrder.id || returnModalOrder._id;
    if (!orderId) return;

    if (uploadedImages.length === 0) {
      setReturnError("Please upload at least 1 photograph of the defective or damaged fixture for inspection.");
      return;
    }

    setIsSubmittingReturn(true);
    setReturnError(null);

    try {
      const res = await requestCustomerReturn({
        order_id: orderId,
        reason: returnReason,
        customer_notes: customerNotes.trim(),
        images: uploadedImages,
        customer_email: userEmail || returnModalOrder.user_email,
      });

      setReturnSuccessMsg(res.message || "Return request submitted successfully!");
      await loadOrders();

      if (
        selectedOrder &&
        (selectedOrder.order_id === orderId || selectedOrder.id === orderId || selectedOrder._id === orderId)
      ) {
        setSelectedOrder((prev) =>
          prev
            ? {
                ...prev,
                status: "return_requested",
                return_details: res.return_details as UserOrder["return_details"],
              }
            : null
        );
      }

      setTimeout(() => {
        handleCloseReturnModal();
      }, 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit return request";
      setReturnError(msg);
    } finally {
      setIsSubmittingReturn(false);
    }
  };

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

    const matchesId = (order.order_number || order.order_id || order.id || "").toLowerCase().includes(q);
    const matchesItem = (order.items || []).some((item) =>
      (item.title || "").toLowerCase().includes(q)
    );
    const matchesCustomer = (order.customer_name || "").toLowerCase().includes(q);

    return statusMatch && (matchesId || matchesItem || matchesCustomer);
  });

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to cancel this order?")) return;
    setCancelLoading(true);
    try {
      await cancelUserOrder(orderId, userEmail);
      await loadOrders();
      if (selectedOrder && (selectedOrder.order_id === orderId || selectedOrder.id === orderId)) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: "Cancelled" } : null));
      }
    } catch (err) {
      console.error("Failed to cancel order:", err);
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
                    <td className={styles.orderId}>{formatOrderReference(order)}</td>
                    <td className={styles.orderDate}>{orderDate}</td>
                    <td className={styles.amount}>
                      {formatCurrency(orderTotal)}
                      <span className={styles.paymentTag}>{order.payment_method || "UPI / Card"}</span>
                    </td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button
                          className={styles.trackLink}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(order);
                          }}
                        >
                          <span>Track</span>
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
                        {((order.status || "").toLowerCase() === "delivered" ||
                          order.status === "return_requested" ||
                          order.return_details) && (
                          <button
                            className={styles.returnBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (order.status === "return_requested" || order.return_details) {
                                setSelectedOrder(order);
                              } else {
                                handleOpenReturnModal(order);
                              }
                            }}
                            title="Request return or check reverse pickup status"
                          >
                            {order.status === "return_requested" ||
                            (order.return_details && order.return_details.status === "PENDING_APPROVAL")
                              ? "⏳ Return Review"
                              : order.return_details?.status === "APPROVED"
                              ? "✓ Return Active"
                              : "🔄 Return Item"}
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
                <h3>Order {formatOrderReference(selectedOrder)}</h3>
                <p>
                  Placed on {selectedOrder.date || (selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleDateString("en-IN") : "Recent")} • {selectedOrder.payment_status || "Paid"} via {selectedOrder.payment_method || "Online"}
                </p>
              </div>
              <button className={styles.closeBtn} onClick={() => setSelectedOrder(null)}>
                ×
              </button>
            </div>

            {/* Return & Reverse Logistics Banner */}
            {selectedOrder.return_details && (
              <div
                className={`${styles.returnBanner} ${
                  selectedOrder.return_details.status === "PENDING_APPROVAL"
                    ? styles.returnBannerPending
                    : selectedOrder.return_details.status === "APPROVED"
                    ? styles.returnBannerApproved
                    : styles.returnBannerRejected
                }`}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.95rem", fontWeight: 700 }}>
                      {selectedOrder.return_details.status === "PENDING_APPROVAL"
                        ? "⏳ Return Request Under Review"
                        : selectedOrder.return_details.status === "APPROVED"
                        ? "✓ Return Approved • Reverse Pickup Scheduled"
                        : "✕ Return Request Rejected"}
                    </h4>
                    <p style={{ margin: "0 0 0.5rem", fontSize: "0.82rem", lineHeight: 1.4 }}>
                      {selectedOrder.return_details.status === "PENDING_APPROVAL"
                        ? "Our technical support team is inspecting your uploaded photos and defect notes. Once verified by admin, reverse pickup will be booked with Shiprocket automatically."
                        : selectedOrder.return_details.status === "APPROVED"
                        ? `A courier boy will arrive at your address for pickup. Return AWB: ${selectedOrder.return_details.return_awb_code || "Generated"} (${selectedOrder.return_details.courier_name || "Express Courier"}).`
                        : `Your return request was not approved. Reason: ${selectedOrder.return_details.rejection_reason || "Requirements not met."}`}
                    </p>
                    <div style={{ fontSize: "0.78rem" }}>
                      <strong>Reason:</strong> {selectedOrder.return_details.reason}
                    </div>
                  </div>
                  {selectedOrder.return_details.return_awb_code && (
                    <a
                      href={`https://shiprocket.co/tracking/${selectedOrder.return_details.return_awb_code}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: "0.78rem",
                        background: "#166534",
                        color: "#fff",
                        padding: "0.3rem 0.65rem",
                        borderRadius: "6px",
                        textDecoration: "none",
                        fontWeight: 600,
                      }}
                    >
                      Track Return on Shiprocket ↗
                    </a>
                  )}
                </div>

                {selectedOrder.return_details.images && selectedOrder.return_details.images.length > 0 && (
                  <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px dashed rgba(0,0,0,0.1)" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                      Your Uploaded Defect Photos ({selectedOrder.return_details.images.length}):
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      {selectedOrder.return_details.images.map((imgUrl, idx) => (
                        <a key={idx} href={imgUrl} target="_blank" rel="noreferrer" style={{ position: "relative", width: "54px", height: "54px", borderRadius: "6px", overflow: "hidden", border: "1px solid rgba(0,0,0,0.15)", display: "block" }}>
                          <Image src={imgUrl} alt="Customer upload" fill sizes="60px" style={{ objectFit: "cover" }} />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Live Progress Stepper */}
            <div className={styles.stepperContainer}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <div className={styles.stepperTitle} style={{ margin: 0 }}>Live Shipment Progress</div>
                {selectedOrder.awb_code && (
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <div style={{ fontSize: "0.82rem", background: "rgba(212, 175, 55, 0.12)", border: "1px solid rgba(212, 175, 55, 0.3)", color: "#d4af37", padding: "0.25rem 0.65rem", borderRadius: "6px", fontWeight: 600 }}>
                      🚚 {selectedOrder.courier_name || "Shiprocket Logistics"} • AWB: {selectedOrder.awb_code}
                    </div>
                    <a
                      href={`https://shiprocket.co/tracking/${selectedOrder.awb_code}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: "0.8rem", color: "#8C6228", textDecoration: "underline", fontWeight: 600 }}
                      title="Open tracking directly on official Shiprocket portal"
                    >
                      Shiprocket Portal ↗
                    </a>
                  </div>
                )}
              </div>
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

              {selectedOrder.tracking_activities && selectedOrder.tracking_activities.length > 0 && (
                <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px dashed rgba(255,255,255,0.1)" }}>
                  <div style={{ fontSize: "0.78rem", color: "#9ca3af", marginBottom: "0.35rem" }}>Latest Transit Scans:</div>
                  {selectedOrder.tracking_activities.slice(-2).reverse().map((act, idx) => (
                    <div key={idx} style={{ fontSize: "0.8rem", color: "#e5e7eb", marginBottom: "0.25rem" }}>
                      • <strong style={{ color: "#d4af37" }}>{act.status || act.activity}</strong> {act.location ? `at ${act.location}` : ""} ({act.date})
                    </div>
                  ))}
                </div>
              )}
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
              {((selectedOrder.status || "").toLowerCase() === "delivered" && !selectedOrder.return_details) && (
                <button
                  className={styles.btnCloseModal}
                  style={{ background: "#8C6228", color: "#fff", fontWeight: 600, border: "none" }}
                  onClick={() => handleOpenReturnModal(selectedOrder)}
                >
                  🔄 Request Return / Replace
                </button>
              )}
              {(selectedOrder.status || "").toLowerCase() === "processing" && (
                <button
                  className={styles.btnCancelOrder}
                  disabled={cancelLoading}
                  onClick={() => handleCancelOrder(selectedOrder.order_id || selectedOrder.id || "")}
                >
                  {cancelLoading ? "Cancelling..." : "Cancel Order"}
                </button>
              )}
              <button className={styles.btnCloseModal} onClick={() => setSelectedOrder(null)}>
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Return Request Modal */}
      {returnModalOrder && (
        <div className={styles.modalOverlay} onClick={handleCloseReturnModal}>
          <div
            className={styles.modalContent}
            style={{ maxWidth: "560px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <h3>Request Return / Replacement</h3>
                <p>Order #{returnModalOrder.order_id || returnModalOrder.id || returnModalOrder._id}</p>
              </div>
              <button className={styles.closeBtn} onClick={handleCloseReturnModal}>
                ×
              </button>
            </div>

            {returnSuccessMsg ? (
              <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>✅</div>
                <h4 style={{ color: "#166534", fontSize: "1.15rem", marginBottom: "0.5rem" }}>
                  Return Request Submitted!
                </h4>
                <p style={{ color: "#4b5563", fontSize: "0.85rem", lineHeight: 1.5 }}>
                  {returnSuccessMsg}
                </p>
                <button
                  className={styles.submitReturnBtn}
                  style={{ marginTop: "1.25rem", width: "auto", display: "inline-block" }}
                  onClick={handleCloseReturnModal}
                >
                  Done
                </button>
              </div>
            ) : (
              <div>
                {returnError && (
                  <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", color: "#b91c1c", padding: "0.65rem 0.9rem", borderRadius: "8px", fontSize: "0.85rem", marginBottom: "1rem" }}>
                    ⚠️ {returnError}
                  </div>
                )}

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Reason for Return *</label>
                  <select
                    className={styles.formSelect}
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                  >
                    {CUSTOMER_RETURN_REASONS.map((reason, idx) => (
                      <option key={idx} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Problem Description / Notes</label>
                  <textarea
                    className={styles.formTextarea}
                    rows={3}
                    placeholder="Describe the issue with the fixture (e.g. cracked glass globe, electrical connector loose)..."
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    Upload Photos of Damaged / Defective Fixture *
                    <span style={{ fontWeight: 400, color: "#6b7280", marginLeft: "0.35rem" }}>
                      (At least 1 photo required for admin approval)
                    </span>
                  </label>
                  
                  <label className={styles.uploadZone}>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      style={{ display: "none" }}
                      onChange={handlePhotoUpload}
                      disabled={isUploading}
                    />
                    <div style={{ fontSize: "1.75rem", marginBottom: "0.25rem" }}>📷</div>
                    <div style={{ fontWeight: 600, color: "#8C6228", fontSize: "0.88rem" }}>
                      {isUploading ? "Uploading photos..." : "Click to select or drag defect photos"}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.25rem" }}>
                      PNG, JPG, WebP up to 10MB
                    </div>
                  </label>

                  {/* Photo Preview Grid */}
                  {uploadedImages.length > 0 && (
                    <div className={styles.photoPreviewGrid}>
                      {uploadedImages.map((imgUrl, idx) => (
                        <div key={idx} className={styles.photoPreviewCard}>
                          <Image
                            src={imgUrl}
                            alt={`Upload ${idx + 1}`}
                            fill
                            sizes="80px"
                            style={{ objectFit: "cover" }}
                          />
                          <button
                            type="button"
                            className={styles.btnRemovePhoto}
                            onClick={() => handleRemoveUploadedPhoto(idx)}
                            title="Remove photo"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: "1.5rem" }}>
                  <button
                    type="button"
                    className={styles.submitReturnBtn}
                    onClick={handleSubmitReturn}
                    disabled={isSubmittingReturn || isUploading}
                  >
                    {isSubmittingReturn
                      ? "Submitting Return Request..."
                      : "Submit Return Request for Admin Approval"}
                  </button>
                </div>
              </div>
            )}
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
