"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext";
import {
  fetchUserWishlist,
  toggleWishlistApi,
  removeFromWishlistByProductId,
  WishlistItem,
  Product,
} from "../services/api";

const LOCAL_STORAGE_KEY = "deluzex_wishlist_items";

function readLocalWishlist(): WishlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalWishlist(items: WishlistItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

interface WishlistContextType {
  wishlistItems: WishlistItem[];
  wishlistIds: Set<string>;
  isWishlisted: (productId?: string | number, title?: string) => boolean;
  toggleWishlist: (
    product: Partial<Product> & { title?: string; image?: string; price?: number | string; slug?: string }
  ) => Promise<boolean>;
  removeFromWishlist: (productId: string | number, itemId?: string, title?: string) => Promise<boolean>;
  wishlistCount: number;
  isLoading: boolean;
  refreshWishlist: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const isHydratedRef = useRef(false);

  const userEmail = (user as Record<string, string>)?.email || "";

  // Helper to rebuild IDs Set from item list
  const buildIdsSet = useCallback((items: WishlistItem[]): Set<string> => {
    const ids = new Set<string>();
    items.forEach((item) => {
      if (item.product_id) ids.add(String(item.product_id).trim());
      if (item.id) ids.add(String(item.id).trim());
      if (item._id) ids.add(String(item._id).trim());
      if (item.product_title) ids.add(String(item.product_title).trim().toLowerCase());
    });
    return ids;
  }, []);

  // 1. Initial hydration from localStorage
  useEffect(() => {
    const local = readLocalWishlist();
    if (local && local.length > 0) {
      setWishlistItems(local);
      setWishlistIds(buildIdsSet(local));
    }
    isHydratedRef.current = true;
  }, [buildIdsSet]);

  // 2. Refresh/sync wishlist
  const refreshWishlist = useCallback(async () => {
    const local = readLocalWishlist();
    if (local && local.length > 0) {
      setWishlistItems(local);
      setWishlistIds(buildIdsSet(local));
    }

    if (!isAuthenticated || !userEmail) {
      return;
    }

    setIsLoading(true);
    try {
      const serverItems = await fetchUserWishlist(userEmail);
      if (Array.isArray(serverItems) && serverItems.length > 0) {
        // Merge server items with local items
        const mergedMap = new Map<string, WishlistItem>();
        local.forEach((item) => {
          const key = String(item.product_id || item.id || item._id || item.product_title).toLowerCase();
          mergedMap.set(key, item);
        });
        serverItems.forEach((item) => {
          const key = String(item.product_id || item.id || item._id || item.product_title).toLowerCase();
          mergedMap.set(key, item);
        });
        const merged = Array.from(mergedMap.values());
        setWishlistItems(merged);
        setWishlistIds(buildIdsSet(merged));
        writeLocalWishlist(merged);
      }
    } catch (err) {
      console.warn("Backend wishlist fetch warning, preserving local state:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, userEmail, buildIdsSet]);

  useEffect(() => {
    if (isHydratedRef.current) {
      refreshWishlist();
    }
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
      product: Partial<Product> & { title?: string; image?: string; price?: number | string; slug?: string }
    ): Promise<boolean> => {
      const pId = String(product._id || product.id || "").trim();
      const pTitle = String(product.product_title || product.title || product.name || "Product").trim();
      const pPrice = product.product_price ?? product.price ?? 0;
      const pImage = product.product_main_image || product.image || "";
      const pSlug = product.slug || pId;

      const currentlyWishlisted = isWishlisted(pId, pTitle);

      if (currentlyWishlisted) {
        // REMOVE FROM WISHLIST
        const updatedItems = wishlistItems.filter((item) => {
          const matchPid = pId && String(item.product_id || item.id || item._id || "") === pId;
          const matchTitle = pTitle && String(item.product_title || "").trim().toLowerCase() === pTitle.toLowerCase();
          return !matchPid && !matchTitle;
        });

        const updatedIds = buildIdsSet(updatedItems);
        setWishlistItems(updatedItems);
        setWishlistIds(updatedIds);
        writeLocalWishlist(updatedItems);

        // Sync with backend if user email is available
        if (userEmail) {
          toggleWishlistApi({
            user_email: userEmail,
            product_id: pId || undefined,
            product_title: pTitle,
            product_price: pPrice,
            product_image: pImage,
            product_slug: pSlug,
          }).catch((err) => {
            console.warn("Backend sync warning on remove:", err);
          });
        }

        return false;
      } else {
        // ADD TO WISHLIST
        const newItem: WishlistItem = {
          id: pId || `wish_${Date.now()}`,
          _id: pId || `wish_${Date.now()}`,
          product_id: pId || undefined,
          product_title: pTitle,
          product_price: pPrice,
          product_image: pImage,
          product_slug: pSlug,
          user_email: userEmail || "guest",
          created_at: new Date().toISOString(),
        };

        const updatedItems = [
          newItem,
          ...wishlistItems.filter((item) => {
            const matchPid = pId && String(item.product_id || item.id || item._id || "") === pId;
            const matchTitle = pTitle && String(item.product_title || "").trim().toLowerCase() === pTitle.toLowerCase();
            return !matchPid && !matchTitle;
          }),
        ];

        const updatedIds = buildIdsSet(updatedItems);
        setWishlistItems(updatedItems);
        setWishlistIds(updatedIds);
        writeLocalWishlist(updatedItems);

        // Sync with backend if user email is available
        if (userEmail) {
          toggleWishlistApi({
            user_email: userEmail,
            product_id: pId || undefined,
            product_title: pTitle,
            product_price: pPrice,
            product_image: pImage,
            product_slug: pSlug,
          }).catch((err) => {
            console.warn("Backend sync warning on add:", err);
          });
        }

        return true;
      }
    },
    [isWishlisted, wishlistItems, buildIdsSet, userEmail]
  );

  const removeFromWishlist = useCallback(
    async (productId: string | number, itemId?: string, title?: string): Promise<boolean> => {
      const pId = String(productId || "").trim();
      const cleanItemId = itemId ? String(itemId).trim() : "";
      const cleanTitle = title ? String(title).trim().toLowerCase() : "";

      const updatedItems = wishlistItems.filter((item) => {
        const matchPid = pId && String(item.product_id || "") === pId;
        const matchId = cleanItemId && (String(item.id || "") === cleanItemId || String(item._id || "") === cleanItemId);
        const matchTitle = cleanTitle && String(item.product_title || "").trim().toLowerCase() === cleanTitle;
        return !matchPid && !matchId && !matchTitle;
      });

      const updatedIds = buildIdsSet(updatedItems);
      setWishlistItems(updatedItems);
      setWishlistIds(updatedIds);
      writeLocalWishlist(updatedItems);

      // Backend sync
      if (userEmail) {
        if (cleanItemId) {
          fetch(`${process.env.NEXT_PUBLIC_API_URL || "/api/v1"}/user/wishlist/${cleanItemId}`, {
            method: "DELETE",
            headers: {
              ...(typeof window !== "undefined" && localStorage.getItem("authToken")
                ? { Authorization: `Bearer ${localStorage.getItem("authToken")}` }
                : {}),
            },
          }).catch(() => {});
        }
        if (pId) {
          removeFromWishlistByProductId(pId, userEmail).catch(() => {});
        }
      }

      return true;
    },
    [wishlistItems, buildIdsSet, userEmail]
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
