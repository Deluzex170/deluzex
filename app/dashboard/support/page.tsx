"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./support.module.css";
import { fetchFaqs } from "../../services/api";

const TOPICS = [
  {
    title: "Orders & Tracking",
    desc: "Track dispatch, logistics partners, and courier milestones",
    href: "/dashboard/orders",
    icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  },
  {
    title: "Addresses & Delivery",
    desc: "Manage saved shipping destinations and billing locations",
    href: "/dashboard/address",
    icon: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
  },
  {
    title: "Wishlist & Curation",
    desc: "Review your curated architectural lighting favorites",
    href: "/dashboard/wishlist",
    icon: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
  },
];

export default function SupportPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>([]);
  const [faqsLoading, setFaqsLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchFaqs("support")
      .then((data) => {
        if (data && data.length > 0) {
          setFaqs(data);
        } else {
          setFaqs([]);
        }
      })
      .catch((err) => {
        console.error("Error loading support FAQs:", err);
        setFaqs([]);
      })
      .finally(() => {
        setFaqsLoading(false);
      });
  }, []);

  const handleSubmitInquiry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setToastMsg("Please fill in subject and message.");
      setTimeout(() => setToastMsg(null), 3000);
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubject("");
      setMessage("");
      setToastMsg("Inquiry received! Our concierge team will reach out within 2 hours.");
      setTimeout(() => setToastMsg(null), 4000);
    }, 700);
  };

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Support &amp; Concierge</h1>
        <p className={styles.subtitle}>
          Dedicated architectural assistance for order dispatch, luminaire inquiries, and account care.
        </p>
      </div>

      {/* Quick Navigation Topics (3 Equal Columns) */}
      <div className={styles.topicsGrid}>
        {TOPICS.map((topic, i) => (
          <Link key={i} href={topic.href} className={styles.topicCard}>
            <div className={styles.topicHeader}>
              <div className={styles.topicIconWrapper}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d={topic.icon} />
                </svg>
              </div>
              <div className={styles.arrowIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
            <h3 className={styles.topicTitle}>{topic.title}</h3>
            <p className={styles.topicDesc}>{topic.desc}</p>
          </Link>
        ))}
      </div>

      {/* Direct Contact Channels */}
      <div className={styles.contactChannels}>
        <a
          href="https://wa.me/919982791722?text=Hello%20Deluzex%20Concierge,%20I%20need%20support%20with%20my%20account"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.channelCard}
        >
          <div className={styles.channelIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </div>
          <div className={styles.channelInfo}>
            <div className={styles.channelTitle}>WhatsApp Concierge</div>
            <div className={styles.channelValue}>+91 99827 91722</div>
          </div>
          <span className={styles.channelAction}>Chat Now →</span>
        </a>

        <a href="mailto:support@deluzexlighting.com" className={styles.channelCard}>
          <div className={styles.channelIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C49A45" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <div className={styles.channelInfo}>
            <div className={styles.channelTitle}>Email Desk</div>
            <div className={styles.channelValue}>support@deluzexlighting.com</div>
          </div>
          <span className={styles.channelAction}>Send Email →</span>
        </a>

        <Link href="/contact" className={styles.channelCard}>
          <div className={styles.channelIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div className={styles.channelInfo}>
            <div className={styles.channelTitle}>Studio Showroom</div>
            <div className={styles.channelValue}>Visit Design Gallery</div>
          </div>
          <span className={styles.channelAction}>View Studio →</span>
        </Link>
      </div>

      {/* Two-Column: FAQ Accordion + Quick Inquiry Form */}
      <div className={styles.twoColSection}>
        {/* FAQ Accordion */}
        <div className={styles.faqSection}>
          <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
          <div className={styles.faqList}>
            {faqsLoading ? (
              [1, 2, 3].map((n) => (
                <div
                  key={n}
                  style={{
                    height: "52px",
                    borderRadius: "8px",
                    background: "var(--theme-surface-muted, #f8f6f3)",
                    border: "1px solid var(--theme-border, #E8E0D8)",
                    marginBottom: "10px",
                    opacity: 0.6,
                  }}
                />
              ))
            ) : faqs.length > 0 ? (
              faqs.map((faq, i) => (
                <div key={i} className={`${styles.faqItem} ${openFaq === i ? styles.faqOpen : ""}`}>
                  <button
                    type="button"
                    className={styles.faqHeader}
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <span className={styles.faqQuestion}>{faq.question || (faq as any).q}</span>
                    <span className={styles.faqToggleIcon}>{openFaq === i ? "−" : "+"}</span>
                  </button>
                  {openFaq === i && (
                    <div className={styles.faqBody}>
                      <p>{faq.answer || (faq as any).a}</p>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p style={{ color: "var(--text-muted, #78716c)", fontSize: "0.9rem", padding: "1rem 0" }}>
                No support FAQs currently listed.
              </p>
            )}
          </div>
        </div>

        {/* Quick Inquiry Form */}
        <div className={styles.inquiryCard}>
          <h2 className={styles.sectionTitle}>Submit Direct Inquiry</h2>
          <p className={styles.inquirySubtitle}>
            Have a custom lighting question? Send our technical team a message.
          </p>
          <form onSubmit={handleSubmitInquiry} className={styles.inquiryForm}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Subject *</label>
              <input
                type="text"
                placeholder="e.g. Chandelier Installation / Order Query"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                className={styles.input}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Message *</label>
              <textarea
                placeholder="Describe your inquiry or order requirements..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={4}
                className={styles.textarea}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className={styles.btnSubmit}
            >
              {isSubmitting ? "Sending..." : "Submit Inquiry"}
            </button>
          </form>
        </div>
      </div>

      {/* Toast Feedback */}
      {toastMsg && (
        <div className={styles.toast}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C49A45" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
