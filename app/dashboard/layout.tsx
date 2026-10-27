"use client";
import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "./dashboard.module.css";
import { useAuth } from "../context/AuthContext";
import { useSidebar } from "../context/SidebarContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, isAdmin, isAuthenticated, loading, openLoginModal } = useAuth();
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);

  React.useEffect(() => {
    if (!loading && !isAuthenticated) {
      openLoginModal(undefined, "Please sign in to access your user account and dashboard.");
      router.push("/");
    }
  }, [loading, isAuthenticated, openLoginModal, router]);

  const handleLogout = () => {
    logout();
    setShowLogoutModal(false);
    router.push("/");
  };

  if (loading) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280" }}>
        <p>Verifying access...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const adminMenuItems = isAdmin
    ? [
      {
        group: "Administration",
        items: [
          { name: "Admin Dashboard", path: "/admin", icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" }
        ]
      }
    ]
    : [];

  const menuItems = [
    ...adminMenuItems,
    {
      group: "My Account",
      items: [
        { name: "My Profile", path: "/dashboard/profile", icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
        // { name: "Overview", path: "/dashboard/overview", icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
        { name: "Orders", path: "/dashboard/orders", icon: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M15 2H9c-1.1 0-2 .9-2 2v2h10V4c0-1.1-.9-2-2-2z" },
        { name: "Wishlist", path: "/dashboard/wishlist", icon: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" },
        // { name: "Blog", path: "/dashboard/blogs", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" },
      ]
    },
    {
      group: "Support",
      items: [
        { name: "Notifications", path: "/dashboard/notifications", icon: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0" },
        { name: "Support & Help", path: "/dashboard/support", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
      ]
    }
  ];

  return (
    <div className={styles.dashboardContainer}>

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarCollapsed}`}>
        <div className={styles.sidebarInner}>
          <div style={{ padding: "1.25rem 1.25rem 0.75rem 1.25rem", borderBottom: "1px solid rgba(0,0,0,0.06)", marginBottom: "0.75rem" }}>
            <Link href="/" title="De Luzex Storefront" style={{ display: "flex", alignItems: "center" }}>
              <img src="/images/logos/de_luzex_black.svg" alt="De Luzex" height="30" style={{ height: "30px", width: "auto" }} />
            </Link>
          </div>

          {menuItems.map((group, idx) => (
            <div key={idx} className={styles.menuGroup}>
              <h4 className={styles.groupTitle}>{group.group}</h4>
              <ul className={styles.menuList}>
                {group.items.map((item, i) => {
                  const isActive = pathname.startsWith(item.path);
                  return (
                    <li key={i}>
                      <Link
                        href={item.path}
                        className={`${styles.menuLink} ${isActive ? styles.activeLink : ""}`}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d={item.icon} />
                        </svg>
                        <span className={styles.menuLinkText}>{item.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div className={styles.menuGroup}>
            <button className={styles.logoutBtn} onClick={() => setShowLogoutModal(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9" />
              </svg>
              <span className={styles.menuLinkText}>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay — closes sidebar when clicking outside */}
      {sidebarOpen && (
        <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />
      )}

      <main className={styles.mainContent}>
        {children}
      </main>

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalIconWrapper}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5c-1.1 0-2 .9-2 2v2 M8 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                <circle cx="20" cy="12" r="3" />
                <line x1="20" y1="9" x2="20" y2="15" />
                <line x1="17" y1="12" x2="23" y2="12" />
              </svg>
            </div>
            <h3>Logout</h3>
            <p>Are you sure you want to logout your account?</p>
            <div className={styles.modalActions}>
              <button className={styles.btnCancel} onClick={() => setShowLogoutModal(false)}>Cancel</button>
              <button className={styles.btnConfirmLogout} onClick={handleLogout}>Logout</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
