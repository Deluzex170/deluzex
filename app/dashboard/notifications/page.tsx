"use client";

import React, { useState } from "react";
import Link from "next/link";
import styles from "./notifications.module.css";

interface NotificationItem {
  id: string;
  category: "orders" | "offers" | "system";
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  statusBadge?: {
    label: string;
    type: "success" | "warning" | "gold" | "info";
  };
  action?: {
    label: string;
    href: string;
  };
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-1",
    category: "orders",
    title: "Order Delivered Successfully",
    message: "Your Aurora Crystal Chandelier has been delivered safely by white-glove courier.",
    timestamp: "10 mins ago",
    isRead: false,
    statusBadge: { label: "Delivered", type: "success" },
    action: { label: "View Order", href: "/dashboard/orders" },
  },
  {
    id: "notif-2",
    category: "orders",
    title: "Shipment In Transit",
    message: "Order #DLX-2610-8A7E is out for delivery with our priority logistics partner.",
    timestamp: "2 hours ago",
    isRead: false,
    statusBadge: { label: "In Transit", type: "warning" },
    action: { label: "Track Shipment", href: "/dashboard/orders" },
  },
  {
    id: "notif-3",
    category: "offers",
    title: "Exclusive Collector's Privilege",
    message: "Enjoy 15% VIP architectural privilege on newly curated chandeliers. Code: DELUXEVIP.",
    timestamp: "1 day ago",
    isRead: true,
    statusBadge: { label: "VIP Offer", type: "gold" },
    action: { label: "Explore Collection", href: "/shop" },
  },
  {
    id: "notif-4",
    category: "system",
    title: "Profile Security Verified",
    message: "Your primary phone number and authentication credentials were verified successfully.",
    timestamp: "3 days ago",
    isRead: true,
    statusBadge: { label: "Security", type: "info" },
  },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [activeTab, setActiveTab] = useState<"all" | "orders" | "offers" | "system">("all");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    showToast("All notifications marked as read");
  };

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear all notifications?")) {
      setNotifications([]);
      showToast("All notifications cleared");
    }
  };

  const handleDismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleToggleRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: !n.isRead } : n))
    );
  };

  const filteredList = notifications.filter((n) => {
    if (activeTab === "all") return true;
    return n.category === activeTab;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Notifications</h1>
            {unreadCount > 0 && (
              <span className={styles.unreadPill}>{unreadCount} new</span>
            )}
          </div>
          <p className={styles.subtitle}>
            Real-time updates regarding your architectural lighting orders, deliveries, and private offers.
          </p>
        </div>

        {/* Global Toolbar Actions */}
        <div className={styles.headerActions}>
          {unreadCount > 0 && (
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleMarkAllRead}
              title="Mark all notifications as read"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Mark all read</span>
            </button>
          )}
          {notifications.length > 0 && (
            <button
              type="button"
              className={styles.btnClear}
              onClick={handleClearAll}
              title="Clear all notifications"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Main Card with Tabs & List */}
      <div className={styles.mainCard}>
        {/* Filter Navigation Tabs */}
        <div className={styles.filterToolbar}>
          <div className={styles.filterTabs}>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === "all" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("all")}
            >
              All <span>({notifications.length})</span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === "orders" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("orders")}
            >
              Orders <span>({notifications.filter((n) => n.category === "orders").length})</span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === "offers" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("offers")}
            >
              Offers <span>({notifications.filter((n) => n.category === "offers").length})</span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === "system" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("system")}
            >
              System <span>({notifications.filter((n) => n.category === "system").length})</span>
            </button>
          </div>
        </div>

        {/* Notifications List */}
        {filteredList.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C49A45" strokeWidth="1.5">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <h3 className={styles.emptyTitle}>You're all caught up</h3>
            <p className={styles.emptySubtitle}>
              There are no {activeTab !== "all" ? activeTab : ""} notifications at this time.
            </p>
          </div>
        ) : (
          <div className={styles.list}>
            {filteredList.map((item) => (
              <div
                key={item.id}
                className={`${styles.item} ${!item.isRead ? styles.itemUnread : ""}`}
                onClick={() => handleToggleRead(item.id)}
              >
                {/* Category Icon */}
                <div className={`${styles.iconWrap} ${styles[`icon_${item.category}`]}`}>
                  {item.category === "orders" ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                      <line x1="12" y1="22.08" x2="12" y2="12" />
                    </svg>
                  ) : item.category === "offers" ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                      <line x1="7" y1="7" x2="7.01" y2="7" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  )}
                </div>

                {/* Content Details */}
                <div className={styles.content}>
                  <div className={styles.itemHeader}>
                    <div className={styles.titleGroup}>
                      <h3 className={styles.itemTitle}>{item.title}</h3>
                      {item.statusBadge && (
                        <span className={`${styles.badge} ${styles[`badge_${item.statusBadge.type}`]}`}>
                          {item.statusBadge.label}
                        </span>
                      )}
                    </div>
                    <span className={styles.timestamp}>{item.timestamp}</span>
                  </div>

                  <p className={styles.itemMessage}>{item.message}</p>

                  <div className={styles.itemFooter} onClick={(e) => e.stopPropagation()}>
                    {item.action && (
                      <Link href={item.action.href} className={styles.actionLink}>
                        <span>{item.action.label}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </Link>
                    )}
                    <button
                      type="button"
                      className={styles.btnDismiss}
                      onClick={() => handleDismiss(item.id)}
                      title="Dismiss this notification"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preferences / Settings Card */}
      <div className={styles.preferencesCard}>
        <div className={styles.prefIcon}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C49A45" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </div>
        <div className={styles.prefText}>
          <div className={styles.prefTitle}>Notification Channels &amp; Preferences</div>
          <div className={styles.prefSubtitle}>
            Customise how you receive shipment tracking, WhatsApp order dispatch alerts, and VIP catalogue updates.
          </div>
        </div>
        <Link href="/dashboard/profile" className={styles.prefBtn}>
          Configure Settings
        </Link>
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
