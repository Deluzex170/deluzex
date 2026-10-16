"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./adminLogin.module.css";
import { useAuth } from "../../context/AuthContext";

type ToastProps = {
  type: "success" | "error";
  message: string;
};

export default function AdminLogin() {
  const router = useRouter();
  const { login, isAdmin, isAuthenticated } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<ToastProps | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("expired") === "1") {
        setToast({
          type: "error",
          message: "Your session has expired. Please sign in again to continue.",
        });
      }
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      const redirectParam =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("redirect")
          : null;
      router.push(redirectParam && redirectParam.startsWith("/admin") ? redirectParam : "/admin");
    }
  }, [isAuthenticated, isAdmin, router]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    setPasswordError("");

    let valid = true;
    if (!email.trim()) {
      setEmailError("Administrator email is required.");
      valid = false;
    }
    if (!password.trim()) {
      setPasswordError("Password is required.");
      valid = false;
    }

    if (!valid) return;

    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
      // Call dedicated admin login endpoint
      const response = await fetch(`${apiUrl}/auth/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (!data.data?.is_admin) {
          setToast({
            type: "error",
            message: "Access denied. You do not have administrator privileges.",
          });
          setIsLoading(false);
          return;
        }

        setToast({ type: "success", message: "Admin authenticated. Loading portal..." });
        localStorage.setItem("authToken", data.access_token);
        login(data.access_token, data.data);

        setTimeout(() => {
          const redirectParam =
            typeof window !== "undefined"
              ? new URLSearchParams(window.location.search).get("redirect")
              : null;
          router.push(redirectParam && redirectParam.startsWith("/admin") ? redirectParam : "/admin");
        }, 1200);
      } else {
        const errorMsg = data.detail || data.message || "Failed to authenticate administrator.";
        setToast({ type: "error", message: errorMsg });
      }
    } catch {
      setToast({ type: "error", message: "Network error occurred. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.ambientGlow} />

      {toast && (
        <div className={`${styles.toast} ${toast.type === "success" ? styles.toastSuccess : styles.toastError}`}>
          <span>{toast.message}</span>
        </div>
      )}

      <div className={styles.loginCard}>
        <div className={styles.header}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.25rem" }}>
            <Link href="/" title="Back to De Luzex Storefront">
              <img src="/images/logos/de_luzex_white.svg" alt="De Luzex" height="34" style={{ height: "34px", width: "auto" }} />
            </Link>
          </div>
          <div className={styles.badge}>
            <span className={styles.badgeDot} />
            Restricted Access
          </div>
          <h1 className={styles.title}>Administrator Portal</h1>
          <p className={styles.subtitle}>
            Enter authorized administrator credentials to access the management dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.formGroup}>
            <label htmlFor="admin-email">Admin Email</label>
            <div className={styles.inputWrapper}>
              <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <input
                id="admin-email"
                type="email"
                placeholder="admin@deluzex.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError("");
                }}
                className={`${styles.input} ${emailError ? styles.inputError : ""}`}
                autoComplete="email"
              />
            </div>
            {emailError && <span className={styles.errorText}>{emailError}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="admin-password">Password</label>
            <div className={styles.inputWrapper}>
              <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                id="admin-password"
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError("");
                }}
                className={`${styles.input} ${passwordError ? styles.inputError : ""}`}
                autoComplete="current-password"
              />
            </div>
            {passwordError && <span className={styles.errorText}>{passwordError}</span>}
          </div>

          <button type="submit" className={styles.btnSubmit} disabled={isLoading}>
            {isLoading ? "Authenticating..." : "Sign In to Admin Portal"}
          </button>
        </form>

        <div className={styles.footer}>
          <Link href="/" className={styles.returnLink}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5 M12 19l-7-7 7-7" />
            </svg>
            Return to Store
          </Link>
          <Link href="/login" className={styles.customerLink}>
            Customer Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
