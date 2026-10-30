"use client";

import React, { useEffect, useState } from "react";
import styles from "./address.module.css";
import { useAuth } from "../../context/AuthContext";
import {
  fetchUserAddresses,
  saveUserAddress,
  updateUserAddress,
  deleteUserAddress,
  setDefaultUserAddress,
  SavedAddress,
} from "../../services/api";

export default function AddressPage() {
  const { user } = useAuth();
  const userEmail = (user as Record<string, string>)?.email || "";
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Modal / Add / Edit Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [type, setType] = useState<"Home" | "Work" | "Other">("Home");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [phone, setPhone] = useState("");

  const resetForm = () => {
    setEditingAddress(null);
    setType("Home");
    setFirstName("");
    setLastName("");
    setStreet("");
    setCity("");
    setState("");
    setPinCode("");
    setPhone("");
  };

  const handleOpenAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleEdit = (addr: SavedAddress, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAddress(addr);
    setType((addr.type as "Home" | "Work" | "Other") || "Home");
    setFirstName(addr.first_name || "");
    setLastName(addr.last_name || "");
    setStreet(addr.street || "");
    setCity(addr.city || "");
    setState(addr.state || "");
    setPinCode(addr.pin_code || "");
    setPhone(addr.phone || "");
    setShowAddModal(true);
  };

  const loadAddresses = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchUserAddresses(userEmail);
      setAddresses(data || []);
    } catch (err) {
      console.error("Failed to load addresses from database:", err);
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !street.trim() || !city.trim() || !state.trim() || !pinCode.trim() || !phone.trim()) {
      alert("Please fill all required address fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingAddress) {
        const addrId = editingAddress.id || editingAddress._id;
        if (!addrId) {
          alert("Invalid address ID");
          return;
        }
        await updateUserAddress(
          addrId,
          {
            type,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            street: street.trim(),
            city: city.trim(),
            state: state.trim(),
            pin_code: pinCode.trim(),
            phone: phone.trim(),
          },
          userEmail
        );
      } else {
        const newAddr: SavedAddress = {
          user_email: userEmail,
          type,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          street: street.trim(),
          city: city.trim(),
          state: state.trim(),
          pin_code: pinCode.trim(),
          phone: phone.trim(),
          is_default: addresses.length === 0,
        };
        await saveUserAddress(newAddr);
      }

      setShowAddModal(false);
      resetForm();
      await loadAddresses();
    } catch (err: any) {
      console.error("Failed to save address:", err);
      alert(err?.message || "Failed to save address to database.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetDefault = async (addr: SavedAddress, e?: React.MouseEvent) => {
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
    } catch (err) {
      console.error("Failed to set default address:", err);
    }
  };

  const handleDelete = async (addr: SavedAddress, e: React.MouseEvent) => {
    e.stopPropagation();
    const addrId = addr.id || addr._id;
    if (!addrId) return;
    if (!window.confirm("Are you sure you want to delete this address?")) return;

    try {
      await deleteUserAddress(addrId, userEmail);
      setAddresses((prev) => prev.filter((a) => (a.id || a._id) !== addrId));
      loadAddresses();
    } catch (err) {
      console.error("Failed to delete address:", err);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My Addresses</h1>
          <p className={styles.subtitle}>Manage your saved addresses for a faster, one-click checkout.</p>
        </div>
        <button
          className={styles.btnAdd}
          onClick={handleOpenAddModal}
        >
          + Add New Address
        </button>
      </div>

      {/* Add Address Form Modal */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "2rem",
              maxWidth: "500px",
              width: "100%",
              boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.3rem" }}>{editingAddress ? "Edit Delivery Address" : "Add Delivery Address"}</h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer" }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveAddress} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {(["Home", "Work", "Other"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    style={{
                      flex: 1,
                      padding: "0.5rem",
                      borderRadius: "6px",
                      border: "1px solid",
                      borderColor: type === t ? "#C89B60" : "rgba(0,0,0,0.15)",
                      background: type === t ? "rgba(200,155,96,0.1)" : "#f9f9f9",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <input
                  type="text"
                  placeholder="First Name *"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  style={{ flex: 1, padding: "0.75rem", border: "1px solid #ddd", borderRadius: "6px" }}
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  style={{ flex: 1, padding: "0.75rem", border: "1px solid #ddd", borderRadius: "6px" }}
                />
              </div>

              <input
                type="text"
                placeholder="Street Address, Building / Apt *"
                required
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                style={{ padding: "0.75rem", border: "1px solid #ddd", borderRadius: "6px" }}
              />

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <input
                  type="text"
                  placeholder="City *"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  style={{ flex: 1, padding: "0.75rem", border: "1px solid #ddd", borderRadius: "6px" }}
                />
                <input
                  type="text"
                  placeholder="State *"
                  required
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  style={{ flex: 1, padding: "0.75rem", border: "1px solid #ddd", borderRadius: "6px" }}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <input
                  type="text"
                  placeholder="PIN Code *"
                  required
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  style={{ flex: 1, padding: "0.75rem", border: "1px solid #ddd", borderRadius: "6px" }}
                />
                <input
                  type="tel"
                  placeholder="Phone Number *"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ flex: 1, padding: "0.75rem", border: "1px solid #ddd", borderRadius: "6px" }}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    background: "#f5f5f5",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    border: "none",
                    borderRadius: "6px",
                    background: isSubmitting ? "#a88b56" : "#C89B60",
                    color: "white",
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    fontWeight: 600,
                  }}
                >
                  {isSubmitting ? "Saving..." : editingAddress ? "Update Address" : "Save Address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Address Grid */}
      {loading ? (
        <p style={{ color: "#777", padding: "2rem 0" }}>Loading saved addresses...</p>
      ) : addresses.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <h3 className={styles.emptyTitle}>No Addresses Saved Yet</h3>
          <p className={styles.emptySubtitle}>
            Add your shipping and delivery address to enjoy seamless, faster checkout on all your orders.
          </p>
          <button
            type="button"
            className={styles.btnAddFirst}
            onClick={handleOpenAddModal}
          >
            + Add Your First Address
          </button>
        </div>
      ) : (
        <div className={styles.addressGrid}>
          {addresses.map((addr, i) => {
            const addrId = addr.id || addr._id || String(i);
            const isSelected = selectedId ? selectedId === addrId : !!addr.is_default;
            return (
              <div
                key={addrId}
                className={`${styles.addressCard} ${isSelected ? styles.addressCardActive : ""}`}
                onClick={() => {
                  setSelectedId(addrId);
                  if (!addr.is_default) {
                    handleSetDefault(addr);
                  }
                }}
              >
                <div className={styles.topRow}>
                  {addr.is_default ? (
                    <span className={styles.defaultBadge}>Default</span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        setSelectedId(addrId);
                        handleSetDefault(addr, e);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#C89B60",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      Set as Default
                    </button>
                  )}
                  <div
                    className={`${styles.radioBtn} ${isSelected ? styles.radioBtnActive : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(addrId);
                      if (!addr.is_default) {
                        handleSetDefault(addr);
                      }
                    }}
                  >
                    {isSelected && <div className={styles.radioDot}></div>}
                  </div>
                </div>

                <div className={styles.addressTypeRow}>
                  <svg
                    className={styles.addressTypeIcon}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span className={styles.addressType}>{addr.type || "Home"}</span>
                </div>

                <div className={styles.personName}>
                  {addr.first_name} {addr.last_name}
                </div>
                <div className={styles.addressText}>
                  {addr.street}, {addr.city}, {addr.state} - {addr.pin_code}
                </div>
                <div className={styles.phoneText}>{addr.phone}</div>

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.btnEdit}
                    onClick={(e) => handleEdit(addr, e)}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Edit
                  </button>
                  <div className={styles.actionDivider} />
                  <button
                    type="button"
                    className={styles.btnDelete}
                    onClick={(e) => handleDelete(addr, e)}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
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

      {/* Footer Banner */}
      <div className={styles.footerBanner}>
        <div className={styles.footerIcon}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>
        <div className={styles.footerText}>
          <h4>Default address will be selected automatically</h4>
          <p>You can change or add delivery addresses at any time</p>
        </div>
      </div>
    </div>
  );
}
