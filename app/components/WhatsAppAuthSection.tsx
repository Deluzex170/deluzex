"use client";

import React, { useState, useEffect } from "react";
import styles from "./WhatsAppAuthSection.module.css";
import { sendWhatsAppOtp, verifyWhatsAppOtp } from "../services/api";

interface WhatsAppAuthSectionProps {
  onSuccess: (accessToken: string, userData: any) => void;
  onError?: (message: string) => void;
}

export default function WhatsAppAuthSection({ onSuccess, onError }: WhatsAppAuthSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [infoMessage, setInfoMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Countdown timer for OTP resend cooldown
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setInfoMessage("");

    const cleanPhone = phone.replace(/[^\d]/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      const err = "Please enter a valid 10-digit mobile number.";
      setErrorMessage(err);
      if (onError) onError(err);
      return;
    }

    setIsLoading(true);
    try {
      const fullPhone = cleanPhone.length === 10 ? `+91${cleanPhone}` : `+${cleanPhone}`;
      const res = await sendWhatsAppOtp(fullPhone);

      setStep("otp");
      setCooldown(60);
      setInfoMessage(res.message || "Verification code sent to your WhatsApp!");
    } catch (err: any) {
      const msg = err.message || "Failed to dispatch WhatsApp code. Please try again.";
      setErrorMessage(msg);
      if (onError) onError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      const err = "Please enter the complete 6-digit code received on WhatsApp.";
      setErrorMessage(err);
      if (onError) onError(err);
      return;
    }

    setIsLoading(true);
    try {
      const cleanPhone = phone.replace(/[^\d]/g, "");
      const fullPhone = cleanPhone.length === 10 ? `+91${cleanPhone}` : `+${cleanPhone}`;
      const res = await verifyWhatsAppOtp(fullPhone, cleanOtp);

      if (res.success && res.access_token) {
        onSuccess(res.access_token, res.data);
      } else {
        throw new Error(res.message || "Authentication failed.");
      }
    } catch (err: any) {
      const msg = err.message || "Invalid or expired verification code.";
      setErrorMessage(msg);
      if (onError) onError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <div className={styles.container}>
        <div className={styles.divider}>or</div>
        <button
          type="button"
          className={styles.whatsappToggleBtn}
          onClick={() => {
            setIsOpen(true);
            setStep("phone");
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.173.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.173.231-.145.39-.086s1.011.477 1.184.564.289.13.332.202c.043.072.043.419-.101.824zm-3.392-12.416c-5.518 0-10 4.482-10 10 0 1.944.561 3.757 1.526 5.293l-1.602 5.861 6.012-1.577c1.477.859 3.195 1.344 5.064 1.344 5.518 0 10-4.482 10-10s-4.482-9.921-10-9.921z" />
          </svg>
          Continue with WhatsApp
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.divider}>WhatsApp Login</div>

      {errorMessage && (
        <div style={{ color: "#dc2626", fontSize: "13px", padding: "8px 12px", background: "#fef2f2", borderRadius: "6px", border: "1px solid #fecaca" }}>
          {errorMessage}
        </div>
      )}

      {infoMessage && <div className={styles.hintBanner}>{infoMessage}</div>}

      {step === "phone" ? (
        <form onSubmit={handleSendOtp} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div className={styles.phoneInputWrapper}>
            <span className={styles.countryPrefix}>+91</span>
            <input
              type="tel"
              required
              autoFocus
              maxLength={10}
              placeholder="Enter 10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))}
              className={styles.phoneInput}
            />
          </div>

          <button type="submit" disabled={isLoading} className={styles.submitBtn}>
            {isLoading ? "Sending WhatsApp Code..." : "Send Verification Code"}
          </button>

          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => {
              setIsOpen(false);
              setErrorMessage("");
              setInfoMessage("");
            }}
            style={{ textAlign: "center", marginTop: "4px" }}
          >
            Use Email & Password Instead
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", color: "#4b5563", marginBottom: "6px", textAlign: "center" }}>
              Enter 6-digit Code sent to WhatsApp
            </label>
            <input
              type="text"
              required
              autoFocus
              maxLength={6}
              placeholder="••••••"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, ""))}
              className={styles.otpInput}
            />
          </div>

          <button type="submit" disabled={isLoading || otp.length < 6} className={styles.submitBtn}>
            {isLoading ? "Verifying..." : "Verify & Sign In"}
          </button>

          <div className={styles.resendRow}>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => {
                setStep("phone");
                setOtp("");
                setErrorMessage("");
              }}
            >
              Change Number
            </button>

            <button
              type="button"
              disabled={cooldown > 0 || isLoading}
              className={styles.linkBtn}
              onClick={handleSendOtp}
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend Code"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
