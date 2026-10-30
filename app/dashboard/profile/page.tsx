"use client";

import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useAuth } from "../../context/AuthContext";
import {
  fetchUserProfile,
  updateUserPassword,
  updateUserProfile,
  fetchUserAddresses,
  saveUserAddress,
  deleteUserAddress,
  setDefaultUserAddress,
  removeUserAvatar,
  deleteUserProfile,
  SavedAddress,
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
  const { user, login, logout } = useAuth();
  const userRecord = user as Record<string, any> | null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
    reader.onload = async () => {
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
      try {
        await updateUserProfile({ avatar_url: result });
      } catch {
        // ignore
      }
      showToast("Profile photo updated successfully!");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    const hasPhoto = Boolean(avatarPreview || (typeof window !== "undefined" && localStorage.getItem("user_avatar")));
    if (!hasPhoto) {
      showToast("No custom profile photo to remove.");
      return;
    }
    setAvatarPreview(null);
    setAvatarError(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (typeof window !== "undefined") {
      localStorage.removeItem("user_avatar");
      try {
        const stored = JSON.parse(localStorage.getItem("user") || "{}");
        const updated = { ...stored, avatar_url: null, avatar: null, image: null, image_url: null };
        localStorage.setItem("user", JSON.stringify(updated));
        const token = localStorage.getItem("authToken") || "";
        login(token, updated);
      } catch {
        // ignore
      }
    }
    try {
      await removeUserAvatar();
      showToast("Profile photo removed.");
    } catch {
      showToast("Profile photo removed.");
    }
  };

  const handleConfirmDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      await deleteUserProfile();
      showToast("Account deleted successfully.");
      logout();
      window.location.href = "/";
    } catch (err: any) {
      console.error("Account deletion failed:", err);
      showToast(err?.message || "Failed to delete account. Please try again.");
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  };

  // Form input states (editable in input fields)
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
  const [state, setState] = useState(() =>
    getInitialUserValue("state", "Gujarat", userRecord)
  );
  const [country, setCountry] = useState(() =>
    getInitialUserValue("country", "India", userRecord)
  );

  // Saved profile display state (only updates when user presses "Save Changes" or when profile loads from DB)
  const [savedProfile, setSavedProfile] = useState(() => ({
    firstName: getInitialUserValue("first_name", userRecord?.first_name || userRecord?.name?.split(" ")[0] || "Hasanabbas", userRecord),
    lastName: getInitialUserValue("last_name", userRecord?.last_name || userRecord?.name?.split(" ").slice(1).join(" ") || "Chaudhary", userRecord),
    email: getInitialUserValue("email", "Hasanabbas@gmail.com", userRecord),
    phone: getInitialUserValue("phone", "+91 9982791722", userRecord),
  }));

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
        if (profile.state) setState(profile.state);
        if (profile.country) setCountry(profile.country);
        setSavedProfile({
          firstName: profile.first_name || profile.name?.split(" ")[0] || "Hasanabbas",
          lastName: profile.last_name || profile.name?.split(" ").slice(1).join(" ") || "Chaudhary",
          email: profile.email || "Hasanabbas@gmail.com",
          phone: profile.phone || "+91 9982791722",
        });
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
        state: state.trim(),
        country: country.trim(),
      });
      const token = localStorage.getItem("authToken") || "";
      login(token, updatedUser);
      setSavedProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
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

  // Addresses State
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);
  const [selectedAddrId, setSelectedAddrId] = useState<string | null>(null);

  // Add Address Modal State
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [addrType, setAddrType] = useState<"Home" | "Work" | "Other">("Home");
  const [addrFirstName, setAddrFirstName] = useState("");
  const [addrLastName, setAddrLastName] = useState("");
  const [addrStreet, setAddrStreet] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrPinCode, setAddrPinCode] = useState("");
  const [addrPhone, setAddrPhone] = useState("");
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  const userEmail = (user as Record<string, string>)?.email || email || "";

  const loadAddresses = React.useCallback(async () => {
    setIsLoadingAddresses(true);
    try {
      const data = await fetchUserAddresses(userEmail);
      setAddresses(data || []);
    } catch (err) {
      console.error("Failed to load addresses:", err);
      setAddresses([]);
    } finally {
      setIsLoadingAddresses(false);
    }
  }, [userEmail]);

  useEffect(() => {
    if (userEmail) {
      loadAddresses();
    }
  }, [userEmail, loadAddresses]);

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrFirstName.trim() || !addrStreet.trim() || !addrCity.trim() || !addrState.trim() || !addrPinCode.trim() || !addrPhone.trim()) {
      showToast("Please fill all required address fields.");
      return;
    }

    const newAddr: SavedAddress = {
      user_email: userEmail,
      type: addrType,
      first_name: addrFirstName.trim(),
      last_name: addrLastName.trim(),
      street: addrStreet.trim(),
      city: addrCity.trim(),
      state: addrState.trim(),
      pin_code: addrPinCode.trim(),
      phone: addrPhone.trim(),
      is_default: addresses.length === 0,
    };

    setIsSavingAddress(true);
    try {
      await saveUserAddress(newAddr);
      setShowAddAddressModal(false);
      setAddrFirstName("");
      setAddrLastName("");
      setAddrStreet("");
      setAddrCity("");
      setAddrState("");
      setAddrPinCode("");
      setAddrPhone("");
      showToast("Address saved successfully!");
      await loadAddresses();
    } catch (err) {
      console.error("Failed to save address:", err);
      showToast("Failed to save address to database.");
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleSetDefaultAddress = async (addr: SavedAddress, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const addrId = addr.id || addr._id;
    if (!addrId) return;

    try {
      await setDefaultUserAddress(addrId);
      setAddresses((prev) =>
        prev.map((a) => ({
          ...a,
          is_default: (a.id || a._id) === addrId,
        }))
      );
      showToast("Default delivery address updated.");
    } catch (err) {
      console.error("Failed to set default address:", err);
      showToast("Failed to update default address.");
    }
  };

  const handleDeleteAddress = async (addr: SavedAddress, e: React.MouseEvent) => {
    e.stopPropagation();
    const addrId = addr.id || addr._id;
    if (!addrId) return;
    if (!window.confirm("Are you sure you want to delete this address?")) return;

    try {
      await deleteUserAddress(addrId, userEmail);
      setAddresses((prev) => prev.filter((a) => (a.id || a._id) !== addrId));
      showToast("Address deleted successfully.");
      loadAddresses();
    } catch (err) {
      console.error("Failed to delete address:", err);
      showToast("Failed to delete address.");
    }
  };


  return (
    <div className={styles.container}>
      <div className={styles.grid}>

        {/* Row 1: Title (left) | Profile Card (right) */}
        <div className={styles.topRow}>
          {/* Left: Title block */}
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>My Profile</h1>
            <p className={styles.subtitle}>
              Manage your personal details, credentials, and quick account settings.
            </p>
          </div>

          {/* Right: Profile overview card */}
          <div className={styles.card}>
            <div className={styles.profileCardContent}>
              <div className={styles.avatarWrapperContainer}>
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
                        fontSize: "1.6rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                      }}
                    >
                      {(savedProfile.firstName?.[0] || savedProfile.email?.[0] || "U").toUpperCase()}
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
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </button>
                {avatarPreview && !avatarError && (
                  <button
                    type="button"
                    className={styles.avatarRemoveBtn}
                    onClick={handleRemoveAvatar}
                    title="Remove profile picture"
                    aria-label="Remove profile picture"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleAvatarChange}
                />
              </div>

              <div className={styles.profileDetailsColumn}>
                <h2 className={styles.profileCardName}>{savedProfile.firstName} {savedProfile.lastName}</h2>
                <div className={styles.profileCardEmail}>{savedProfile.email}</div>
                <div className={styles.profileCardPhone}>{savedProfile.phone}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.45rem", flexWrap: "wrap" }}>
                  <span className={styles.memberBadge}>&#9733; Deluzex Premium Client</span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={styles.changePhotoBtn}
                    title="Upload or change profile picture"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    Change Photo
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className={styles.removePhotoBtn}
                    title="Remove profile photo and restore default initials"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                    Remove Photo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Personal Information (left) | Security & Password (right) */}
        <div className={styles.twoColRow}>
          {/* Left: Personal Information */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <span>Personal Information</span>
            </div>

            <form onSubmit={handleSaveProfile} className={styles.compactForm}>
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
                  <label className={styles.label}>State</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                className={styles.btnSave}
                disabled={isLoadingProfile || isSavingProfile}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
              >
                {isSavingProfile ? (
                  <>
                    <svg
                      style={{ animation: "spin 0.75s linear infinite" }}
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </form>
          </div>

          {/* Right: Security & Password */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <span>Security &amp; Password</span>
            </div>

            <form onSubmit={handleUpdatePassword} className={styles.compactForm}>
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                      placeholder="Min 6 chars"
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
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Confirm Password</label>
                  <div className={styles.passwordWrapper}>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm password"
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
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className={styles.btnSave}
                disabled={isUpdatingPassword}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
              >
                {isUpdatingPassword ? (
                  <>
                    <svg
                      style={{ animation: "spin 0.75s linear infinite" }}
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    <span>Updating Password...</span>
                  </>
                ) : (
                  "Update Password"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Row 3: Saved Addresses â€” full width */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <span>Saved Addresses</span>
            <button
              type="button"
              className={styles.btnAddAddress}
              onClick={() => {
                setAddrFirstName(firstName || "");
                setAddrLastName(lastName || "");
                setAddrPhone(phone || "");
                setAddrCity(city || "");
                setShowAddAddressModal(true);
              }}
            >
              + Add New Address
            </button>
          </div>

          {isLoadingAddresses ? (
            <p style={{ color: "#777", padding: "0.5rem 0", margin: 0, fontSize: "0.85rem" }}>Loading saved addresses...</p>
          ) : addresses.length === 0 ? (
            <div className={styles.emptyAddressState}>
              <div className={styles.emptyAddressIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <h3 className={styles.emptyAddressTitle}>No Addresses Saved Yet</h3>
              <p className={styles.emptyAddressSubtitle}>
                Add your shipping and delivery address for faster checkout.
              </p>
              <button
                type="button"
                className={styles.btnAddAddressFirst}
                onClick={() => {
                  setAddrFirstName(firstName || "");
                  setAddrLastName(lastName || "");
                  setAddrPhone(phone || "");
                  setAddrCity(city || "");
                  setShowAddAddressModal(true);
                }}
              >
                + Add Address
              </button>
            </div>
          ) : (
            <div className={styles.addressListRow}>
              {addresses.map((addr, i) => {
                const addrId = addr.id || addr._id || String(i);
                const isSelected = selectedAddrId ? selectedAddrId === addrId : !!addr.is_default;
                return (
                  <div
                    key={addrId}
                    className={`${styles.addressCard} ${isSelected ? styles.addressCardActive : ""}`}
                    onClick={() => {
                      setSelectedAddrId(addrId);
                      if (!addr.is_default) {
                        handleSetDefaultAddress(addr);
                      }
                    }}
                  >
                    <div className={styles.addressTopRow}>
                      {addr.is_default ? (
                        <span className={styles.defaultBadge}>Default</span>
                      ) : (
                        <button
                          type="button"
                          className={styles.btnSetDefault}
                          onClick={(e) => {
                            setSelectedAddrId(addrId);
                            handleSetDefaultAddress(addr, e);
                          }}
                        >
                          Set as Default
                        </button>
                      )}
                      <div
                        className={`${styles.radioBtn} ${isSelected ? styles.radioBtnActive : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAddrId(addrId);
                          if (!addr.is_default) {
                            handleSetDefaultAddress(addr);
                          }
                        }}
                      >
                        {isSelected && <div className={styles.radioDot} />}
                      </div>
                    </div>

                    <div className={styles.addressTypeRow}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span className={styles.addressType}>{addr.type || "Home"}</span>
                    </div>

                    <div className={styles.addressPersonName}>
                      {addr.first_name} {addr.last_name}
                    </div>
                    <div className={styles.addressText}>
                      {addr.street}, {addr.city}, {addr.state} - {addr.pin_code}
                    </div>
                    <div className={styles.addressPhone}>{addr.phone}</div>

                    <div className={styles.addressCardActions}>
                      <button
                        type="button"
                        className={styles.btnDeleteAddress}
                        onClick={(e) => handleDeleteAddress(addr, e)}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4h6v2" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Row 4: Account Deletion (Danger Zone) */}
        <div className={styles.card} style={{ borderColor: "#FEE2E2", marginTop: "1rem" }}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.cardTitle} style={{ color: "#DC2626" }}>Delete Account</div>
              <div className={styles.cardSubtitle}>
                Permanently delete your Deluzex customer account and remove all personal profile data.
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#6B7280", maxWidth: "600px", lineHeight: 1.5 }}>
              Once deleted, your profile details, avatar, saved delivery addresses, and active session will be permanently erased. This action is irreversible.
            </p>
            <button
              type="button"
              className={styles.btnDeleteAccount}
              onClick={() => setShowDeleteModal(true)}
            >
              Delete Account
            </button>
          </div>
        </div>

      </div>

      {/* Add Address Modal */}
      {showAddAddressModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <div className={styles.modalHeader}>
              <h2>Add Delivery Address</h2>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setShowAddAddressModal(false)}
              >
                Ã—
              </button>
            </div>

            <form onSubmit={handleSaveAddress} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className={styles.typeSelector}>
                {(["Home", "Work", "Other"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAddrType(t)}
                    className={`${styles.typeBtn} ${addrType === t ? styles.typeBtnActive : ""}`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>First Name *</label>
                  <input
                    type="text"
                    required
                    className={styles.input}
                    placeholder="First Name"
                    value={addrFirstName}
                    onChange={(e) => setAddrFirstName(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Last Name</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Last Name"
                    value={addrLastName}
                    onChange={(e) => setAddrLastName(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Street Address *</label>
                <input
                  type="text"
                  required
                  className={styles.input}
                  placeholder="Street Address, Building / Apt"
                  value={addrStreet}
                  onChange={(e) => setAddrStreet(e.target.value)}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>City *</label>
                  <input
                    type="text"
                    required
                    className={styles.input}
                    placeholder="City"
                    value={addrCity}
                    onChange={(e) => setAddrCity(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>State *</label>
                  <input
                    type="text"
                    required
                    className={styles.input}
                    placeholder="State"
                    value={addrState}
                    onChange={(e) => setAddrState(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>PIN Code *</label>
                  <input
                    type="text"
                    required
                    className={styles.input}
                    placeholder="PIN Code"
                    value={addrPinCode}
                    onChange={(e) => setAddrPinCode(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Phone Number *</label>
                  <input
                    type="tel"
                    required
                    className={styles.input}
                    placeholder="Phone Number"
                    value={addrPhone}
                    onChange={(e) => setAddrPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.btnCancelModal}
                  onClick={() => setShowAddAddressModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.btnSubmitModal}
                  disabled={isSavingAddress}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                >
                  {isSavingAddress ? (
                    <>
                      <svg
                        style={{ animation: "spin 0.75s linear infinite" }}
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                        <path d="M12 2a10 10 0 0 1 10 10" />
                      </svg>
                      <span>Saving Address...</span>
                    </>
                  ) : (
                    "Save Address"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div
          className={styles.modalOverlay}
          style={{ zIndex: 10000 }}
          onClick={() => !deleteLoading && setShowDeleteModal(false)}
        >
          <div
            className={styles.modalBox}
            style={{ maxWidth: "460px", textAlign: "center", padding: "2rem 1.75rem" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              backgroundColor: "rgba(220, 38, 38, 0.12)",
              color: "#DC2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.25rem",
              fontSize: "1.6rem",
              fontWeight: "bold",
            }}>
              ⚠️
            </div>
            <h3 style={{
              fontSize: "1.35rem",
              fontWeight: 600,
              color: "#1F2937",
              margin: "0 0 0.5rem",
              fontFamily: "var(--font-libre), Georgia, serif"
            }}>
              Delete Your Deluzex Account?
            </h3>
            <p style={{
              fontSize: "0.88rem",
              color: "#6B7280",
              lineHeight: 1.55,
              margin: "0 0 1.75rem"
            }}>
              Are you sure you want to permanently delete your account? This action cannot be undone. All personal information and saved settings will be erased immediately.
            </p>
            <div style={{ display: "flex", gap: "0.85rem", justifyContent: "center" }}>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => setShowDeleteModal(false)}
                style={{
                  flex: 1,
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  border: "1px solid #D1D5DB",
                  background: "#FFFFFF",
                  color: "#374151",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                Keep Account
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleConfirmDeleteAccount}
                style={{
                  flex: 1,
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  border: "none",
                  background: "#DC2626",
                  color: "#FFFFFF",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  cursor: deleteLoading ? "not-allowed" : "pointer",
                  opacity: deleteLoading ? 0.75 : 1,
                  transition: "all 0.2s ease",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                }}
              >
                {deleteLoading ? (
                  <>
                    <svg
                      style={{ animation: "spin 0.75s linear infinite" }}
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    <span>Deleting Account...</span>
                  </>
                ) : (
                  "Yes, Delete Account"
                )}
              </button>
            </div>
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
