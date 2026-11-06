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

function getUserStorageKey(email?: string): string | null {
  if (!email) return null;
  const clean = email.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return `deluzex_wishlist_${clean}`;
}

function readUserWishlist(email?: string): WishlistItem[] {
  if (typeof window === "undefined" || !email) return [];
  const key = getUserStorageKey(email);
  if (!key) return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUserWishlist(email: string | undefined, items: WishlistItem[]) {
  if (typeof window === "undefined" || !email) return;
  const key = getUserStorageKey(email);
  if (!key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // ignore storage quota errors
  }
}

function purgeLegacyStorage() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("deluzex_wishlist_items");
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
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const isHydratedRef = useRef(false);

  const userEmail = (user as Record<string, any>)?.email ? String((user as any).email).trim().toLowerCase() : "";

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

  // Refresh/sync wishlist from backend
  const refreshWishlist = useCallback(async () => {
    // Guest protection: If not authenticated, ensure wishlist is empty
    if (!isAuthenticated || !userEmail) {
      setWishlistItems([]);
      setWishlistIds(new Set());
      purgeLegacyStorage();
      return;
    }

    // 1. Optimistic read from user-scoped localStorage
    const local = readUserWishlist(userEmail);
    if (local && local.length > 0) {
      setWishlistItems(local);
      setWishlistIds(buildIdsSet(local));
    }

    // 2. Authoritative sync with backend
    setIsLoading(true);
    try {
      const serverItems = await fetchUserWishlist(userEmail);
      if (Array.isArray(serverItems)) {
        setWishlistItems(serverItems);
        setWishlistIds(buildIdsSet(serverItems));
        writeUserWishlist(userEmail, serverItems);
      }
    } catch (err) {
      console.warn("Backend wishlist sync notice:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, userEmail, buildIdsSet]);

  // Handle Authentication Changes
  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !userEmail) {
      // Guest: clear all wishlist state
      setWishlistItems([]);
      setWishlistIds(new Set());
      purgeLegacyStorage();
    } else {
      // Authenticated: load user wishlist
      refreshWishlist();
    }
    isHydratedRef.current = true;
  }, [isAuthenticated, userEmail, authLoading, refreshWishlist]);

  // Listen to Global Logout Event
  useEffect(() => {
    const handleLogout = () => {
      setWishlistItems([]);
      setWishlistIds(new Set());
      purgeLegacyStorage();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("auth:logout", handleLogout);
      return () => {
        window.removeEventListener("auth:logout", handleLogout);
      };
    }
  }, []);

  // Check if a product is wishlisted
  const isWishlisted = useCallback(
    (productId?: string | number, title?: string): boolean => {
      if (!isAuthenticated || !userEmail) return false;
      if (!productId && !title) return false;
      const idStr = productId ? String(productId).trim() : "";
      const titleStr = title ? String(title).trim().toLowerCase() : "";
      return (idStr ? wishlistIds.has(idStr) : false) || (titleStr ? wishlistIds.has(titleStr) : false);
    },
    [isAuthenticated, userEmail, wishlistIds]
  );

  // Toggle wishlist item
  const toggleWishlist = useCallback(
    async (
      product: Partial<Product> & { title?: string; image?: string; price?: number | string; slug?: string }
    ): Promise<boolean> => {
      // Wishlist is strictly for authenticated users
      if (!isAuthenticated || !userEmail) {
        return false;
      }

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
        writeUserWishlist(userEmail, updatedItems);

        // Sync with backend
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
          user_email: userEmail,
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
        writeUserWishlist(userEmail, updatedItems);

        // Sync with backend
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

        return true;
      }
    },
    [isAuthenticated, userEmail, isWishlisted, wishlistItems, buildIdsSet]
  );

  const removeFromWishlist = useCallback(
    async (productId: string | number, itemId?: string, title?: string): Promise<boolean> => {
      if (!isAuthenticated || !userEmail) return false;

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
      writeUserWishlist(userEmail, updatedItems);

      // Backend sync
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

      return true;
    },
    [isAuthenticated, userEmail, wishlistItems, buildIdsSet]
  );

  return (
    <WishlistContext.Provider
      value={{
        wishlistItems: isAuthenticated ? wishlistItems : [],
        wishlistIds: isAuthenticated ? wishlistIds : new Set(),
        isWishlisted,
        toggleWishlist,
        removeFromWishlist,
        wishlistCount: isAuthenticated ? wishlistItems.length : 0,
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
