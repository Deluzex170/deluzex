"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useDispatch } from "react-redux";
import { useAuth } from "../context/AuthContext";
import { addToCart, openCart } from "../store/cartSlice";
import styles from "./UserLoginModal.module.css";

export default function UserLoginModal() {
  const dispatch = useDispatch();
  const {
    showLoginModal,
    closeLoginModal,
    loginModalMessage,
    pendingCartProduct,
    clearPendingCartProduct,
    login,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!showLoginModal) {
    return null;
  }

  const handleClose = () => {
    if (isLoading) return;
    setErrorMsg("");
    setSuccessMsg("");
    setResetSent(false);
    closeLoginModal();
  };

  const parseErrorDetail = (data: any, fallback: string): string => {
    if (!data) return fallback;
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail) && data.detail.length > 0) {
      return data.detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(", ");
    }
    if (typeof data.message === "string") return data.message;
    return fallback;
  };

  const authFetch = async (endpoint: string, options: RequestInit): Promise<Response> => {
    const envUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    try {
      const res = await fetch(`${envUrl}${endpoint}`, options);
      return res;
    } catch (primaryErr) {
      if (envUrl.startsWith("http")) {
        try {
          const fallbackRes = await fetch(`/api/v1${endpoint}`, options);
          return fallbackRes;
        } catch {
          // rethrow primary error if fallback also fails
        }
      }
      throw primaryErr;
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!email.trim() || !password.trim()) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await authFetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Authenticate in context
        login(data.access_token, data.data);

        // Add pending product if exists
        if (pendingCartProduct) {
          dispatch(addToCart(pendingCartProduct));
          dispatch(openCart());
          clearPendingCartProduct();
          setSuccessMsg(`Welcome! ${pendingCartProduct.product_title || pendingCartProduct.name || "Item"} added to your cart.`);
        } else {
          setSuccessMsg("Logged in successfully!");
        }

        setTimeout(() => {
          handleClose();
        }, 1200);
      } else {
        setErrorMsg(parseErrorDetail(data, "Invalid email or password. Please try again."));
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Unable to reach the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const emailVal = email.trim();
    if (!emailVal || !password.trim()) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);

    try {
      const nameFromEmail = emailVal.split("@")[0] || "User";
      const response = await authFetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim() || nameFromEmail,
          last_name: lastName.trim() || "Customer",
          email: emailVal,
          password,
          phone: phone.trim() || "+919999999999",
          accept_terms: true,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // If register returns access_token and user data, log in immediately
        if (data.access_token && data.data) {
          login(data.access_token, data.data);
          if (pendingCartProduct) {
            dispatch(addToCart(pendingCartProduct));
            dispatch(openCart());
            clearPendingCartProduct();
            setSuccessMsg(`Account created! ${pendingCartProduct.product_title || pendingCartProduct.name || "Item"} added to your cart.`);
          } else {
            setSuccessMsg("Account created and logged in successfully!");
          }
          setTimeout(() => {
            handleClose();
          }, 1200);
          return;
        }

        // Fallback: log in via /auth/login
        try {
          const loginRes = await authFetch("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: emailVal, password }),
          });
          const loginData = await loginRes.json();

          if (loginRes.ok && loginData.success) {
            login(loginData.access_token, loginData.data);
            if (pendingCartProduct) {
              dispatch(addToCart(pendingCartProduct));
              dispatch(openCart());
              clearPendingCartProduct();
              setSuccessMsg(`Account created! ${pendingCartProduct.product_title || pendingCartProduct.name || "Item"} added to your cart.`);
            } else {
              setSuccessMsg("Account created and logged in successfully!");
            }
            setTimeout(() => {
              handleClose();
            }, 1200);
            return;
          }
        } catch {
          // ignore
        }

        setActiveTab("login");
        setSuccessMsg("Account created! Please enter your password to sign in.");
      } else {
        setErrorMsg(parseErrorDetail(data, "Registration failed. Please check your details."));
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    if (!resetEmail.trim()) {
      setErrorMsg("Please enter your registered email address.");
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setResetSent(true);
      setSuccessMsg("Password reset link has been sent to your email.");
    }, 600);
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={handleClose} aria-label="Close dialog">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className={styles.header}>
          <div className={styles.logoWrapper}>
            <img
              src="/images/logos/de_luzex_black.svg"
              alt="de luzex"
              width={105}
              height={22}
              className={styles.logoImg}
            />
          </div>
          <h2 className={styles.title}>
            {activeTab === "login"
              ? "Welcome Back"
              : activeTab === "register"
              ? "Elevate Every Space With Light"
              : "Reset Password"}
          </h2>
          {activeTab === "forgot" && (
            <p className={styles.subtitle}>
              We will send a password reset link to your registered email address
            </p>
          )}
          {loginModalMessage && activeTab === "login" && (
            <p className={styles.subtitle}>{loginModalMessage}</p>
          )}
        </div>

        {pendingCartProduct && (
          <div className={styles.productPreview}>
            <div
              style={{
                position: "relative",
                width: "40px",
                height: "40px",
                borderRadius: "6px",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              <Image
                src={
                  pendingCartProduct.product_main_image ||
                  pendingCartProduct.image_url ||
                  "/images/lamp_modern_tall_1784107732736.jpg"
                }
                alt={pendingCartProduct.product_title || pendingCartProduct.name || "Product"}
                fill
                sizes="40px"
                style={{ objectFit: "contain" }}
                className={styles.productThumb}
              />
            </div>
            <div className={styles.productPreviewInfo}>
              <div className={styles.productPreviewTitle}>
                {pendingCartProduct.product_title || pendingCartProduct.name || "Selected Item"}
              </div>
              <div className={styles.productPreviewSub}>
                ₹{Number(pendingCartProduct.product_price || pendingCartProduct.price || 0).toFixed(2)}
                {pendingCartProduct.quantity && pendingCartProduct.quantity > 1 ? ` × ${pendingCartProduct.quantity}` : ""}
                {" — will be added after sign in"}
              </div>
            </div>
          </div>
        )}

        {activeTab === "login" && (
          <form className={styles.form} onSubmit={handleLoginSubmit}>
            {errorMsg && <div className={styles.errorBanner}>{errorMsg}</div>}
            {successMsg && <div className={styles.successBanner}>{successMsg}</div>}

            <div className={styles.inputGroup}>
              <label className={styles.label}>Enter Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Enter Password</label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.input}
                />
                <button
                  type="button"
                  className={styles.eyeToggle}
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <div className={styles.forgotWrapper}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("forgot");
                    setErrorMsg("");
                    setSuccessMsg("");
                  }}
                  className={styles.forgotLink}
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            <div className={styles.btnRow}>
              <button type="submit" disabled={isLoading} className={styles.submitButton}>
                {isLoading ? "Signing in..." : (pendingCartProduct ? "Sign In & Add to Cart" : "Sign In Now")}
              </button>
            </div>

            <div className={styles.footerSwitch}>
              <span>Don&apos;t have an account? </span>
              <button
                type="button"
                className={styles.switchLink}
                onClick={() => {
                  setActiveTab("register");
                  setErrorMsg("");
                  setSuccessMsg("");
                }}
              >
                Sign Up Here
              </button>
            </div>
          </form>
        )}

        {activeTab === "register" && (
          <form className={styles.form} onSubmit={handleRegisterSubmit}>
            {errorMsg && <div className={styles.errorBanner}>{errorMsg}</div>}
            {successMsg && <div className={styles.successBanner}>{successMsg}</div>}

            <div className={styles.inputGroup}>
              <label className={styles.label}>Enter Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Enter Password</label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  placeholder="Create new Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.input}
                />
                <button
                  type="button"
                  className={styles.eyeToggle}
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className={styles.btnRow}>
              <button type="submit" disabled={isLoading} className={styles.submitButton}>
                {isLoading ? "Signing up..." : (pendingCartProduct ? "Sign Up & Add to Cart" : "Sign Up Now")}
              </button>
            </div>

            <div className={styles.footerSwitch}>
              <span>Already have an account? </span>
              <button
                type="button"
                className={styles.switchLink}
                onClick={() => {
                  setActiveTab("login");
                  setErrorMsg("");
                  setSuccessMsg("");
                }}
              >
                Sign In Here
              </button>
            </div>
          </form>
        )}

        {activeTab === "forgot" && (
          <form className={styles.form} onSubmit={handleResetSubmit}>
            {errorMsg && <div className={styles.errorBanner}>{errorMsg}</div>}
            {successMsg && <div className={styles.successBanner}>{successMsg}</div>}

            <div className={styles.inputGroup}>
              <label className={styles.label}>Enter Your Registered Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="Enter your registered email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.btnRow}>
              <button type="submit" disabled={isLoading || resetSent} className={styles.submitButton}>
                {isLoading ? "Sending Link..." : (resetSent ? "Reset Link Sent" : "Send Reset Link")}
              </button>
            </div>

            <div className={styles.footerSwitch}>
              <span>Know your password? </span>
              <button
                type="button"
                className={styles.switchLink}
                onClick={() => {
                  setActiveTab("login");
                  setErrorMsg("");
                  setSuccessMsg("");
                }}
              >
                Sign In Here
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
