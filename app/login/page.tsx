"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./login.module.css";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import {
  checkCustomerPhone,
  sendWhatsAppOtp,
  verifyWhatsAppOtp,
  requestPasswordReset,
  resetPasswordWithOtp,
} from "../services/api";

export default function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const globalToast = useToast();
  const { login, isAuthenticated } = useAuth();

  // Primary steps: "phone" -> "otp", with secondary "password" and "forgot"
  const [step, setStep] = useState<"phone" | "otp" | "password" | "forgot">("phone");

  // WhatsApp Frictionless Auth States
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [isExistingCustomer, setIsExistingCustomer] = useState<boolean | null>(null);
  const [detectedFirstName, setDetectedFirstName] = useState("");
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);

  // OTP Verification States
  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  // Secondary Password Auth States
  const [passwordEmail, setPasswordEmail] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  // Forgot Password States
  const [resetEmail, setResetEmail] = useState("");
  const [forgotStep, setForgotStep] = useState<"email" | "otp_password">("email");
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const [inlineError, setInlineError] = useState("");
  const checkPhoneTimerRef = useRef<NodeJS.Timeout | null>(null);

  // If already authenticated, redirect
  useEffect(() => {
    if (isAuthenticated) {
      const redirectUrl = searchParams.get("redirect") || "/";
      router.replace(redirectUrl);
    }
  }, [isAuthenticated, router, searchParams]);

  // Countdown timer for OTP resend cooldown
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  // Smart User Detection: Debounced phone lookup on 10 digits
  useEffect(() => {
    const cleanDigits = phone.replace(/\D/g, "");

    if (checkPhoneTimerRef.current) {
      clearTimeout(checkPhoneTimerRef.current);
    }

    if (cleanDigits.length === 10) {
      setIsCheckingPhone(true);
      checkPhoneTimerRef.current = setTimeout(async () => {
        try {
          const res = await checkCustomerPhone(cleanDigits);
          if (res.exists) {
            setIsExistingCustomer(true);
            setDetectedFirstName(res.first_name || "Customer");
          } else {
            setIsExistingCustomer(false);
            setDetectedFirstName("");
          }
        } catch {
          setIsExistingCustomer(null);
        } finally {
          setIsCheckingPhone(false);
        }
      }, 350);
    } else {
      setIsExistingCustomer(null);
      setDetectedFirstName("");
      setIsCheckingPhone(false);
    }

    return () => {
      if (checkPhoneTimerRef.current) {
        clearTimeout(checkPhoneTimerRef.current);
      }
    };
  }, [phone]);

  const handleAuthSuccess = (accessToken: string, userData: any) => {
    login(accessToken, userData);
    const greetingName = userData?.first_name || detectedFirstName || "Customer";
    globalToast.success(`Welcome back, ${greetingName}! Logged in successfully.`);

    const redirectUrl = searchParams.get("redirect") || "/";
    router.replace(redirectUrl);
  };

  // Step 1: Send WhatsApp OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError("");

    const cleanDigits = phone.replace(/\D/g, "");
    if (cleanDigits.length !== 10) {
      const err = "Please enter a valid 10-digit mobile number.";
      setInlineError(err);
      globalToast.error(err);
      return;
    }

    if (isExistingCustomer === false && !fullName.trim()) {
      const err = "Please enter your full name.";
      setInlineError(err);
      globalToast.error(err);
      return;
    }

    setIsSendingOtp(true);
    try {
      const fullPhone = `+91${cleanDigits}`;
      const res = await sendWhatsAppOtp(fullPhone);

      if (res.is_existing_user) {
        setIsExistingCustomer(true);
        if (res.first_name) setDetectedFirstName(res.first_name);
      } else if (res.is_existing_user === false) {
        setIsExistingCustomer(false);
      }

      setStep("otp");
      setCooldown(res.retry_after || 60);
      globalToast.success(`Verification code dispatched to WhatsApp: +91 ${cleanDigits}`);
    } catch (err: any) {
      const msg = err.message || "Failed to dispatch WhatsApp code. Please try again.";
      setInlineError(msg);
      globalToast.error(msg);
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Step 2: Verify WhatsApp OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError("");

    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      const err = "Please enter the complete 6-digit code received on WhatsApp.";
      setInlineError(err);
      globalToast.error(err);
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const cleanDigits = phone.replace(/\D/g, "");
      const fullPhone = `+91${cleanDigits}`;
      const res = await verifyWhatsAppOtp(fullPhone, cleanOtp, fullName.trim() || undefined);

      if (res.success && res.access_token) {
        handleAuthSuccess(res.access_token, res.data);
      } else {
        throw new Error(res.message || "Authentication failed.");
      }
    } catch (err: any) {
      const msg = err.message || "Invalid or expired verification code.";
      setInlineError(msg);
      globalToast.error(msg);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Fallback Resend
  const handleResendOtp = async () => {
    if (cooldown > 0 || isSendingOtp) return;
    setInlineError("");
    setIsSendingOtp(true);
    try {
      const cleanDigits = phone.replace(/\D/g, "");
      const fullPhone = `+91${cleanDigits}`;
      const res = await sendWhatsAppOtp(fullPhone);
      setCooldown(res.retry_after || 60);
      globalToast.success(res.message || "New verification code dispatched to your WhatsApp!");
    } catch (err: any) {
      const msg = err.message || "Failed to resend verification code.";
      setInlineError(msg);
      globalToast.error(msg);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleSmsFallback = async () => {
    if (cooldown > 0) {
      globalToast.info(`Please wait ${cooldown} seconds before requesting a new code.`);
      return;
    }
    await handleResendOtp();
    globalToast.info("Verification code re-dispatched. Check both WhatsApp and SMS messages.");
  };

  // Secondary: Staff / Password Sign In
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError("");

    if (!passwordEmail.trim() || !passwordValue.trim()) {
      setInlineError("Please enter both email and password.");
      return;
    }

    setIsPasswordLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: passwordEmail.trim(), password: passwordValue }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.detail || data.message || "Incorrect email or password.");
      }

      handleAuthSuccess(data.access_token, data.data);
    } catch (err: any) {
      setInlineError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setIsPasswordLoading(false);
    }
  };

  // Secondary: Request Password Reset
  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError("");
    if (!resetEmail.trim()) {
      setInlineError("Please enter your registered email address.");
      return;
    }
    setIsResetting(true);
    try {
      const res = await requestPasswordReset(resetEmail.trim());
      setForgotStep("otp_password");
      globalToast.success(res.message || "A 6-digit reset code has been sent to your email.");
    } catch (err: any) {
      setInlineError(err.message || "Failed to send reset code. Please try again.");
    } finally {
      setIsResetting(false);
    }
  };

  // Secondary: Confirm Password Reset with OTP
  const handleResetPasswordWithOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError("");
    if (!resetOtp.trim() || resetOtp.trim().length !== 6) {
      setInlineError("Please enter the 6-digit verification code.");
      return;
    }
    if (!newPassword.trim() || newPassword.length < 6) {
      setInlineError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setInlineError("Passwords do not match.");
      return;
    }

    setIsResetting(true);
    try {
      const res = await resetPasswordWithOtp(resetEmail.trim(), resetOtp.trim(), newPassword);
      globalToast.success(res.message || "Password reset successfully! Please sign in.");
      setPasswordEmail(resetEmail.trim());
      setPasswordValue("");
      setForgotStep("email");
      setStep("password");
    } catch (err: any) {
      setInlineError(err.message || "Failed to reset password. Please check your code.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.loginContainer}>
        <div className={styles.loginHeader}>
          <div className={styles.logoWrapper}>
            <Link href="/">
              <img
                src="/images/logos/de_luzex_black.svg"
                alt="de luzex"
                width={115}
                height={28}
                className={styles.logoImg}
              />
            </Link>
          </div>

          <h1 className={styles.title}>
            {step === "phone"
              ? "Welcome to de luzex"
              : step === "otp"
              ? "Enter WhatsApp Code"
              : step === "password"
              ? "Password Sign In"
              : "Reset Password"}
          </h1>

          {step === "phone" && (
            <p className={styles.subtitle}>
              Instant verification with your WhatsApp mobile number.
            </p>
          )}

          {isExistingCustomer && step === "phone" && (
            <div className={styles.welcomeChip}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Welcome back, {detectedFirstName || "Customer"}!
            </div>
          )}
        </div>

        {inlineError && <div className={styles.errorBanner}>{inlineError}</div>}

        {/* STEP 1: Phone + Smart Name Form */}
        {step === "phone" && (
          <form className={styles.form} onSubmit={handleRequestOtp}>
            <div className={styles.formGroup}>
              <label>Mobile Number *</label>
              <div className={styles.phoneInputWrapper}>
                <span className={styles.countryBadge}>+91</span>
                <input
                  type="tel"
                  required
                  autoFocus
                  maxLength={10}
                  placeholder="Enter 10-digit mobile number"
                  value={phone}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setPhone(clean);
                    if (inlineError) setInlineError("");
                  }}
                  className={styles.phoneInput}
                  disabled={isSendingOtp}
                />
              </div>
            </div>

            {/* Smart Detection: Reveal Name input only if customer is new */}
            {isExistingCustomer === false && (
              <div className={styles.formGroup} style={{ animation: "fadeIn 0.25s ease" }}>
                <label>Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (inlineError) setInlineError("");
                  }}
                  className={styles.input}
                  disabled={isSendingOtp}
                />
              </div>
            )}

            <button type="submit" disabled={isSendingOtp || phone.length < 10} className={styles.btnPrimary}>
              {isSendingOtp ? "Sending WhatsApp Code..." : "Get WhatsApp OTP"}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <p className={styles.whatsappHint}>
              We will send a 6-digit one-time code to your WhatsApp.
            </p>

            <div className={styles.footerSection}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => {
                  setInlineError("");
                  setStep("password");
                }}
              >
                Sign in with password instead
              </button>
              <Link href="/admin/login" className={styles.adminLink}>
                Store Manager? Admin Portal →
              </Link>
            </div>
          </form>
        )}

        {/* STEP 2: 6-Digit WhatsApp OTP Verification Form */}
        {step === "otp" && (
          <form className={styles.form} onSubmit={handleVerifyOtp}>
            <div className={styles.otpCard}>
              <p className={styles.otpCardText}>
                We sent a 6-digit code to WhatsApp:
                <br />
                <span className={styles.phoneHighlight}>+91 {phone}</span>
              </p>
              <button
                type="button"
                className={styles.changeNumberBtn}
                onClick={() => {
                  setInlineError("");
                  setStep("phone");
                }}
              >
                Change Number
              </button>
            </div>

            <div className={styles.formGroup}>
              <label>Enter 6-Digit OTP</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="••••••"
                value={otp}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setOtp(val);
                  if (inlineError) setInlineError("");
                }}
                className={styles.otpInput}
                autoFocus
                required
                disabled={isVerifyingOtp}
              />
            </div>

            <div className={styles.resendRow}>
              <span>Didn&apos;t receive code?</span>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={cooldown > 0 || isSendingOtp}
                className={styles.resendBtn}
              >
                {cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Resend OTP"}
              </button>
            </div>

            <div className={styles.fallbackRow}>
              <span>Having WhatsApp issues?</span>
              <button
                type="button"
                onClick={handleSmsFallback}
                className={styles.fallbackLink}
                disabled={cooldown > 0}
              >
                Get OTP via SMS
              </button>
            </div>

            <button type="submit" disabled={isVerifyingOtp || otp.length < 6} className={styles.btnPrimary}>
              {isVerifyingOtp ? "Verifying..." : "Verify & Continue"}
            </button>
          </form>
        )}

        {/* SECONDARY: Password Sign In */}
        {step === "password" && (
          <form className={styles.form} onSubmit={handlePasswordLogin}>
            <div className={styles.formGroup}>
              <label>Email Address *</label>
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={passwordEmail}
                onChange={(e) => setPasswordEmail(e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Password *</label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={passwordValue}
                  onChange={(e) => setPasswordValue(e.target.value)}
                  className={styles.input}
                />
                <button
                  type="button"
                  className={styles.eyeToggle}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" strokeLinecap="round" strokeLinejoin="round"/>
                      <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              <div className={styles.forgotWrapper}>
                <button
                  type="button"
                  className={styles.forgotLink}
                  onClick={() => {
                    setInlineError("");
                    setResetEmail(passwordEmail);
                    setStep("forgot");
                  }}
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            <button type="submit" disabled={isPasswordLoading} className={styles.btnPrimary}>
              {isPasswordLoading ? "Signing In..." : "Sign In with Password"}
            </button>

            <div className={styles.footerSection}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => {
                  setInlineError("");
                  setStep("phone");
                }}
              >
                ← Back to WhatsApp Sign In
              </button>
              <Link href="/admin/login" className={styles.adminLink}>
                Store Manager? Admin Portal →
              </Link>
            </div>
          </form>
        )}

        {/* SECONDARY: Forgot Password */}
        {step === "forgot" && (
          <div className={styles.form}>
            {forgotStep === "email" ? (
              <form onSubmit={handleRequestPasswordReset} className={styles.form}>
                <p className={styles.subtitle} style={{ textAlign: "center" }}>
                  We will send a 6-digit password reset code to your registered email address.
                </p>
                <div className={styles.formGroup}>
                  <label>Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className={styles.input}
                  />
                </div>
                <button type="submit" disabled={isResetting} className={styles.btnPrimary}>
                  {isResetting ? "Sending Code..." : "Send Reset Code"}
                </button>
                <div className={styles.footerSection}>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => {
                      setInlineError("");
                      setStep("password");
                    }}
                  >
                    ← Back to Sign In
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPasswordWithOtp} className={styles.form}>
                <div className={styles.otpCard}>
                  <p className={styles.otpCardText}>
                    Reset code dispatched to: <strong>{resetEmail}</strong>
                  </p>
                </div>
                <div className={styles.formGroup}>
                  <label>6-Digit Reset Code *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="••••••"
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className={styles.otpInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>New Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Confirm New Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={styles.input}
                  />
                </div>
                <button type="submit" disabled={isResetting} className={styles.btnPrimary}>
                  {isResetting ? "Resetting Password..." : "Update Password & Sign In"}
                </button>
                <div className={styles.footerSection}>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => {
                      setInlineError("");
                      setForgotStep("email");
                      setStep("password");
                    }}
                  >
                    ← Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
