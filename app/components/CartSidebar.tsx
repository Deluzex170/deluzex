"use client";

import React from "react";
import Image from "next/image";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store/store";
import { closeCart, removeFromCart, updateQuantity, clearCart } from "../store/cartSlice";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import styles from "./CartSidebar.module.css";

export default function CartSidebar() {
  const dispatch = useDispatch();
  const { isCartOpen, cartItems, cartTotal } = useSelector((state: RootState) => state.cart);
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const subtotal = cartTotal;
  const gst = subtotal * 0.18;
  const delivery = subtotal > 0 ? 99 : 0;
  const grandTotal = subtotal + gst + delivery;

  const handleCheckout = () => {
    if (isAuthenticated) {
      router.push("/checkout");
    } else {
      router.push("/login");
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
<<<<<<< HEAD
          <div>
            <h2>{cartItems.length} ITEM{cartItems.length !== 1 ? 'S' : ''} IN CART</h2>
            {cartItems.length > 0 && (
              <button
                type="button"
                className={styles.clearCartBtn}
                onClick={() => dispatch(clearCart())}
              >
                Clear Cart
              </button>
            )}
          </div>
          <button className={styles.closeBtn} onClick={() => dispatch(closeCart())}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
=======
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
>>>>>>> dev
          </button>
        </div>

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
            <div className={styles.breakdownSection}>
              <div className={styles.summaryRow}>
                <span>Subtotal</span>
                <span>₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>GST (18%)</span>
                <span>₹{gst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Delivery Charges</span>
                <span>{delivery > 0 ? `₹${delivery.toFixed(2)}` : "Free"}</span>
              </div>
            </div>
          )}

          <div className={styles.grandTotalRow}>
            <div>
              <h3 className={styles.grandTotalLabel}>Subtotal</h3>
              <p className={styles.taxesSubtext}>Taxes included</p>
            </div>
            <div className={styles.totalPrice}>
              ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <button
            className={styles.btnCheckout}
            disabled={cartItems.length === 0}
            onClick={handleCheckout}
          >
            Proceed to Checkout
          </button>
        </div>
      </div>
    </>
  );
}
