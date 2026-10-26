"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";
import { useAuth } from "../context/AuthContext";
import { useDispatch } from "react-redux";
import { addToCart, openCart } from "../store/cartSlice";
import {
  verifyEmailOtp,
  resendEmailOtp,
  requestPasswordReset,
  resetPasswordWithOtp,
  sendSignupWhatsAppOtp,
  verifySignupWhatsApp,
} from "../services/api";

type ToastProps = {
  type: "success" | "error";
  message: string;
};

export default function Login() {
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot" | "email_otp" | "signup_whatsapp_otp">("login");
  const { login } = useAuth();
  const dispatch = useDispatch();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Common fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Signup fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [fullNameError, setFullNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  // WhatsApp OTP for signup
  const [whatsappOtp, setWhatsappOtp] = useState("");
  const [whatsappOtpError, setWhatsappOtpError] = useState("");
  const [whatsappCooldown, setWhatsappCooldown] = useState(0);
  const [isVerifyingWhatsApp, setIsVerifyingWhatsApp] = useState(false);
  const [isResendingWhatsApp, setIsResendingWhatsApp] = useState(false);

  // Forgot password state
  const [resetEmail, setResetEmail] = useState("");
  const [forgotStep, setForgotStep] = useState<"email" | "otp_password">("email");
  const [resetOtp, setResetOtp] = useState("");
  const [resetOtpError, setResetOtpError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordError, setNewPasswordError] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Email OTP state (legacy support)
  const [emailOtp, setEmailOtp] = useState("");
  const [emailOtpError, setEmailOtpError] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);

  // Errors
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [resetEmailError, setResetEmailError] = useState("");
  const [toast, setToast] = useState<ToastProps | null>(null);

  // Countdown timer for email OTP
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Countdown timer for WhatsApp signup OTP
  useEffect(() => {
    if (whatsappCooldown > 0) {
      const timer = setTimeout(() => setWhatsappCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [whatsappCooldown]);

  // Toast timer
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const validatePassword = (val: string) => {
    if (val.length < 6) return "Password must be at least 6 characters long.";
    return null;
  };

  const handleBlurEmail = () => {
    if (!email.trim()) {
      setEmailError("Email is required.");
    } else if (authMode === "register" && !validateEmail(email)) {
      setEmailError("Please enter a valid email address.");
    }
  };

  const handleBlurPassword = () => {
    if (!password.trim()) {
      setPasswordError("Password is required.");
    } else if (authMode === "register") {
      const pswError = validatePassword(password);
      if (pswError) setPasswordError(pswError);
    }
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
      detail: response.status === 404 ? "Service endpoint not reachable (404)." : text || "Server communication error.",
    };
  };

  const authFetch = async (endpoint: string, options: RequestInit): Promise<Response> => {
    const envUrl = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
    try {
      return await fetch(`${envUrl}${endpoint}`, options);
    } catch (primaryErr) {
      if (envUrl.startsWith("http")) {
        try {
          return await fetch(`/api/v1${endpoint}`, options);
        } catch {
          // ignore
        }
      }
      throw primaryErr;
    }
  };

  // -------------------------------------------------------------
  // Regular Sign In (Login with Email or Mobile Number + Password)
  // -------------------------------------------------------------
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    setPasswordError("");

    let isValid = true;
    if (!email.trim()) {
      setEmailError("Email or Mobile number is required.");
      isValid = false;
    }

    if (!password.trim()) {
      setPasswordError("Password is required.");
      isValid = false;
    }

    if (!isValid) return;

    setIsLoading(true);
    try {
      const response = await authFetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await safeParseResponse(response);

      if (response.status === 404 || data?.detail?.includes("ACCOUNT_NOT_FOUND")) {
        setToast({
          type: "error",
          message: "No account found. Switching to Sign Up...",
        });
        setTimeout(() => {
          setAuthMode("register");
        }, 1500);
        return;
      }

      // Check if email verification is needed
      if (response.status === 403 && (data?.detail?.includes("EMAIL_NOT_VERIFIED") || data?.detail?.includes("verify your email"))) {
        setPendingEmail(email.trim());
        setAuthMode("email_otp");
        setResendCooldown(data.retry_after ?? 0);
        setToast({ type: "success", message: "Enter verification code sent to your email." });
        return;
      }

      if (response.ok && data.success) {
        setToast({ type: "success", message: "Successfully logged in!" });
        localStorage.setItem("authToken", data.access_token);
        login(data.access_token, data.data);

        // Auto-add pending cart product if present
        try {
          const pending = window.sessionStorage.getItem("pending_cart_product");
          if (pending) {
            const product = JSON.parse(pending);
            dispatch(addToCart(product));
            dispatch(openCart());
            window.sessionStorage.removeItem("pending_cart_product");
          }
        } catch {
          // ignore
        }

        setTimeout(() => {
          const redirectParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("redirect") : null;
          if (redirectParam && (data?.data?.is_admin || !redirectParam.startsWith("/admin"))) {
            router.push(redirectParam);
          } else if (data?.data?.is_admin) {
            router.push("/admin");
          } else {
            router.push("/");
          }
        }, 1200);
      } else {
        setToast({ type: "error", message: parseErrorDetail(data, "Invalid credentials. Please try again.") });
      }
    } catch (err: any) {
      setToast({ type: "error", message: err?.message || "Unable to reach server. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Sign Up Step 1: Submit Details & Request WhatsApp OTP
  // -------------------------------------------------------------
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFullNameError("");
    setEmailError("");
    setPhoneError("");
    setPasswordError("");

    let isValid = true;

    if (!fullName.trim()) {
      setFullNameError("Full name is required.");
      isValid = false;
    }

    if (!email.trim()) {
      setEmailError("Email address is required.");
      isValid = false;
    } else if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address.");
      isValid = false;
    }

    const cleanDigits = phone.replace(/\D/g, "");
    if (!cleanDigits || cleanDigits.length < 10) {
      setPhoneError("Please enter a valid 10-digit mobile number.");
      isValid = false;
    }

    const pswError = validatePassword(password);
    if (pswError) {
      setPasswordError(pswError);
      isValid = false;
    }

    if (!isValid) return;

    setIsLoading(true);
    try {
      const fullPhone = cleanDigits.length === 10 ? `+91${cleanDigits}` : `+${cleanDigits}`;
      const res = await sendSignupWhatsAppOtp(fullPhone, email.trim());

      setToast({
        type: "success",
        message: res.message || "A 6-digit verification code has been dispatched to your WhatsApp!",
      });
      setWhatsappCooldown(res.retry_after || 60);
      setWhatsappOtp("");
      setWhatsappOtpError("");
      setAuthMode("signup_whatsapp_otp");
    } catch (err: any) {
      const msg = err.message || "Failed to dispatch WhatsApp OTP. Please check your number.";
      setToast({ type: "error", message: msg });
      if (msg.toLowerCase().includes("whatsapp") || msg.toLowerCase().includes("mobile")) {
        setPhoneError(msg);
      } else if (msg.toLowerCase().includes("email")) {
        setEmailError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Sign Up Step 2: Verify WhatsApp OTP & Create Account
  // -------------------------------------------------------------
  const handleVerifySignupWhatsAppOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setWhatsappOtpError("");

    const cleanOtp = whatsappOtp.replace(/\D/g, "");
    if (!cleanOtp || cleanOtp.length !== 6) {
      setWhatsappOtpError("Please enter the complete 6-digit WhatsApp code.");
      return;
    }

    setIsVerifyingWhatsApp(true);
    try {
      const cleanDigits = phone.replace(/\D/g, "");
      const fullPhone = cleanDigits.length === 10 ? `+91${cleanDigits}` : `+${cleanDigits}`;
      const nameParts = fullName.trim().split(" ");
      const firstName = nameParts[0] || "User";
      const lastName = nameParts.slice(1).join(" ") || "Customer";

      const res = await verifySignupWhatsApp({
        phone: fullPhone,
        otp: cleanOtp,
        first_name: firstName,
        last_name: lastName,
        email: email.trim(),
        password,
      });

      if (res.success && res.access_token) {
        setToast({
          type: "success",
          message: "Account verified & created successfully! Logging you in...",
        });
        localStorage.setItem("authToken", res.access_token);
        login(res.access_token, res.data);

        // Auto-add pending cart product if present
        try {
          const pending = window.sessionStorage.getItem("pending_cart_product");
          if (pending) {
            const product = JSON.parse(pending);
            dispatch(addToCart(product));
            dispatch(openCart());
            window.sessionStorage.removeItem("pending_cart_product");
          }
        } catch {
          // ignore
        }

        setTimeout(() => {
          const redirectParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("redirect") : null;
          if (redirectParam) {
            router.push(redirectParam);
          } else {
            router.push("/");
          }
        }, 1200);
      } else {
        throw new Error(res.message || "Verification failed. Please check the code.");
      }
    } catch (err: any) {
      const msg = err.message || "Invalid or expired verification code.";
      setWhatsappOtpError(msg);
      setToast({ type: "error", message: msg });
    } finally {
      setIsVerifyingWhatsApp(false);
    }
  };

  const handleResendSignupWhatsAppOtp = async () => {
    if (whatsappCooldown > 0 || isResendingWhatsApp) return;
    setIsResendingWhatsApp(true);
    try {
      const cleanDigits = phone.replace(/\D/g, "");
      const fullPhone = cleanDigits.length === 10 ? `+91${cleanDigits}` : `+${cleanDigits}`;
      const res = await sendSignupWhatsAppOtp(fullPhone, email.trim());
      setToast({
        type: "success",
        message: res.message || "New 6-digit code sent to your WhatsApp!",
      });
      setWhatsappCooldown(res.retry_after || 60);
    } catch (err: any) {
      setToast({ type: "error", message: err.message || "Failed to resend code." });
    } finally {
      setIsResendingWhatsApp(false);
    }
  };

  // -------------------------------------------------------------
  // Forgot Password Flow
  // -------------------------------------------------------------
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetEmailError("");
    if (!resetEmail.trim()) {
      setResetEmailError("Please enter your registered email address.");
      return;
    }
    if (!validateEmail(resetEmail)) {
      setResetEmailError("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await requestPasswordReset(resetEmail.trim());
      setForgotStep("otp_password");
      setToast({
        type: "success",
        message: res.message || "A 6-digit reset code has been sent to your email.",
      });
    } catch (err: any) {
      const msg = err?.message || "Failed to send reset code. Please try again.";
      setResetEmailError(msg);
      setToast({ type: "error", message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordWithOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetOtpError("");
    setNewPasswordError("");
    setConfirmPasswordError("");

    let valid = true;
    if (!resetOtp.trim() || resetOtp.trim().length !== 6) {
      setResetOtpError("Please enter the 6-digit code.");
      valid = false;
    }

    const pswErr = validatePassword(newPassword);
    if (pswErr) {
      setNewPasswordError(pswErr);
      valid = false;
    }

    if (newPassword !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match.");
      valid = false;
    }

    if (!valid) return;

    setIsResettingPassword(true);
    try {
      const res = await resetPasswordWithOtp(resetEmail.trim(), resetOtp.trim(), newPassword);
      setToast({
        type: "success",
        message: res.message || "Password reset successfully! Please sign in with your new password.",
      });
      setTimeout(() => {
        setEmail(resetEmail.trim());
        setPassword("");
        setResetOtp("");
        setNewPassword("");
        setConfirmPassword("");
        setForgotStep("email");
        setAuthMode("login");
      }, 1400);
    } catch (err: any) {
      const msg = err?.message || "Failed to reset password. Please check your code.";
      setResetOtpError(msg);
      setToast({ type: "error", message: msg });
    } finally {
      setIsResettingPassword(false);
    }
  };

  // -------------------------------------------------------------
  // Legacy Email OTP Verification
  // -------------------------------------------------------------
  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailOtpError("");
    if (!emailOtp.trim() || emailOtp.trim().length !== 6) {
      setEmailOtpError("Please enter the 6-digit verification code.");
      return;
    }
    setIsVerifyingOtp(true);
    try {
      const targetEmail = pendingEmail || email.trim();
      const data = await verifyEmailOtp(targetEmail, emailOtp.trim());
      if (data.success && data.access_token) {
        setToast({ type: "success", message: "Email verified successfully! Logging you in..." });
        localStorage.setItem("authToken", data.access_token);
        login(data.access_token, data.data);

        setTimeout(() => {
          router.push("/");
        }, 1200);
      } else {
        setEmailOtpError(data.message || "Invalid verification code.");
      }
    } catch (err: any) {
      setEmailOtpError(err?.message || "Invalid or expired verification code.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResendEmailOtp = async () => {
    if (resendCooldown > 0 || isResendingOtp) return;
    setIsResendingOtp(true);
    try {
      const targetEmail = pendingEmail || email.trim();
      const res = await resendEmailOtp(targetEmail);
      setToast({ type: "success", message: res.message || "A new 6-digit code has been sent to your email." });
      setResendCooldown(45);
    } catch (err: any) {
      setToast({ type: "error", message: err?.message || "Failed to resend code." });
    } finally {
      setIsResendingOtp(false);
    }
  };

  const handleSwitchMode = (targetMode: "login" | "register" | "forgot" | "email_otp") => {
    setAuthMode(targetMode);
    setEmailError("");
    setPasswordError("");
    setFullNameError("");
    setPhoneError("");
    setWhatsappOtpError("");
    setResetEmailError("");
    setResetOtpError("");
    setNewPasswordError("");
    setConfirmPasswordError("");
    setEmailOtpError("");
    setForgotStep("email");
    setToast(null);
  };

  return (
    <main className={styles.main} data-auth-page="true">
      {toast && (
        <div className={`${styles.toast} ${toast.type === "success" ? styles.toastSuccess : styles.toastError}`}>
          {toast.type === "success" ? (
            <svg className={styles.toastIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className={styles.toastIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span>{toast.message}</span>
        </div>
      )}

      <div className={styles.loginContainer}>
        <div className={styles.loginHeader}>
          <div className={styles.logoWrapper}>
            <img
              src="/images/logos/de_luzex_black.svg"
              alt="de luzex"
              width={105}
              height={22}
              className={styles.logoImg}
            />
          </div>
          <h1 className={styles.title}>
            {authMode === "login"
              ? "Welcome Back"
              : authMode === "register"
              ? "Create Deluzex Account"
              : authMode === "signup_whatsapp_otp"
              ? "WhatsApp Verification"
              : authMode === "email_otp"
              ? "Verify Your Email"
              : "Reset Password"}
          </h1>
          <p className={styles.subtitle}>
            {authMode === "login"
              ? "Sign in with your email or mobile number"
              : authMode === "register"
              ? "Verified with WhatsApp for maximum account security"
              : authMode === "signup_whatsapp_otp"
              ? "Enter the 6-digit code received on your WhatsApp"
              : authMode === "email_otp"
              ? "Enter the 6-digit code sent to your inbox"
              : forgotStep === "email"
              ? "Enter your registered email to receive a reset code"
              : "Enter the code and set your new password"}
          </p>
        </div>

        {/* --------------------------------------------------------- */}
        {/* VIEW 1: SIGNUP WHATSAPP OTP VERIFICATION SCREEN          */}
        {/* --------------------------------------------------------- */}
        {authMode === "signup_whatsapp_otp" ? (
          <form className={styles.form} onSubmit={handleVerifySignupWhatsAppOtp} noValidate>
            <div className={styles.otpInfoBox}>
              <p className={styles.otpInfoText}>
                We sent a 6-digit verification code to your WhatsApp:
                <br />
                <strong style={{ color: "#D4AF37", fontSize: "15px", letterSpacing: "0.05em" }}>
                  +91 {phone.replace(/\D/g, "")}
                </strong>
              </p>
            </div>

            <div className={styles.formGroup}>
              <label>Enter 6-Digit WhatsApp Code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="••••••"
                value={whatsappOtp}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setWhatsappOtp(val);
                  if (whatsappOtpError) setWhatsappOtpError("");
                }}
                className={`${styles.otpInput} ${whatsappOtpError ? styles.inputError : ""}`}
                autoFocus
              />
              {whatsappOtpError && <span className={styles.errorText}>{whatsappOtpError}</span>}
            </div>

            <div className={styles.resendRow}>
              <span>Didn&apos;t receive code?</span>
              <button
                type="button"
                onClick={handleResendSignupWhatsAppOtp}
                disabled={whatsappCooldown > 0 || isResendingWhatsApp}
                className={styles.switchBtn}
                style={{ cursor: whatsappCooldown > 0 ? "not-allowed" : "pointer", opacity: whatsappCooldown > 0 ? 0.6 : 1 }}
              >
                {isResendingWhatsApp ? "Sending..." : whatsappCooldown > 0 ? `Resend in ${whatsappCooldown}s` : "Resend WhatsApp Code"}
              </button>
            </div>

            <div className={styles.btnRow}>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={isVerifyingWhatsApp || whatsappOtp.length !== 6}
              >
                {isVerifyingWhatsApp ? "Verifying..." : "Verify & Create Account"}
              </button>
            </div>

            <div className={styles.switchMode}>
              <p>
                Incorrect number or details?{" "}
                <button
                  type="button"
                  onClick={() => setAuthMode("register")}
                  className={styles.switchBtn}
                >
                  Edit Information
                </button>
              </p>
            </div>
          </form>
        ) : authMode === "email_otp" ? (
          /* --------------------------------------------------------- */
          /* VIEW 2: EMAIL OTP VERIFICATION (LEGACY SUPPORT)          */
          /* --------------------------------------------------------- */
          <form className={styles.form} onSubmit={handleVerifyEmailOtp} noValidate>
            <div className={styles.otpInfoBox}>
              <p className={styles.otpInfoText}>
                We sent a 6-digit security code from <strong>support@deluzexlighting.com</strong> to:
                <br />
                <strong style={{ color: "#D4AF37", fontSize: "14px" }}>{pendingEmail || email}</strong>
              </p>
            </div>

            <div className={styles.formGroup}>
              <label>Enter 6-Digit Code</label>
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
                  if (emailOtpError) setEmailOtpError("");
                }}
                className={`${styles.otpInput} ${emailOtpError ? styles.inputError : ""}`}
                autoFocus
              />
              {emailOtpError && <span className={styles.errorText}>{emailOtpError}</span>}
            </div>

            <div className={styles.resendRow}>
              <span>Didn&apos;t receive code?</span>
              <button
                type="button"
                onClick={handleResendEmailOtp}
                disabled={resendCooldown > 0 || isResendingOtp}
                className={styles.switchBtn}
                style={{ cursor: resendCooldown > 0 ? "not-allowed" : "pointer", opacity: resendCooldown > 0 ? 0.6 : 1 }}
              >
                {isResendingOtp ? "Sending..." : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
              </button>
            </div>

            <div className={styles.btnRow}>
              <button type="submit" className={styles.btnPrimary} disabled={isVerifyingOtp || emailOtp.length !== 6}>
                {isVerifyingOtp ? "Verifying..." : "Verify & Complete Sign In"}
              </button>
            </div>

            <div className={styles.switchMode}>
              <p>
                Wrong email or need to sign in?{" "}
                <button type="button" onClick={() => handleSwitchMode("login")} className={styles.switchBtn}>
                  Back to Sign In
                </button>
              </p>
            </div>
          </form>
        ) : authMode === "forgot" ? (
          /* --------------------------------------------------------- */
          /* VIEW 3: FORGOT PASSWORD FLOW                              */
          /* --------------------------------------------------------- */
          forgotStep === "email" ? (
            <form className={styles.form} onSubmit={handleResetSubmit} noValidate>
              <div className={styles.formGroup}>
                <label>Enter Your Registered Email</label>
                <input
                  type="email"
                  placeholder="Enter your registered email"
                  value={resetEmail}
                  onChange={(e) => {
                    setResetEmail(e.target.value);
                    if (resetEmailError) setResetEmailError("");
                  }}
                  className={resetEmailError ? styles.inputError : ""}
                  autoFocus
                />
                {resetEmailError && <span className={styles.errorText}>{resetEmailError}</span>}
              </div>

              <div className={styles.btnRow}>
                <button type="submit" className={styles.btnPrimary} disabled={isLoading}>
                  {isLoading ? "Sending Code..." : "Send Verification Code"}
                </button>
              </div>

              <div className={styles.switchMode}>
                <p>
                  Know your password?{" "}
                  <button type="button" onClick={() => handleSwitchMode("login")} className={styles.switchBtn}>
                    Sign In Here
                  </button>
                </p>
              </div>
            </form>
          ) : (
            <form className={styles.form} onSubmit={handleResetPasswordWithOtp} noValidate>
              <div className={styles.otpInfoBox}>
                <p className={styles.otpInfoText}>
                  We sent a 6-digit verification code from <strong>support@deluzexlighting.com</strong> to:
                  <br />
                  <strong style={{ color: "#D4AF37", fontSize: "14px" }}>{resetEmail}</strong>
                </p>
              </div>

              <div className={styles.formGroup}>
                <label>6-Digit Reset Code</label>
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
                    if (resetOtpError) setResetOtpError("");
                  }}
                  className={`${styles.otpInput} ${resetOtpError ? styles.inputError : ""}`}
                  autoFocus
                />
                {resetOtpError && <span className={styles.errorText}>{resetOtpError}</span>}
              </div>

              <div className={styles.formGroup}>
                <label>New Password</label>
                <div className={styles.passwordWrapper}>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (newPasswordError) setNewPasswordError("");
                    }}
                    className={newPasswordError ? styles.inputError : ""}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className={styles.eyeBtn}
                    aria-label="Toggle password visibility"
                  >
                    {showNewPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {newPasswordError && <span className={styles.errorText}>{newPasswordError}</span>}
              </div>

              <div className={styles.formGroup}>
                <label>Confirm New Password</label>
                <input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (confirmPasswordError) setConfirmPasswordError("");
                  }}
                  className={confirmPasswordError ? styles.inputError : ""}
                />
                {confirmPasswordError && <span className={styles.errorText}>{confirmPasswordError}</span>}
              </div>

              <div className={styles.resendRow}>
                <span>Didn&apos;t receive code?</span>
                <button type="button" onClick={handleResetSubmit} disabled={isLoading} className={styles.switchBtn}>
                  {isLoading ? "Sending..." : "Resend Code"}
                </button>
              </div>

              <div className={styles.btnRow}>
                <button type="submit" className={styles.btnPrimary} disabled={isResettingPassword || resetOtp.length !== 6}>
                  {isResettingPassword ? "Updating Password..." : "Reset Password & Sign In"}
                </button>
              </div>

              <div className={styles.switchMode}>
                <p>
                  Need to change email?{" "}
                  <button type="button" onClick={() => setForgotStep("email")} className={styles.switchBtn}>
                    Back to Email
                  </button>
                </p>
              </div>
            </form>
          )
        ) : authMode === "register" ? (
          /* --------------------------------------------------------- */
          /* VIEW 4: SIGN UP (WHATSAPP VERIFIED REGISTRATION)          */
          /* --------------------------------------------------------- */
          <form className={styles.form} onSubmit={handleSignupSubmit} noValidate>
            <div className={styles.formGroup}>
              <label>Full Name</label>
              <input
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (fullNameError) setFullNameError("");
                }}
                className={fullNameError ? styles.inputError : ""}
                autoFocus
              />
              {fullNameError && <span className={styles.errorText}>{fullNameError}</span>}
            </div>

            <div className={styles.formGroup}>
              <label>Email Address</label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError("");
                }}
                onBlur={handleBlurEmail}
                className={emailError ? styles.inputError : ""}
              />
              {emailError && <span className={styles.errorText}>{emailError}</span>}
            </div>

            <div className={styles.formGroup}>
              <label>WhatsApp Mobile Number</label>
              <div className={styles.phoneInputWrapper}>
                <span className={styles.countryPrefix}>+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setPhone(clean);
                    if (phoneError) setPhoneError("");
                  }}
                  className={phoneError ? styles.inputError : ""}
                />
              </div>
              {phoneError && <span className={styles.errorText}>{phoneError}</span>}
            </div>

            <div className={styles.formGroup}>
              <label>Password</label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Create password (min 6 characters)"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError("");
                  }}
                  onBlur={handleBlurPassword}
                  className={passwordError ? styles.inputError : ""}
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
              {passwordError && <span className={styles.errorText}>{passwordError}</span>}
            </div>

            <div className={styles.btnRow}>
              <button type="submit" className={styles.btnPrimary} disabled={isLoading}>
                {isLoading ? "Sending WhatsApp Code..." : "Verify via WhatsApp & Sign Up"}
              </button>
            </div>

            <div className={styles.switchMode}>
              <p>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => handleSwitchMode("login")}
                  className={styles.switchBtn}
                >
                  Sign In Here
                </button>
              </p>
            </div>
          </form>
        ) : (
          /* --------------------------------------------------------- */
          /* VIEW 5: REGULAR SIGN IN (EMAIL/PHONE + PASSWORD)          */
          /* --------------------------------------------------------- */
          <form className={styles.form} onSubmit={handleLoginSubmit} noValidate>
            <div className={styles.formGroup}>
              <label>Email or Mobile Number</label>
              <input
                type="text"
                placeholder="Enter email or 10-digit mobile"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError("");
                }}
                onBlur={handleBlurEmail}
                className={emailError ? styles.inputError : ""}
                autoFocus
              />
              {emailError && <span className={styles.errorText}>{emailError}</span>}
            </div>

            <div className={styles.formGroup}>
              <label>Password</label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError("");
                  }}
                  onBlur={handleBlurPassword}
                  className={passwordError ? styles.inputError : ""}
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
              {passwordError && <span className={styles.errorText}>{passwordError}</span>}

              <div className={styles.forgotWrapper}>
                <button
                  type="button"
                  onClick={() => handleSwitchMode("forgot")}
                  className={styles.forgotLink}
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            <div className={styles.btnRow}>
              <button type="submit" className={styles.btnPrimary} disabled={isLoading}>
                {isLoading ? "Signing In..." : "Sign In Now"}
              </button>
            </div>

            <div className={styles.switchMode}>
              <p>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => handleSwitchMode("register")}
                  className={styles.switchBtn}
                >
                  Sign Up with WhatsApp
                </button>
              </p>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
