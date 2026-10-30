"use client";

import React, { useEffect, useState, useMemo } from "react";
import styles from "./shippingSettings.module.css";
import {
  fetchAdminShippingSettings,
  updateAdminShippingSettings,
  ShippingSettings,
  fetchShiprocketWallet,
  fetchShiprocketPickupLocations,
  ShiprocketWalletInfo,
  ShiprocketPickupLocation,
} from "../../services/api";

const DEFAULT_SETTINGS: ShippingSettings = {
  standard_delivery_fee: 99.0,
  free_shipping_enabled: true,
  free_shipping_threshold: 1999.0,
  min_order_value_enabled: true,
  min_order_value: 499.0,
  min_order_message: "Minimum order value of ₹{amount} is required to place an order.",
  cod_enabled: true,
  cod_extra_fee: 0.0,
  cod_max_order_value: 25000.0,
  estimated_delivery_days: "3-5 business days",
  white_glove_note: "Complimentary white-glove packaging on all luminaire orders.",
};

export default function ShippingSettingsPage() {
  const [settings, setSettings] = useState<ShippingSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Shiprocket Logistics Status State
  const [walletInfo, setWalletInfo] = useState<ShiprocketWalletInfo | null>(null);
  const [pickupLocations, setPickupLocations] = useState<ShiprocketPickupLocation[]>([]);
  const [loadingSr, setLoadingSr] = useState(false);

  // Simulator test cart amount
  const [simCartAmount, setSimCartAmount] = useState<number>(1500);

  useEffect(() => {
    loadSettings();
    loadSrData();
  }, []);

  const loadSrData = async () => {
    setLoadingSr(true);
    try {
      const [wallet, locs] = await Promise.all([
        fetchShiprocketWallet().catch(() => null),
        fetchShiprocketPickupLocations().catch(() => ({ success: false, locations: [] })),
      ]);
      if (wallet) setWalletInfo(wallet);
      if (locs?.locations) setPickupLocations(locs.locations);
    } catch {
      // ignore
    } finally {
      setLoadingSr(false);
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminShippingSettings();
      if (data) {
        setSettings({
          standard_delivery_fee: Number(data.standard_delivery_fee ?? 99),
          free_shipping_enabled: Boolean(data.free_shipping_enabled ?? true),
          free_shipping_threshold: Number(data.free_shipping_threshold ?? 1999),
          min_order_value_enabled: Boolean(data.min_order_value_enabled ?? true),
          min_order_value: Number(data.min_order_value ?? 499),
          min_order_message: data.min_order_message || "Minimum order value of ₹{amount} is required to place an order.",
          cod_enabled: Boolean(data.cod_enabled ?? true),
          cod_extra_fee: Number(data.cod_extra_fee ?? 0),
          cod_max_order_value: Number(data.cod_max_order_value ?? 25000),
          estimated_delivery_days: data.estimated_delivery_days || "3-5 business days",
          white_glove_note: data.white_glove_note || "Complimentary white-glove packaging on all luminaire orders.",
          updated_at: data.updated_at,
          updated_by: data.updated_by,
        });
      }
    } catch (err: unknown) {
      console.error("Failed to load shipping settings:", err);
      showToast("error", "Failed to load live settings. Displaying defaults.");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const cleanPayload: Partial<ShippingSettings> = {
        standard_delivery_fee: Number(settings.standard_delivery_fee) || 0,
        free_shipping_enabled: Boolean(settings.free_shipping_enabled),
        free_shipping_threshold: Number(settings.free_shipping_threshold) || 0,
        min_order_value_enabled: Boolean(settings.min_order_value_enabled),
        min_order_value: Number(settings.min_order_value) || 0,
        min_order_message: settings.min_order_message || "Minimum order value of ₹{amount} is required to place an order.",
        cod_enabled: Boolean(settings.cod_enabled),
        cod_extra_fee: Number(settings.cod_extra_fee) || 0,
        cod_max_order_value: Number(settings.cod_max_order_value) || 0,
        estimated_delivery_days: settings.estimated_delivery_days || "3-5 business days",
        white_glove_note: settings.white_glove_note || "Complimentary white-glove packaging on all luminaire orders.",
      };

      const res = await updateAdminShippingSettings(cleanPayload);
      if (res.success) {
        showToast("success", "Shipping & Delivery rules successfully published to store!");
        if (res.settings) {
          setSettings((prev) => ({ ...prev, ...res.settings }));
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update settings.";
      showToast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm("Reset all shipping and delivery parameters to official factory defaults?")) {
      setSettings(DEFAULT_SETTINGS);
      showToast("success", "Reset to default values. Click 'Publish Changes' to apply.");
    }
  };

  // Live Simulator Calculations
  const simResults = useMemo(() => {
    const isBelowMin = settings.min_order_value_enabled && simCartAmount < settings.min_order_value;
    const isFreeDelivery =
      settings.free_shipping_enabled && simCartAmount >= settings.free_shipping_threshold;
    const deliveryFee = simCartAmount === 0 ? 0 : (isFreeDelivery ? 0 : settings.standard_delivery_fee);
    const gst = Math.round(simCartAmount * 0.18 * 100) / 100;
    const grandTotal = Math.round((simCartAmount + gst + deliveryFee) * 100) / 100;

    const diffForFree = Math.max(0, settings.free_shipping_threshold - simCartAmount);
    const progressPercent = settings.free_shipping_threshold > 0
      ? Math.min(100, Math.round((simCartAmount / settings.free_shipping_threshold) * 100))
      : 100;

    return {
      isBelowMin,
      isFreeDelivery,
      deliveryFee,
      gst,
      grandTotal,
      diffForFree,
      progressPercent,
    };
  }, [simCartAmount, settings]);

  const formatCurrency = (val: number) =>
    val.toLocaleString("en-IN", { maximumFractionDigits: 2 });

  return (
    <div className={styles.container}>
      {/* Toast Notification */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === "success" ? styles.toastSuccess : styles.toastError}`}>
          <span>{toast.type === "success" ? "✓" : "⚠"}</span>
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>
            <span>🚚</span> Shipping & Delivery Policy Engine
          </h1>
          <p>
            Configure storefront delivery charges, minimum order limits, and complimentary white-glove shipping rules.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button type="button" className={styles.resetBtn} onClick={handleReset} disabled={saving || loading}>
            ↺ Reset Defaults
          </button>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? "Publishing Rules..." : "💾 Publish Storefront Rules"}
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className={styles.layoutGrid}>
        {/* Left Column: Settings Configuration Cards */}
        <div className={styles.settingsForms}>
          {/* CARD 1: STANDARD WHITE-GLOVE DELIVERY FEE */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>
                  <span>📦</span> Standard Shipping Fee
                </h3>
                <p className={styles.cardDesc}>
                  The standard flat delivery charge applied to orders that do not qualify for complimentary delivery.
                </p>
              </div>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Base Delivery Fee (INR)</label>
                <div className={styles.inputWrapper}>
                  <span className={styles.currencyPrefix}>₹</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className={styles.inputNumber}
                    value={settings.standard_delivery_fee}
                    onChange={(e) =>
                      setSettings({ ...settings, standard_delivery_fee: Math.max(0, Number(e.target.value)) })
                    }
                  />
                </div>
                <span className={styles.fieldHint}>Set to 0 if all orders should have free delivery.</span>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Estimated Delivery Timeline</label>
                <input
                  type="text"
                  className={styles.inputText}
                  placeholder="e.g. 3-5 business days"
                  value={settings.estimated_delivery_days}
                  onChange={(e) => setSettings({ ...settings, estimated_delivery_days: e.target.value })}
                />
                <span className={styles.fieldHint}>Displayed to customers on Cart & Checkout pages.</span>
              </div>
            </div>
          </div>

          {/* CARD 2: COMPLIMENTARY FREE SHIPPING THRESHOLD */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>
                  <span>🎁</span> Complimentary Free Delivery Rule
                </h3>
                <p className={styles.cardDesc}>
                  Automatically waive shipping fee when cart subtotal meets or exceeds this qualifying threshold.
                </p>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={settings.free_shipping_enabled}
                  onChange={(e) => setSettings({ ...settings, free_shipping_enabled: e.target.checked })}
                />
                <span className={styles.slider} />
              </label>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Qualifying Cart Amount (Threshold)</label>
                <div className={styles.inputWrapper}>
                  <span className={styles.currencyPrefix}>₹</span>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    className={styles.inputNumber}
                    disabled={!settings.free_shipping_enabled}
                    value={settings.free_shipping_threshold}
                    onChange={(e) =>
                      setSettings({ ...settings, free_shipping_threshold: Math.max(0, Number(e.target.value)) })
                    }
                  />
                </div>
                <span className={styles.fieldHint}>
                  Orders equal or greater than ₹{formatCurrency(settings.free_shipping_threshold)} receive free delivery.
                </span>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Current Status</label>
                <div style={{ paddingTop: "0.4rem" }}>
                  {settings.free_shipping_enabled ? (
                    <span className={styles.badgeEnabled}>✓ Active Above ₹{formatCurrency(settings.free_shipping_threshold)}</span>
                  ) : (
                    <span className={styles.badgeDisabled}>✕ Free Delivery Rule Disabled</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* CARD 3: MINIMUM ORDER VALUE (MOV) RESTRICTION */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>
                  <span>🛡</span> Minimum Order Value (MOV) Restriction
                </h3>
                <p className={styles.cardDesc}>
                  Prevent customers from placing orders below this amount. Checkout is locked until minimum is reached.
                </p>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={settings.min_order_value_enabled}
                  onChange={(e) => setSettings({ ...settings, min_order_value_enabled: e.target.checked })}
                />
                <span className={styles.slider} />
              </label>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Minimum Order Threshold (INR)</label>
                <div className={styles.inputWrapper}>
                  <span className={styles.currencyPrefix}>₹</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    className={styles.inputNumber}
                    disabled={!settings.min_order_value_enabled}
                    value={settings.min_order_value}
                    onChange={(e) =>
                      setSettings({ ...settings, min_order_value: Math.max(0, Number(e.target.value)) })
                    }
                  />
                </div>
                <span className={styles.fieldHint}>
                  Recommended: ₹499 or ₹999 for architectural luxury luminaires.
                </span>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Customer Warning Message</label>
                <input
                  type="text"
                  className={styles.inputText}
                  disabled={!settings.min_order_value_enabled}
                  value={settings.min_order_message}
                  onChange={(e) => setSettings({ ...settings, min_order_message: e.target.value })}
                />
                <span className={styles.fieldHint}>Use {"{amount}"} to automatically insert threshold.</span>
              </div>
            </div>
          </div>

          {/* CARD 4: CASH ON DELIVERY (COD) RULES */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>
                  <span>💵</span> Cash on Delivery (COD) Rules
                </h3>
                <p className={styles.cardDesc}>
                  Configure whether COD is offered, optional convenience fee, and maximum COD checkout limit.
                </p>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={settings.cod_enabled}
                  onChange={(e) => setSettings({ ...settings, cod_enabled: e.target.checked })}
                />
                <span className={styles.slider} />
              </label>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Extra COD Handling Fee (INR)</label>
                <div className={styles.inputWrapper}>
                  <span className={styles.currencyPrefix}>₹</span>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    className={styles.inputNumber}
                    disabled={!settings.cod_enabled}
                    value={settings.cod_extra_fee}
                    onChange={(e) => setSettings({ ...settings, cod_extra_fee: Math.max(0, Number(e.target.value)) })}
                  />
                </div>
                <span className={styles.fieldHint}>Set ₹0 for zero additional COD surcharge.</span>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Maximum COD Order Cap (INR)</label>
                <div className={styles.inputWrapper}>
                  <span className={styles.currencyPrefix}>₹</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    className={styles.inputNumber}
                    disabled={!settings.cod_enabled}
                    value={settings.cod_max_order_value}
                    onChange={(e) =>
                      setSettings({ ...settings, cod_max_order_value: Math.max(0, Number(e.target.value)) })
                    }
                  />
                </div>
                <span className={styles.fieldHint}>Orders exceeding this cap must pay online.</span>
              </div>
            </div>
          </div>

          {/* CARD 5: ATELIER WHITE-GLOVE NOTE */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>
                  <span>✦</span> Luxury Packaging & Assurance Note
                </h3>
                <p className={styles.cardDesc}>
                  Displayed on the Cart Drawer and Order Invoice as part of the Deluzex brand assurance.
                </p>
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <input
                type="text"
                className={styles.inputText}
                value={settings.white_glove_note}
                onChange={(e) => setSettings({ ...settings, white_glove_note: e.target.value })}
              />
              <span className={styles.fieldHint}>Example: &quot;Complimentary white-glove packaging on all orders.&quot;</span>
            </div>
          </div>

          {/* CARD 6: SHIPROCKET LOGISTICS & WALLET STATUS */}
          <div className={styles.card} style={{ border: "1px solid rgba(124, 58, 237, 0.4)" }}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle} style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span>🚀</span> Shiprocket Automated Logistics Integration
                  <span style={{ fontSize: "0.72rem", background: "rgba(16, 185, 129, 0.2)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.4)", padding: "0.15rem 0.5rem", borderRadius: "4px", fontWeight: 600 }}>
                    API CONNECTED
                  </span>
                </h3>
                <p className={styles.cardDesc}>
                  Live courier rate engine, AWB generation, thermal barcodes & GST invoice integration via Shiprocket v2.
                </p>
              </div>
              <button
                type="button"
                onClick={loadSrData}
                disabled={loadingSr}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#d1d5db",
                  padding: "0.4rem 0.8rem",
                  borderRadius: "6px",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                {loadingSr ? "Checking..." : "🔄 Check Balance"}
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
              {/* Wallet Balance Box */}
              <div style={{
                background: walletInfo?.is_low ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                border: `1px solid ${walletInfo?.is_low ? "rgba(239, 68, 68, 0.35)" : "rgba(16, 185, 129, 0.35)"}`,
                borderRadius: "10px",
                padding: "1rem",
              }}>
                <div style={{ fontSize: "0.8rem", color: "#9ca3af", marginBottom: "0.25rem" }}>Prepaid Wallet Balance</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 700, color: walletInfo?.is_low ? "#f87171" : "#34d399" }}>
                  ₹{walletInfo ? walletInfo.balance.toFixed(2) : "0.00"}
                </div>
                {walletInfo?.is_low && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <div style={{ fontSize: "0.75rem", color: "#fca5a5", marginBottom: "0.5rem" }}>
                      ⚠️ Low Balance! Minimum ₹100 required to generate AWBs.
                    </div>
                    <a
                      href={walletInfo.recharge_url || "https://app.shiprocket.in/billing/recharge"}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-block",
                        background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                        color: "#fff",
                        textDecoration: "none",
                        padding: "0.35rem 0.75rem",
                        borderRadius: "6px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      ⚡ Recharge Wallet ↗
                    </a>
                  </div>
                )}
              </div>

              {/* Pickup Locations Box */}
              <div style={{
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "10px",
                padding: "1rem",
              }}>
                <div style={{ fontSize: "0.8rem", color: "#9ca3af", marginBottom: "0.25rem" }}>Primary Dispatch Warehouse</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#e5e7eb" }}>
                  {pickupLocations[0]?.pickup_location || "work"} ({pickupLocations[0]?.city || "Banaskantha"} - {pickupLocations[0]?.pin_code || "385210"})
                </div>
                <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.35rem" }}>
                  Default parcel specs: 30 × 30 × 20 cm • 1.5 kg
                </div>
              </div>

              {/* Webhook Sync Box */}
              <div style={{
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "10px",
                padding: "1rem",
              }}>
                <div style={{ fontSize: "0.8rem", color: "#9ca3af", marginBottom: "0.25rem" }}>Real-time Webhook Receiver</div>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#a78bfa", fontFamily: "monospace" }}>
                  /api/v1/shiprocket/webhook
                </div>
                <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.35rem" }}>
                  Auto-updates Shipped, Out for Delivery, Delivered & RTO status
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Storefront Simulator */}
        <div className={styles.simulatorSticky}>
          <div className={styles.simulatorCard}>
            <div className={styles.simHeader}>
              <h3 className={styles.simTitle}>
                <span>👁</span> Storefront Live Simulator
              </h3>
              <p className={styles.simDesc}>
                Test real customer cart values to preview live calculation, progress bar, and checkout alerts.
              </p>
            </div>

            {/* Slider */}
            <div className={styles.simSliderBlock}>
              <div className={styles.simSliderHeader}>
                <span className={styles.simSliderLabel}>Simulated Cart Subtotal:</span>
                <span className={styles.simSliderValue}>₹{formatCurrency(simCartAmount)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="6000"
                step="50"
                className={styles.simRange}
                value={simCartAmount}
                onChange={(e) => setSimCartAmount(Number(e.target.value))}
              />

              <div className={styles.presetButtons}>
                {[250, 499, 1200, 1999, 3500].map((val) => (
                  <button
                    key={val}
                    type="button"
                    className={styles.presetBtn}
                    onClick={() => setSimCartAmount(val)}
                  >
                    ₹{val}
                  </button>
                ))}
              </div>
            </div>

            {/* Simulated Cart Display */}
            <div className={styles.simPreviewBox}>
              <div className={styles.simPreviewTitle}>Cart Drawer Live Preview</div>

              {/* Free Shipping Progress Bar */}
              {settings.free_shipping_enabled && (
                <div>
                  <div className={styles.progressBarContainer}>
                    <div
                      className={styles.progressBarFill}
                      style={{ width: `${simResults.progressPercent}%` }}
                    />
                  </div>
                  <div className={styles.progressLabel}>
                    {simResults.isFreeDelivery ? (
                      <span style={{ color: "#10b981", fontWeight: 600 }}>
                        🎉 Congratulations! You unlocked FREE White-Glove Shipping!
                      </span>
                    ) : (
                      <span>
                        Add <span className={styles.progressHighlight}>₹{formatCurrency(simResults.diffForFree)}</span> more to unlock <strong>FREE Shipping</strong>!
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Receipt Summary */}
              <table className={styles.simReceiptTable}>
                <tbody>
                  <tr>
                    <td>Cart Subtotal:</td>
                    <td>₹{formatCurrency(simCartAmount)}</td>
                  </tr>
                  <tr>
                    <td>Estimated GST (18%):</td>
                    <td>₹{formatCurrency(simResults.gst)}</td>
                  </tr>
                  <tr>
                    <td>Delivery Fee:</td>
                    <td style={{ color: simResults.deliveryFee === 0 ? "#10b981" : "inherit" }}>
                      {simResults.deliveryFee === 0 ? "FREE" : `₹${formatCurrency(simResults.deliveryFee)}`}
                    </td>
                  </tr>
                  <tr className={styles.simTotalRow}>
                    <td>Grand Total:</td>
                    <td>₹{formatCurrency(simResults.grandTotal)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Minimum Order Value Alert */}
              {simResults.isBelowMin && (
                <div className={`${styles.alertBox} ${styles.alertWarning}`}>
                  <span>⛔</span>
                  <div>
                    <strong>Minimum Order Not Met:</strong>
                    <div>
                      {settings.min_order_message.replace("{amount}", formatCurrency(settings.min_order_value))}
                    </div>
                  </div>
                </div>
              )}

              {!simResults.isBelowMin && simCartAmount > 0 && (
                <div className={`${styles.alertBox} ${styles.alertSuccess}`}>
                  <span>✓</span>
                  <div>
                    <strong>Eligible for Checkout:</strong> Meets store minimum of ₹{formatCurrency(settings.min_order_value)}.
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className={styles.saveBtn}
              style={{ width: "100%", justifyContent: "center" }}
              disabled={saving}
            >
              {saving ? "Publishing Rules..." : "Publish These Rules to Storefront"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
