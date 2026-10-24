"use client";

import React, { useState, useEffect } from "react";
import styles from "./ShiprocketFulfillmentModal.module.css";
import {
  UserOrder,
  AvailableCourier,
  checkOrderCouriers,
  createShiprocketShipment,
  assignShiprocketCourier,
  scheduleShiprocketPickup,
  fetchShippingLabel,
  fetchShippingInvoice,
  fetchOrderLiveTracking,
  cancelShiprocketShipment,
  createReturnOrder,
  restockReturnedOrder,
  LiveTrackingResponse,
} from "../services/api";

interface ShiprocketFulfillmentModalProps {
  order: UserOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: () => void;
}

const RETURN_REASONS = [
  "Damaged / broken glass or fixture during transit",
  "Defective electrical component / not turning on",
  "Incorrect item or finish color received",
  "Customer changed mind / return policy window",
  "Size / dimension mismatch with room ceiling",
];

export default function ShiprocketFulfillmentModal({
  order,
  isOpen,
  onClose,
  onOrderUpdated,
}: ShiprocketFulfillmentModalProps) {
  const [activeTab, setActiveTab] = useState<"ship" | "track" | "returns">("ship");

  // Forward Shipping Form
  const [weight, setWeight] = useState<number>(1.5);
  const [length, setLength] = useState<number>(30);
  const [breadth, setBreadth] = useState<number>(30);
  const [height, setHeight] = useState<number>(20);
  const [pickupLocation, setPickupLocation] = useState<string>("work");

  // Couriers
  const [couriers, setCouriers] = useState<AvailableCourier[]>([]);
  const [selectedCourierId, setSelectedCourierId] = useState<number | null>(null);
  const [isCheckingCouriers, setIsCheckingCouriers] = useState(false);

  // Actions Loading State
  const [isCreatingShipment, setIsCreatingShipment] = useState(false);
  const [isSchedulingPickup, setIsSchedulingPickup] = useState(false);
  const [pickupDate, setPickupDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [isGeneratingLabel, setIsGeneratingLabel] = useState(false);

  // Live Tracking
  const [trackingData, setTrackingData] = useState<LiveTrackingResponse | null>(null);
  const [isLoadingTracking, setIsLoadingTracking] = useState(false);

  // Reverse Logistics (Returns)
  const [returnReason, setReturnReason] = useState<string>(RETURN_REASONS[0]);
  const [isInitiatingReturn, setIsInitiatingReturn] = useState(false);
  const [isRestocking, setIsRestocking] = useState(false);

  // Local Order State to allow in-modal updates
  const [currentOrder, setCurrentOrder] = useState<UserOrder | null>(order);

  // Notifications
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  useEffect(() => {
    setCurrentOrder(order);
    if (order?.awb_code) {
      setActiveTab("track");
    } else {
      setActiveTab("ship");
    }
  }, [order]);

  // Load tracking automatically when clicking tracking tab
  useEffect(() => {
    if (activeTab === "track" && currentOrder?._id) {
      loadTracking(currentOrder._id);
    }
  }, [activeTab, currentOrder]);

  if (!isOpen || !currentOrder) return null;

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadTracking = async (orderId: string) => {
    setIsLoadingTracking(true);
    try {
      const data = await fetchOrderLiveTracking(orderId);
      setTrackingData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load tracking";
      showToast(msg, "error");
    } finally {
      setIsLoadingTracking(false);
    }
  };

  const handleCheckCouriers = async () => {
    if (!currentOrder._id) return;
    setIsCheckingCouriers(true);
    try {
      const res = await checkOrderCouriers(currentOrder._id, weight);
      setCouriers(res.couriers || []);
      if (res.couriers?.length > 0) {
        setSelectedCourierId(res.couriers[0].courier_company_id);
        showToast(`Found ${res.couriers.length} available courier services!`);
      } else {
        showToast("No couriers available for this pincode.", "error");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to check couriers";
      showToast(msg, "error");
    } finally {
      setIsCheckingCouriers(false);
    }
  };

  const handleCreateShipmentAndAWB = async () => {
    if (!currentOrder._id) return;
    setIsCreatingShipment(true);
    try {
      // Step 1: Create Shipment in Shiprocket
      const shipRes = await createShiprocketShipment(currentOrder._id, {
        weight,
        length,
        breadth,
        height,
        pickup_location: pickupLocation,
      });

      const shipmentId = shipRes.shiprocket_shipment_id;

      // Step 2: Assign courier & generate AWB
      const awbRes = await assignShiprocketCourier(
        currentOrder._id,
        shipmentId,
        selectedCourierId || undefined
      );

      showToast(`AWB ${awbRes.awb_code} generated via ${awbRes.courier_name}!`);

      setCurrentOrder((prev) =>
        prev
          ? {
              ...prev,
              shiprocket_order_id: shipRes.shiprocket_order_id,
              shiprocket_shipment_id: shipmentId,
              awb_code: awbRes.awb_code,
              courier_name: awbRes.courier_name,
              status: "Processing",
            }
          : null
      );

      onOrderUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate shipment";
      showToast(msg, "error");
    } finally {
      setIsCreatingShipment(false);
    }
  };

  const handleSchedulePickup = async () => {
    const shipmentId = currentOrder.shiprocket_shipment_id;
    if (!currentOrder._id || !shipmentId) return;

    setIsSchedulingPickup(true);
    try {
      await scheduleShiprocketPickup(currentOrder._id, Number(shipmentId), pickupDate);
      showToast(`Pickup scheduled successfully for ${pickupDate}!`);
      setCurrentOrder((prev) =>
        prev ? { ...prev, pickup_scheduled_date: pickupDate } : null
      );
      onOrderUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to schedule pickup";
      showToast(msg, "error");
    } finally {
      setIsSchedulingPickup(false);
    }
  };

  const handlePrintLabel = async () => {
    const shipmentId = currentOrder.shiprocket_shipment_id;
    if (!shipmentId) return;

    setIsGeneratingLabel(true);
    try {
      const res = await fetchShippingLabel(Number(shipmentId), currentOrder._id);
      if (res.label_url) {
        window.open(res.label_url, "_blank");
      } else {
        showToast("Label URL not available yet", "error");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to get label";
      showToast(msg, "error");
    } finally {
      setIsGeneratingLabel(false);
    }
  };

  const handlePrintInvoice = async () => {
    if (!currentOrder._id) return;
    try {
      const res = await fetchShippingInvoice(currentOrder._id);
      if (res.invoice_url) {
        window.open(res.invoice_url, "_blank");
      } else {
        showToast("Invoice URL not available yet", "error");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to get invoice";
      showToast(msg, "error");
    }
  };

  const handleCancelShipment = async () => {
    if (!currentOrder._id) return;
    if (!confirm("Are you sure you want to cancel this Shiprocket shipment and restore stock?")) return;

    try {
      await cancelShiprocketShipment(currentOrder._id);
      showToast("Shipment cancelled and inventory stock restored.");
      setCurrentOrder((prev) => (prev ? { ...prev, status: "Cancelled" } : null));
      onOrderUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to cancel shipment";
      showToast(msg, "error");
    }
  };

  const handleInitiateReturn = async () => {
    if (!currentOrder._id) return;
    setIsInitiatingReturn(true);
    try {
      const res = await createReturnOrder(currentOrder._id, returnReason, {
        weight,
        length,
        breadth,
        height,
      });

      showToast("Reverse pickup initiated! Return AWB created.");
      setCurrentOrder((prev) =>
        prev
          ? {
              ...prev,
              return_details: res.return_details as UserOrder["return_details"],
              status: "return_requested",
            }
          : null
      );
      onOrderUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to initiate return";
      showToast(msg, "error");
    } finally {
      setIsInitiatingReturn(false);
    }
  };

  const handleRestockInventory = async () => {
    if (!currentOrder._id) return;
    setIsRestocking(true);
    try {
      await restockReturnedOrder(currentOrder._id);
      showToast("Returned items restocked into store inventory!");
      setCurrentOrder((prev) =>
        prev
          ? {
              ...prev,
              return_details: {
                ...(prev.return_details || {}),
                restocked: true,
              },
              status: "returned",
            }
          : null
      );
      onOrderUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to restock";
      showToast(msg, "error");
    } finally {
      setIsRestocking(false);
    }
  };

  const hasAwb = !!currentOrder.awb_code;
  const returnDetails = currentOrder.return_details;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <div className={styles.headerTitle}>
              <span className={styles.logoBadge}>Shiprocket</span>
              <h3 className={styles.title}>Fulfillment & Reverse Logistics</h3>
            </div>
            <p className={styles.subtitle}>
              Order #{currentOrder.order_id || currentOrder._id} • {currentOrder.customer_name} •{" "}
              {currentOrder.shipping_address?.city}, {currentOrder.shipping_address?.pin_code}
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === "ship" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("ship")}
          >
            📦 1. Forward Shipment
          </button>
          <button
            className={`${styles.tab} ${activeTab === "track" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("track")}
          >
            🚚 2. Live Tracking
          </button>
          <button
            className={`${styles.tab} ${activeTab === "returns" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("returns")}
          >
            🔄 3. Return & Reverse Pickup
          </button>
        </div>

        {/* Body Content */}
        <div className={styles.body}>
          {toast && (
            <div
              className={toast.type === "success" ? styles.toastSuccess : styles.toastError}
            >
              {toast.text}
            </div>
          )}

          {/* TAB 1: FORWARD SHIPMENT */}
          {activeTab === "ship" && (
            <>
              {/* If AWB already generated */}
              {hasAwb ? (
                <div className={styles.card}>
                  <h4 className={styles.cardTitle}>
                    <span>✅ Active Shipment Details</span>
                    <button
                      className={styles.btnDanger}
                      onClick={handleCancelShipment}
                    >
                      Cancel Shipment
                    </button>
                  </h4>
                  <div className={styles.grid2} style={{ marginBottom: "1rem" }}>
                    <div>
                      <div className={styles.label}>Air Waybill (AWB Number)</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#d4af37" }}>
                        {currentOrder.awb_code}
                      </div>
                    </div>
                    <div>
                      <div className={styles.label}>Courier Partner</div>
                      <div style={{ fontSize: "1rem", fontWeight: 600 }}>
                        {currentOrder.courier_name || "Express Logistics"}
                      </div>
                    </div>
                  </div>

                  {/* Quick Print Actions */}
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
                    <button
                      className={styles.btnPrimary}
                      onClick={handlePrintLabel}
                      disabled={isGeneratingLabel}
                    >
                      🖨️ {isGeneratingLabel ? "Generating..." : "Print Shipping Label"}
                    </button>
                    <button className={styles.btnSecondary} onClick={handlePrintInvoice}>
                      📄 Download GST Invoice
                    </button>
                    <button
                      className={styles.btnSecondary}
                      onClick={() => setActiveTab("track")}
                    >
                      📍 View Live Tracking
                    </button>
                  </div>

                  {/* Schedule Pickup Section */}
                  <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <h5 style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", color: "#e5e7eb" }}>
                      📅 Courier Pickup Scheduling
                    </h5>
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                      <input
                        type="date"
                        className={styles.input}
                        value={pickupDate}
                        onChange={(e) => setPickupDate(e.target.value)}
                        style={{ maxWidth: "200px" }}
                      />
                      <button
                        className={styles.btnPrimary}
                        onClick={handleSchedulePickup}
                        disabled={isSchedulingPickup}
                      >
                        {isSchedulingPickup ? "Scheduling..." : "Schedule Pickup"}
                      </button>
                      {currentOrder.pickup_scheduled_date && (
                        <span style={{ fontSize: "0.8rem", color: "#10b981" }}>
                          ✓ Scheduled for {currentOrder.pickup_scheduled_date}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Generate New Shipment */
                <>
                  <div className={styles.card}>
                    <h4 className={styles.cardTitle}>
                      <span>1. Package Dimensions & Pickup Warehouse</span>
                    </h4>
                    <div className={styles.grid4}>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Weight (KG)</label>
                        <input
                          type="number"
                          step="0.1"
                          className={styles.input}
                          value={weight}
                          onChange={(e) => setWeight(parseFloat(e.target.value) || 0.5)}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Length (CM)</label>
                        <input
                          type="number"
                          className={styles.input}
                          value={length}
                          onChange={(e) => setLength(parseFloat(e.target.value) || 10)}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Breadth (CM)</label>
                        <input
                          type="number"
                          className={styles.input}
                          value={breadth}
                          onChange={(e) => setBreadth(parseFloat(e.target.value) || 10)}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Height (CM)</label>
                        <input
                          type="number"
                          className={styles.input}
                          value={height}
                          onChange={(e) => setHeight(parseFloat(e.target.value) || 10)}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                        Pickup Location: <strong style={{ color: "#d4af37" }}>work</strong> (Pincode: 385210)
                      </div>
                      <button
                        className={styles.btnSecondary}
                        onClick={handleCheckCouriers}
                        disabled={isCheckingCouriers}
                      >
                        {isCheckingCouriers ? "Checking..." : "🔍 Check Available Couriers & Rates"}
                      </button>
                    </div>
                  </div>

                  {/* Courier Selection */}
                  {couriers.length > 0 && (
                    <div className={styles.card}>
                      <h4 className={styles.cardTitle}>
                        <span>2. Choose Courier Partner</span>
                        <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                          Destination: {currentOrder.shipping_address?.pin_code}
                        </span>
                      </h4>

                      <div className={styles.courierList}>
                        {couriers.map((c) => (
                          <div
                            key={c.courier_company_id}
                            className={`${styles.courierCard} ${
                              selectedCourierId === c.courier_company_id
                                ? styles.selectedCourier
                                : ""
                            }`}
                            onClick={() => setSelectedCourierId(c.courier_company_id)}
                          >
                            <div className={styles.courierLeft}>
                              <input
                                type="radio"
                                name="courier"
                                checked={selectedCourierId === c.courier_company_id}
                                onChange={() => setSelectedCourierId(c.courier_company_id)}
                              />
                              <div>
                                <div className={styles.courierName}>
                                  {c.courier_name}
                                  {c.is_recommended && (
                                    <span className={styles.recBadge}>RECOMMENDED</span>
                                  )}
                                </div>
                                <div className={styles.courierMeta}>
                                  Est. Delivery: {c.estimated_delivery_days} days • Rating:{" "}
                                  {c.rating || "4.5"} ★
                                </div>
                              </div>
                            </div>
                            <div className={styles.courierPrice}>₹{c.rate}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ marginTop: "1.25rem", textAlign: "right" }}>
                        <button
                          className={styles.btnPrimary}
                          onClick={handleCreateShipmentAndAWB}
                          disabled={isCreatingShipment || !selectedCourierId}
                        >
                          {isCreatingShipment ? "Generating AWB..." : "🚀 Confirm & Generate AWB Code"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* TAB 2: LIVE TRACKING */}
          {activeTab === "track" && (
            <div className={styles.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 className={styles.cardTitle} style={{ margin: 0 }}>
                  🚚 Real-Time Courier Tracking
                </h4>
                <button
                  className={styles.btnSecondary}
                  onClick={() => currentOrder._id && loadTracking(currentOrder._id)}
                  disabled={isLoadingTracking}
                  style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
                >
                  {isLoadingTracking ? "Refreshing..." : "🔄 Refresh"}
                </button>
              </div>

              {/* Visual Stepper */}
              <div className={styles.stepper}>
                <div
                  className={`${styles.step} ${
                    currentOrder.status ? styles.stepCompleted : ""
                  }`}
                >
                  <div className={styles.stepDot}>1</div>
                  <div className={styles.stepLabel}>Order Placed</div>
                </div>
                <div
                  className={`${styles.step} ${
                    currentOrder.awb_code ? styles.stepCompleted : ""
                  }`}
                >
                  <div className={styles.stepDot}>2</div>
                  <div className={styles.stepLabel}>AWB Assigned</div>
                </div>
                <div
                  className={`${styles.step} ${
                    currentOrder.pickup_scheduled_date ? styles.stepCompleted : ""
                  }`}
                >
                  <div className={styles.stepDot}>3</div>
                  <div className={styles.stepLabel}>Pickup Scheduled</div>
                </div>
                <div
                  className={`${styles.step} ${
                    ["shipped", "out_for_delivery", "delivered"].includes(
                      (currentOrder.status || "").toLowerCase()
                    )
                      ? styles.stepCompleted
                      : ""
                  }`}
                >
                  <div className={styles.stepDot}>4</div>
                  <div className={styles.stepLabel}>In Transit</div>
                </div>
                <div
                  className={`${styles.step} ${
                    (currentOrder.status || "").toLowerCase() === "delivered"
                      ? styles.stepCompleted
                      : ""
                  }`}
                >
                  <div className={styles.stepDot}>5</div>
                  <div className={styles.stepLabel}>Delivered</div>
                </div>
              </div>

              {/* Transit Checkpoints */}
              <h5 style={{ margin: "1.25rem 0 0.5rem", fontSize: "0.85rem", color: "#9ca3af" }}>
                Hub Scan Activity Checkpoints:
              </h5>
              {trackingData?.activities && trackingData.activities.length > 0 ? (
                <div className={styles.activityLog}>
                  {trackingData.activities.map((act, idx) => (
                    <div key={idx} className={styles.activityItem}>
                      <div className={styles.activityTime}>{act.date}</div>
                      <div>
                        <div className={styles.activityDesc}>{act.activity || act.status}</div>
                        {act.location && (
                          <div className={styles.activityLocation}>📍 {act.location}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "1.5rem", color: "#9ca3af", fontSize: "0.85rem" }}>
                  {hasAwb
                    ? "Awaiting first hub physical scan by courier boy."
                    : "Generate an AWB number first to activate live tracking."}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: REVERSE LOGISTICS (RETURNS) */}
          {activeTab === "returns" && (
            <div className={styles.card}>
              <h4 className={styles.cardTitle}>
                <span>🔄 Return & Reverse Pickup Management</span>
                {returnDetails && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      background: "rgba(212,175,55,0.15)",
                      color: "#d4af37",
                      padding: "0.2rem 0.5rem",
                      borderRadius: "4px",
                    }}
                  >
                    STATUS: {returnDetails.return_status}
                  </span>
                )}
              </h4>

              {returnDetails ? (
                /* Return in Progress */
                <div>
                  <div className={styles.grid2} style={{ marginBottom: "1rem" }}>
                    <div>
                      <div className={styles.label}>Return AWB Code</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#d4af37" }}>
                        {returnDetails.return_awb_code || "Pending Courier Assignment"}
                      </div>
                    </div>
                    <div>
                      <div className={styles.label}>Reason for Return</div>
                      <div style={{ fontSize: "0.9rem", color: "#e5e7eb" }}>
                        {returnDetails.reason}
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: "0.85rem", background: "rgba(255,255,255,0.02)", borderRadius: "8px", marginBottom: "1rem" }}>
                    <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                      Destination Warehouse: <strong>work</strong> (Ahmedabad - Palanpur Hwy, Banaskantha 385210)
                    </div>
                  </div>

                  {/* Restock Inventory Button */}
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    {returnDetails.restocked ? (
                      <span style={{ color: "#10b981", fontSize: "0.9rem", fontWeight: 600 }}>
                        ✓ Returned items have been inspected and restocked into MongoDB inventory.
                      </span>
                    ) : (
                      <button
                        className={styles.btnPrimary}
                        onClick={handleRestockInventory}
                        disabled={isRestocking}
                      >
                        {isRestocking ? "Restocking..." : "📥 Confirm Received & Restock Inventory"}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* Initiate Reverse Pickup */
                <div>
                  <p style={{ fontSize: "0.85rem", color: "#9ca3af", margin: "0 0 1rem" }}>
                    Initiate courier pickup from the customer&apos;s address back to your primary warehouse (&apos;work&apos;).
                  </p>
                  <div className={styles.formGroup} style={{ marginBottom: "1rem" }}>
                    <label className={styles.label}>Select Return Reason</label>
                    <select
                      className={styles.select}
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                    >
                      {RETURN_REASONS.map((r, i) => (
                        <option key={i} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.card} style={{ background: "#1a1a20", marginBottom: "1rem" }}>
                    <div className={styles.label}>Customer Pickup Location</div>
                    <div style={{ fontSize: "0.9rem", color: "#ffffff", marginTop: "0.25rem" }}>
                      {currentOrder.customer_name} • {currentOrder.user_phone}
                      <br />
                      {currentOrder.shipping_address?.street}, {currentOrder.shipping_address?.city},{" "}
                      {currentOrder.shipping_address?.pin_code}
                    </div>
                  </div>

                  <button
                    className={styles.btnPrimary}
                    onClick={handleInitiateReturn}
                    disabled={isInitiatingReturn}
                  >
                    {isInitiatingReturn
                      ? "Initiating Reverse Pickup..."
                      : "🔄 Initiate Reverse Courier Pickup"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
