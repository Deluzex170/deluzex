"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store/store";
import {
  clearCart,
  setAppliedCoupon as setReduxAppliedCoupon,
  removeAppliedCoupon as removeReduxAppliedCoupon,
} from "../store/cartSlice";
import { useAuth } from "../context/AuthContext";
import {
  createPaymentOrder,
  verifyPayment,
  createCodOrder,
  recordPaymentFailure,
  fetchUserAddresses,
  saveUserAddress,
  savePlacedOrder,
  SavedAddress,
  fetchAvailableCoupons,
  validateCoupon,
  AvailableCoupon,
  CouponValidateResponse,
  fetchPublicShippingSettings,
  ShippingSettings,
} from "../services/api";
import styles from "./checkout.module.css";

function getOrCreateIdempotencyKey(): string {
  if (typeof window === "undefined") return "";
  try {
    let key = sessionStorage.getItem("deluzex_checkout_idem");
    if (!key) {
      key = "idem_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem("deluzex_checkout_idem", key);
    }
    return key;
  } catch {
    return "idem_fallback_" + Date.now();
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).Razorpay) return resolve(true);

    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true));
      existingScript.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function CheckoutPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { user, isAuthenticated, openLoginModal } = useAuth();
  const errorRef = useRef<HTMLDivElement>(null);
  const { cartItems, cartTotal, appliedCoupon: reduxCoupon } = useSelector(
    (state: RootState) => state.cart
  );

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // Idempotency & Failure Recovery State
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");
  const [failedOrder, setFailedOrder] = useState<{
    orderId: string;
    rzpOrderId?: string;
    errorReason: string;
    errorCode?: string;
  } | null>(null);

  // Saved Addresses State
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [saveAddressToProfile, setSaveAddressToProfile] = useState(true);

  // Payment Selection: 'razorpay' (Default) | 'cod'
  const [paymentMethod, setPaymentMethod] = useState<"razorpay" | "cod">("razorpay");

  // Contact & Shipping Form Fields
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pinCode, setPinCode] = useState("");

  // Coupon & Promo Code State
  const [availableOffers, setAvailableOffers] = useState<AvailableCoupon[]>([]);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidateResponse | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccessMsg, setCouponSuccessMsg] = useState<string | null>(null);

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

  // Monetary Totals with Dynamic Shipping Policy & Discount
  const subtotal = cartTotal;
  const discount = appliedCoupon?.discount_amount || 0;
  const taxableSubtotal = Math.max(0, subtotal - discount);
  const gst = taxableSubtotal * 0.18;
  const isFreeShipping =
    appliedCoupon?.discount_type === "free_shipping" ||
    (shippingRules.free_shipping_enabled && subtotal >= shippingRules.free_shipping_threshold);
  const delivery = isFreeShipping ? 0 : (subtotal > 0 ? shippingRules.standard_delivery_fee : 0);
  const grandTotal = taxableSubtotal + gst + delivery;

  const isBelowMinOrder =
    shippingRules.min_order_value_enabled && subtotal > 0 && subtotal < shippingRules.min_order_value;
  const minOrderDiff = Math.max(0, shippingRules.min_order_value - subtotal);

  // Initialize Idempotency Key, Preload Razorpay Script, & Fetch Shipping Rules
  useEffect(() => {
    setIdempotencyKey(getOrCreateIdempotencyKey());
    loadRazorpayScript().catch((err) => console.warn("Razorpay script preload warning:", err));
    fetchPublicShippingSettings().then((rules) => {
      if (rules) setShippingRules(rules);
    });
  }, []);

  // Fetch Available Public Coupons
  useEffect(() => {
    fetchAvailableCoupons()
      .then((res) => {
        if (Array.isArray(res)) {
          setAvailableOffers(res);
        }
      })
      .catch((err) => console.warn("Could not load available coupons:", err));
  }, []);

  // Sync coupon with Redux store (if applied from Cart Drawer)
  useEffect(() => {
    if (reduxCoupon && !appliedCoupon && subtotal > 0) {
      validateCoupon(reduxCoupon.code, subtotal, email.trim() || undefined)
        .then((res) => {
          if (res.valid) {
            setAppliedCoupon(res);
          } else {
            dispatch(removeReduxAppliedCoupon());
          }
        })
        .catch(() => {});
    }
  }, [reduxCoupon, subtotal, email, appliedCoupon, dispatch]);

  // Re-validate coupon if cart total changes
  useEffect(() => {
    if (appliedCoupon && subtotal > 0) {
      validateCoupon(appliedCoupon.code, subtotal, email.trim() || undefined)
        .then((res) => {
          if (res.valid) {
            setAppliedCoupon(res);
            setCouponError(null);
          } else {
            setAppliedCoupon(null);
            dispatch(removeReduxAppliedCoupon());
            setCouponError(res.message || "Applied coupon no longer meets order criteria.");
            setCouponSuccessMsg(null);
          }
        })
        .catch(() => {});
    } else if (subtotal === 0) {
      setAppliedCoupon(null);
      dispatch(removeReduxAppliedCoupon());
    }
  }, [subtotal, email, appliedCoupon, dispatch]);

  const handleApplyCoupon = async (codeToApply?: string) => {
    const code = (codeToApply || couponInput).trim();
    if (!code) {
      setCouponError("Please enter a valid coupon code.");
      return;
    }
    setCouponLoading(true);
    setCouponError(null);
    setCouponSuccessMsg(null);

    try {
      const res = await validateCoupon(code, subtotal, email.trim() || undefined);
      if (res.valid) {
        setAppliedCoupon(res);
        dispatch(
          setReduxAppliedCoupon({
            code: res.code,
            discount_amount: res.discount_amount,
            discount_type: (res.discount_type as "percentage" | "flat" | "free_shipping") || "percentage",
            discount_value: res.discount_value,
            message: res.message,
          })
        );
        setCouponInput("");
        setCouponSuccessMsg(res.message || `Coupon ${res.code} applied successfully!`);
      } else {
        setCouponError(res.message || "Invalid coupon code.");
      }
    } catch (err: unknown) {
      setCouponError(err instanceof Error ? err.message : "Failed to apply coupon. Please try again.");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    dispatch(removeReduxAppliedCoupon());
    setCouponSuccessMsg(null);
    setCouponError(null);
  };

  const applyAddress = useCallback((addr: SavedAddress) => {
    setSelectedAddressId(addr.id || addr._id || null);
    setFirstName(addr.first_name || "");
    setLastName(addr.last_name || "");
    setStreet(addr.street || "");
    setCity(addr.city || "");
    setState(addr.state || "");
    setPinCode(addr.pin_code || "");
    if (addr.phone) setPhone(addr.phone);
  }, []);

  // Pre-fill user profile if logged in
  useEffect(() => {
    if (user) {
      const userObj = user as Record<string, string>;
      if (userObj.email && !email) setEmail(userObj.email);
      if (userObj.phone && !phone) setPhone(userObj.phone);
      if (userObj.first_name && !firstName) setFirstName(userObj.first_name);
      if (userObj.last_name && !lastName) setLastName(userObj.last_name);
    }
  }, [user, email, phone, firstName, lastName]);

  // Load saved addresses for signed-in users only (guests must not see addresses tied to a typed email)
  useEffect(() => {
    if (!isAuthenticated) return;
    const activeEmail = ((user as Record<string, string>)?.email) || "";
    if (activeEmail) {
      fetchUserAddresses(activeEmail).then((list) => {
        setSavedAddresses(list);
        if (list.length > 0 && !selectedAddressId) {
          const defaultAddr = list.find((a) => a.is_default) || list[0];
          applyAddress(defaultAddr);
        }
      });
    }
  }, [isAuthenticated, user, applyAddress, selectedAddressId]);

  const scrollToError = () => {
    setTimeout(() => {
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const validateForm = (): boolean => {
    if (cartItems.length === 0) {
      setErrorMessage("Your cart is empty. Please add lighting fixtures to proceed.");
      return false;
    }
    if (isBelowMinOrder) {
      setErrorMessage(
        shippingRules.min_order_message.replace("{amount}", `₹${shippingRules.min_order_value.toLocaleString("en-IN")}`)
      );
      scrollToError();
      return false;
    }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setErrorMessage("Please provide a valid email address for your order confirmation.");
      scrollToError();
      return false;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setErrorMessage("Please enter a valid 10-digit mobile number for delivery tracking.");
      scrollToError();
      return false;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setErrorMessage("Please provide your full recipient name.");
      scrollToError();
      return false;
    }
    if (!street.trim()) {
      setErrorMessage("Please provide your complete street delivery address.");
      scrollToError();
      return false;
    }
    if (!city.trim() || !state.trim()) {
      setErrorMessage("Please enter your delivery city and state.");
      scrollToError();
      return false;
    }
    const cleanPin = pinCode.replace(/\D/g, "");
    if (cleanPin.length !== 6) {
      setErrorMessage("Please provide a valid 6-digit postal PIN code.");
      scrollToError();
      return false;
    }
    return true;
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setNoticeMessage(null);

    if (!validateForm()) return;

    setIsProcessing(true);

    try {
      const userObj = user as Record<string, string> | null;
      const userId = userObj?._id || userObj?.id || "";

      // Save address if requested
      if (isAuthenticated && saveAddressToProfile) {
        saveUserAddress({
          user_id: userId,
          user_email: email.trim(),
          user_phone: phone.trim(),
          type: "Home",
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          street: street.trim(),
          city: city.trim(),
          state: state.trim(),
          pin_code: pinCode.trim(),
          phone: phone.trim(),
          is_default: savedAddresses.length === 0,
        }).catch((err) => console.warn("Failed to persist address:", err));
      }

      // Verify the payment returned by the official gateway.
      const completePaymentVerification = async (params: {
        order_id: string;
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        setIsProcessing(true);

        try {
          const verifyRes = await verifyPayment({
            order_id: params.order_id,
            razorpay_order_id: params.razorpay_order_id,
            razorpay_payment_id: params.razorpay_payment_id,
            razorpay_signature: params.razorpay_signature,
          });

          if (verifyRes.success) {
            await savePlacedOrder({
              order_id: params.order_id,
              razorpay_order_id: params.razorpay_order_id,
              razorpay_payment_id: params.razorpay_payment_id,
              user_email: email.trim(),
              user_phone: phone.trim(),
              customer_name: `${firstName.trim()} ${lastName.trim()}`,
              shipping_address: {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                street: street.trim(),
                city: city.trim(),
                state: state.trim(),
                pin_code: pinCode.trim(),
              },
              items: cartItems.map((item) => ({
                product_id: String(item.id),
                title: item.title,
                price: item.price,
                quantity: item.quantity,
                image: item.image,
              })),
              subtotal,
              gst,
              delivery,
              total: grandTotal,
              status: "Processing",
              payment_method: "Razorpay (Cards / UPI / NetBanking)",
              payment_status: "Paid",
            }).catch(console.warn);

            if (typeof window !== "undefined") {
              sessionStorage.removeItem("deluzex_checkout_idem");
            }
            setFailedOrder(null);

            dispatch(clearCart());
            router.push(`/checkout/success?orderId=${encodeURIComponent(params.order_id)}`);
          } else {
            throw new Error(verifyRes.message || "Payment verification could not be confirmed.");
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : "Payment verification failed. Please contact Deluzex support.";
          setErrorMessage(errMsg);
          setIsProcessing(false);

          scrollToError();
        }
      };

      // =========================================================================
      // FLOW 1: OFFICIAL RAZORPAY GATEWAY CHECKOUT (UPI, CARDS, NETBANKING, WALLETS)
      // =========================================================================
      if (paymentMethod === "razorpay") {
        // Create order via backend Razorpay API
        const orderRes = await createPaymentOrder({
          email: email.trim(),
          phone: phone.trim(),
          shipping_address: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            street: street.trim(),
            city: city.trim(),
            state: state.trim(),
            pin_code: pinCode.trim(),
          },
          items: cartItems.map((item) => ({
            product_id: String(item.id),
            title: item.title,
            price: item.price,
            quantity: item.quantity,
            image: item.image,
          })),
          subtotal,
          discount,
          coupon_code: appliedCoupon?.code,
          gst,
          delivery,
          total: grandTotal,
          payment_method: "card",
          razorpay_method: "all",
          idempotency_key: idempotencyKey,
          existing_order_id: failedOrder?.orderId,
        });

        if (orderRes.is_already_paid) {
          dispatch(clearCart());
          router.push(`/checkout/success?orderId=${encodeURIComponent(orderRes.order_id)}`);
          return;
        }

        const isLoaded = await loadRazorpayScript();
        if (!isLoaded) throw new Error("Payment gateway could not load. Please try again.");
        const gatewayKey = orderRes.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
        if (!gatewayKey) throw new Error("Payment gateway is not configured.");

        // Configure and open Razorpay Official Modal
        const options = {
          key: gatewayKey,
          amount: orderRes.amount,
          currency: orderRes.currency || "INR",
          name: "Deluzex Lighting",
          description: `Order #${orderRes.order_id.slice(-8)} — Luxury Architectural Fixtures`,
          image: "/images/logos/de_luzex_black.svg",
          order_id: orderRes.razorpay_order_id,
          handler: async function (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) {
            await completePaymentVerification({
              order_id: orderRes.order_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
          },
          prefill: {
            name: `${firstName} ${lastName}`.trim(),
            email: email.trim(),
            contact: phone.trim(),
          },
          notes: {
            deluzex_order_id: orderRes.order_id,
            shipping_address: `${street}, ${city}, ${state} - ${pinCode}`,
          },
          theme: {
            color: "#C89B60",
          },
          modal: {
            ondismiss: function () {
              setIsProcessing(false);
              setNoticeMessage("Payment session paused. You can complete your order or choose another method at any time.");
            },
          },
        };

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rzp = new (window as any).Razorpay(options);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rzp.on("payment.failed", function (resp: any) {
            setIsProcessing(false);
            const reason = resp.error?.description || "Payment was declined by your bank or UPI app.";
            setErrorMessage(reason);
            setFailedOrder({
              orderId: orderRes.order_id,
              rzpOrderId: orderRes.razorpay_order_id,
              errorReason: reason,
              errorCode: resp.error?.code,
            });
            recordPaymentFailure({
              order_id: orderRes.order_id,
              razorpay_order_id: orderRes.razorpay_order_id,
              razorpay_payment_id: resp.error?.metadata?.payment_id,
              status: "failed",
              error_code: resp.error?.code,
              error_description: reason,
              error_source: resp.error?.source,
              error_step: resp.error?.step,
              error_reason: resp.error?.reason,
            }).catch(console.warn);
            scrollToError();
          });

          rzp.open();
        } catch (openErr) {
          throw new Error(openErr instanceof Error ? openErr.message : "Payment gateway could not open. Please try again.");
        }
        return;
      }

      // =========================================================================
      // FLOW 2: CASH ON DELIVERY (DOORSTEP PAYMENT)
      // =========================================================================
      if (paymentMethod === "cod") {
        const codRes = await createCodOrder({
          email: email.trim(),
          phone: phone.trim(),
          shipping_address: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            street: street.trim(),
            city: city.trim(),
            state: state.trim(),
            pin_code: pinCode.trim(),
          },
          items: cartItems.map((item) => ({
            product_id: String(item.id),
            title: item.title,
            price: item.price,
            quantity: item.quantity,
            image: item.image,
          })),
          subtotal,
          discount,
          coupon_code: appliedCoupon?.code,
          gst,
          delivery,
          total: grandTotal,
          idempotency_key: idempotencyKey,
          existing_order_id: failedOrder?.orderId,
        });

        if (codRes && codRes.success) {
          await savePlacedOrder({
            order_id: codRes.order_id,
            razorpay_order_id: codRes.order_id,
            razorpay_payment_id: `cod_${codRes.order_id}`,
            user_email: email.trim(),
            user_phone: phone.trim(),
            customer_name: `${firstName.trim()} ${lastName.trim()}`,
            shipping_address: {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              street: street.trim(),
              city: city.trim(),
              state: state.trim(),
              pin_code: pinCode.trim(),
            },
            items: cartItems.map((item) => ({
              product_id: String(item.id),
              title: item.title,
              price: item.price,
              quantity: item.quantity,
              image: item.image,
            })),
            subtotal,
            gst,
            delivery,
            total: grandTotal,
            status: "cod",
            payment_method: "Cash on Delivery",
            payment_status: "Pending (Pay on Delivery)",
          }).catch(console.warn);

          if (typeof window !== "undefined") {
            sessionStorage.removeItem("deluzex_checkout_idem");
          }
          dispatch(clearCart());
          router.push(`/checkout/success?orderId=${encodeURIComponent(codRes.order_id)}&method=cod`);
          return;
        } else {
          throw new Error(codRes.message || "Failed to confirm Cash on Delivery order.");
        }
      }
    } catch (err: unknown) {
      console.error("Payment Submission Error:", err);
      const msg = err instanceof Error ? err.message : "Failed to initiate payment. Please check your connection and try again.";
      setErrorMessage(msg);
      setIsProcessing(false);
      scrollToError();
    }
  };

  const isAddressReady = Boolean(firstName && lastName && street && city && state && pinCode.length === 6 && phone);

  if (cartItems.length === 0) {
    return (
      <main className={styles.container}>
        <div style={{ textAlign: "center", padding: "6rem 1rem", background: "#FFFFFF", borderRadius: "12px", border: "1px solid rgba(200, 155, 96, 0.2)" }}>
          <div style={{ width: "70px", height: "70px", margin: "0 auto 1.5rem", borderRadius: "50%", background: "rgba(200, 155, 96, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#C89B60" strokeWidth="1.8">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <h2 style={{ fontFamily: "var(--font-libre), serif", fontSize: "2rem", marginBottom: "0.75rem", color: "#1F2937" }}>
            Your Cart is Empty
          </h2>
          <p style={{ color: "#6B7280", maxWidth: "460px", margin: "0 auto 2rem", fontSize: "0.95rem" }}>
            Explore our curated catalog of architectural chandeliers, pendant lights, and designer lamps to proceed with checkout.
          </p>
          <Link
            href="/shop"
            style={{
              display: "inline-block",
              background: "#C89B60",
              color: "#fff",
              padding: "0.9rem 2rem",
              borderRadius: "4px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Explore Lighting Catalog
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      {/* 2-Step Luxury Progress Stepper */}
      <div className={styles.checkoutStepper}>
        <div className={styles.stepItem}>
          <div className={`${styles.stepCircle} ${isAddressReady ? styles.stepCircleCompleted : styles.stepCircleActive}`}>
            {isAddressReady ? "✓" : "1"}
          </div>
          <span className={`${styles.stepLabel} ${isAddressReady ? "" : styles.stepLabelActive}`}>
            Delivery Address
          </span>
        </div>

        <div className={`${styles.stepConnector} ${isAddressReady ? styles.stepConnectorActive : ""}`} />

        <div className={styles.stepItem}>
          <div className={`${styles.stepCircle} ${styles.stepCircleActive}`}>
            2
          </div>
          <span className={`${styles.stepLabel} ${styles.stepLabelActive}`}>
            Razorpay Payment
          </span>
        </div>

        <div className={styles.stepConnector} />

        <div className={styles.stepItem}>
          <div className={styles.stepCircle}>
            3
          </div>
          <span className={styles.stepLabel}>
            Confirmation
          </span>
        </div>
      </div>

      {/* Dismissible Notice / Warning Banner */}
      {noticeMessage && (
        <div className={styles.noticeBanner}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>{noticeMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setNoticeMessage(null)}
            style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "#1E40AF" }}
          >
            ×
          </button>
        </div>
      )}

      {/* Dismissible Error Banner */}
      {errorMessage && (
        <div ref={errorRef} className={styles.errorBanner}>
          <div className={styles.errorIcon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className={styles.errorText}>
            <p className={styles.errorTitle}>Payment Notice</p>
            <p className={styles.errorDesc}>{errorMessage}</p>
          </div>
          <button
            type="button"
            className={styles.errorDismiss}
            onClick={() => setErrorMessage(null)}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      <h1 className={styles.title}>Secure Checkout</h1>

      <form onSubmit={handlePayment} className={styles.checkoutGrid}>
        <div className={styles.leftCol}>
          {/* Section 1: Contact Information */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>1. Contact Information</h2>
            {!isAuthenticated && (
              <div className={styles.guestBanner}>
                <span>Checking out as a guest. Your order updates go to the email and phone below.</span>
                <button
                  type="button"
                  className={styles.guestSignInBtn}
                  onClick={() => openLoginModal(undefined, "Sign in to use your saved addresses and track orders in your account.")}
                >
                  Sign in instead
                </button>
              </div>
            )}
            <div className={styles.formGroup}>
              <label className={styles.label}>Email Address (for Order Confirmation & Invoice) *</label>
              <input
                type="email"
                required
                className={styles.input}
                placeholder="e.g. client@architects.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isProcessing}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Phone Number (with SMS / WhatsApp delivery dispatch) *</label>
              <input
                type="tel"
                required
                className={styles.input}
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isProcessing}
              />
            </div>
          </div>

          {/* Section 2: Delivery / Shipping Address */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <span>2. Delivery Address</span>
              {savedAddresses.length > 0 && (
                <span
                  className={styles.savedHeaderLabel}
                  onClick={() => {
                    setSelectedAddressId(null);
                    setStreet("");
                    setCity("");
                    setState("");
                    setPinCode("");
                  }}
                >
                  + Add New Address
                </span>
              )}
            </div>

            {/* Saved Addresses Cards (Matching User's Reference Layout) */}
            {savedAddresses.length > 0 && (
              <div className={styles.savedGrid}>
                {savedAddresses.map((addr) => {
                  const addrId = addr.id || addr._id || "";
                  const isSelected = selectedAddressId === addrId;
                  return (
                    <div
                      key={addrId}
                      className={`${styles.savedItemCard} ${isSelected ? styles.savedItemCardActive : ""}`}
                      onClick={() => applyAddress(addr)}
                    >
                      <div className={styles.savedItemHeader}>
                        <span className={styles.savedBadge}>{addr.type || "Home"}</span>
                        {isSelected && (
                          <span style={{ color: "#C89B60", fontSize: "0.85rem", fontWeight: 700 }}>
                            ✓ Selected
                          </span>
                        )}
                      </div>
                      <div className={styles.savedItemName}>
                        {addr.first_name} {addr.last_name}
                      </div>
                      <div className={styles.savedItemDetails}>
                        {addr.street}, {addr.city}, {addr.state} - {addr.pin_code}
                      </div>
                      <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "#666" }}>
                        📞 {addr.phone || phone}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.label}>First Name *</label>
                <input
                  type="text"
                  required
                  className={styles.input}
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={isProcessing}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Last Name *</label>
                <input
                  type="text"
                  required
                  className={styles.input}
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={isProcessing}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Street Address & Residence / Landmark *</label>
              <input
                type="text"
                required
                className={styles.input}
                placeholder="House/Villa no., building, street name, locality"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                disabled={isProcessing}
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.label}>City *</label>
                <input
                  type="text"
                  required
                  className={styles.input}
                  placeholder="e.g. Mumbai, Ahmedabad"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={isProcessing}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>State *</label>
                <input
                  type="text"
                  required
                  className={styles.input}
                  placeholder="State"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  disabled={isProcessing}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>PIN Code (6 digits) *</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  className={styles.input}
                  placeholder="380054"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={isProcessing}
                />
              </div>
            </div>

            {isAuthenticated && (
              <label className={styles.checkboxWrapper}>
                <input
                  type="checkbox"
                  checked={saveAddressToProfile}
                  onChange={(e) => setSaveAddressToProfile(e.target.checked)}
                />
                <span className={styles.checkboxLabel}>
                  Save this address to my profile for fast one-click checkout in future
                </span>
              </label>
            )}
          </div>

          {/* Section 3: Razorpay Payment Gateway Hub */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>3. Payment Gateway</h2>

            <div className={styles.razorpayGatewayContainer}>
              {/* Option 1: Official Razorpay Payment Gateway (Recommended) */}
              <div
                className={`${styles.razorpaySelectCard} ${paymentMethod === "razorpay" ? styles.razorpaySelectCardActive : ""}`}
                onClick={() => setPaymentMethod("razorpay")}
              >
                <div className={styles.razorpayCardHeader}>
                  <div className={styles.razorpayHeaderLeft}>
                    <div className={`${styles.razorpayRadioCircle} ${paymentMethod === "razorpay" ? styles.razorpayRadioCircleSelected : ""}`}>
                      {paymentMethod === "razorpay" && <div className={styles.razorpayRadioDot} />}
                    </div>
                    <div className={styles.razorpayTitleGroup}>
                      <h3 className={styles.razorpayMainTitle}>Razorpay Secure Gateway</h3>
                      <span className={styles.razorpayLivePill}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                        </svg>
                        Official Gateway
                      </span>
                      <span className={styles.razorpayZeroFeePill}>Zero Convenience Fee</span>
                    </div>
                  </div>
                </div>

                <p className={styles.razorpayDescription}>
                  Pay securely with all Indian and International payment methods. Includes <strong>Instant UPI</strong> (GPay, PhonePe, Paytm), <strong>Credit & Debit Cards</strong> with RBI-compliant 3D Secure OTP verification, <strong>50+ Net Banking Banks</strong>, and <strong>Wallets</strong>.
                </p>

                {/* Grid of Supported Methods Inside Razorpay */}
                <div className={styles.razorpayMethodsGrid}>
                  {/* UPI Chip */}
                  <div className={styles.methodChip}>
                    <div className={styles.methodChipIcon}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                    </div>
                    <div className={styles.methodChipInfo}>
                      <span className={styles.methodChipName}>UPI Apps</span>
                      <span className={styles.methodChipDetail}>GPay, PhonePe, Paytm</span>
                    </div>
                  </div>

                  {/* Cards Chip */}
                  <div className={styles.methodChip}>
                    <div className={styles.methodChipIcon}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="5" width="20" height="14" rx="2" />
                        <line x1="2" y1="10" x2="22" y2="10" />
                      </svg>
                    </div>
                    <div className={styles.methodChipInfo}>
                      <span className={styles.methodChipName}>Cards (3DS)</span>
                      <span className={styles.methodChipDetail}>Visa, MC, RuPay</span>
                    </div>
                  </div>

                  {/* NetBanking Chip */}
                  <div className={styles.methodChip}>
                    <div className={styles.methodChipIcon}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="3" y1="21" x2="21" y2="21" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                        <polyline points="5 6 12 3 19 6" />
                        <line x1="4" y1="10" x2="4" y2="21" />
                        <line x1="20" y1="10" x2="20" y2="21" />
                        <line x1="8" y1="14" x2="8" y2="17" />
                        <line x1="12" y1="14" x2="12" y2="17" />
                        <line x1="16" y1="14" x2="16" y2="17" />
                      </svg>
                    </div>
                    <div className={styles.methodChipInfo}>
                      <span className={styles.methodChipName}>Net Banking</span>
                      <span className={styles.methodChipDetail}>50+ Major Banks</span>
                    </div>
                  </div>

                  {/* Wallets Chip */}
                  <div className={styles.methodChip}>
                    <div className={styles.methodChipIcon}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
                        <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
                        <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z" />
                      </svg>
                    </div>
                    <div className={styles.methodChipInfo}>
                      <span className={styles.methodChipName}>Wallets & PayLater</span>
                      <span className={styles.methodChipDetail}>Amazon, Mobikwik</span>
                    </div>
                  </div>
                </div>

                <div className={styles.razorpayTrustBanner}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                  <span>
                    Secured by <strong>Razorpay Encrypted Infrastructure</strong> • 256-Bit SSL Encryption • PCI-DSS Level 1 Certified
                  </span>
                </div>
              </div>

              {/* Option 2: Cash on Delivery Alternative */}
              <div
                className={`${styles.codSelectCard} ${paymentMethod === "cod" ? styles.codSelectCardActive : ""}`}
                onClick={() => setPaymentMethod("cod")}
              >
                <div className={styles.razorpayCardHeader}>
                  <div className={styles.razorpayHeaderLeft}>
                    <div className={`${styles.razorpayRadioCircle} ${paymentMethod === "cod" ? styles.razorpayRadioCircleSelected : ""}`}>
                      {paymentMethod === "cod" && <div className={styles.razorpayRadioDot} />}
                    </div>
                    <h3 className={styles.razorpayMainTitle}>Cash on Delivery (Doorstep Payment)</h3>
                  </div>
                </div>
                <p className={styles.razorpayDescription} style={{ margin: 0 }}>
                  Pay in cash or scan the delivery executive&apos;s digital UPI QR code upon arrival at your doorstep.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary & Instant Razorpay Action */}
        <div className={styles.rightCol}>
          <div className={styles.summaryCard}>
            <h2 className={styles.summaryTitle}>Order Summary</h2>

            <div className={styles.cartItems}>
              {cartItems.map((item) => (
                <div key={item.id} className={styles.cartItem}>
                  <div className={styles.itemImage}>
                    <span className={styles.itemBadge}>{item.quantity}</span>
                    <Image
                      src={item.image || "/images/lamp_modern_tall_1784107732736.jpg"}
                      alt={item.title}
                      fill
                      sizes="80px"
                      style={{ objectFit: "contain" }}
                    />
                  </div>
                  <div className={styles.itemDetails}>
                    <h4 className={styles.itemName}>{item.title}</h4>
                    <span className={styles.itemPrice}>₹{item.price.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Offers & Promo Codes Subsystem */}
            <div className={styles.couponSection}>
              <div className={styles.couponTitle}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                  <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
                <span>Offers & Promo Codes</span>
              </div>

              {appliedCoupon ? (
                <div className={styles.appliedCouponBadge}>
                  <div className={styles.appliedCouponInfo}>
                    <div className={styles.appliedCouponCodeRow}>
                      <span className={styles.appliedCouponCode}>{appliedCoupon.code}</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className={styles.appliedCouponSavings}>
                      {appliedCoupon.discount_type === "free_shipping"
                        ? "Free Delivery unlocked"
                        : `Saved ₹${(appliedCoupon.discount_amount || 0).toFixed(2)}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className={styles.btnRemoveCoupon}
                    aria-label="Remove coupon"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <div className={styles.couponInputRow}>
                    <input
                      type="text"
                      className={styles.couponInput}
                      placeholder="Enter code (e.g. DELUZEXVIP)"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleApplyCoupon();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className={styles.btnApplyCoupon}
                      onClick={() => handleApplyCoupon()}
                      disabled={couponLoading || !couponInput.trim()}
                    >
                      {couponLoading ? "Applying..." : "Apply"}
                    </button>
                  </div>

                  {couponError && (
                    <div className={styles.couponFeedbackError}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>{couponError}</span>
                    </div>
                  )}

                  {couponSuccessMsg && (
                    <div className={styles.couponFeedbackSuccess}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      <span>{couponSuccessMsg}</span>
                    </div>
                  )}

                  {availableOffers.length > 0 && (
                    <div className={styles.availableOffersContainer}>
                      <div className={styles.availableOffersLabel}>Available Offers</div>
                      {availableOffers.slice(0, 3).map((offer) => (
                        <div key={offer.code} className={styles.offerCard}>
                          <div className={styles.offerCardLeft}>
                            <span className={styles.offerCode}>{offer.code}</span>
                            <span className={styles.offerDesc}>{offer.description}</span>
                          </div>
                          <button
                            type="button"
                            className={styles.btnApplyOffer}
                            onClick={() => handleApplyCoupon(offer.code)}
                            disabled={couponLoading}
                          >
                            Apply
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className={styles.totals}>
              <div className={styles.summaryRow}>
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className={styles.discountSummaryRow}>
                  <span>Discount ({appliedCoupon?.code})</span>
                  <span>-₹{discount.toFixed(2)}</span>
                </div>
              )}
              <div className={styles.summaryRow}>
                <span>GST (18%)</span>
                <span>₹{gst.toFixed(2)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Express Insured Shipping</span>
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
              <div className={styles.grandTotalRow}>
                <span>Grand Total</span>
                <span className={styles.grandTotalPrice}>₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Minimum Order Value Alert */}
            {isBelowMinOrder && (
              <div style={{
                padding: "0.75rem 1rem",
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "8px",
                color: "#fca5a5",
                fontSize: "0.825rem",
                marginBottom: "1rem",
                lineHeight: 1.4,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}>
                <span>⛔</span>
                <span>
                  {shippingRules.min_order_message.replace("{amount}", `₹${shippingRules.min_order_value.toLocaleString("en-IN")}`)} (Add items worth ₹{minOrderDiff.toLocaleString("en-IN")} more to complete order)
                </span>
              </div>
            )}

            {/* Dynamic CTA Button */}
            {paymentMethod === "razorpay" ? (
              <button
                type="submit"
                className={styles.btnPayWithRazorpay}
                disabled={isProcessing || isBelowMinOrder}
              >
                {isProcessing ? (
                  <>
                    <div className={styles.spinner} />
                    <span>Connecting to Razorpay Secure...</span>
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>{isBelowMinOrder ? `Min. Order ₹${shippingRules.min_order_value.toLocaleString("en-IN")} Required` : `Pay ₹${grandTotal.toFixed(2)} via Razorpay`}</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="submit"
                className={styles.btnPayCod}
                disabled={isProcessing || isBelowMinOrder}
              >
                {isProcessing ? (
                  <>
                    <div className={styles.spinner} />
                    <span>Confirming Order...</span>
                  </>
                ) : (
                  <span>{isBelowMinOrder ? `Min. Order ₹${shippingRules.min_order_value.toLocaleString("en-IN")} Required` : `Confirm Cash on Delivery (₹${grandTotal.toFixed(2)})`}</span>
                )}
              </button>
            )}

            <div className={styles.securityGuarantee} style={{ marginTop: "1.25rem" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C89B60" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Bank-Grade 256-Bit Encryption • Official Razorpay Partner</span>
            </div>
          </div>
        </div>
      </form>

    </main>
  );
}
