"use client";

import styles from "./contact.module.css";
import { useState, useEffect } from "react";
import { submitContactForm, fetchSiteContent } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function Contact() {
  const { isAuthenticated, openLoginModal, user } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    projectType: "Luxury Residential Villa",
    message: ""
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    fetchSiteContent("site_settings").then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      const defaultName = (user as any)?.name || `${(user as any)?.first_name || ""} ${(user as any)?.last_name || ""}`.trim();
      const defaultEmail = (user as any)?.email || "";
      const defaultPhone = (user as any)?.phone || "";
      setFormData((prev) => ({
        ...prev,
        name: prev.name || defaultName,
        email: prev.email || defaultEmail,
        phone: prev.phone || defaultPhone,
      }));
    }
  }, [user]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      openLoginModal(undefined, "Please sign in to send an inquiry or message to our studio team.");
      return;
    }
    setStatus("loading");
    setErrorMessage("");

    const fullMessage = formData.projectType
      ? `[Project Scope: ${formData.projectType}]\n\n${formData.message}`
      : formData.message;

    try {
      await submitContactForm({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        message: fullMessage,
      });
      setStatus("success");
      setFormData({
        name: "",
        email: "",
        phone: "",
        projectType: "Luxury Residential Villa",
        message: "",
      });
    } catch (error: unknown) {
      setStatus("error");
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else if (typeof error === "string") {
        setErrorMessage(error);
      } else {
        setErrorMessage("Something went wrong. Please try again or contact us directly.");
      }
    }
  };

  const phoneNum = settings?.phone || "+91 85116 82031";
  const emailAddr = settings?.email || "info@deluzexlighting.com";
  const addressText = settings?.address || "Chhapi, Gujarat, India";

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        {/* 2-COLUMN CONTACT GRID */}
        <section className={styles.contactGrid}>
          {/* LEFT COLUMN: INFORMATION & EDITORIAL COPY */}
          <div className={styles.leftCol}>
            <p className={styles.signatureText}>signature lighting collection</p>
            <h1 className={styles.title}>We&apos;d Love To Hear From You</h1>

            <div className={styles.inquiryList}>
              <p className={styles.inquiryItem}>Looking for the perfect lighting solution?</p>
              <p className={styles.inquiryItem}>Planning a residential or commercial project?</p>
              <p className={styles.inquiryItem}>Need a custom lighting design?</p>
              <p className={styles.inquiryItem}>Want expert guidance before making a purchase?</p>
            </div>

            <p className={styles.visionText}>
              Whether you&apos;re designing a luxury residence, hotel, restaurant, or workspace, our team is here to help bring your vision to life.
            </p>

            <p className={styles.responseNote}>
              Get in touch with us and we&apos;ll respond within 24 hours.
            </p>

            {/* DIRECT CONTACT INFO ITEMS */}
            <div className={styles.contactInfoList}>
              <a href={`tel:${phoneNum.replace(/\s+/g, "")}`} className={styles.contactInfoItem} title="Call Deluzex">
                <svg className={styles.contactIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <span>{phoneNum}</span>
              </a>

              <a href={`mailto:${emailAddr}`} className={styles.contactInfoItem} title="Email Deluzex">
                <svg className={styles.contactIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <span>{emailAddr}</span>
              </a>

              <div className={styles.contactInfoItem}>
                <svg className={styles.contactIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>{addressText}</span>
              </div>
            </div>

            {/* SOCIAL ICONS */}
            <div className={styles.socialList}>
              <a
                href={
                  settings?.social_links?.whatsapp
                    ? (settings.social_links.whatsapp.startsWith("http")
                      ? settings.social_links.whatsapp
                      : `https://wa.me/${settings.social_links.whatsapp.replace(/\D/g, "")}`)
                    : `https://wa.me/${phoneNum.replace(/\D/g, "") || "918511682031"}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialLink}
                aria-label="WhatsApp"
                title="Chat on WhatsApp"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>

              <a
                href={settings?.social_links?.linkedin || "https://linkedin.com/"}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialLink}
                aria-label="LinkedIn"
                title="Deluzex on LinkedIn"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              </a>

              <a
                href={settings?.social_links?.twitter || "https://twitter.com/"}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialLink}
                aria-label="Twitter"
                title="Deluzex on Twitter"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
                </svg>
              </a>

              <a
                href={settings?.social_links?.facebook || "https://facebook.com/"}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialLink}
                aria-label="Facebook"
                title="Deluzex on Facebook"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95C18.05 21.45 22 17.19 22 12z" />
                </svg>
              </a>
            </div>
          </div>

          {/* RIGHT COLUMN: FLOATING FORM CARD */}
          <div className={styles.formCard}>
            <form className={styles.contactForm} onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Name</label>
                <input
                  type="text"
                  name="name"
                  placeholder="Enter your name"
                  className={styles.formInput}
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Email*</label>
                <input
                  type="email"
                  name="email"
                  placeholder="Enter your mail"
                  className={styles.formInput}
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Phone</label>
                <input
                  type="tel"
                  name="phone"
                  placeholder="Enter your Number"
                  className={styles.formInput}
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Placeholder</label>
                <textarea
                  name="message"
                  placeholder="Placeholder"
                  className={styles.formTextarea}
                  rows={3}
                  value={formData.message}
                  onChange={handleChange}
                  required
                />
              </div>

              {status === "error" && (
                <div className={styles.alertError}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{errorMessage}</span>
                </div>
              )}

              {status === "success" && (
                <div className={styles.alertSuccess}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <span>Thank you. Your message has been received. We will respond within 24 hours.</span>
                </div>
              )}

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={status === "loading"}
              >
                {status === "loading" ? "Submitting..." : "Submit"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
