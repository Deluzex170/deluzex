import React from "react";
import Link from "next/link";
import styles from "../contact/contact.module.css";

export const metadata = {
  title: "Privacy Policy — DeLuzex Lighting",
  description: "Privacy Policy and data protection terms for DeLuzex luxury architectural lighting.",
};

export default function PrivacyPage() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <section style={{ maxWidth: "1000px", margin: "40px auto 80px", padding: "0 20px" }}>
          <h1 className={styles.title} style={{ textAlign: "center", marginBottom: "36px", fontSize: "2.8rem" }}>
            Privacy Policy
          </h1>

          <div style={{ display: "flex", flexDirection: "column", gap: "28px", color: "#2B2B2B", lineHeight: "1.6", fontSize: "20px" }}>
            <p style={{ fontSize: "20px", margin: 0, color: "#374151" }}>
              At DeLuzex, we respect your privacy and are committed to protecting any personal information you share with us. This Privacy Policy outlines our data handling practices for visitors, clients, and commercial partners.
            </p>

            <div>
              <h3 style={{ fontSize: "24px", color: "#1C1917", marginBottom: "10px", fontWeight: 600 }}>1. Information We Collect</h3>
              <p style={{ fontSize: "20px", margin: 0, color: "#374151" }}>
                When you purchase lighting luminaires, request design consultations, or subscribe to our updates, we collect essential details such as your name, delivery address, phone number, email address, and transaction specifics. Payment card data is processed directly via encrypted PCI-DSS certified gateways (Razorpay / Stripe) and is never retained on our servers.
              </p>
            </div>

            <div>
              <h3 style={{ fontSize: "24px", color: "#1C1917", marginBottom: "10px", fontWeight: 600 }}>2. How We Use Your Information</h3>
              <ul style={{ paddingLeft: "28px", margin: "10px 0 0", fontSize: "20px", display: "flex", flexDirection: "column", gap: "8px", color: "#374151" }}>
                <li>Processing and delivering luminaire orders to your project sites.</li>
                <li>Providing dedicated order tracking and after-sales warranty support.</li>
                <li>Sending curated updates about new architectural collections, strictly when opted in.</li>
                <li>Enhancing website browsing performance, security, and checkout flow.</li>
              </ul>
            </div>

            <div>
              <h3 style={{ fontSize: "24px", color: "#1C1917", marginBottom: "10px", fontWeight: 600 }}>3. Data Protection &amp; Confidentiality</h3>
              <p style={{ fontSize: "20px", margin: 0, color: "#374151" }}>
                We do not sell, rent, or trade your personal data to any third-party advertisers. Information is only shared with verified logistics carriers and certified technicians solely to execute delivery and installation.
              </p>
            </div>

            <div>
              <h3 style={{ fontSize: "24px", color: "#1C1917", marginBottom: "10px", fontWeight: 600 }}>4. Contact Our Privacy Team</h3>
              <p style={{ fontSize: "20px", margin: 0, color: "#374151" }}>
                If you have any questions regarding your personal information or wish to modify your preferences, please reach out through our <Link href="/contact" style={{ color: "#C89B60", textDecoration: "underline", fontWeight: 500 }}>Contact Page</Link> or email us at <strong>concierge@deluzexlighting.com</strong>.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
