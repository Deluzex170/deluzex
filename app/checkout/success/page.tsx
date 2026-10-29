"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import styles from "../checkout.module.css";

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  // COD orders are confirmed but not yet paid, so they must not claim a confirmed payment
  const isCod = searchParams.get("method") === "cod";
  const [copied, setCopied] = useState(false);

  const handleCopyOrderId = () => {
    if (orderId) {
      navigator.clipboard.writeText(orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <main
      className={styles.container}
      style={{
        minHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "8rem 1.5rem 4rem",
      }}
    >
      <div
        style={{
          textAlign: "center",
          maxWidth: "640px",
          width: "100%",
          background: "#FFFFFF",
          border: "1px solid rgba(200, 155, 96, 0.2)",
          borderRadius: "12px",
          padding: "3rem 2rem",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.04)",
        }}
      >
        {/* Animated Gold Checkmark */}
        <div
          style={{
            width: "76px",
            height: "76px",
            borderRadius: "50%",
            background: "rgba(200, 155, 96, 0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.75rem",
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#C89B60"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>

        <span
          style={{
            display: "inline-block",
            fontSize: "0.75rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#C89B60",
            marginBottom: "0.5rem",
          }}
        >
          {isCod ? "Order Confirmed" : "Payment Confirmed"}
        </span>

        <h1
          style={{
            fontFamily: "var(--font-libre), serif",
            fontSize: "2.2rem",
            fontWeight: 400,
            color: "#2B2B2B",
            marginBottom: "1rem",
          }}
        >
          Order Placed Successfully!
        </h1>

        <p
          style={{
            color: "#666",
            fontSize: "1rem",
            marginBottom: "2rem",
            lineHeight: 1.6,
          }}
        >
          {isCod
            ? "Thank you for choosing Deluzex. Your Cash on Delivery order is confirmed — please keep the payment ready (cash or UPI) when your order arrives. A confirmation email and SMS updates will be sent to you shortly."
            : "Thank you for choosing Deluzex. Your payment has been verified and your order details are securely recorded. A confirmation email and SMS updates will be sent to you shortly."}
        </p>

        {orderId && (
          <div
            style={{
              background: "#FAFAF8",
              padding: "1.25rem 1.5rem",
              borderRadius: "8px",
              border: "1px solid rgba(0, 0, 0, 0.08)",
              marginBottom: "2.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
            }}
          >
            <div style={{ textAlign: "left" }}>
              <span style={{ display: "block", fontSize: "0.75rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Order Reference
              </span>
              <strong style={{ fontSize: "1.05rem", color: "#2B2B2B", wordBreak: "break-all" }}>
                {orderId}
              </strong>
            </div>
            <button
              type="button"
              onClick={handleCopyOrderId}
              style={{
                background: copied ? "#2e7d32" : "#2B2B2B",
                color: "white",
                border: "none",
                borderRadius: "4px",
                padding: "0.5rem 1rem",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.2s ease",
                whiteSpace: "nowrap",
              }}
            >
              {copied ? "✓ Copied" : "Copy ID"}
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            gap: "1rem",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/shop"
            className={styles.btnPlaceOrder}
            style={{
              display: "inline-block",
              width: "auto",
              padding: "0.9rem 2.5rem",
              textDecoration: "none",
            }}
          >
            Continue Shopping
          </Link>
          <Link
            href="/"
            style={{
              display: "inline-block",
              width: "auto",
              padding: "0.9rem 2rem",
              textDecoration: "none",
              color: "#2B2B2B",
              border: "1px solid rgba(0,0,0,0.2)",
              borderRadius: "4px",
              fontWeight: 500,
              fontSize: "0.95rem",
            }}
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<div className={styles.container} style={{ textAlign: "center", padding: "8rem 2rem" }}>Loading order confirmation...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
