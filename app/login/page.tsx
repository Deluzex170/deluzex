"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";
import { useAuth } from "../context/AuthContext";
import { useDispatch } from "react-redux";
import { addToCart, openCart } from "../store/cartSlice";
import WhatsAppAuthSection from "../components/WhatsAppAuthSection";
import { verifyEmailOtp, resendEmailOtp } from "../services/api";

type ToastProps = {
  type: "success" | "error";
  message: string;
};

export default function Login() {
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot" | "email_otp">("login");
  const { login } = useAuth();
  const dispatch = useDispatch();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  // Email OTP state
  const [emailOtp, setEmailOtp] = useState("");
  const [emailOtpError, setEmailOtpError] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [resetEmailError, setResetEmailError] = useState("");
  
  const [toast, setToast] = useState<ToastProps | null>(null);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const validatePassword = (val: string) => {
    if (val.length < 8) return "Password must be at least 8 characters long.";
    return null;
  };

  const handleBlurEmail = () => {
    if (!email.trim()) {
      setEmailError("Email is required.");
    } else if (!validateEmail(email)) {
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

  const handleResetSubmit = (e: React.FormEvent) => {
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
    setTimeout(() => {
      setIsLoading(false);
      setResetSent(true);
      setToast({ type: "success", message: "Password reset link has been sent to your email." });
    }, 700);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let isValid = true;

    setEmailError("");
    setPasswordError("");

    if (!email.trim()) {
      setEmailError("Email is required.");
      isValid = false;
    } else if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address.");
      isValid = false;
    }

    if (!password.trim()) {
      setPasswordError("Password is required.");
      isValid = false;
    } else if (authMode === "register") {
      const pswError = validatePassword(password);
      if (pswError) {
        setPasswordError(pswError);
        isValid = false;
      }
    }

    if (!isValid) {
      setToast({ type: "error", message: "Please check your inputs." });
      return;
    }

    setIsLoading(true);

    try {
      if (authMode === "login") {
        const response = await authFetch("/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const data = await response.json();

        // Check if email verification is required
        if (response.status === 403 && (data?.detail?.includes("EMAIL_NOT_VERIFIED") || data?.detail?.includes("verify your email"))) {
          setPendingEmail(email.trim());
          setAuthMode("email_otp");
          setResendCooldown(45);
          setToast({ type: "error", message: "Please verify your email address. A 6-digit code has been sent to your inbox." });
          return;
        }
        
        if (response.ok && data.success) {
          setToast({ type: "success", message: "Successfully logged in!" });
          localStorage.setItem("authToken", data?.access_token);
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
            const redirectParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('redirect') : null;
            if (redirectParam && (data?.data?.is_admin || !redirectParam.startsWith('/admin'))) {
              router.push(redirectParam);
            } else if (data?.data?.is_admin) {
              router.push("/admin");
            } else {
              router.push("/");
            }
          }, 1200);
        } else {
          setToast({ type: "error", message: parseErrorDetail(data, "Invalid email or password. Please try again.") });
        }
      } else {
        // Sign up (register)
        const nameFromEmail = email.trim().split("@")[0] || "User";
        const response = await authFetch("/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            first_name: nameFromEmail,
            last_name: "Customer",
            email: email.trim(),
            password,
            phone: "+919999999999",
            accept_terms: true,
          }),
        });
        const data = await response.json();
        
        if (response.ok && data.success) {
          if (data.requires_verification) {
            setPendingEmail(email.trim());
            setAuthMode("email_otp");
            setResendCooldown(45);
            setToast({ type: "success", message: "Registration successful! A 6-digit verification code has been sent to your email." });
            return;
          }

          if (data.access_token && data.data) {
            setToast({ type: "success", message: "Account created and logged in successfully!" });
            localStorage.setItem("authToken", data.access_token);
            login(data.access_token, data.data);
            setTimeout(() => {
              router.push("/");
            }, 1200);
          } else {
            setToast({ type: "success", message: "Registration successful! You can now log in." });
            setAuthMode("login");
            setPassword("");
          }
        } else {
          setToast({ type: "error", message: parseErrorDetail(data, "Registration failed. Please check your details.") });
        }
      }
    } catch (err: any) {
      setToast({ type: "error", message: err?.message || "Unable to reach the server. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

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
          const redirectParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('redirect') : null;
          if (redirectParam && (data?.data?.is_admin || !redirectParam.startsWith('/admin'))) {
            router.push(redirectParam);
          } else if (data?.data?.is_admin) {
            router.push("/admin");
          } else {
            router.push("/");
          }
        }, 1200);
      }
    } catch (err: any) {
      setEmailOtpError(err?.message || "Invalid or expired verification code.");
      setToast({ type: "error", message: err?.message || "Verification failed." });
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
      setToast({ type: "error", message: err?.message || "Failed to resend code. Please try again." });
    } finally {
      setIsResendingOtp(false);
    }
  };

  const handleSwitchMode = (targetMode: "login" | "register" | "forgot" | "email_otp") => {
    setAuthMode(targetMode);
    setEmailError("");
    setPasswordError("");
    setResetEmailError("");
    setEmailOtpError("");
    setToast(null);
  };

  return (
    <main className={styles.main} data-auth-page="true">
      {toast && (
        <div className={`${styles.toast} ${toast.type === "success" ? styles.toastSuccess : styles.toastError}`}>
          {toast.type === "success" ? (
            <svg className={styles.toastIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
              ? "Elevate Every Space With Light"
              : authMode === "email_otp"
              ? "Verify Your Email"
              : "Reset Password"}
          </h1>
          {authMode === "email_otp" && (
            <p className={styles.subtitle}>
              Enter the 6-digit security code sent to your inbox
            </p>
          )}
          {authMode === "forgot" && (
            <p className={styles.subtitle}>
              We will send a password reset link to your registered email address
            </p>
          )}
        </div>

        {authMode === "email_otp" ? (
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
              />
              {resetEmailError && <span className={styles.errorText}>{resetEmailError}</span>}
            </div>

            <div className={styles.btnRow}>
              <button type="submit" className={styles.btnPrimary} disabled={isLoading || resetSent}>
                {isLoading ? "Sending Link..." : (resetSent ? "Reset Link Sent" : "Send Reset Link")}
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
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.formGroup}>
              <label>Enter Email</label>
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
              <label>Enter Password</label>
              <div className={styles.passwordWrapper}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder={authMode === "login" ? "Enter your password" : "Create new Password"} 
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
              {authMode === "login" && (
                <div className={styles.forgotWrapper}>
                  <button
                    type="button"
                    onClick={() => handleSwitchMode("forgot")}
                    className={styles.forgotLink}
                  >
                    Forgot Password?
                  </button>
                </div>
              )}
            </div>

            <div className={styles.btnRow}>
              <button type="submit" className={styles.btnPrimary} disabled={isLoading}>
                {isLoading
                  ? (authMode === "login" ? "Signing In..." : "Signing Up...")
                  : (authMode === "login" ? "Sign In Now" : "Sign Up Now")}
              </button>
            </div>

            <WhatsAppAuthSection
              onSuccess={(token, userData) => {
                setToast({ type: "success", message: "Logged in successfully via WhatsApp!" });
                localStorage.setItem("authToken", token);
                login(token, userData);
                setTimeout(() => {
                  router.push("/");
                }, 1200);
              }}
              onError={(msg) => setToast({ type: "error", message: msg })}
            />

            <div className={styles.switchMode}>
              <p>
                {authMode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => handleSwitchMode(authMode === "login" ? "register" : "login")}
                  className={styles.switchBtn}
                >
                  {authMode === "login" ? "Sign Up Here" : "Sign In Here"}
                </button>
              </p>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
