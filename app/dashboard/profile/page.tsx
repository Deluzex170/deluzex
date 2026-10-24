"use client";

import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import {
  fetchUserProfile,
  updateUserPassword,
  updateUserProfile,
  sendProfilePhoneOtp,
  verifyProfilePhoneOtp,
} from "../../services/api";
import styles from "./profile.module.css";

function getInitialUserValue(key: string, defaultValue: string, userObj?: Record<string, string> | null): string {
  if (userObj && userObj[key]) return userObj[key];
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const u = JSON.parse(stored);
        if (u && u[key]) return u[key];
      }
    } catch {
      // ignore
    }
  }
  return defaultValue;
}

export default function ProfilePage() {
  const { user, login } = useAuth();
  const userRecord = user as Record<string, any> | null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedAvatar = localStorage.getItem("user_avatar");
      if (storedAvatar) {
        setAvatarPreview(storedAvatar);
      } else if (userRecord?.avatar_url || userRecord?.avatar || userRecord?.image || userRecord?.image_url) {
        setAvatarPreview(userRecord?.avatar_url || userRecord?.avatar || userRecord?.image || userRecord?.image_url);
      }
    }
  }, [user]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Please select a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast("Image size should be less than 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAvatarPreview(result);
      setAvatarError(false);

      if (typeof window !== "undefined") {
        localStorage.setItem("user_avatar", result);
        try {
          const stored = JSON.parse(localStorage.getItem("user") || "{}");
          const updated = { ...stored, avatar_url: result };
          localStorage.setItem("user", JSON.stringify(updated));
          const token = localStorage.getItem("authToken") || "";
          login(token, updated);
        } catch {
          // ignore
        }
      }
      showToast("Profile photo updated successfully!");
    };
    reader.readAsDataURL(file);
  };

  const [firstName, setFirstName] = useState(() =>
    getInitialUserValue("first_name", userRecord?.first_name || userRecord?.name?.split(" ")[0] || "Hasanabbas", userRecord)
  );
  const [lastName, setLastName] = useState(() =>
    getInitialUserValue("last_name", userRecord?.last_name || userRecord?.name?.split(" ").slice(1).join(" ") || "Chaudhary", userRecord)
  );
  const [email, setEmail] = useState(() =>
    getInitialUserValue("email", "Hasanabbas@gmail.com", userRecord)
  );
  const [phone, setPhone] = useState(() =>
    getInitialUserValue("phone", "+91 9982791722", userRecord)
  );
  const [originalPhone, setOriginalPhone] = useState(() =>
    getInitialUserValue("phone", "+91 9982791722", userRecord)
  );
  const [city, setCity] = useState(() =>
    getInitialUserValue("city", "Ahmedabad", userRecord)
  );
  const [country, setCountry] = useState(() =>
    getInitialUserValue("country", "India", userRecord)
  );

  // Password fields and visibility toggles
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Phone OTP Modal States
  const [showPhoneOtpModal, setShowPhoneOtpModal] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [isVerifyingPhoneOtp, setIsVerifyingPhoneOtp] = useState(false);
  const [isSendingPhoneOtp, setIsSendingPhoneOtp] = useState(false);
  const [phoneOtpTimer, setPhoneOtpTimer] = useState(0);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Timer countdown for Phone OTP resend
  useEffect(() => {
    if (phoneOtpTimer <= 0) return;
    const interval = setInterval(() => {
      setPhoneOtpTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [phoneOtpTimer]);

  useEffect(() => {
    let isMounted = true;

    fetchUserProfile()
      .then((profile) => {
        if (!isMounted) return;
        if (profile.first_name) setFirstName(profile.first_name);
        if (profile.last_name) setLastName(profile.last_name);
        if (profile.email) setEmail(profile.email);
        if (profile.phone) {
          setPhone(profile.phone);
          setOriginalPhone(profile.phone);
        }
        if (profile.city) setCity(profile.city);
        if (profile.country) setCountry(profile.country);
        localStorage.setItem("user", JSON.stringify(profile));
      })
      .catch((error: Error) => {
        if (isMounted && error.message !== "Could not validate credentials") {
          showToast(error.message);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingProfile(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      showToast("Please enter your first name.");
      return;
    }
    if (!lastName.trim()) {
      showToast("Please enter your last name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      showToast("Please enter a valid email address.");
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const cleanOriginal = originalPhone.replace(/\D/g, "").slice(-10);

    // If phone number changed, require WhatsApp OTP verification before saving
    if (cleanPhone.length === 10 && cleanPhone !== cleanOriginal) {
      setIsSendingPhoneOtp(true);
      try {
        await sendProfilePhoneOtp(cleanPhone);
        setShowPhoneOtpModal(true);
        setPhoneOtp("");
        setPhoneOtpTimer(60);
        showToast(`WhatsApp OTP sent to +91 ${cleanPhone}`);
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Failed to send WhatsApp verification OTP.");
      } finally {
        setIsSendingPhoneOtp(false);
      }
      return;
    }

    setIsSavingProfile(true);
    try {
      const updatedUser = await updateUserProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        city: city.trim(),
        country: country.trim(),
      });
      const token = localStorage.getItem("authToken") || "";
      login(token, updatedUser);
      showToast("Personal information saved successfully!");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleResendPhoneOtp = async () => {
    if (phoneOtpTimer > 0) return;
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    try {
      await sendProfilePhoneOtp(cleanPhone);
      setPhoneOtpTimer(60);
      showToast(`New WhatsApp OTP sent to +91 ${cleanPhone}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to resend OTP.");
    }
  };

  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = phoneOtp.trim();
    if (cleanOtp.length !== 6) {
      showToast("Please enter the 6-digit WhatsApp OTP.");
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    setIsVerifyingPhoneOtp(true);
    try {
      // 1. Verify phone OTP and update phone number in backend
      await verifyProfilePhoneOtp(cleanPhone, cleanOtp);

      // 2. Also save other profile fields
      const formattedPhone = `+91 ${cleanPhone}`;
      const updatedUser = await updateUserProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: formattedPhone,
        city: city.trim(),
        country: country.trim(),
      });

      setPhone(formattedPhone);
      setOriginalPhone(formattedPhone);
      setShowPhoneOtpModal(false);

      const token = localStorage.getItem("authToken") || "";
      login(token, updatedUser);
      showToast("Phone number verified and profile saved successfully!");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Invalid WhatsApp OTP. Please try again.");
    } finally {
      setIsVerifyingPhoneOtp(false);
    }
  };

  const handleCancelPhoneOtp = () => {
    setShowPhoneOtpModal(false);
    setPhone(originalPhone);
    setPhoneOtp("");
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword.trim()) {
      showToast("Please enter your current password.");
      return;
    }
    if (newPassword.length < 6) {
      showToast("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("New password and confirm password do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      showToast("New password must be different from current password.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await updateUserPassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("Password updated successfully!");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to update password.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };


  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>My Profile</h1>
        <p className={styles.subtitle}>
          Manage your personal details, credentials, and quick account settings.
        </p>
      </div>

      {/* Hero Profile Card */}
      <div className={styles.profileHero}>
        <div className={styles.heroLeft}>
          <div style={{ position: "relative" }}>
            <div className={styles.avatarWrapper}>
              {avatarPreview && !avatarError ? (
                <Image
                  src={avatarPreview}
                  alt="Profile"
                  fill
                  unoptimized
                  className={styles.avatarImg}
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "linear-gradient(135deg, #C89B60, #856117)",
                    color: "#ffffff",
                    fontSize: "2rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  {(firstName?.[0] || email?.[0] || "U").toUpperCase()}
                </div>
              )}
            </div>
            <button
              type="button"
              className={styles.avatarEditBtn}
              onClick={() => fileInputRef.current?.click()}
              title="Change profile picture"
              aria-label="Change profile picture"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleAvatarChange}
            />
          </div>
          <div className={styles.heroInfo}>
            <h2>{firstName} {lastName}</h2>
            <div className={styles.heroEmail}>
              <span>{email}</span>
              <span>•</span>
              <span>{phone}</span>
            </div>
            <span className={styles.memberBadge}>★ Deluzex Premium Client</span>
          </div>
        </div>

        {/* <Link
          href="/dashboard/overview"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem 1.25rem",
            background: "#FAFAF8",
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: "6px",
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "#2B2B2B",
          }}
        >
          <span>View Account Overview</span>
          <span>→</span>
        </Link> */}
      </div>

      {/* Main Grid */}
      <div className={styles.grid}>
        {/* Left Column: Personal Info & Security */}
        <div>
          {/* Personal Information */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <span>Personal Information</span>
            </div>

            <form onSubmit={handleSaveProfile}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>First Name</label>
                  <input
                    type="text"
                    required
                    className={styles.input}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Last Name</label>
                  <input
                    type="text"
                    required
                    className={styles.input}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Email Address</label>
                  <input
                    type="email"
                    required
                    className={styles.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Phone Number</label>
                  <input
                    type="tel"
                    required
                    className={styles.input}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>City</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Country</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </div>
              </div>

              <button type="submit" className={styles.btnSave} disabled={isLoadingProfile || isSavingProfile}>
                {isSavingProfile ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>

          {/* Security & Password */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <span>Security & Password</span>
            </div>

            <form onSubmit={handleUpdatePassword}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Current Password</label>
                <div className={styles.passwordWrapper}>
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    placeholder="Enter current password"
                    className={styles.input}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className={styles.passwordToggleBtn}
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                  >
                    {showCurrentPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>New Password</label>
                  <div className={styles.passwordWrapper}>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      placeholder="At least 6 characters"
                      className={styles.input}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className={styles.passwordToggleBtn}
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Confirm New Password</label>
                  <div className={styles.passwordWrapper}>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      className={styles.input}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className={styles.passwordToggleBtn}
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <button type="submit" className={styles.btnSave} disabled={isUpdatingPassword}>
                {isUpdatingPassword ? "Updating..." : "Update Password"}
              </button>

            </form>
          </div>
        </div>

        {/* Right Column: Quick Navigation to other Dashboard pages */}
        <div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <span>Quick Navigation</span>
            </div>

            <div className={styles.quickNavList}>
              <Link href="/dashboard/orders" className={styles.quickNavItem}>
                <div className={styles.quickNavLeft}>
                  <div className={styles.quickNavIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M15 2H9c-1.1 0-2 .9-2 2v2h10V4c0-1.1-.9-2-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <div className={styles.quickNavTitle}>My Orders</div>
                    <div className={styles.quickNavSubtitle}>Track orders & view receipts</div>
                  </div>
                </div>
                <span>→</span>
              </Link>

              <Link href="/dashboard/address" className={styles.quickNavItem}>
                <div className={styles.quickNavLeft}>
                  <div className={styles.quickNavIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <div>
                    <div className={styles.quickNavTitle}>Delivery Addresses</div>
                    <div className={styles.quickNavSubtitle}>Manage shipping destinations</div>
                  </div>
                </div>
                <span>→</span>
              </Link>

              <Link href="/dashboard/payments" className={styles.quickNavItem}>
                <div className={styles.quickNavLeft}>
                  <div className={styles.quickNavIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                      <line x1="1" y1="10" x2="23" y2="10" />
                    </svg>
                  </div>
                  <div>
                    <div className={styles.quickNavTitle}>Payment Methods</div>
                    <div className={styles.quickNavSubtitle}>Saved cards & UPI details</div>
                  </div>
                </div>
                <span>→</span>
              </Link>

              <Link href="/dashboard/wishlist" className={styles.quickNavItem}>
                <div className={styles.quickNavLeft}>
                  <div className={styles.quickNavIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </div>
                  <div>
                    <div className={styles.quickNavTitle}>Wishlist</div>
                    <div className={styles.quickNavSubtitle}>Saved lighting designs</div>
                  </div>
                </div>
                <span>→</span>
              </Link>

              <Link href="/dashboard/overview" className={styles.quickNavItem}>
                <div className={styles.quickNavLeft}>
                  <div className={styles.quickNavIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <div className={styles.quickNavTitle}>Account Overview</div>
                    <div className={styles.quickNavSubtitle}>Analytics & activity summary</div>
                  </div>
                </div>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Phone Change WhatsApp OTP Modal */}
      {showPhoneOtpModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <button
              type="button"
              className={styles.modalCloseBtn}
              onClick={handleCancelPhoneOtp}
              aria-label="Close modal"
            >
              ×
            </button>
            <h3 className={styles.modalTitle}>Verify New Number</h3>
            <p className={styles.modalSubtitle}>
              For security, enter the 6-digit OTP sent to your WhatsApp on{" "}
              <span className={styles.phoneHighlight}>+91 {phone.replace(/\D/g, "").slice(-10)}</span>
            </p>

            <form onSubmit={handleVerifyPhoneOtp}>
              <input
                type="text"
                maxLength={6}
                autoFocus
                placeholder="• • • • • •"
                className={styles.otpInputBox}
                value={phoneOtp}
                onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, ""))}
              />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                  {phoneOtpTimer > 0 ? `Resend OTP in ${phoneOtpTimer}s` : "Didn't receive code?"}
                </span>
                <button
                  type="button"
                  onClick={handleResendPhoneOtp}
                  disabled={phoneOtpTimer > 0}
                  style={{
                    background: "none",
                    border: "none",
                    color: phoneOtpTimer > 0 ? "#9ca3af" : "#c89b60",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    cursor: phoneOtpTimer > 0 ? "not-allowed" : "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Resend on WhatsApp
                </button>
              </div>

              <div className={styles.modalBtnRow}>
                <button
                  type="button"
                  className={styles.modalCancelBtn}
                  onClick={handleCancelPhoneOtp}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.modalConfirmBtn}
                  disabled={isVerifyingPhoneOtp || phoneOtp.length !== 6}
                >
                  {isVerifyingPhoneOtp ? "Verifying..." : "Verify & Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Feedback Toast */}
      {toastMessage && (
        <div className={styles.toast}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C89B60" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
