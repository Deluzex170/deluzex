import React from "react";
import Link from "next/link";
import styles from "../contact/contact.module.css";

export const metadata = {
  title: "Terms & Conditions — DeLuzex Lighting",
  description: "Terms and conditions, bespoke collaboration agreement, and purchasing policies for DeLuzex luxury architectural lighting.",
};

export default function TermsPage() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <section style={{ maxWidth: "1000px", margin: "40px auto 80px", padding: "0 20px" }}>
          <h1 className={styles.title} style={{ textAlign: "center", marginBottom: "36px", fontSize: "2.8rem" }}>
            Terms &amp; Conditions
          </h1>

          <div style={{ display: "flex", flexDirection: "column", gap: "28px", color: "#2B2B2B", lineHeight: "1.6", fontSize: "20px" }}>
            <div style={{ background: "#F5EFE6", padding: "28px 32px", borderRadius: "14px", border: "1px solid #E8D8C0" }}>
              <h3 style={{ fontFamily: "var(--font-libre), serif", fontSize: "26px", color: "#1C1917", margin: "0 0 10px", fontWeight: 600 }}>
                Bespoke Collaboration &amp; Intellectual Property Protection
              </h3>
              <p style={{ margin: 0, fontSize: "20px", lineHeight: "1.6", color: "#374151" }}>
                When architects, interior designers, or clients submit original sketches, CAD drawings, blueprints, or custom lighting concepts via our Collaborate portal, DeLuzex treats all submitted materials under strict confidentiality. Your proprietary designs remain your intellectual property and will never be commercialized or replicated without explicit written consent.
              </p>
            </div>

            <p style={{ fontSize: "20px", margin: 0, color: "#374151" }}>
              Welcome to DeLuzex Lighting. By browsing our website, placing an order for luminaires, or submitting bespoke manufacturing inquiries, you agree to comply with and be bound by the following terms and conditions.
            </p>

            <div>
              <h3 style={{ fontSize: "24px", color: "#1C1917", marginBottom: "10px", fontWeight: 600 }}>1. Bespoke Custom Fabrications</h3>
              <ul style={{ paddingLeft: "28px", margin: "10px 0 0", fontSize: "20px", display: "flex", flexDirection: "column", gap: "8px", color: "#374151" }}>
                <li><strong>Design Review &amp; Quotations:</strong> Once a bespoke inquiry is submitted, our engineering team assesses technical feasibility and provides a formal fabrication quote with CAD validation.</li>
                <li><strong>Confidentiality Guarantee:</strong> All design assets, architectural specifications, and dimension sheets submitted by clients remain strictly private under our non-disclosure protocol.</li>
                <li><strong>Custom Production Timeline:</strong> Bespoke chandeliers and made-to-order architectural fixtures enter artisanal production only upon receipt of the agreed deposit or advance payment.</li>
              </ul>
            </div>

            <div>
              <h3 style={{ fontSize: "24px", color: "#1C1917", marginBottom: "10px", fontWeight: 600 }}>2. Orders &amp; Product Specifications</h3>
              <p style={{ fontSize: "20px", margin: 0, color: "#374151" }}>
                All standard catalogue orders are subject to acceptance and material availability. While we make every effort to display the authentic finishes (brushed brass, handblown crystal, architectural matte black) accurately, natural variations in artisan materials may occur and are inherent to luxury craftsmanship.
              </p>
            </div>

            <div>
              <h3 style={{ fontSize: "24px", color: "#1C1917", marginBottom: "10px", fontWeight: 600 }}>3. Pricing &amp; Payments</h3>
              <p style={{ fontSize: "20px", margin: 0, color: "#374151" }}>
                All prices listed are in Indian Rupees (INR) and are inclusive of applicable GST unless explicitly noted otherwise. Online payments are processed through encrypted, PCI-DSS compliant payment gateways. DeLuzex does not store credit card or bank login credentials on its servers.
              </p>
            </div>

            <div>
              <h3 style={{ fontSize: "24px", color: "#1C1917", marginBottom: "10px", fontWeight: 600 }}>4. Warranty &amp; Certified Craftsmanship</h3>
              <p style={{ fontSize: "20px", margin: 0, color: "#374151" }}>
                DeLuzex luminaires include a standard 2-year warranty covering manufacturing defects, internal LED driver integrity, and metallurgical structure under normal indoor operating conditions. The warranty does not cover damages arising from incorrect installation, voltage surges beyond specified operating thresholds, or unauthorized modifications.
              </p>
            </div>

            <div>
              <h3 style={{ fontSize: "24px", color: "#1C1917", marginBottom: "10px", fontWeight: 600 }}>5. Shipping &amp; Transit Protection</h3>
              <p style={{ fontSize: "20px", margin: 0, color: "#374151" }}>
                All shipments are insured and packaged in reinforced protective crates. For detailed pan-India delivery schedules and white-glove installation services, please consult our <Link href="/shipping" style={{ color: "#C89B60", textDecoration: "underline", fontWeight: 500 }}>Shipping &amp; Delivery Policy</Link>.
              </p>
            </div>

            <div>
              <h3 style={{ fontSize: "24px", color: "#1C1917", marginBottom: "10px", fontWeight: 600 }}>6. Privacy &amp; Data Security</h3>
              <p style={{ fontSize: "20px", margin: 0, color: "#374151" }}>
                Your personal and commercial details are protected in accordance with our <Link href="/privacy" style={{ color: "#C89B60", textDecoration: "underline", fontWeight: 500 }}>Privacy Policy</Link>. We never sell or share client design data with third-party advertisers.
              </p>
            </div>

            <div>
              <h3 style={{ fontSize: "24px", color: "#1C1917", marginBottom: "10px", fontWeight: 600 }}>7. Concierge &amp; Inquiries</h3>
              <p style={{ fontSize: "20px", margin: 0, color: "#374151" }}>
                For legal inquiries, contract documentation, or commercial partnership queries, please reach out via our <Link href="/contact" style={{ color: "#C89B60", textDecoration: "underline", fontWeight: 500 }}>Contact Page</Link> or email our executive team directly at <strong>concierge@deluzexlighting.com</strong>.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

