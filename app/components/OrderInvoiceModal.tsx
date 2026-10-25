"use client";

import React from "react";
import styles from "./OrderInvoiceModal.module.css";

export interface OrderInvoiceModalProps {
  order: any;
  onClose: () => void;
}

export default function OrderInvoiceModal({ order, onClose }: OrderInvoiceModalProps) {
  if (!order) return null;

  const orderNum = order.order_number || order.orderNumber || order.id || "ORD-0001";
  const orderDate = order.created_at || order.date
    ? new Date(order.created_at || order.date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN");

  const totalAmount = Number(order.total_amount || order.totalAmount || 0);

  // 18% GST calculation
  const subtotalWithoutTax = Math.round((totalAmount / 1.18) * 100) / 100;
  const totalTax = Math.round((totalAmount - subtotalWithoutTax) * 100) / 100;
  const cgst = Math.round((totalTax / 2) * 100) / 100;
  const sgst = Math.round((totalTax / 2) * 100) / 100;

  const items = Array.isArray(order.items) && order.items.length > 0 ? order.items : [];

  // Customer & Shipping Address extraction
  const custName =
    order.customer?.name ||
    order.customer_name ||
    `${order.shipping_address?.first_name || ""} ${order.shipping_address?.last_name || ""}`.trim() ||
    "Valued Patron";

  const custEmail = order.customer?.email || order.customer_email || order.user_email || "concierge@deluzex.com";
  const custPhone = order.customer?.phone || order.shipping_address?.phone || "—";

  const shipAddr = order.shipping_address || order.shippingAddress || {};
  const addressLine1 = shipAddr.address_line1 || shipAddr.street || shipAddr.address || "Bespoke Residence Delivery";
  const addressLine2 = shipAddr.address_line2 || shipAddr.apartment || "";
  const city = shipAddr.city || "Mumbai";
  const state = shipAddr.state || "Maharashtra";
  const pincode = shipAddr.postal_code || shipAddr.pincode || shipAddr.zip || "400001";

  const paymentMethod = order.payment_method || order.paymentMethod || "Online Payment (UPI / Cards)";
  const paymentStatus = (order.payment_status || order.status || "Paid").toUpperCase();

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        {/* Action Bar (Hidden on print) */}
        <div className={styles.modalActionBar}>
          <div className={styles.actionBarTitle}>
            <span>✦</span> Official Tax Invoice & GST Receipt
          </div>
          <div className={styles.actionBarButtons}>
            <button className={styles.printBtn} onClick={handlePrint}>
              <span>🖨</span> Print / Download PDF
            </button>
            <button className={styles.closeBtn} onClick={onClose}>
              ✕ Close
            </button>
          </div>
        </div>

        {/* Printable Sheet */}
        <div className={styles.invoiceSheet}>
          {/* Header */}
          <div className={styles.invHeader}>
            <div className={styles.atelierBrand}>
              <h1>De Luzex</h1>
              <div className={styles.atelierSub}>Luxury Luminaire Atelier</div>
              <div className={styles.atelierAddress}>
                <strong>De Luzex Living Pvt. Ltd.</strong><br />
                Level 14, Crest Tower, Bandra Kurla Complex<br />
                Mumbai, Maharashtra, 400051 India<br />
                GSTIN: <strong>27AABCD1234E1Z5</strong> · CIN: U74999MH2024PTC123456<br />
                Email: concierge@deluzex.com | Phone: +91 98765 43210
              </div>
            </div>

            <div className={styles.invBadgeBlock}>
              <div className={styles.invBadgeTitle}>Tax Invoice</div>
              <div className={styles.invMetaRow}>
                Invoice No: <strong>INV-2026-{orderNum}</strong>
              </div>
              <div className={styles.invMetaRow}>
                Invoice Date: <strong>{orderDate}</strong>
              </div>
              <div className={styles.invMetaRow}>
                Order Ref: <strong>#{orderNum}</strong>
              </div>
              <div className={styles.invMetaRow}>
                Payment Mode: <strong>{paymentMethod}</strong>
              </div>
              <div className={styles.invMetaRow}>
                Status: <strong style={{ color: "#16a34a" }}>{paymentStatus}</strong>
              </div>
              <div className={styles.invMetaRow}>
                Place of Supply: <strong>{state} (State Code: 27)</strong>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className={styles.detailsGrid}>
            <div>
              <div className={styles.detailColTitle}>Billed To (Client Details)</div>
              <div className={styles.clientName}>{custName}</div>
              <div className={styles.clientText}>
                Email: {custEmail}<br />
                Phone: {custPhone}<br />
                Client Type: Retail / Private Collector
              </div>
            </div>

            <div>
              <div className={styles.detailColTitle}>Shipped To (Destination)</div>
              <div className={styles.clientName}>{custName}</div>
              <div className={styles.clientText}>
                {addressLine1}{addressLine2 ? `, ${addressLine2}` : ""}<br />
                {city}, {state} - {pincode}<br />
                Country: India
              </div>
            </div>
          </div>

          {/* Items Table */}
          <table className={styles.itemsTable}>
            <thead>
              <tr>
                <th style={{ width: "40px" }}>#</th>
                <th>Item Description</th>
                <th style={{ width: "90px" }}>HSN/SAC</th>
                <th style={{ width: "60px", textAlign: "center" }}>Qty</th>
                <th style={{ width: "110px", textAlign: "right" }}>Unit Price</th>
                <th style={{ width: "80px", textAlign: "right" }}>GST Rate</th>
                <th style={{ width: "120px", textAlign: "right" }}>Total (INR)</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td>1</td>
                  <td>
                    <div className={styles.itemTitle}>Custom Bespoke Luminaire</div>
                    <div className={styles.itemSub}>Crafted brass architectural fitting</div>
                  </td>
                  <td>940510</td>
                  <td style={{ textAlign: "center" }}>1</td>
                  <td style={{ textAlign: "right" }}>₹{subtotalWithoutTax.toLocaleString("en-IN")}</td>
                  <td style={{ textAlign: "right" }}>18%</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>
                    ₹{totalAmount.toLocaleString("en-IN")}
                  </td>
                </tr>
              ) : (
                items.map((it: any, idx: number) => {
                  const qty = Number(it.quantity || it.qty || 1);
                  const itemTotal = Number(it.total || (it.price ? it.price * qty : totalAmount));
                  const itemUnit = Math.round((itemTotal / qty / 1.18) * 100) / 100;

                  return (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>
                        <div className={styles.itemTitle}>{it.product_name || it.title || "Luxury Luminaire"}</div>
                        {it.variant && <div className={styles.itemSub}>Variant: {it.variant}</div>}
                        {it.finish && <div className={styles.itemSub}>Finish: {it.finish}</div>}
                      </td>
                      <td>940510</td>
                      <td style={{ textAlign: "center" }}>{qty}</td>
                      <td style={{ textAlign: "right" }}>₹{itemUnit.toLocaleString("en-IN")}</td>
                      <td style={{ textAlign: "right" }}>18%</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        ₹{itemTotal.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Summary */}
          <div className={styles.summaryRow}>
            <table className={styles.summaryTable}>
              <tbody>
                <tr>
                  <td>Taxable Value:</td>
                  <td>₹{subtotalWithoutTax.toLocaleString("en-IN")}</td>
                </tr>
                <tr>
                  <td>CGST (9.0%):</td>
                  <td>₹{cgst.toLocaleString("en-IN")}</td>
                </tr>
                <tr>
                  <td>SGST (9.0%):</td>
                  <td>₹{sgst.toLocaleString("en-IN")}</td>
                </tr>
                <tr>
                  <td>Atelier White-Glove Shipping:</td>
                  <td style={{ color: "#16a34a" }}>COMPLIMENTARY</td>
                </tr>
                <tr className={styles.totalRow}>
                  <td>Grand Total (INR):</td>
                  <td>₹{totalAmount.toLocaleString("en-IN")}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Legal Footer */}
          <div className={styles.invoiceFooter}>
            <div>
              <div className={styles.termsTitle}>Declaration & Warranty Terms</div>
              <div className={styles.termsText}>
                We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
                All De Luzex luminaire fixtures include a 5-Year Atelier Structural Guarantee and Authenticity Certificate.
                <br />
                <em>This is a verified computer-generated document and does not require a physical seal.</em>
              </div>
            </div>

            <div className={styles.signArea}>
              <div className={styles.signCompany}>For De Luzex Living Pvt. Ltd.</div>
              <div className={styles.signLine}>Authorized Signatory</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
