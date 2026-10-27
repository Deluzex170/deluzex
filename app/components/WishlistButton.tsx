"use client";

import React, { useState } from "react";
import { useWishlist } from "../context/WishlistContext";
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
  const [animating, setAnimating] = useState(false);
  const [busy, setBusy] = useState(false);

  const pId = String(product._id || product.id || "");
  const pTitle = String(product.product_title || product.title || product.name || "");
  const active = isWishlisted(pId, pTitle);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (busy) return;
    setBusy(true);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 400);

    try {
      await toggleWishlist(product);
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
