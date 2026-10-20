"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./support.module.css";
import { fetchFaqs, FAQItem } from "../../services/api";

const DEFAULT_SUPPORT_FAQS = [
  { question: "How long does custom fixture manufacturing take?", answer: "Typically, bespoke or customized architectural pieces take 4-6 weeks to manufacture, electroplate, and inspect prior to white-glove dispatch." },
  { question: "Can I inspect orders and tracking status in real time?", answer: "Yes! Navigate to Track Orders in your dashboard to view your real-time processing and shipping milestones." },
  { question: "What is your warranty and returns coverage?", answer: "Every DeLuzex fixture comes backed by our 5-year structural warranty and 30-day architectural return policy." },
];

const TOPICS = [
  {
    title: "Orders & Shipping",
    desc: "Track dispatch, delivery updates, and courier details",
    href: "/dashboard/orders",
    icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  },
  {
    title: "Addresses & Delivery",
    desc: "Manage saved shipping addresses and default locations",
    href: "/dashboard/address",
    icon: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
  },
  {
    title: "Wishlist & Favorites",
    desc: "Review your curated architectural lighting selection",
    href: "/dashboard/wishlist",
    icon: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
  },
];

export default function Support() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>(DEFAULT_SUPPORT_FAQS);

  useEffect(() => {
    fetchFaqs("support")
      .then((data) => {
        if (data && data.length > 0) {
          setFaqs(data);
        }
      })
      .catch((err) => {
        console.error("Error loading support FAQs:", err);
      });
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Support & Help</h1>
        <p className={styles.subtitle}>Need assistance? We are here to help with your orders, products, and account.</p>
      </div>

      <div className={styles.topicsGrid}>
        {TOPICS.map((topic, i) => (
          <Link key={i} href={topic.href} className={styles.topicCard} style={{ textDecoration: "none", color: "inherit" }}>
            <div className={styles.topicIconWrapper}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d={topic.icon}></path>
              </svg>
            </div>
            <h3>{topic.title}</h3>
            <p>{topic.desc}</p>
            <div className={styles.arrowIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </div>
          </Link>
        ))}
      </div>

      <div className={styles.faqSection}>
        <h2 className={styles.faqTitle}>Frequently asked questions</h2>
        <div className={styles.faqList}>
          {faqs.map((faq, i) => (
            <div key={i} className={`${styles.faqItem} ${openFaq === i ? styles.faqOpen : ""}`}>
              <button className={styles.faqHeader} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <span className={styles.faqToggleIcon}>{openFaq === i ? "—" : "+"}</span>
                {faq.question || (faq as any).q}
              </button>
              {openFaq === i && (
                <div className={styles.faqBody}>
                  <p>{faq.answer || (faq as any).a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.contactBanner}>
        <div className={styles.bannerImage}>
          <Image src="/images/hero_bg_1784107713316.jpg" alt="Support" fill style={{ objectFit: "cover" }} />
        </div>
        <div className={styles.bannerContent}>
          <h3>Still Need Help</h3>
          <p>Our team is happy to assist you with any questions or concerns you may have.</p>
          <Link href="/contact" style={{ textDecoration: "none" }}>
            <button className={styles.btnContact} type="button">Contact Us</button>
          </Link>
        </div>
      </div>
    </div>
  );
}
