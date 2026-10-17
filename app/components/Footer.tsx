"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./Footer.module.css";
import { subscribeNewsletter, fetchSiteContent } from "../services/api";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [settings, setSettings] = useState<any>(null);

  React.useEffect(() => {
    fetchSiteContent("site_settings").then(setSettings).catch(() => { });
  }, []);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const res = await subscribeNewsletter(cleanEmail);
      if (res.success) {
        setStatus("success");
        setMessage(res.message);
        setEmail("");
        setTimeout(() => {
          setStatus("idle");
          setMessage("");
        }, 5000);
      } else {
        setStatus("error");
        setMessage(res.message);
      }
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <footer className={styles.footer}>
      {/* Top border golden line */}
      <div className={styles.footerTopBorder}></div>

      <div className={styles.footerInner}>
        {/* Left column */}
        <div className={styles.footerLeft}>
          <p className={styles.footerLeftLabel}>Available On</p>
          <div className={styles.footerLogos}>
            {/* Amazon logo */}
            <a
              href={settings?.available_on?.amazon || "https://www.amazon.in"}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.footerLogoItem}
              aria-label="Shop Deluzex on Amazon"
              title="Shop Deluzex on Amazon"
            >
              <Image
                src="/images/logos/amazon.svg"
                alt="Amazon"
                width={48}
                height={48}
                className={styles.footerLogoImg}
              />
            </a>

            {/* Flipkart logo */}
            <a
              href={settings?.available_on?.flipkart || "https://www.flipkart.com"}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.footerLogoItem}
              aria-label="Shop Deluzex on Flipkart"
              title="Shop Deluzex on Flipkart"
            >
              <Image
                src="/images/logos/flip.svg"
                alt="Flipkart"
                width={48}
                height={48}
                className={styles.footerLogoImg}
              />
            </a>
          </div>

          <p className={styles.footerDesc}>Luxury lighting solutions, thoughtfully crafted<br />for modern interiors.</p>


          {/* Social icons */}
          <div className={styles.socialIcons}>
            <a
              href={
                settings?.social_links?.whatsapp
                  ? (settings.social_links.whatsapp.startsWith("http")
                    ? settings.social_links.whatsapp
                    : `https://wa.me/${settings.social_links.whatsapp.replace(/\D/g, "")}`)
                  : "https://wa.me/918511682031"
              }
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialIcon}
              aria-label="WhatsApp"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </a>
            <a href={settings?.social_links?.linkedin || "https://linkedin.com/"} target="_blank" rel="noopener noreferrer" className={styles.socialIcon} aria-label="LinkedIn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" /><circle cx="4" cy="4" r="2" />
              </svg>
            </a>
            <a href={settings?.social_links?.twitter || "https://twitter.com/"} target="_blank" rel="noopener noreferrer" className={styles.socialIcon} aria-label="Twitter">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
              </svg>
            </a>
            <a href={settings?.social_links?.facebook || "https://facebook.com/"} target="_blank" rel="noopener noreferrer" className={styles.socialIcon} aria-label="Facebook">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </a>
            <a href={settings?.social_links?.instagram || "https://instagram.com/"} target="_blank" rel="noopener noreferrer" className={styles.socialIcon} aria-label="Instagram">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </a>
            <a href={settings?.social_links?.youtube || "https://youtube.com/"} target="_blank" rel="noopener noreferrer" className={styles.socialIcon} aria-label="YouTube">
              <svg width="22" height="17" viewBox="0 0 141.35 102.74" fill="currentColor" fillRule="evenodd" clipRule="evenodd">
                <path d="M40.78 12.29c15.62,-0.99 32.18,-0.98 48.3,-0.59 7.81,0.18 15.58,0.42 23.61,1.18 8.62,0.81 12.77,1.24 15.05,9.5 2.94,10.64 2.55,34.25 1.63,46.29 -1.72,22.57 -6.7,20.79 -28.1,21.9 -16.24,0.84 -32.61,0.88 -48.9,0.46 -12.3,-0.31 -35.15,2.46 -38.71,-10.67 -2.88,-10.64 -2.61,-34.52 -1.59,-46.8 1.88,-22.8 8.17,-19.97 28.71,-21.27zm-9.69 -10.77c-22.56,2 -28.27,8.28 -30.24,30.45 -1.26,14.13 -1.72,42.63 3.04,54.94 6.2,16.05 27.25,14.9 45.25,15.44 19.58,0.58 41.74,0.67 60.76,-0.86 22.52,-1.8 28.46,-7.72 30.57,-29.73 1.3,-13.45 1.83,-45.72 -3.25,-56.67 -7.06,-15.23 -26.63,-14.13 -46.03,-14.73 -19.9,-0.62 -40.74,-0.55 -60.1,1.16z" />
                <path d="M56.7 72.13l35.84 -20.76c-2.8,-2.97 -33.41,-19.86 -35.84,-21.03l0 41.79z" />
              </svg>
            </a>
            <a href={settings?.social_links?.pinterest || "https://pinterest.com/"} target="_blank" rel="noopener noreferrer" className={styles.socialIcon} aria-label="Pinterest">
              <svg width="20" height="20" viewBox="0 0 173.21 171.96" fill="currentColor" fillRule="evenodd" clipRule="evenodd">
                <path d="M50.58 106.14c-0.13,-0.09 -4.36,-5.04 -4.53,-5.3 -20.55,-31.91 23.72,-74.55 64.98,-53.42 42.04,21.54 12.46,99.87 -31.83,71.27l-15.29 49.62c40.69,13.39 90.96,-10.92 105.1,-58.33 31.64,-106.14 -124.62,-156.34 -163.23,-54.37 -19.27,50.89 12.99,96.71 47.42,109.24 4.72,-30.37 16.01,-52.67 14.41,-77.56 -1.46,-22.76 18.99,-25.35 21.26,-11.26 2.15,13.38 -12.09,24.75 -1.5,35.84 21.05,15 44.91,-46.54 10.38,-57.08 -16.13,-4.93 -30.03,1.93 -36.92,11.19 -14.76,19.84 1.75,27.89 -2.68,41.61l-7.57 -1.45z" />
              </svg>
            </a>
          </div>

          <hr className={styles.footerDivider} />
          <p className={styles.copyright}>{settings?.footer_copyright || "© 2026 DeLuzex. All rights reserved."}</p>
        </div>

        {/* Right column */}
        <div className={styles.footerRight}>
          {/* Newsletter */}
          <div className={styles.newsletterBlock}>
            <h4 className={styles.newsletterTitle}>Be Updated With Us</h4>
            <form className={styles.newsletterForm} onSubmit={handleSubscribe}>
              <div
                className={`${styles.newsletterInput} ${status === "error" ? styles.inputError : ""
                  } ${status === "success" ? styles.inputSuccess : ""}`}
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (status !== "idle") setStatus("idle");
                  }}
                  placeholder="Enter your email address"
                  aria-label="Email address for newsletter"
                  required
                />
                <button
                  type="submit"
                  className={styles.newsletterBtn}
                  disabled={status === "loading"}
                  aria-label="Subscribe to newsletter"
                >
                  {status === "loading" ? (
                    <span className={styles.spinner} />
                  ) : status === "success" ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  )}
                </button>
              </div>
              {message && (
                <p className={status === "success" ? styles.newsletterSuccess : styles.newsletterError}>
                  {message}
                </p>
              )}
            </form>
          </div>

          {/* Footer links */}
          <div className={styles.footerLinks}>
            <div className={styles.linkGroup}>
              <h5 className={styles.linkGroupTitle}>Explore</h5>
              <Link href="/shop?category=Chandeliers">Chandeliers</Link>
              <Link href="/shop?category=Pendant%20Lights">Pendant Lights</Link>
              <Link href="/shop?category=Wall%20Lights">Wall Lights</Link>
              <Link href="/shop?category=Table%20Lamps">Table Lamps</Link>
              <Link href="/shop?sort=newest">New Arrivals</Link>
              <Link href="/shop?sort=popular">Best Sellers</Link>
            </div>
            <div className={styles.linkGroup}>
              <h5 className={styles.linkGroupTitle}>Company</h5>
              <Link href="/about">About Us</Link>
              <Link href="/projects">Our Projects</Link>
              <Link href="/contact">Contact</Link>
              <Link href="/shipping">Shipping &amp; Delivery</Link>
              <Link href="/privacy">Privacy Policy</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

