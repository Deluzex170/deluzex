"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./overview.module.css";
import { fetchDashboardSummary, DashboardSummaryResponse } from "../services/api";

export default function AdminOverview() {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchDashboardSummary();
      setSummary(data);
    } catch (err) {
      console.error("Failed to load dashboard summary:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>
            Executive <span className={styles.goldAccent}>Overview</span>
          </h1>
          <p className={styles.subtitle}>
            Real-time business performance, customer orders, inventory health, and operational tasks.
          </p>
        </div>

        <button className={styles.refreshBtn} onClick={loadData} disabled={loading}>
          <span>↻</span> {loading ? "Refreshing..." : "Refresh Live Data"}
        </button>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        {/* Gross Revenue */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTopRow}>
            <span className={styles.kpiLabel}>Total Store Revenue</span>
            <span className={styles.kpiIcon}>✦</span>
          </div>
          <div className={styles.kpiValue}>
            <span className={styles.goldVal}>
              ₹{(summary?.revenue.total || 0).toLocaleString("en-IN")}
            </span>
          </div>
          <div className={styles.kpiFootnote}>
            Cumulative across {summary?.revenue.orders_count || 0} customer orders
          </div>
        </div>

        {/* Orders Pipeline */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTopRow}>
            <span className={styles.kpiLabel}>Orders Pipeline</span>
            <span className={styles.kpiIcon}>📦</span>
          </div>
          <div className={styles.kpiValue}>
            <span style={{ color: "#4ade80" }}>{summary?.revenue.pending_orders || 0}</span>
            <span style={{ fontSize: "1.1rem", color: "#888", fontWeight: 400 }}> active</span>
          </div>
          <div className={styles.kpiFootnote}>
            {summary?.revenue.delivered_orders || 0} orders delivered successfully
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTopRow}>
            <span className={styles.kpiLabel}>Inventory Health</span>
            <span className={styles.kpiIcon}>⚠️</span>
          </div>
          <div className={styles.kpiValue}>
            <span style={{ color: (summary?.inventory.low_stock_count || 0) > 0 ? "#f87171" : "#4ade80" }}>
              {summary?.inventory.low_stock_count || 0}
            </span>
            <span style={{ fontSize: "1.1rem", color: "#888", fontWeight: 400 }}> low stock</span>
          </div>
          <div className={styles.kpiFootnote}>
            {summary?.inventory.out_of_stock_count || 0} items completely out of stock
          </div>
        </div>

        {/* Audience & Operations */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTopRow}>
            <span className={styles.kpiLabel}>Audience & VIPs</span>
            <span className={styles.kpiIcon}>👥</span>
          </div>
          <div className={styles.kpiValue}>
            {summary?.operations.total_customers || 0}
            <span style={{ fontSize: "1.1rem", color: "#888", fontWeight: 400 }}> clients</span>
          </div>
          <div className={styles.kpiFootnote}>
            {summary?.operations.newsletter_subscribers || 0} newsletter subscribers
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className={styles.quickNavSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Operations Center</h2>
        </div>
        <div className={styles.quickNavGrid}>
          <Link href="/admin/orders" className={styles.navCard}>
            <div className={styles.navCardTitle}>Orders Dispatch</div>
            <div className={styles.navCardDesc}>Track statuses, payments & shipments</div>
          </Link>
          <Link href="/admin/products" className={styles.navCard}>
            <div className={styles.navCardTitle}>Products & Stock</div>
            <div className={styles.navCardDesc}>Manage luxury catalog, pricing & stock</div>
          </Link>
          <Link href="/admin/inquiries" className={styles.navCard}>
            <div className={styles.navCardTitle}>Client Inquiries</div>
            <div className={styles.navCardDesc}>Consultation requests & bespoke briefs</div>
          </Link>
          <Link href="/admin/reviews" className={styles.navCard}>
            <div className={styles.navCardTitle}>Reviews Moderation</div>
            <div className={styles.navCardDesc}>Approve ratings & storefront testimonials</div>
          </Link>
          <Link href="/admin/customers" className={styles.navCard}>
            <div className={styles.navCardTitle}>Customer Directory</div>
            <div className={styles.navCardDesc}>Customer lifetime spend & profiles</div>
          </Link>
          <Link href="/admin/newsletter" className={styles.navCard}>
            <div className={styles.navCardTitle}>Newsletter Audience</div>
            <div className={styles.navCardDesc}>VIP launch list & CSV download</div>
          </Link>
        </div>
      </div>

      {/* Dual Feed: Recent Orders & Operational Alerts */}
      <div className={styles.dualFeedGrid}>
        {/* Left: Recent Orders */}
        <div className={styles.feedCard}>
          <div className={styles.feedCardHeader}>
            <h3 style={{ margin: 0, fontSize: "1.05rem", color: "#fff" }}>Recent Orders</h3>
            <Link href="/admin/orders" className={styles.viewAllLink}>
              View All Orders →
            </Link>
          </div>

          <div>
            {loading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#777" }}>
                Loading recent orders...
              </div>
            ) : (summary?.revenue.recent_orders.length || 0) === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#777" }}>
                No orders recorded yet.
              </div>
            ) : (
              summary?.revenue.recent_orders.map((ord) => (
                <div key={ord.id} className={styles.orderRow}>
                  <div>
                    <div className={styles.orderNum}>{ord.order_number}</div>
                    <div className={styles.orderCust}>
                      {ord.customer_name} · {new Date(ord.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className={styles.orderRight}>
                    <div className={styles.orderAmount}>
                      ₹{ord.total_amount.toLocaleString("en-IN")}
                    </div>
                    <span
                      className={`${styles.statusBadge} ${
                        ord.status === "delivered" || ord.status === "paid"
                          ? styles.statusPaid
                          : styles.statusPending
                      }`}
                    >
                      {ord.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Operational Attention & Low Stock */}
        <div className={styles.feedCard}>
          <div className={styles.feedCardHeader}>
            <h3 style={{ margin: 0, fontSize: "1.05rem", color: "#fff" }}>
              Action Required
            </h3>
          </div>

          {/* Operational Links with pending badges */}
          <Link href="/admin/inquiries" className={styles.opAlertCard}>
            <div>
              <div className={styles.opAlertTitle}>Pending Inquiries</div>
              <div className={styles.opAlertSubtitle}>New consultation requests awaiting reply</div>
            </div>
            <span className={styles.opBadge}>
              {summary?.operations.pending_inquiries || 0}
            </span>
          </Link>

          <Link href="/admin/reviews" className={styles.opAlertCard}>
            <div>
              <div className={styles.opAlertTitle}>Pending Reviews</div>
              <div className={styles.opAlertSubtitle}>Customer ratings needing approval</div>
            </div>
            <span className={styles.opBadge}>
              {summary?.operations.pending_reviews || 0}
            </span>
          </Link>

          {/* Low Stock Watchlist */}
          <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid #222" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#aaa", textTransform: "uppercase" }}>
                Low Stock Watchlist
              </span>
              <Link href="/admin/products" className={styles.viewAllLink}>
                Catalog →
              </Link>
            </div>

            {(summary?.inventory.low_stock_items.length || 0) === 0 ? (
              <div style={{ color: "#4ade80", fontSize: "0.85rem", padding: "0.5rem 0" }}>
                ✓ All products currently have healthy inventory.
              </div>
            ) : (
              summary?.inventory.low_stock_items.map((it) => (
                <div key={it.id} className={styles.stockRow}>
                  <span className={styles.stockName}>{it.name}</span>
                  <span
                    className={`${styles.stockCountBadge} ${
                      it.stock <= 0 ? styles.stockCritical : styles.stockWarning
                    }`}
                  >
                    {it.stock <= 0 ? "Out of Stock" : `${it.stock} remaining`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
