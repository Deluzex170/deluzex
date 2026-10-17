"use client";

import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store/store";
import { addToCart, updateQuantity, removeFromCart } from "../store/cartSlice";
import { Product } from "../services/api";
import { useAuth } from "../context/AuthContext";

interface AddToCartButtonProps {
  product: Product;
  styleClass?: string;
  variant?: "default" | "plus";
}

export default function AddToCartButton({ product, styleClass, variant = "default" }: AddToCartButtonProps) {
  const dispatch = useDispatch();
  const { isAuthenticated, openLoginModal } = useAuth();
  const cartItems = useSelector((state: RootState) => state.cart.cartItems);
  const productId = product._id || product.id || "";
  const cartItem = cartItems.find(item => String(item.id) === String(productId));
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      openLoginModal(
        product,
        `Please log in to add ${product.product_title || product.name || "this lamp"} to your cart.`
      );
      return;
    }
    dispatch(addToCart(product));
  };

  const handleDecrease = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!productId) return;
    if (cartItem && cartItem.quantity === 1) {
      dispatch(removeFromCart(productId));
    } else {
      dispatch(updateQuantity({ id: productId, change: -1 }));
    }
  };

  const handleIncrease = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!productId) return;
    if (!isAuthenticated) {
      openLoginModal(product, "Please log in to update your cart items.");
      return;
    }
    dispatch(updateQuantity({ id: productId, change: 1 }));
  };

  if (mounted && cartItem) {
    return (
      <div className="cartQuantityControl" style={{
        position: 'absolute',
        right: '16px',
        bottom: '16px',
        background: '#C4924F',
        borderRadius: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        padding: '6px 12px',
        zIndex: 10,
        boxShadow: '0 4px 12px rgba(196, 146, 79, 0.35)'
      }}>
        <button 
          onClick={handleDecrease}
          style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '16px', fontWeight: 600, padding: '0 4px', lineHeight: 1 }}
        >
          −
        </button>
        <span style={{ color: 'white', fontSize: '13px', fontWeight: 700, minWidth: '14px', textAlign: 'center' }}>
          {cartItem.quantity}
        </span>
        <button 
          onClick={handleIncrease}
          style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '16px', fontWeight: 600, padding: '0 4px', lineHeight: 1 }}
        >
          +
        </button>
      </div>
    );
  }

  if (variant === "plus") {
    return (
      <button 
        className={styleClass} 
        onClick={handleAdd}
        aria-label="Add to cart"
        style={{
          position: 'absolute',
          right: '16px',
          bottom: '16px',
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          background: '#C4924F',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          cursor: 'pointer',
          zIndex: 10,
          boxShadow: '0 4px 14px rgba(196, 146, 79, 0.4)',
          transition: 'transform 0.25s ease, background 0.25s ease',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    );
  }

  return (
    <button 
      className={styleClass} 
      onClick={handleAdd}
      aria-label="Add to cart"
      style={{
        position: 'absolute',
        right: '1rem',
        bottom: '1rem',
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: '#C19A6B',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        cursor: 'pointer',
        zIndex: 10,
        transition: 'transform 0.3s ease, background 0.3s ease'
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20" fill="currentColor">
        <path d="M0 0h24v24H0V0z" fill="none"/>
        <path d="M11 9h2V6h3V4h-3V1h-2v3H8v2h3v3zm-4 9c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2zm-8.9-5h7.45c.75 0 1.41-.41 1.75-1.03l3.86-7.01L19.42 4l-3.87 7H8.53L4.27 2H1v2h2l3.6 7.59L3.62 17H19v-2H7l1.1-2z"/>
      </svg>   
    </button>
  );
}
