"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import {
  fetchUserWishlist,
  toggleWishlistApi,
  removeFromWishlistByProductId,
  WishlistItem,
  Product,
} from "../services/api";

interface WishlistContextType {
  wishlistItems: WishlistItem[];
  wishlistIds: Set<string>;
  isWishlisted: (productId?: string | number, title?: string) => boolean;
  toggleWishlist: (product: Partial<Product> & { title?: string; image?: string; price?: number | string }) => Promise<boolean>;
  removeFromWishlist: (productId: string | number) => Promise<boolean>;
  wishlistCount: number;
  isLoading: boolean;
  refreshWishlist: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, openLoginModal } = useAuth();
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const userEmail = (user as Record<string, string>)?.email || "";

  // Load wishlist from backend when user logs in
  const refreshWishlist = useCallback(async () => {
    if (!isAuthenticated || !userEmail) {
      setWishlistItems([]);
      setWishlistIds(new Set());
      return;
    }

    setIsLoading(true);
    try {
      const items = await fetchUserWishlist(userEmail);
      setWishlistItems(items || []);
      const ids = new Set<string>();
      (items || []).forEach((item) => {
        if (item.product_id) ids.add(String(item.product_id).trim());
        if (item.product_title) ids.add(String(item.product_title).trim().toLowerCase());
      });
      setWishlistIds(ids);
    } catch (err) {
      console.error("Failed to load wishlist:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, userEmail]);

  useEffect(() => {
    refreshWishlist();
  }, [refreshWishlist]);

  // Check if a product is wishlisted
  const isWishlisted = useCallback(
    (productId?: string | number, title?: string): boolean => {
      if (!productId && !title) return false;
      const idStr = productId ? String(productId).trim() : "";
      const titleStr = title ? String(title).trim().toLowerCase() : "";
      return (idStr ? wishlistIds.has(idStr) : false) || (titleStr ? wishlistIds.has(titleStr) : false);
    },
    [wishlistIds]
  );

  // Toggle wishlist item
  const toggleWishlist = useCallback(
    async (
      product: Partial<Product> & { title?: string; image?: string; price?: number | string }
    ): Promise<boolean> => {
      if (!isAuthenticated || !userEmail) {
        openLoginModal(
          product as Product,
          `Please sign in to add "${product.product_title || product.title || product.name || "this item"}" to your wishlist.`
        );
        return false;
      }

      const pId = String(product._id || product.id || "").trim();
      const pTitle = String(product.product_title || product.title || product.name || "Product").trim();
      const pPrice = product.product_price ?? product.price ?? 0;
      const pImage = product.product_main_image || product.image || "";
      const pSlug = product.slug || pId;

      const currentlyWishlisted = isWishlisted(pId, pTitle);

      // 1. Optimistic UI update
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (currentlyWishlisted) {
          if (pId) next.delete(pId);
          if (pTitle) next.delete(pTitle.toLowerCase());
        } else {
          if (pId) next.add(pId);
          if (pTitle) next.add(pTitle.toLowerCase());
        }
        return next;
      });

      if (currentlyWishlisted) {
        setWishlistItems((prev) =>
          prev.filter((item) => String(item.product_id) !== pId && item.product_title !== pTitle)
        );
      }

      // 2. Call backend
      try {
        const res = await toggleWishlistApi({
          user_email: userEmail,
          product_id: pId || undefined,
          product_title: pTitle,
          product_price: pPrice,
          product_image: pImage,
          product_slug: pSlug,
        });

        // Reconcile with server response
        if (res.is_wishlisted) {
          setWishlistIds((prev) => {
            const next = new Set(prev);
            if (pId) next.add(pId);
            if (pTitle) next.add(pTitle.toLowerCase());
            return next;
          });
          if (res.item) {
            setWishlistItems((prev) => [res.item as WishlistItem, ...prev.filter((i) => String(i.product_id) !== pId)]);
          }
          return true;
        } else {
          setWishlistIds((prev) => {
            const next = new Set(prev);
            if (pId) next.delete(pId);
            if (pTitle) next.delete(pTitle.toLowerCase());
            return next;
          });
          setWishlistItems((prev) =>
            prev.filter((item) => String(item.product_id) !== pId && item.product_title !== pTitle)
          );
          return false;
        }
      } catch (err) {
        console.error("Failed to toggle wishlist on backend:", err);
        // Rollback optimistic update on error
        refreshWishlist();
        return currentlyWishlisted;
      }
    },
    [isAuthenticated, userEmail, openLoginModal, isWishlisted, refreshWishlist]
  );

  const removeFromWishlist = useCallback(
    async (productId: string | number, itemId?: string, title?: string): Promise<boolean> => {
      if (!userEmail) return false;
      const pId = String(productId).trim();
      const cleanItemId = itemId ? String(itemId).trim() : "";
      const cleanTitle = title ? String(title).trim().toLowerCase() : "";

      // 1. Optimistic removal from live Set and list
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (pId) next.delete(pId);
        if (cleanItemId) next.delete(cleanItemId);
        if (cleanTitle) next.delete(cleanTitle);
        return next;
      });

      setWishlistItems((prev) =>
        prev.filter((item) => {
          const matchPid = pId && String(item.product_id) === pId;
          const matchId = cleanItemId && (String(item.id) === cleanItemId || String(item._id) === cleanItemId);
          const matchTitle = cleanTitle && String(item.product_title).toLowerCase() === cleanTitle;
          return !matchPid && !matchId && !matchTitle;
        })
      );

      // 2. Call backend
      try {
        if (cleanItemId) {
          await fetch(`${process.env.NEXT_PUBLIC_API_URL || "/api/v1"}/user/wishlist/${cleanItemId}`, {
            method: "DELETE",
            headers: {
              ...(typeof window !== "undefined" && localStorage.getItem("authToken")
                ? { Authorization: `Bearer ${localStorage.getItem("authToken")}` }
                : {}),
            },
          });
        }
        if (pId) {
          await removeFromWishlistByProductId(pId, userEmail);
        }
        return true;
      } catch (err) {
        console.error("Failed to remove item from wishlist:", err);
        refreshWishlist();
        return false;
      }
    },
    [userEmail, refreshWishlist]
  );

  return (
    <WishlistContext.Provider
      value={{
        wishlistItems,
        wishlistIds,
        isWishlisted,
        toggleWishlist,
        removeFromWishlist,
        wishlistCount: wishlistItems.length,
        isLoading,
        refreshWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}
