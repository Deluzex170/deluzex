import React from "react";
import Link from "next/link";
import styles from "../contact/contact.module.css";

export const metadata = {
  title: "Shipping & Delivery — DeLuzex Lighting",
  description: "Learn about DeLuzex luxury lighting delivery policies, pan-India timelines, and white-glove installation services.",
};

export default function ShippingPage() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <section style={{ maxWidth: "1000px", margin: "40px auto 80px", padding: "0 20px" }}>
          <h1 className={styles.title} style={{ textAlign: "center", marginBottom: "36px", fontSize: "2.8rem" }}>
            Shipping &amp; Delivery
          </h1>

          <div style={{ display: "flex", flexDirection: "column", gap: "28px", color: "#2B2B2B", lineHeight: "1.6", fontSize: "20px" }}>
            <div style={{ background: "#F5EFE6", padding: "28px 32px", borderRadius: "14px", border: "1px solid #E8D8C0" }}>
              <h3 style={{ fontFamily: "var(--font-libre), serif", fontSize: "26px", color: "#1C1917", margin: "0 0 10px", fontWeight: 600 }}>
                Pan-India Safe Transit Guarantee
              </h3>
              <p style={{ margin: 0, fontSize: "20px", lineHeight: "1.6", color: "#374151" }}>
                Every De Luzex luminaire is packaged in custom-engineered impact-resistant crating and temperature-shielded foam to ensure flawless delivery to your doorstep anywhere across India.
              </p>
            </div>

            <div>
              <h3 style={{ fontSize: "24px", color: "#1C1917", marginBottom: "10px", fontWeight: 600 }}>1. Delivery Timelines</h3>
              <p style={{ fontSize: "20px", margin: "0 0 10px", color: "#374151" }}>
                Standard residential and architectural orders are processed within 24 to 48 hours. Transit times vary depending on the destination:
              </p>
              <ul style={{ paddingLeft: "28px", margin: "0", fontSize: "20px", display: "flex", flexDirection: "column", gap: "8px", color: "#374151" }}>
                <li><strong>Metro Cities (Mumbai, Delhi NCR, Bengaluru, Hyderabad, Chennai, Kolkata):</strong> 3 to 5 business days.</li>
                <li><strong>Tier 2 &amp; Tier 3 Cities:</strong> 5 to 7 business days.</li>
                <li><strong>Bespoke / Custom Architectural Chandelier Commissions:</strong> 2 to 4 weeks production followed by priority express transit.</li>
              </ul>
            </div>

            <div>
              <h3 style={{ fontSize: "24px", color: "#1C1917", marginBottom: "10px", fontWeight: 600 }}>2. Shipping Charges</h3>
              <p style={{ fontSize: "20px", margin: 0, color: "#374151" }}>
                We offer complimentary insured shipping on orders above ₹5,000. For orders below this threshold, a flat delivery fee of ₹99 is applied at checkout.
              </p>
            </div>

            <div>
              <h3 style={{ fontSize: "24px", color: "#1C1917", marginBottom: "10px", fontWeight: 600 }}>3. White-Glove Installation &amp; Handling</h3>
              <p style={{ fontSize: "20px", margin: 0, color: "#374151" }}>
                For our flagship chandeliers and statement suspended fixtures, DeLuzex provides certified installation technicians in select metro areas upon request. Contact our concierge team via our <Link href="/contact" style={{ color: "#C89B60", textDecoration: "underline", fontWeight: 500 }}>Contact Page</Link> to schedule an appointment.
              </p>
            </div>

            <div>
              <h3 style={{ fontSize: "24px", color: "#1C1917", marginBottom: "10px", fontWeight: 600 }}>4. Order Tracking &amp; Transit Damage</h3>
              <p style={{ fontSize: "20px", margin: 0, color: "#374151" }}>
                Once dispatched, you will receive real-time tracking details via SMS and email. In the rare event of transit damage, inspect your parcel upon arrival and contact us within 48 hours for an immediate complimentary replacement.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
