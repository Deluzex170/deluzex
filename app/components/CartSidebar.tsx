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
        <div className={styles.header}>
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
          </button>
        </div>

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
                  <Image src={item.image} alt={item.title} fill style={{ objectFit: 'contain' }} />
                </div>
                <div className={styles.itemDetails}>
                  <h4>{item.title}</h4>
                  <p className={styles.price}>₹{item.price.toFixed(2)}</p>
                  <div className={styles.itemActions}>
                    <div className={styles.quantity}>
                      <button onClick={() => dispatch(updateQuantity({ id: item.id, change: -1 }))}>-</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => dispatch(updateQuantity({ id: item.id, change: 1 }))}>+</button>
                    </div>
                    <div className={styles.iconButtons}>
                      <button className={styles.iconBtnSmall} onClick={() => dispatch(removeFromCart(item.id))}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

        <div className={styles.footer}>
          <div className={styles.summaryRow}>
            <span>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>GST (18%)</span>
            <span>₹{gst.toFixed(2)}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>Delivery Charges</span>
            <span>{delivery > 0 ? `₹${delivery.toFixed(2)}` : 'Free'}</span>
          </div>
          <div className={styles.subtotalRow} style={{ marginTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h3>Grand Total</h3>
              <p>Taxes & Shipping included</p>
            </div>
            <div className={styles.totalPrice}>₹{grandTotal.toFixed(2)}</div>
          </div>
          <button className={styles.btnCheckout} disabled={cartItems.length === 0} onClick={handleCheckout}>
            Proceed to Checkout
          </button>
        </div>
      </div>
    </>
  );
}
