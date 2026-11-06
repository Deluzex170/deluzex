"use client";

import React, { useState } from "react";
import { useWishlist } from "../context/WishlistContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Product } from "../services/api";
import styles from "./WishlistButton.module.css";

interface WishlistButtonProps {
  product: Partial<Product> & {
    title?: string;
    image?: string;
    price?: number | string;
    slug?: string;
  };
  variant?: "floating" | "icon" | "pill";
  size?: number;
  className?: string;
  showText?: boolean;
}

export default function WishlistButton({
  product,
  variant = "floating",
  size = 18,
  className = "",
  showText = false,
}: WishlistButtonProps) {
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { isAuthenticated, openLoginModal } = useAuth();
  const toast = useToast();
  const [animating, setAnimating] = useState(false);
  const [busy, setBusy] = useState(false);

  const pId = String(product._id || product.id || "");
  const pTitle = String(product.product_title || product.title || product.name || "Product").trim();
  const active = isWishlisted(pId, pTitle);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Guest protection: prompt to sign in
    if (!isAuthenticated) {
      toast.warning("Please sign in to save pieces to your wishlist.");
      if (openLoginModal) {
        openLoginModal(undefined, "Please sign in to save items to your wishlist.");
      }
      return;
    }

    if (busy) return;
    setBusy(true);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 400);

    try {
      const added = await toggleWishlist(product);
      if (added) {
        toast.success(`"${pTitle}" added to your wishlist!`);
      } else {
        toast.info(`"${pTitle}" removed from your wishlist.`);
      }
    } catch {
      toast.error("Failed to update wishlist. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const getButtonClass = () => {
    const base = [styles.wishlistBtn];
    if (variant === "floating") {
      base.push(styles.floating);
      if (active) base.push(styles.floatingActive);
    } else if (variant === "pill") {
      base.push(styles.pill);
      if (active) base.push(styles.pillActive);
    } else {
      base.push(styles.icon);
      if (active) base.push(styles.iconActive);
    }
    if (className) base.push(className);
    return base.join(" ");
  };

  return (
    <button
      type="button"
      className={getButtonClass()}
      onClick={handleClick}
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      title={active ? "Remove from Wishlist" : "Save to Wishlist"}
      disabled={busy}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={active ? "0" : "2"}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`${styles.heartSvg} ${animating ? styles.animateBounce : ""}`}
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {(variant === "pill" || showText) && (
        <span>{active ? "Saved to Wishlist" : "Add to Wishlist"}</span>
      )}
    </button>
  );
}
