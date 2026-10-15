"use client";

import { useEffect, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store/store";
import { setCartItems, CartItem } from "../store/cartSlice";
import { useAuth } from "../context/AuthContext";
import {
  fetchBackendCart,
  getCartSessionId,
  syncBackendCart,
  addToBackendCart,
  clearBackendCart,
  updateBackendCartItem,
  removeBackendCartItem,
  BackendCartItem,
} from "../services/api";

export default function CartSyncManager() {
  const dispatch = useDispatch();
  const { cartItems } = useSelector((state: RootState) => state.cart);
  const { user, isAuthenticated } = useAuth();
  
  const isInitialLoadDone = useRef(false);
  const prevAuthEmail = useRef<string | null>(null);
  const isSyncingFromBackend = useRef(false);

  // Active identifier: user's email if logged in, else guest session ID
  const activeIdentifier = (user as Record<string, string>)?.email || getCartSessionId();

  // 1. Initial hydration: Load cart from MongoDB on app mount
  useEffect(() => {
    let isMounted = true;

    async function hydrateCart() {
      if (isInitialLoadDone.current) return;
      
      const identifier = (user as Record<string, string>)?.email || getCartSessionId();
      try {
        const backendItems = await fetchBackendCart(identifier);
        
        if (!isMounted) return;

        if (backendItems && backendItems.length > 0) {
          isSyncingFromBackend.current = true;
          const mappedItems: CartItem[] = backendItems.map((bi) => ({
            id: bi.product_id,
            title: bi.title,
            price: Number(bi.price) || 0,
            image: bi.image,
            quantity: bi.quantity,
          }));
          dispatch(setCartItems(mappedItems));
        } else if (cartItems.length > 0) {
          // If backend is empty but client has items in local storage, seed backend
          const sid = getCartSessionId();
          const email = (user as Record<string, string>)?.email;
          for (const item of cartItems) {
            await addToBackendCart({
              session_id: sid,
              user_email: email,
              product_id: String(item.id),
              quantity: item.quantity,
              title: item.title,
              price: item.price,
              image: item.image,
            });
          }
        }
      } catch (err) {
        console.error("Cart hydration failed:", err);
      } finally {
        if (isMounted) {
          isInitialLoadDone.current = true;
          setTimeout(() => {
            isSyncingFromBackend.current = false;
          }, 300);
        }
      }
    }

    hydrateCart();

    return () => {
      isMounted = false;
    };
  }, [user, dispatch]);

  // 2. Account Login Transition: Merge guest cart with user cart in MongoDB
  useEffect(() => {
    const currentEmail = (user as Record<string, string>)?.email;
    if (isAuthenticated && currentEmail && currentEmail !== prevAuthEmail.current) {
      prevAuthEmail.current = currentEmail;
      const guestSid = getCartSessionId();
      
      syncBackendCart(guestSid, currentEmail).then((merged) => {
        if (merged && merged.length > 0) {
          isSyncingFromBackend.current = true;
          const mapped: CartItem[] = merged.map((bi) => ({
            id: bi.product_id,
            title: bi.title,
            price: Number(bi.price) || 0,
            image: bi.image,
            quantity: bi.quantity,
          }));
          dispatch(setCartItems(mapped));
          setTimeout(() => {
            isSyncingFromBackend.current = false;
          }, 300);
        }
      }).catch((e) => console.error("Cart sync on login failed:", e));
    }
  }, [isAuthenticated, user, dispatch]);

  // 3. Debounced synchronization to MongoDB whenever Redux cart changes
  useEffect(() => {
    if (!isInitialLoadDone.current || isSyncingFromBackend.current) {
      return;
    }

    const timer = setTimeout(async () => {
      const identifier = (user as Record<string, string>)?.email || getCartSessionId();
      const sid = getCartSessionId();
      const email = (user as Record<string, string>)?.email;

      try {
        if (cartItems.length === 0) {
          await clearBackendCart(identifier);
          return;
        }

        // Fetch current backend state to compare
        const currentBackend = await fetchBackendCart(identifier);
        const currentBackendMap = new Map(currentBackend.map((b) => [String(b.product_id), b]));

        // Sync local items to backend
        for (const item of cartItems) {
          const pId = String(item.id);
          const existing = currentBackendMap.get(pId);

          if (!existing) {
            await addToBackendCart({
              session_id: sid,
              user_email: email,
              product_id: pId,
              quantity: item.quantity,
              title: item.title,
              price: item.price,
              image: item.image,
            });
          } else if (existing.quantity !== item.quantity) {
            await updateBackendCartItem(identifier, pId, item.quantity);
          }
          currentBackendMap.delete(pId);
        }

        // Remove any items from backend that were deleted locally
        for (const [orphanId] of currentBackendMap) {
          await removeBackendCartItem(identifier, orphanId);
        }
      } catch (err) {
        console.error("Cart background sync error:", err);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [cartItems, user]);

  return null;
}
