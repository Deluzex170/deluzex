"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useDispatch } from "react-redux";
import { useAuth } from "../context/AuthContext";
import { addToCart, openCart } from "../store/cartSlice";
import WhatsAppAuthSection from "./WhatsAppAuthSection";
import { verifyEmailOtp, resendEmailOtp, requestPasswordReset, resetPasswordWithOtp } from "../services/api";
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

  const [activeTab, setActiveTab] = useState<"login" | "register" | "forgot" | "email_otp">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  // Forgot Password 2-Step State
  const [forgotStep, setForgotStep] = useState<"email" | "otp_password">("email");
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Email OTP state
  const [emailOtp, setEmailOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  React.useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

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

  const safeParseResponse = async (response: Response): Promise<any> => {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        return await response.json();
      } catch {
        return { detail: "Failed to parse server response." };
      }
    }
    const text = await response.text();
    return {
      detail: response.status === 404
        ? "Service endpoint not reachable (404)."
        : text || "Server communication error.",
    };
  };

  const authFetch = async (endpoint: string, options: RequestInit): Promise<Response> => {
    const envUrl = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
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

      const data = await safeParseResponse(response);

      // Check if user is not registered -> Offer to sign up
      if (response.status === 404 || data?.detail?.includes("ACCOUNT_NOT_FOUND")) {
        setErrorMsg("No account found with this email. Switching to Sign Up...");
        setTimeout(() => {
          setActiveTab("register");
        }, 1500);
        return;
      }

      // Check if email verification is required
      if (response.status === 403 && (data?.detail?.includes("EMAIL_NOT_VERIFIED") || data?.detail?.includes("verify your email"))) {
        setActiveTab("email_otp");
        setResendCooldown(data.retry_after ?? 0);
        setSuccessMsg("Enter the verification code sent to your email. Check your spam folder too.");
        return;
      }

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
          phone: phone.trim() || undefined,
          accept_terms: true,
        }),
      });

      const data = await safeParseResponse(response);

      if (response.ok && data.success) {
        if (data.requires_verification) {
          setActiveTab("email_otp");
          setResendCooldown(data.retry_after ?? 0);
          if (data.otp_sent) setSuccessMsg(data.message);
          else setErrorMsg(data.message);
          return;
        }

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

  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    if (!emailOtp.trim() || emailOtp.trim().length !== 6) {
      setErrorMsg("Please enter the 6-digit verification code.");
      return;
    }
    setIsVerifyingOtp(true);
    try {
      const data = await verifyEmailOtp(email.trim(), emailOtp.trim());
      if (data.success && data.access_token) {
        login(data.access_token, data.data);
        if (pendingCartProduct) {
          dispatch(addToCart(pendingCartProduct));
          dispatch(openCart());
          clearPendingCartProduct();
          setSuccessMsg(`Email verified! ${pendingCartProduct.product_title || pendingCartProduct.name || "Item"} added to your cart.`);
        } else {
          setSuccessMsg("Email verified! Logged in successfully.");
        }
        setTimeout(() => {
          handleClose();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid or expired verification code.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResendEmailOtp = async () => {
    if (resendCooldown > 0 || isResendingOtp) return;
    setIsResendingOtp(true);
    setErrorMsg("");
    try {
      const res = await resendEmailOtp(email.trim());
      setSuccessMsg(res.message || "A new 6-digit verification code has been sent to your email.");
      setResendCooldown(45);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to resend code.");
    } finally {
      setIsResendingOtp(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    if (!resetEmail.trim()) {
      setErrorMsg("Please enter your registered email address.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await requestPasswordReset(resetEmail.trim());
      setResetSent(true);
      setForgotStep("otp_password");
      setSuccessMsg(res.message || "A 6-digit reset code has been sent to your email.");
    } catch (err: any) {
      const msg = err.message || "Failed to send reset code. Please try again.";
      if (msg.includes("ACCOUNT_NOT_FOUND") || msg.toLowerCase().includes("no account")) {
        setErrorMsg("No account found with this email. Please check your email or sign up.");
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordWithOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!resetOtp.trim() || resetOtp.trim().length !== 6) {
      setErrorMsg("Please enter the 6-digit verification code.");
      return;
    }

    if (!newPassword.trim() || newPassword.length < 8) {
      setErrorMsg("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setIsResettingPassword(true);
    try {
      const res = await resetPasswordWithOtp(resetEmail.trim(), resetOtp.trim(), newPassword);
      setSuccessMsg(res.message || "Password reset successfully! Please sign in with your new password.");
      setTimeout(() => {
        setEmail(resetEmail.trim());
        setPassword("");
        setResetOtp("");
        setNewPassword("");
        setConfirmPassword("");
        setForgotStep("email");
        setActiveTab("login");
      }, 1400);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reset password. Please check your code.");
    } finally {
      setIsResettingPassword(false);
    }
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
              : activeTab === "email_otp"
              ? "Verify Your Email"
              : "Reset Password"}
          </h2>
          {activeTab === "email_otp" && (
            <p className={styles.subtitle}>
              Enter the 6-digit verification code sent to your email
            </p>
          )}
          {activeTab === "forgot" && (
            <p className={styles.subtitle}>
              We will send a password reset link to your registered email address
            </p>
          )}
          {loginModalMessage && activeTab === "login" && (
            <p className={styles.subtitle}>{loginModalMessage}</p>
          )}
        </div>

        {activeTab === "email_otp" && (
          <form className={styles.form} onSubmit={handleVerifyEmailOtp}>
            {errorMsg && <div className={styles.errorBanner}>{errorMsg}</div>}
            {successMsg && <div className={styles.successBanner}>{successMsg}</div>}

            <div className={styles.otpInfoBox}>
              <p className={styles.otpInfoText}>
                We sent a 6-digit code from <strong>support@deluzexlighting.com</strong> to:
                <br />
                <strong style={{ color: "#D4AF37", fontSize: "14px" }}>{email}</strong>
              </p>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Enter 6-Digit Code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="••••••"
                value={emailOtp}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setEmailOtp(val);
                  if (errorMsg) setErrorMsg("");
                }}
                className={styles.otpInput}
                autoFocus
                required
              />
            </div>

            <div className={styles.resendRow}>
              <span>Didn&apos;t receive code?</span>
              <button
                type="button"
                onClick={handleResendEmailOtp}
                disabled={resendCooldown > 0 || isResendingOtp}
                className={styles.switchLink}
                style={{ cursor: resendCooldown > 0 ? "not-allowed" : "pointer", opacity: resendCooldown > 0 ? 0.6 : 1 }}
              >
                {isResendingOtp ? "Sending..." : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
              </button>
            </div>

            <div className={styles.btnRow}>
              <button type="submit" disabled={isVerifyingOtp || emailOtp.length !== 6} className={styles.submitButton}>
                {isVerifyingOtp ? "Verifying..." : "Verify & Complete Sign In"}
              </button>
            </div>

            <div className={styles.footerSwitch}>
              <span>Need to change email or sign in? </span>
              <button
                type="button"
                className={styles.switchLink}
                onClick={() => {
                  setActiveTab("login");
                  setErrorMsg("");
                  setSuccessMsg("");
                }}
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}

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

            <WhatsAppAuthSection
              onSuccess={(token, userData) => {
                login(token, userData);
                if (pendingCartProduct) {
                  dispatch(addToCart(pendingCartProduct));
                  dispatch(openCart());
                  clearPendingCartProduct();
                  setSuccessMsg(`Welcome! ${pendingCartProduct.product_title || pendingCartProduct.name || "Item"} added to your cart.`);
                } else {
                  setSuccessMsg("Logged in successfully via WhatsApp!");
                }
                setTimeout(() => {
                  handleClose();
                }, 1200);
              }}
              onError={(msg) => setErrorMsg(msg)}
            />

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
          forgotStep === "email" ? (
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
                  onChange={(e) => {
                    setResetEmail(e.target.value);
                    if (errorMsg) setErrorMsg("");
                  }}
                  className={styles.input}
                  autoFocus
                />
              </div>

              <div className={styles.btnRow}>
                <button type="submit" disabled={isLoading} className={styles.submitButton}>
                  {isLoading ? "Sending Code..." : "Send Verification Code"}
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
          ) : (
            <form className={styles.form} onSubmit={handleResetPasswordWithOtp}>
              {errorMsg && <div className={styles.errorBanner}>{errorMsg}</div>}
              {successMsg && <div className={styles.successBanner}>{successMsg}</div>}

              <div className={styles.otpNotice}>
                We sent a 6-digit verification code from <strong>support@deluzexlighting.com</strong> to:
                <br />
                <span style={{ color: "#D4AF37", fontWeight: 600 }}>{resetEmail}</span>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Enter 6-Digit Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="••••••"
                  value={resetOtp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setResetOtp(val);
                    if (errorMsg) setErrorMsg("");
                  }}
                  className={styles.input}
                  autoFocus
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>New Password</label>
                <div className={styles.passwordWrapper}>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (errorMsg) setErrorMsg("");
                    }}
                    className={styles.input}
                  />
                  <button
                    type="button"
                    className={styles.eyeToggle}
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? (
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

              <div className={styles.inputGroup}>
                <label className={styles.label}>Confirm New Password</label>
                <input
                  type={showNewPassword ? "text" : "password"}
                  required
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errorMsg) setErrorMsg("");
                  }}
                  className={styles.input}
                />
              </div>

              <div className={styles.resendWrapper}>
                <span>Didn&apos;t receive code? </span>
                <button
                  type="button"
                  onClick={handleResetSubmit}
                  disabled={isLoading}
                  className={styles.switchLink}
                >
                  {isLoading ? "Sending..." : "Resend Code"}
                </button>
              </div>

              <div className={styles.btnRow}>
                <button
                  type="submit"
                  disabled={isResettingPassword || resetOtp.length !== 6}
                  className={styles.submitButton}
                >
                  {isResettingPassword ? "Updating Password..." : "Reset Password & Sign In"}
                </button>
              </div>

              <div className={styles.footerSwitch}>
                <button
                  type="button"
                  className={styles.switchLink}
                  onClick={() => {
                    setForgotStep("email");
                    setErrorMsg("");
                    setSuccessMsg("");
                  }}
                >
                  ← Back to Email
                </button>
              </div>
            </form>
          )
        )}
      </div>
    </div>
  );
}
