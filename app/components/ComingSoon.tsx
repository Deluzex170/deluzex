"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { isValidEmail, sanitizeEmail } from "../utils/validation";
import styles from "./ComingSoon.module.css";

interface ComingSoonProps {
  is404?: boolean;
}

export default function ComingSoon({ is404 = false }: ComingSoonProps) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [btnText, setBtnText] = useState("Notify Me");
  const [toastMessage, setToastMessage] = useState("");
  const [isToastActive, setIsToastActive] = useState(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const API_ENDPOINT =
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000/api/v1/newsletter/subscribe";

  const showToast = (message: string, duration = 4000) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(message);
    setIsToastActive(true);
    toastTimeoutRef.current = setTimeout(() => {
      setIsToastActive(false);
    }, duration);
  };

  const saveLocally = (subEmail: string, pendingSync = false) => {
    try {
      const subscribers = JSON.parse(
        localStorage.getItem("deluzex_subscribers") || "[]"
      );
      if (!subscribers.includes(subEmail)) {
        subscribers.push(subEmail);
        localStorage.setItem(
          "deluzex_subscribers",
          JSON.stringify(subscribers)
        );
      }

      if (pendingSync) {
        const offlineQueue = JSON.parse(
          localStorage.getItem("deluzex_pending_sync") || "[]"
        );
        if (!offlineQueue.includes(subEmail)) {
          offlineQueue.push(subEmail);
          localStorage.setItem(
            "deluzex_pending_sync",
            JSON.stringify(offlineQueue)
          );
        }
      }
    } catch {
      // storage unavailable
    }
  };

  // Background sync on load
  useEffect(() => {
    const syncOffline = async () => {
      try {
        const queue = JSON.parse(
          localStorage.getItem("deluzex_pending_sync") || "[]"
        );
        if (!queue.length) return;

        const remaining: string[] = [];
        for (const item of queue) {
          try {
            const res = await fetch(API_ENDPOINT, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: item,
                source: "coming_soon_offline_sync",
              }),
            });
            if (!res.ok && res.status !== 400) {
              remaining.push(item);
            }
          } catch {
            remaining.push(item);
          }
        }
        localStorage.setItem(
          "deluzex_pending_sync",
          JSON.stringify(remaining)
        );
      } catch {
        // silent fail
      }
    };
    syncOffline();
  }, [API_ENDPOINT]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = sanitizeEmail(email);

    if (!isValidEmail(cleanEmail)) {
      showToast("Please enter a valid email address (e.g. name@example.com).");
      return;
    }

    setIsSubmitting(true);
    setBtnText("Subscribing...");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, source: "coming_soon" }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        saveLocally(cleanEmail, false);

        if (data.status === "already_subscribed") {
          setBtnText("Subscribed ✓");
          showToast("You're already subscribed. We'll notify you once we go live.");
        } else {
          setBtnText("Subscribed ✓");
          showToast("Thank you. We will notify you as soon as we launch.");
        }
        setEmail("");
      } else {
        throw new Error("Server status: " + res.status);
      }
    } catch {
      saveLocally(cleanEmail, true);
      setBtnText("Subscribed ✓");
      showToast("Thank you. We will notify you as soon as we launch.");
      setEmail("");
    } finally {
      setTimeout(() => {
        setBtnText("Notify Me");
        setIsSubmitting(false);
      }, 3000);
    }
  };

  // Connected 5 social media links with monochrome black (#1d1e26) icons
  const socialIcons = [
    {
      name: "LinkedIn",
      href: "https://www.linkedin.com/company/deluzex",
      svg: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" clipRule="evenodd" d="M1 2.838A1.84 1.84 0 0 1 2.838 1H21.16A1.837 1.837 0 0 1 23 2.838V21.16A1.84 1.84 0 0 1 21.161 23H2.838A1.84 1.84 0 0 1 1 21.161zm8.708 6.55h2.979v1.496c.43-.86 1.53-1.634 3.183-1.634c3.169 0 3.92 1.713 3.92 4.856v5.822h-3.207v-5.106c0-1.79-.43-2.8-1.522-2.8c-1.515 0-2.145 1.089-2.145 2.8v5.106H9.708zm-5.5 10.403h3.208V9.25H4.208zM7.875 5.812a2.063 2.063 0 1 1-4.125 0a2.063 2.063 0 0 1 4.125 0" />
        </svg>
      ),
    },
    {
      name: "Facebook",
      href: "https://www.facebook.com/deluzexlighting",
      svg: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" clipRule="evenodd" d="M0 12.067C0 18.034 4.333 22.994 10 24v-8.667H7V12h3V9.333c0-3 1.933-4.666 4.667-4.666c.866 0 1.8.133 2.666.266V8H15.8c-1.467 0-1.8.733-1.8 1.667V12h3.2l-.533 3.333H14V24c5.667-1.006 10-5.966 10-11.933C24 5.43 18.6 0 12 0S0 5.43 0 12.067" />
        </svg>
      ),
    },
    {
      name: "Instagram",
      href: "https://www.instagram.com/deluzex_lighting",
      svg: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" clipRule="evenodd" d="M7.465 1.066C8.638 1.012 9.012 1 12 1s3.362.013 4.534.066s1.972.24 2.672.511c.733.277 1.398.71 1.948 1.27c.56.549.992 1.213 1.268 1.947c.272.7.458 1.5.512 2.67C22.988 8.639 23 9.013 23 12s-.013 3.362-.066 4.535c-.053 1.17-.24 1.97-.512 2.67a5.4 5.4 0 0 1-1.268 1.949c-.55.56-1.215.992-1.948 1.268c-.7.272-1.5.458-2.67.512c-1.174.054-1.548.066-4.536.066s-3.362-.013-4.535-.066c-1.17-.053-1.97-.24-2.67-.512a5.4 5.4 0 0 1-1.949-1.268a5.4 5.4 0 0 1-1.269-1.948c-.271-.7-.457-1.5-.511-2.67C1.012 15.361 1 14.987 1 12s.013-3.362.066-4.534s.24-1.972.511-2.672a5.4 5.4 0 0 1 1.27-1.948a5.4 5.4 0 0 1 1.947-1.269c.7-.271 1.5-.457 2.67-.511m8.98 1.98c-1.16-.053-1.508-.064-4.445-.064s-3.285.011-4.445.064c-1.073.049-1.655.228-2.043.379c-.513.2-.88.437-1.265.822a3.4 3.4 0 0 0-.822 1.265c-.151.388-.33.97-.379 2.043c-.053 1.16-.064 1.508-.064 4.445s.011 3.285.064 4.445c.049 1.073.228 1.655.379 2.043c.176.477.457.91.822 1.265c.355.365.788.646 1.265.822c.388.151.97.33 2.043.379c1.16.053 1.507.064 4.445.064s3.285-.011 4.445-.064c1.073-.049 1.655-.228 2.043-.379c.513-.2.88-.437 1.265-.822c.365-.355.646-.788.822-1.265c.151-.388.33-.97.379-2.043c.053-1.16.064-1.508.064-4.445s-.011-3.285-.064-4.445c-.049-1.073-.228-1.655-.379-2.043c-.2-.513-.437-.88-.822-1.265a3.4 3.4 0 0 0-1.265-.822c-.388-.151-.97-.33-2.043-.379m-5.85 12.345a3.669 3.669 0 0 0 4-5.986a3.67 3.67 0 1 0-4 5.986M8.002 8.002a5.654 5.654 0 1 1 7.996 7.996a5.654 5.654 0 0 1-7.996-7.996m10.906-.814a1.337 1.337 0 1 0-1.89-1.89a1.337 1.337 0 0 0 1.89 1.89" />
        </svg>
      ),
    },
    {
      name: "YouTube",
      href: "https://www.youtube.com/@deluzex",
      svg: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M23.5 6.507a2.8 2.8 0 0 0-.766-1.27a3.05 3.05 0 0 0-1.338-.742C19.518 4 11.994 4 11.994 4a77 77 0 0 0-9.39.47a3.16 3.16 0 0 0-1.338.76c-.37.356-.638.795-.778 1.276A29 29 0 0 0 0 12c-.012 1.841.151 3.68.488 5.494c.137.479.404.916.775 1.269s.833.608 1.341.743c1.903.494 9.39.494 9.39.494a77 77 0 0 0 9.402-.47a3.05 3.05 0 0 0 1.338-.742a2.8 2.8 0 0 0 .765-1.27A28.4 28.4 0 0 0 24 12.023a26.6 26.6 0 0 0-.5-5.517M9.602 15.424V8.577l6.26 3.424z" />
        </svg>
      ),
    },
    {
      name: "Pinterest",
      href: "https://in.pinterest.com/deluzex_lighting/",
      svg: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" clipRule="evenodd" d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345-.09.375-.291 1.199-.332 1.357-.053.225-.177.273-.408.165-1.519-.706-2.467-2.923-2.467-4.707 0-3.834 2.786-7.356 8.034-7.356 4.218 0 7.496 3.007 7.496 7.024 0 4.193-2.643 7.567-6.31 7.567-1.232 0-2.39-.64-2.787-1.399l-.759 2.895c-.274 1.054-1.018 2.375-1.517 3.188 1.127.348 2.327.537 3.57.537 6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z" />
        </svg>
      ),
    },
  ];

  return (
    <div className={styles.pageWrapper} data-coming-soon="true">
      {/* Background Layers */}
      <div className={`${styles.bgLayer} ${styles.bgDesktop}`} aria-hidden="true" />
      <div className={`${styles.bgLayer} ${styles.bgMobile}`} aria-hidden="true" />
      <div className={styles.mobileOverlay} aria-hidden="true" />

      {/* Top Left Black Pill Logo Badge */}
      <Link href="/" className={styles.logoBadge} aria-label="Deluzex Lighting Home">
        <Image
          src="/images/logos/De Luzex_white_logo.svg"
          alt="de luzex"
          width={148}
          height={34}
          priority
          className={styles.logoImg}
        />
      </Link>

      {/* Desktop Top Right Social Icons */}
      <nav className={styles.socialDesktop} aria-label="Social Media Links">
        {socialIcons.map((icon) => (
          <a
            key={icon.name}
            href={icon.href}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.socialLink}
            aria-label={icon.name}
          >
            {icon.svg}
          </a>
        ))}
      </nav>

      {/* Main Hero Content */}
      <main className={styles.mainContent}>
        <div className={styles.contentBlock}>
          {/* Cursive Subtitle */}
          <p className={styles.scriptSubtitle}>
            something beautiful is on the way
          </p>

          {/* Heading */}
          <h1 className={styles.mainTitle}>
            We&apos;re Coming Soon
          </h1>

          {/* Descriptions */}
          <div className={styles.descriptionWrapper}>
            <p className={styles.descText}>
              Find Beautiful Lights For Your Home, Office, Hotel, And Other Spaces. Explore Chandeliers, Wall Lights, Ceiling Lights, Lamps, And More.
            </p>
            <p className={styles.descText}>
              And For Architects &amp; Lighting Designers Something Special Is Coming Your Way Too. Stay Tuned...
            </p>
          </div>

          {/* Email Notification Form */}
          <form className={styles.notifyForm} onSubmit={handleSubmit} noValidate>
            <input
              type="email"
              className={styles.emailInput}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => {
                if (email.trim() && !isValidEmail(email)) {
                  showToast("Please enter a valid email address (e.g. name@example.com).");
                }
              }}
              placeholder="Enter your email address"
              required
              autoComplete="email"
              aria-label="Email address for notification updates"
            />
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting}
            >
              {btnText}
            </button>
          </form>

          {/* Feature Badges Row */}
          <div className={styles.featuresRow}>
            {/* 1. Modern Designs */}
            <div className={styles.featureItem}>
              <div className={styles.iconCircle} aria-hidden="true">
                <svg width="22" height="22" viewBox="0 -960 960 960" fill="#5F4013" aria-hidden="true">
                  <path d="M480-160q-56 0-105.5-17.5T284-227l-56 55q-11 11-28 11t-28-11q-11-11-11-28t11-28l55-55q-32-41-49.5-91T160-480q0-134 93-227t227-93h320v320q0 134-93 227t-227 93Zm0-80q100 0 170-70t70-170v-240H480q-100 0-170 70t-70 170q0 39 12 74.5t33 64.5l207-207q11-11 28-11t28 11q12 12 12 28.5T548-491L341-284q29 21 64.5 32.5T480-240Zm0-240Z" />
                </svg>
              </div>
              <span className={styles.featureLabel}>Modern Designs</span>
            </div>

            <div className={styles.dividerLine} aria-hidden="true" />

            {/* 2. Premium Quality */}
            <div className={styles.featureItem}>
              <div className={styles.iconCircle} aria-hidden="true">
                <svg width="22" height="22" viewBox="0 -960 960 960" fill="#5F4013" aria-hidden="true">
                  <path d="M480-120 80-600l120-240h560l120 240-400 480Zm-95-520h190l-60-120h-70l-60 120Zm55 347v-267H218l222 267Zm80 0 222-267H520v267Zm144-347h106l-60-120H604l60 120Zm-474 0h106l60-120H250l-60 120Z" />
                </svg>
              </div>
              <span className={styles.featureLabel}>Premium Quality</span>
            </div>

            <div className={styles.dividerLine} aria-hidden="true" />

            {/* 3. For Everspace */}
            <div className={styles.featureItem}>
              <div className={styles.iconCircle} aria-hidden="true">
                <svg width="22" height="22" viewBox="0 -960 960 960" fill="#5F4013" aria-hidden="true">
                  <path d="M517-518 347-688l57-56 113 113 227-226 56 56-283 283ZM280-220l278 76 238-74q-5-9-14.5-15.5T760-240H558q-27 0-43-2t-33-8l-93-31 22-78 81 27q17 5 40 8t68 4q0-11-6.5-21T578-354l-234-86h-64v220ZM40-80v-440h304q7 0 14 1.5t13 3.5l235 87q33 12 53.5 42t20.5 66h80q50 0 85 33t35 87v40L560-60l-280-78v58H40Zm80-80h80v-280h-80v280Z" />
                </svg>
              </div>
              <span className={styles.featureLabel}>For Everspace</span>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile & Tablet Bottom Social Icons */}
      <nav
        className={styles.socialMobile}
        aria-label="Mobile Social Media Links"
        data-coming-soon-social="true"
      >
        {socialIcons.map((icon) => (
          <a
            key={icon.name}
            href={icon.href}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.socialLink}
            aria-label={icon.name}
          >
            {icon.svg}
          </a>
        ))}
      </nav>

      {/* Feedback Toast */}
      <div
        className={`${styles.toastMessage} ${
          isToastActive ? styles.toastActive : ""
        }`}
        role="status"
        aria-live="polite"
      >
        <span>✨</span>
        <span>{toastMessage}</span>
      </div>
    </div>
  );
}
