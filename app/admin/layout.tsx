"use client";
import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "./admin.module.css";
import { useAuth } from "../context/AuthContext";
import { useSidebar } from "../context/SidebarContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, isAuthenticated, isAdmin, loading } = useAuth();
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const [confirmLogout, setConfirmLogout] = React.useState(false);

  const isLoginPage = pathname === "/admin/login";

  React.useEffect(() => {
    document.body.style.paddingTop = "0px";
    return () => {
      document.body.style.paddingTop = "";
    };
  }, []);

  React.useEffect(() => {
    if (!loading && !isLoginPage) {
      if (!isAuthenticated) {
        router.push(`/admin/login?redirect=${encodeURIComponent(pathname)}`);
      } else if (!isAdmin) {
        router.push("/");
      }
    }
  }, [loading, isAuthenticated, isAdmin, pathname, router, isLoginPage]);

  const handleLogout = () => {
    logout();
    setConfirmLogout(false);
    router.push("/admin/login");
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading || !isAuthenticated || !isAdmin) {
    return (
      <div style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0B0B0B",
        color: "#C49A45",
        fontFamily: "inherit"
      }}>
        <div style={{
          width: "40px",
          height: "40px",
          border: "3px solid rgba(196, 154, 69, 0.2)",
          borderTopColor: "#C49A45",
          borderRadius: "50%",
          animation: "adminSpin 1s linear infinite"
        }} />
        <style dangerouslySetInnerHTML={{ __html: `@keyframes adminSpin { to { transform: rotate(360deg); } }` }} />
        <p style={{ marginTop: "1.25rem", fontSize: "0.95rem", color: "#E0E0E0", letterSpacing: "0.05em" }}>
          Verifying administrator privileges...
        </p>
      </div>
    );
  }

  const menuItems = [
    {
      group: "Admin Control",
      items: [
        { name: "Overview", path: "/admin", icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
        { name: "Visitor Analytics", path: "/admin/analytics", icon: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" },
        { name: "Audit Logs", path: "/admin/audit-logs", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M12 8v4l3 3" },
        { name: "Hero Products", path: "/admin/hero-products", icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" },
        { name: "Products", path: "/admin/products", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
        { name: "Categories", path: "/admin/categories", icon: "M4 6h16M4 12h16M4 18h16" },
        { name: "Projects", path: "/admin/projects", icon: "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z" },
        { name: "Blogs", path: "/admin/blogs", icon: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15z" },
        { name: "Website Content", path: "/admin/content", icon: "M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5zm0 8a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6zm10 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-6z" },
        { name: "Customer Stories", path: "/admin/testimonials", icon: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" },
        { name: "Inquiries", path: "/admin/inquiries", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" }
      ]
    }
  ];

  return (
    <div className={styles.adminRoot} data-admin-root>
      <div className={styles.dashboardContainer}>
        {/* Sidebar */}
        <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarCollapsed}`}>
          <div className={styles.sidebarInner}>
            <div style={{ padding: "1.25rem 1.5rem 1rem 1.5rem", borderBottom: "1px solid rgba(0, 0, 0, 0.08)", marginBottom: "0.75rem" }}>
              <Link href="/" title="Storefront" style={{ display: "flex", alignItems: "center" }}>
                <img src="/images/logos/de_luzex_black.svg" alt="De Luzex" height="32" style={{ height: "32px", width: "auto" }} />
              </Link>
            </div>

            {menuItems.map((group, idx) => (
              <div key={idx} className={styles.menuGroup}>
                <h4 className={styles.groupTitle}>{group.group}</h4>
                <ul className={styles.menuList}>
                  {group.items.map((item, i) => {
                    const isActive = pathname === item.path || (item.path !== '/admin' && pathname.startsWith(item.path));
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
              {confirmLogout ? (
                <div style={{ padding: "0.6rem 0.75rem", background: "rgba(220, 38, 38, 0.08)", border: "1px solid rgba(220, 38, 38, 0.2)", borderRadius: "8px", margin: "0.25rem 0.75rem" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#DC2626", marginBottom: "0.4rem" }}>
                    Confirm Sign Out?
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button
                      onClick={handleLogout}
                      style={{
                        flex: 1,
                        background: "#DC2626",
                        color: "#fff",
                        padding: "0.35rem 0.6rem",
                        borderRadius: "6px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Logout
                    </button>
                    <button
                      onClick={() => setConfirmLogout(false)}
                      style={{
                        background: "#fff",
                        color: "#64748b",
                        border: "1px solid #cbd5e1",
                        padding: "0.35rem 0.6rem",
                        borderRadius: "6px",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button className={styles.logoutBtn} onClick={() => setConfirmLogout(true)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9" />
                  </svg>
                  <span className={styles.menuLinkText}>Logout</span>
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Mobile Backdrop for sidebar drawer */}
        {sidebarOpen && (
          <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />
        )}

        <main className={styles.mainContent}>
          {children}
        </main>
      </div>
    </div>
  );
}

