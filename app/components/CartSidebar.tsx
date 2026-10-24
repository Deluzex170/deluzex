"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store/store";
import {
  closeCart,
  removeFromCart,
  updateQuantity,
  clearCart,
  setAppliedCoupon,
  removeAppliedCoupon,
} from "../store/cartSlice";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { fetchAvailableCoupons, validateCoupon, AvailableCoupon, fetchPublicShippingSettings, ShippingSettings } from "../services/api";
import styles from "./CartSidebar.module.css";

export default function CartSidebar() {
  const dispatch = useDispatch();
  const { isCartOpen, cartItems, cartTotal, appliedCoupon } = useSelector(
    (state: RootState) => state.cart
  );
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();

  // Promo Code State
  const [isPromoExpanded, setIsPromoExpanded] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [availableOffers, setAvailableOffers] = useState<AvailableCoupon[]>([]);

  // Dynamic Shipping & Delivery Settings State
  const [shippingRules, setShippingRules] = useState<ShippingSettings>({
    standard_delivery_fee: 99,
    free_shipping_enabled: true,
    free_shipping_threshold: 1999,
    min_order_value_enabled: true,
    min_order_value: 499,
    min_order_message: "Minimum order value of ₹{amount} is required to place an order.",
    cod_enabled: true,
    cod_extra_fee: 0,
    cod_max_order_value: 25000,
    estimated_delivery_days: "3-5 business days",
    white_glove_note: "Complimentary white-glove packaging on all orders.",
  });

  // Fetch Available Offers and Shipping Rules when Drawer Opens
  useEffect(() => {
    if (isCartOpen) {
      fetchAvailableCoupons()
        .then((res) => {
          if (Array.isArray(res)) setAvailableOffers(res);
        })
        .catch(() => {});

      fetchPublicShippingSettings()
        .then((rules) => {
          if (rules) setShippingRules(rules);
        })
        .catch(() => {});
    }
  }, [isCartOpen]);

  // Recalculate Totals with Dynamic Shipping Policy
  const subtotal = cartTotal;
  const discount = appliedCoupon?.discount_amount || 0;
  const taxableSubtotal = Math.max(0, subtotal - discount);
  const gst = taxableSubtotal * 0.18;
  const isFreeShipping =
    appliedCoupon?.discount_type === "free_shipping" ||
    (shippingRules.free_shipping_enabled && subtotal >= shippingRules.free_shipping_threshold);
  const delivery = isFreeShipping ? 0 : subtotal > 0 ? shippingRules.standard_delivery_fee : 0;
  const grandTotal = taxableSubtotal + gst + delivery;

  const isBelowMinOrder =
    shippingRules.min_order_value_enabled && subtotal > 0 && subtotal < shippingRules.min_order_value;
  const minOrderDiff = Math.max(0, shippingRules.min_order_value - subtotal);
  const freeShippingDiff = Math.max(0, shippingRules.free_shipping_threshold - subtotal);

  // Re-validate coupon if cart total changes
  useEffect(() => {
    if (appliedCoupon && subtotal > 0) {
      const email = user && typeof user === "object" && "email" in user ? (user as { email: string }).email : undefined;
      validateCoupon(appliedCoupon.code, subtotal, email)
        .then((res) => {
          if (res.valid) {
            dispatch(
              setAppliedCoupon({
                code: res.code,
                discount_amount: res.discount_amount,
                discount_type: (res.discount_type as "percentage" | "flat" | "free_shipping") || "percentage",
                discount_value: res.discount_value,
                message: res.message,
              })
            );
            setPromoError(null);
          } else {
            dispatch(removeAppliedCoupon());
            setPromoError(res.message || "Coupon no longer meets criteria.");
          }
        })
        .catch(() => {});
    } else if (subtotal === 0 && appliedCoupon) {
      dispatch(removeAppliedCoupon());
    }
  }, [subtotal, user, dispatch]);

  const handleApplyPromo = async (codeToApply?: string) => {
    const code = (codeToApply || promoInput).trim().toUpperCase();
    if (!code) {
      setPromoError("Please enter a promo code.");
      return;
    }
    setPromoLoading(true);
    setPromoError(null);

    try {
      const email = user && typeof user === "object" && "email" in user ? (user as { email: string }).email : undefined;
      const res = await validateCoupon(code, subtotal, email);
      if (res.valid) {
        dispatch(
          setAppliedCoupon({
            code: res.code,
            discount_amount: res.discount_amount,
            discount_type: (res.discount_type as "percentage" | "flat" | "free_shipping") || "percentage",
            discount_value: res.discount_value,
            message: res.message,
          })
        );
        setPromoInput("");
        setIsPromoExpanded(false);
      } else {
        setPromoError(res.message || "Invalid promo code.");
      }
    } catch (err: unknown) {
      setPromoError(err instanceof Error ? err.message : "Failed to apply coupon.");
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromo = () => {
    dispatch(removeAppliedCoupon());
    setPromoError(null);
  };

  const handleCheckout = () => {
    if (isAuthenticated) {
      router.push("/checkout");
    } else {
      router.push("/login?redirect=/checkout");
    }
    dispatch(closeCart());
  };

  if (!isCartOpen) return null;

  return (
    <>
      <div className={styles.overlay} onClick={() => dispatch(closeCart())}></div>
      <div className={styles.sidebar}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.headerTitle}>
            {cartItems.length} ITEM{cartItems.length !== 1 ? "S" : ""} IN CART
          </h2>
          <button
            className={styles.closeBtn}
            onClick={() => dispatch(closeCart())}
            aria-label="Close cart"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Free Shipping Progress Bar */}
        {shippingRules.free_shipping_enabled && cartItems.length > 0 && (
          <div style={{ padding: "0.75rem 1.25rem", background: "rgba(196, 154, 69, 0.08)", borderBottom: "1px solid rgba(196, 154, 69, 0.15)" }}>
            <div style={{ height: "4px", background: "rgba(255, 255, 255, 0.1)", borderRadius: "2px", overflow: "hidden", marginBottom: "0.4rem" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, Math.round((subtotal / shippingRules.free_shipping_threshold) * 100))}%`,
                  background: "linear-gradient(90deg, #c49a45, #10b981)",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <div style={{ fontSize: "0.775rem", color: isFreeShipping ? "#10b981" : "#c49a45", fontWeight: 500 }}>
              {isFreeShipping ? (
                "🎉 You unlocked FREE White-Glove Shipping!"
              ) : (
                <>Add <strong style={{ color: "#ffffff" }}>₹{freeShippingDiff.toLocaleString("en-IN")}</strong> more to unlock <strong>FREE Delivery</strong></>
              )}
            </div>
          </div>
        )}

        {/* Cart Items List */}
        <div className={styles.cartItems}>
          {cartItems.length === 0 ? (
            <div className={styles.emptyState}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
              <p>Your cart is empty.</p>
            </div>
          ) : (
            cartItems.map((item) => (
              <div key={item.id} className={styles.cartItem}>
                <div className={styles.itemImageWrapper}>
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    sizes="88px"
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <div className={styles.itemDetails}>
                  <div className={styles.itemTitleArea}>
                    <h4 className={styles.itemTitle}>{item.title}</h4>
                  </div>
                  <p className={styles.price}>
                    ₹{item.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <div className={styles.itemActions}>
                    <div className={styles.quantity}>
                      <button
                        type="button"
                        onClick={() => dispatch(updateQuantity({ id: item.id, change: -1 }))}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => dispatch(updateQuantity({ id: item.id, change: 1 }))}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <div className={styles.iconButtons}>
                      <button
                        type="button"
                        className={styles.actionCircleBtn}
                        onClick={() => {
                          dispatch(closeCart());
                          router.push(`/product/${item.id}`);
                        }}
                        title="View / Edit Product"
                        aria-label="View / Edit Product"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={styles.actionCircleBtn}
                        onClick={() => dispatch(removeFromCart(item.id))}
                        title="Remove from cart"
                        aria-label="Remove from cart"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer / Summary Section */}
        <div className={styles.footer}>
          {cartItems.length > 0 && (
            <>
              {/* Promo Code Accordion / Applied Badge */}
              <div className={styles.promoSection}>
                {appliedCoupon ? (
                  <div className={styles.appliedPromoBadge}>
                    <div className={styles.appliedPromoLeft}>
                      <div className={styles.appliedPromoCodeRow}>
                        <span className={styles.appliedPromoCode}>{appliedCoupon.code}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <span className={styles.appliedPromoSavings}>
                        {appliedCoupon.discount_type === "free_shipping"
                          ? "Free Delivery unlocked"
                          : `Saved ₹${(appliedCoupon.discount_amount || 0).toFixed(2)}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePromo}
                      className={styles.btnRemovePromo}
                      aria-label="Remove promo code"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      className={styles.promoToggleBtn}
                      onClick={() => setIsPromoExpanded((prev) => !prev)}
                    >
                      <div className={styles.promoToggleLeft}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                          <line x1="7" y1="7" x2="7.01" y2="7" />
                        </svg>
                        <span>Have a promo code?</span>
                      </div>
                      <span style={{ fontSize: "0.9rem" }}>{isPromoExpanded ? "−" : "+"}</span>
                    </button>

                    {isPromoExpanded && (
                      <div className={styles.promoInputWrapper}>
                        <div className={styles.promoInputRow}>
                          <input
                            type="text"
                            className={styles.promoInput}
                            placeholder="e.g. DELUZEXVIP"
                            value={promoInput}
                            onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleApplyPromo();
                              }
                            }}
                          />
                          <button
                            type="button"
                            className={styles.btnApplyPromo}
                            onClick={() => handleApplyPromo()}
                            disabled={promoLoading || !promoInput.trim()}
                          >
                            {promoLoading ? "..." : "Apply"}
                          </button>
                        </div>

                        {promoError && (
                          <div className={styles.promoFeedbackError}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <span>{promoError}</span>
                          </div>
                        )}

                        {availableOffers.length > 0 && (
                          <div className={styles.quickOffersRow}>
                            {availableOffers.slice(0, 2).map((offer) => (
                              <button
                                key={offer.code}
                                type="button"
                                className={styles.quickOfferChip}
                                onClick={() => handleApplyPromo(offer.code)}
                                disabled={promoLoading}
                              >
                                {offer.code} ({offer.discount_type === "percentage" ? `${offer.discount_value}%` : `₹${offer.discount_value}`})
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className={styles.breakdownSection}>
                <div className={styles.summaryRow}>
                  <span>Subtotal</span>
                  <span>₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {discount > 0 && (
                  <div className={styles.discountRow}>
                    <span>Discount ({appliedCoupon?.code})</span>
                    <span>-₹{discount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className={styles.summaryRow}>
                  <span>GST (18%)</span>
                  <span>₹{gst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Delivery Charges</span>
                  <span>
                    {delivery > 0 ? (
                      `₹${delivery.toFixed(2)}`
                    ) : (
                      <span>
                        Free
                        {appliedCoupon?.discount_type === "free_shipping" && (
                          <span className={styles.freeShippingTag}>Coupon</span>
                        )}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </>
          )}

          <div className={styles.grandTotalRow}>
            <div>
              <h3 className={styles.grandTotalLabel}>Total</h3>
              <p className={styles.taxesSubtext}>Taxes & discounts included</p>
            </div>
            <div className={styles.totalPrice}>
              ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {isBelowMinOrder && (
            <div style={{
              padding: "0.65rem 0.85rem",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "8px",
              color: "#fca5a5",
              fontSize: "0.785rem",
              marginBottom: "0.75rem",
              lineHeight: 1.4,
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
            }}>
              <span>⛔</span>
              <span>
                {shippingRules.min_order_message.replace("{amount}", shippingRules.min_order_value.toLocaleString("en-IN"))} (Add ₹{minOrderDiff.toLocaleString("en-IN")} more)
              </span>
            </div>
          )}

          <button
            className={styles.btnCheckout}
            disabled={cartItems.length === 0 || isBelowMinOrder}
            onClick={handleCheckout}
            title={isBelowMinOrder ? "Cart amount is below minimum order value" : "Proceed to Checkout"}
          >
            {isBelowMinOrder ? `Min. Order ₹${shippingRules.min_order_value.toLocaleString("en-IN")} Required` : "Proceed to Checkout"}
          </button>
        </div>
      </div>
    </>
  );
}
