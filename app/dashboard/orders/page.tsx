"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";

// Register Community Modules only (Zero licence watermarks)
ModuleRegistry.registerModules([AllCommunityModule]);

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

const customerGridTheme = themeQuartz.withParams({
  backgroundColor: "#FFFFFF",
  foregroundColor: "#1A1A1A",
  chromeBackgroundColor: "#FAF7F2",
  headerBackgroundColor: "#FAF7F2",
  headerTextColor: "#555555",
  borderColor: "rgba(0, 0, 0, 0.07)",
  accentColor: "#C49A45",
  rowHoverColor: "#FAF8F5",
  selectedRowBackgroundColor: "rgba(196, 154, 69, 0.08)",
  inputFocusBorder: { color: "#C49A45" },
  fontFamily: "var(--font-inter), system-ui, sans-serif",
  fontSize: 13,
  dataFontSize: 13,
  headerFontSize: 11,
  headerFontWeight: 600,
  headerHeight: 40,
  rowHeight: 64,
  spacing: 5,
  cellHorizontalPadding: 14,
  wrapperBorder: true,
  wrapperBorderRadius: 10,
  borderRadius: 6,
});

function StatusBadge({ status }: { status: string }) {
  const s = (status || "Processing").toLowerCase();

  if (s === "return_requested") {
    return (
      <span className={`${styles.statusBadge} ${styles.badgeReturnPending}`}>
        ● Return Pending
      </span>
    );
  }
  if (s === "return_in_transit" || s === "return_approved") {
    return (
      <span className={`${styles.statusBadge} ${styles.badgeReturnApproved}`}>
        ● Return Approved
      </span>
    );
  }
  if (s === "return_rejected") {
    return (
      <span className={`${styles.statusBadge} ${styles.badgeReturnRejected}`}>
        ● Return Rejected
      </span>
    );
  }
  if (s === "returned") {
    return (
      <span className={`${styles.statusBadge} ${styles.badgeReturned}`}>
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
      ? "Paid"
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
  const [viewMode, setViewMode] = useState<"grid" | "cards">("grid");

  const [selectedOrder, setSelectedOrder] = useState<UserOrder | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<UserOrder | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<UserOrder | null>(null);

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
    setUploadedImages([]);
    setReturnError(null);
    setReturnSuccessMsg(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (uploadedImages.length + files.length > 4) {
      setReturnError("Maximum 4 images allowed per return request.");
      return;
    }

    setIsUploading(true);
    setReturnError(null);

    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) continue;
        const res = await uploadCmsImage(file);
        if (res) {
          const urlStr = typeof res === "string" ? res : (res as any)?.url || "";
          if (urlStr) newUrls.push(urlStr);
        }
      }
      setUploadedImages((prev) => [...prev, ...newUrls]);
    } catch {
      setReturnError("Failed to upload image. Please check file size/format.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setUploadedImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnModalOrder) return;
    const orderId = returnModalOrder.order_id || returnModalOrder.id || returnModalOrder._id;
    if (!orderId) {
      setReturnError("Order ID missing.");
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
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
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
  }, [orders, activeTab, search]);

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

  const getStepProgress = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "delivered") return 5;
    if (s === "shipped") return 3;
    if (s === "processing") return 2;
    if (s === "cancelled") return 0;
    return 1;
  };

  // AG Grid Column Definitions
  const columnDefs: ColDef<UserOrder>[] = useMemo(
    () => [
      {
        headerName: "PRODUCT ITEM",
        field: "items",
        flex: 2,
        minWidth: 240,
        cellRenderer: (params: ICellRendererParams<UserOrder>) => {
          const order = params.data;
          if (!order) return null;
          const firstItem = order.items && order.items.length > 0 ? order.items[0] : null;
          const extra = (order.items?.length || 1) - 1;
          return (
            <div className={styles.gridProductCell}>
              <div className={styles.gridThumbWrapper}>
                {firstItem?.image ? (
                  <Image src={firstItem.image} alt={firstItem.title || "Luminaire"} fill sizes="48px" className={styles.gridThumbImg} />
                ) : (
                  <span className={styles.gridThumbFallback}>💡</span>
                )}
              </div>
              <div className={styles.gridProductInfo}>
                <div className={styles.gridProductTitle}>{firstItem?.title || "Luxury Luminaire"}</div>
                <div className={styles.gridProductSub}>
                  {firstItem?.variant || "Architectural Spec"}
                  {extra > 0 && <span className={styles.gridExtraPill}>+{extra} more</span>}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        headerName: "ORDER REF",
        field: "order_number",
        flex: 1,
        minWidth: 140,
        cellRenderer: (params: ICellRendererParams<UserOrder>) => {
          return <span className={styles.gridOrderRef}>{formatOrderReference(params.data)}</span>;
        },
      },
      {
        headerName: "DATE",
        field: "created_at",
        width: 120,
        cellRenderer: (params: ICellRendererParams<UserOrder>) => {
          const dateStr = params.data?.date || (params.data?.created_at ? new Date(params.data.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Recent");
          return <span className={styles.gridDateText}>{dateStr}</span>;
        },
      },
      {
        headerName: "TOTAL AMOUNT",
        field: "total",
        width: 140,
        cellRenderer: (params: ICellRendererParams<UserOrder>) => {
          const total = params.data?.total || params.data?.amount || 0;
          return (
            <div className={styles.gridAmountCell}>
              <span className={styles.gridAmountNum}>{formatCurrency(total)}</span>
              <span className={styles.gridPaymentMode}>{params.data?.payment_method || "Online"}</span>
            </div>
          );
        },
      },
      {
        headerName: "STATUS",
        field: "status",
        width: 140,
        cellRenderer: (params: ICellRendererParams<UserOrder>) => {
          return <StatusBadge status={params.value} />;
        },
      },
      {
        headerName: "ACTIONS",
        width: 190,
        sortable: false,
        filter: false,
        cellRenderer: (params: ICellRendererParams<UserOrder>) => {
          const order = params.data;
          if (!order) return null;
          return (
            <div className={styles.gridActionsCell}>
              <button
                type="button"
                className={styles.gridBtnAction}
                onClick={() => setSelectedOrder(order)}
                title="Track real-time shipment status"
              >
                Track →
              </button>
              <button
                type="button"
                className={styles.gridBtnInvoice}
                onClick={() => setInvoiceOrder(order)}
                title="View and download Tax Invoice"
              >
                GST Invoice
              </button>
            </div>
          );
        },
      },
    ],
    []
  );

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My Orders</h1>
          <p className={styles.subtitle}>
            Monitor white-glove shipments, retrieve GST invoices, and track live transit milestones.
          </p>
        </div>
        <button className={styles.btnRefresh} onClick={loadOrders} title="Refresh orders list">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      {/* Modern Filter Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search Order ID or Luminaire..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Tab Filters */}
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

        {/* View Toggle */}
        <div className={styles.viewToggleGroup}>
          <button
            type="button"
            className={`${styles.viewBtn} ${viewMode === "grid" ? styles.viewBtnActive : ""}`}
            onClick={() => setViewMode("grid")}
            title="AG-Grid Table View"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <button
            type="button"
            className={`${styles.viewBtn} ${viewMode === "cards" ? styles.viewBtnActive : ""}`}
            onClick={() => setViewMode("cards")}
            title="Card View"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className={styles.loadingBox}>
          <div className={styles.loadingSpinner} />
          <span>Synchronising order records...</span>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C49A45" strokeWidth="1.5">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <h3 className={styles.emptyTitle}>No orders found</h3>
          <p className={styles.emptySubtitle}>
            {search
              ? `No records matching "${search}" found in ${activeTab}.`
              : `You do not have any ${activeTab !== "All" ? activeTab.toLowerCase() : ""} orders.`}
          </p>
          <Link href="/shop" className={styles.emptyBtn}>
            Explore Lighting Collection →
          </Link>
        </div>
      ) : viewMode === "grid" ? (
        /* AG-Grid Table View */
        <div className={styles.agGridWrapper}>
          <AgGridReact
            theme={customerGridTheme}
            rowData={filteredOrders}
            columnDefs={columnDefs}
            domLayout="autoHeight"
            pagination={true}
            paginationPageSize={10}
            paginationPageSizeSelector={[10, 25, 50]}
            onRowClicked={(event) => {
              if (event.data) setSelectedOrder(event.data);
            }}
          />
        </div>
      ) : (
        /* Luxury Cards View */
        <div className={styles.cardList}>
          {filteredOrders.map((order, i) => {
            const firstItem = order.items && order.items.length > 0 ? order.items[0] : null;
            const extra = (order.items?.length || 1) - 1;
            const total = order.total || order.amount || 0;
            const dateStr = order.date || (order.created_at ? new Date(order.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Recent");

            return (
              <div key={order.order_id || order.id || i} className={styles.orderCard}>
                <div className={styles.orderCardHeader}>
                  <div className={styles.cardHeaderLeft}>
                    <span className={styles.orderCardRef}>{formatOrderReference(order)}</span>
                    <span className={styles.orderCardDate}>{dateStr}</span>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                <div className={styles.orderCardBody}>
                  <div className={styles.cardProductRow}>
                    <div className={styles.cardThumbWrapper}>
                      {firstItem?.image ? (
                        <Image src={firstItem.image} alt={firstItem.title || "Product"} fill sizes="60px" style={{ objectFit: "cover" }} />
                      ) : (
                        <span>💡</span>
                      )}
                    </div>
                    <div className={styles.cardProductDetails}>
                      <h4 className={styles.cardProductTitle}>{firstItem?.title || "Luxury Luminaire"}</h4>
                      <div className={styles.cardProductVariant}>
                        {firstItem?.variant || "Standard Finish"}
                        {extra > 0 && <span className={styles.extraBadge}>+{extra} more item(s)</span>}
                      </div>
                      <div className={styles.cardPriceRow}>
                        <strong>{formatCurrency(total)}</strong>
                        <span className={styles.paymentMethodPill}>{order.payment_method || "Online"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.orderCardFooter}>
                  <button
                    type="button"
                    className={styles.cardBtnTrack}
                    onClick={() => setSelectedOrder(order)}
                  >
                    Track Shipment →
                  </button>
                  <button
                    type="button"
                    className={styles.cardBtnInvoice}
                    onClick={() => setInvoiceOrder(order)}
                  >
                    GST Invoice
                  </button>
                  {isOrderProcessing(order.status) && (
                    <button
                      type="button"
                      className={styles.cardBtnCancel}
                      onClick={() => setOrderToCancel(order)}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Order Tracking & Details Modal */}
      {selectedOrder && (
        <div className={styles.modalOverlay} onClick={() => setSelectedOrder(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>Order {formatOrderReference(selectedOrder)}</h3>
                <p className={styles.modalSub}>
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
                    <div style={{ fontSize: "0.78rem", background: "rgba(196, 154, 69, 0.12)", border: "1px solid rgba(196, 154, 69, 0.3)", color: "#8C6228", padding: "0.2rem 0.55rem", borderRadius: "6px", fontWeight: 600 }}>
                      🚚 {selectedOrder.courier_name || "Shiprocket Logistics"} • AWB: {selectedOrder.awb_code}
                    </div>
                    <a
                      href={`https://shiprocket.co/tracking/${selectedOrder.awb_code}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: "0.78rem", color: "#8C6228", textDecoration: "underline", fontWeight: 600 }}
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
                <div style={{ marginTop: "0.85rem", paddingTop: "0.65rem", borderTop: "1px dashed rgba(0,0,0,0.08)" }}>
                  <div style={{ fontSize: "0.76rem", color: "#6B7280", marginBottom: "0.3rem" }}>Latest Transit Scans:</div>
                  {selectedOrder.tracking_activities.slice(-2).reverse().map((act, idx) => (
                    <div key={idx} style={{ fontSize: "0.78rem", color: "#1A1A1A", marginBottom: "0.2rem" }}>
                      • <strong style={{ color: "#C49A45" }}>{act.status || act.activity}</strong> {act.location ? `at ${act.location}` : ""} ({act.date})
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
                  <span>Total Amount</span>
                  <span>{formatCurrency(selectedOrder.total || selectedOrder.amount)}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className={styles.modalActions}>
              <button
                className={styles.btnActionPrimary}
                onClick={() => setInvoiceOrder(selectedOrder)}
              >
                📄 GST Tax Invoice
              </button>
              {((selectedOrder.status || "").toLowerCase() === "delivered" && !selectedOrder.return_details) && (
                <button
                  className={styles.btnActionReturn}
                  onClick={() => handleOpenReturnModal(selectedOrder)}
                >
                  🔄 Request Return
                </button>
              )}
              {isOrderProcessing(selectedOrder.status) && (
                <button
                  className={styles.btnActionCancel}
                  disabled={cancelLoading}
                  onClick={() => setOrderToCancel(selectedOrder)}
                >
                  Cancel Order
                </button>
              )}
              <button className={styles.btnActionClose} onClick={() => setSelectedOrder(null)}>
                Close
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
            style={{ maxWidth: "520px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>Request Return / Replacement</h3>
                <p className={styles.modalSub}>Order {formatOrderReference(returnModalOrder)}</p>
              </div>
              <button className={styles.closeBtn} onClick={handleCloseReturnModal}>
                ×
              </button>
            </div>

            {returnSuccessMsg ? (
              <div style={{ textAlign: "center", padding: "1.5rem 1rem" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✅</div>
                <h4 style={{ color: "#166534", fontSize: "1.05rem", marginBottom: "0.35rem" }}>
                  Return Request Submitted!
                </h4>
                <p style={{ color: "#4B5563", fontSize: "0.82rem", lineHeight: 1.45 }}>
                  {returnSuccessMsg}
                </p>
                <button
                  className={styles.btnActionPrimary}
                  style={{ marginTop: "1rem" }}
                  onClick={handleCloseReturnModal}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitReturn} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {returnError && (
                  <div className={styles.alertError}>
                    {returnError}
                  </div>
                )}

                <div>
                  <label className={styles.modalLabel}>Reason for Return *</label>
                  <select
                    className={styles.modalSelect}
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    required
                  >
                    {CUSTOMER_RETURN_REASONS.map((r, idx) => (
                      <option key={idx} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={styles.modalLabel}>Defect Details &amp; Packaging Notes</label>
                  <textarea
                    className={styles.modalTextarea}
                    rows={3}
                    placeholder="Please explain the issue in detail..."
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                  />
                </div>

                <div>
                  <label className={styles.modalLabel}>Upload Photos (Max 4)</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={isUploading || uploadedImages.length >= 4}
                    onChange={handleImageUpload}
                    style={{ fontSize: "0.8rem" }}
                  />
                  {uploadedImages.length > 0 && (
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                      {uploadedImages.map((url, i) => (
                        <div key={i} style={{ position: "relative", width: "48px", height: "48px", borderRadius: "4px", overflow: "hidden", border: "1px solid #DDD" }}>
                          <Image src={url} alt="Upload" fill style={{ objectFit: "cover" }} />
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(i)}
                            style={{ position: "absolute", top: 0, right: 0, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", fontSize: "10px", width: "16px", height: "16px", cursor: "pointer" }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.btnActionClose}
                    onClick={handleCloseReturnModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReturn || isUploading}
                    className={styles.btnActionPrimary}
                  >
                    {isSubmittingReturn ? "Submitting..." : "Submit Return"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Cancel Order Confirmation Modal */}
      {orderToCancel && (
        <div className={styles.modalOverlay} onClick={() => setOrderToCancel(null)}>
          <div className={styles.modalContent} style={{ maxWidth: "420px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: "1.15rem", marginBottom: "0.5rem", color: "#DC2626" }}>Cancel Order?</h3>
            <p style={{ fontSize: "0.82rem", color: "#6B7280", lineHeight: 1.45, marginBottom: "1rem" }}>
              Are you sure you want to cancel order {formatOrderReference(orderToCancel)}? If payment was made, your refund will be credited back via original method.
            </p>
            <div style={{ display: "flex", gap: "0.65rem", justifyContent: "center" }}>
              <button
                type="button"
                className={styles.btnActionClose}
                onClick={() => setOrderToCancel(null)}
              >
                Keep Order
              </button>
              <button
                type="button"
                disabled={cancelLoading}
                className={styles.btnActionCancel}
                onClick={() => handleConfirmCancel(orderToCancel)}
              >
                {cancelLoading ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tax Invoice Modal */}
      {invoiceOrder && (
        <OrderInvoiceModal
          order={invoiceOrder}
          onClose={() => setInvoiceOrder(null)}
        />
      )}
    </div>
  );
}
