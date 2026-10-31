"use client";

import React, { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { verifyEmailOtp, resendEmailOtp } from "../services/api";
import styles from "./EmailVerificationPrompt.module.css";

export default function EmailVerificationPrompt() {
  const pathname = usePathname();
  const { isAuthenticated, user, updateUser } = useAuth();

  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Read dismissed banner preference from sessionStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const dismissed = window.sessionStorage.getItem("deluzex_verify_banner_dismissed");
      if (dismissed === "1") {
        setIsBannerDismissed(true);
      }
    }
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Listen for custom trigger from Profile page or elsewhere
  useEffect(() => {
    const handleOpenModal = () => {
      setIsModalOpen(true);
      setOtp("");
      setOtpError("");
      setStatusMessage("");
      setIsSuccess(false);
    };

    window.addEventListener("deluzex:open-email-verify", handleOpenModal);
    return () => {
      window.removeEventListener("deluzex:open-email-verify", handleOpenModal);
    };
  }, []);

  const handleDismissBanner = () => {
    setIsBannerDismissed(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("deluzex_verify_banner_dismissed", "1");
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setOtp("");
    setOtpError("");
    setStatusMessage("");
    setIsSuccess(false);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setOtp("");
    setOtpError("");
    setStatusMessage("");
  };

  const handleResendCode = useCallback(async () => {
    const userEmail = (user as any)?.email;
    if (!userEmail || resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setOtpError("");
    setStatusMessage("");

    try {
      const res = await resendEmailOtp(userEmail);
      setStatusMessage(res.message || "A fresh 6-digit code has been sent to your email.");
      setResendCooldown(45);
    } catch (err: any) {
      setOtpError(err?.message || "Failed to resend code. Please try again in a few moments.");
    } finally {
      setIsResending(false);
    }
  }, [user, resendCooldown, isResending]);

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError("");
    setStatusMessage("");

    const cleanOtp = otp.replace(/\D/g, "");
    if (cleanOtp.length !== 6) {
      setOtpError("Please enter the complete 6-digit verification code.");
      return;
    }

    const userEmail = (user as any)?.email;
    if (!userEmail) {
      setOtpError("No user email address found.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await verifyEmailOtp(userEmail, cleanOtp);
      if (res.success) {
        setIsSuccess(true);
        setStatusMessage("Email verified successfully! Your account is now fully active.");
        updateUser({ is_verified: true });

        // Update token if returned
        if (res.access_token) {
          localStorage.setItem("authToken", res.access_token);
        }

        setTimeout(() => {
          setIsModalOpen(false);
        }, 1400);
      } else {
        setOtpError(res.message || "Invalid verification code.");
      }
    } catch (err: any) {
      setOtpError(err?.message || "Invalid or expired verification code. Please request a new one.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Conditions to hide prompt
  if (
    !isAuthenticated ||
    !user ||
    (user as any).is_verified === true ||
    (user as any).is_admin === true ||
    pathname === "/login" ||
    pathname?.startsWith("/admin")
  ) {
    return null;
  }

  const userEmail = (user as any)?.email || "your email";

  return (
    <>
      {/* Top Reminder Banner */}
      {!isBannerDismissed && (
        <aside className={styles.banner} aria-label="Email verification notice">
          <div className={styles.bannerInner}>
            <div className={styles.bannerContent}>
              <svg
                className={styles.shieldIcon}
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
              <span>
                Your email <strong className={styles.emailHighlight}>{userEmail}</strong> is not verified.
                Please verify to secure your orders and access bespoke privileges.
              </span>
            </div>

            <div className={styles.bannerActions}>
              <button
                type="button"
                className={styles.verifyNowBtn}
                onClick={handleOpenModal}
              >
                <span>Verify Email Now</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              <button
                type="button"
                className={styles.dismissBtn}
                onClick={handleDismissBanner}
                aria-label="Dismiss banner for this session"
                title="Dismiss"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Verification Modal Popup */}
      {isModalOpen && (
        <div className={styles.overlay} onClick={handleCloseModal}>
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="verify-email-title"
          >
            <button
              type="button"
              className={styles.closeModalBtn}
              onClick={handleCloseModal}
              aria-label="Close modal"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className={styles.modalHeader}>
              <div className={styles.iconCircle}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
              </div>
              <h2 id="verify-email-title" className={styles.modalTitle}>
                Verify Your Email
              </h2>
              <p className={styles.modalSubtitle}>
                Enter the 6-digit code sent from <strong>support@deluzexlighting.com</strong> to:
              </p>
              <div className={styles.targetEmailPill}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <span>{userEmail}</span>
              </div>
            </div>

            {isSuccess ? (
              <div className={styles.successNotice}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{statusMessage}</span>
              </div>
            ) : (
              <form onSubmit={handleVerifySubmit} className={styles.form} noValidate>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="email-otp-input">
                    <span>6-Digit Verification Code</span>
                  </label>
                  <input
                    id="email-otp-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="••••••"
                    value={otp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setOtp(val);
                      if (otpError) setOtpError("");
                    }}
                    className={`${styles.otpInput} ${otpError ? styles.otpInputError : ""}`}
                    autoFocus
                  />
                  {otpError && <span className={styles.errorText}>{otpError}</span>}
                  {statusMessage && !otpError && (
                    <span style={{ color: "#166534", fontSize: "12.5px", marginTop: "4px" }}>
                      {statusMessage}
                    </span>
                  )}
                </div>

                <div className={styles.resendRow}>
                  <span>Didn&apos;t get the email?</span>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendCooldown > 0 || isResending}
                    className={styles.resendBtn}
                  >
                    {isResending
                      ? "Sending..."
                      : resendCooldown > 0
                      ? `Resend Code (${resendCooldown}s)`
                      : "Send / Resend Code"}
                  </button>
                </div>

                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={isSubmitting || otp.length !== 6}
                >
                  {isSubmitting ? "Verifying..." : "Verify & Activate Account"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

