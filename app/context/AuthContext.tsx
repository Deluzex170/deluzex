"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { UserProfile } from "../services/api";

export type AuthUser = (UserProfile & { is_admin?: boolean }) | Record<string, unknown> | null;

export interface PendingCartProduct {
  _id?: string | number;
  id?: string | number;
  product_title?: string;
  name?: string;
  product_price?: number | string;
  price?: number | string;
  product_main_image?: string;
  image_url?: string;
  quantity?: number;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isAdmin: boolean;
  user: AuthUser;
  loading: boolean;
  login: (token: string, userData: AuthUser) => void;
  logout: () => void;
  showLoginModal: boolean;
  loginModalMessage: string;
  pendingCartProduct: PendingCartProduct | null;
  openLoginModal: (product?: PendingCartProduct, message?: string) => void;
  closeLoginModal: () => void;
  clearPendingCartProduct: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function hasAccessToken(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  return document.cookie.includes("access_token=");
}

function readStoredUser(): AuthUser {
  if (typeof window === "undefined") {
    return null;
  }

  const storedUser = window.localStorage.getItem("user");
  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Login Modal & Cart Protection state
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [loginModalMessage, setLoginModalMessage] = useState<string>("Please log in to add items to your cart.");
  const [pendingCartProduct, setPendingCartProduct] = useState<PendingCartProduct | null>(null);

  useEffect(() => {
    const getLocalToken = (): string | null => {
      if (typeof window === "undefined") return null;
      const direct =
        window.localStorage.getItem("authToken") ||
        window.localStorage.getItem("access_token") ||
        window.localStorage.getItem("token");
      if (direct) return direct;
      if (typeof document !== "undefined") {
        const cookies = document.cookie.split(";");
        for (const cookie of cookies) {
          const [name, value] = cookie.trim().split("=");
          if (name === "access_token" || name === "accessToken") {
            return decodeURIComponent(value);
          }
        }
      }
      return null;
    };

    const token = getLocalToken();
    const storedUser = readStoredUser();

    if (!token) {
      setIsAuthenticated(false);
      setUser(null);
      setLoading(false);
    } else {
      // Optimistically display stored user while validating to prevent visual flicker
      if (storedUser) {
        setUser(storedUser);
        setIsAuthenticated(true);
      }

      // Check validity with backend
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
      fetch(`${apiUrl}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      })
        .then(async (res) => {
          if (res.ok) {
            const body = await res.json();
            const freshUser = body && body.data ? body.data : body;
            setUser(freshUser);
            setIsAuthenticated(true);
            if (typeof window !== "undefined") {
              window.localStorage.setItem("user", JSON.stringify(freshUser));
            }
          } else if (res.status === 401 || res.status === 403) {
            // Token is invalid or expired
            logout();
            if (typeof window !== "undefined") {
              const path = window.location.pathname;
              if (path.startsWith("/admin") && path !== "/admin/login") {
                const redirectParam = encodeURIComponent(window.location.pathname + window.location.search);
                window.location.href = `/admin/login?expired=1&redirect=${redirectParam}`;
              }
            }
          }
        })
        .catch(() => {
          // If network failure / offline, preserve storedUser state
          if (storedUser) {
            setIsAuthenticated(true);
          }
        })
        .finally(() => {
          setLoading(false);
        });
    }

    try {
      const storedPending = window.sessionStorage.getItem("pending_cart_product");
      if (storedPending) {
        setPendingCartProduct(JSON.parse(storedPending));
      }
    } catch {
      // ignore JSON parse errors
    }

    const handleSessionExpired = () => {
      logout();
    };

    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () => {
      window.removeEventListener("auth:session-expired", handleSessionExpired);
    };
  }, []);

  const isAdmin = Boolean(user && typeof user === "object" && (user as Record<string, unknown>).is_admin === true);

  const openLoginModal = (product?: PendingCartProduct, message?: string) => {
    if (product) {
      setPendingCartProduct(product);
      try {
        window.sessionStorage.setItem("pending_cart_product", JSON.stringify(product));
      } catch {
        // ignore storage errors
      }
    }
    if (message) {
      setLoginModalMessage(message);
    } else {
      setLoginModalMessage("Please log in to add items to your cart.");
    }
    setShowLoginModal(true);
  };

  const closeLoginModal = () => {
    setShowLoginModal(false);
  };

  const clearPendingCartProduct = () => {
    setPendingCartProduct(null);
    try {
      window.sessionStorage.removeItem("pending_cart_product");
    } catch {
      // ignore
    }
  };

  const login = (token: string, userData: AuthUser) => {
    setIsAuthenticated(true);
    setUser(userData);
    // 7 days expiration (604800s) matching backend ACCESS_TOKEN_EXPIRE_MINUTES
    document.cookie = `access_token=${token}; path=/; max-age=604800; SameSite=Lax`;
    localStorage.setItem("authToken", token);
    localStorage.setItem("access_token", token);
    if (userData) {
      localStorage.setItem("user", JSON.stringify(userData));
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    if (typeof document !== "undefined") {
      document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax";
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem("authToken");
      localStorage.removeItem("access_token");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isAdmin,
        user,
        loading,
        login,
        logout,
        showLoginModal,
        loginModalMessage,
        pendingCartProduct,
        openLoginModal,
        closeLoginModal,
        clearPendingCartProduct,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

