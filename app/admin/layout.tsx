"use client";
import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import styles from "./admin.module.css";
import { useAuth } from "../context/AuthContext";
import { useSidebar } from "../context/SidebarContext";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-admin-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-admin-mono",
  display: "swap",
});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, isAuthenticated, isAdmin, loading } = useAuth();
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const [confirmLogout, setConfirmLogout] = React.useState(false);
  const [theme, setTheme] = React.useState<"dark" | "light">("dark");
  // Desktop-only icon rail; remembered per browser like the theme
  const [railCollapsed, setRailCollapsed] = React.useState(false);

  const isLoginPage = pathname === "/admin/login";

  React.useEffect(() => {
    const savedTheme = localStorage.getItem("admin_theme") as "dark" | "light" | null;
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }
  }, []);

  React.useEffect(() => {
    try {
      if (localStorage.getItem("admin_sidebar_rail") === "1") setRailCollapsed(true);
    } catch {
      // storage unavailable: keep the expanded default
    }
  }, []);

  const toggleRail = () => {
    setRailCollapsed((prev) => {
      try {
        localStorage.setItem("admin_sidebar_rail", prev ? "0" : "1");
      } catch {
        // storage unavailable: the toggle still works for this visit
      }
      return !prev;
    });
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("admin_theme", nextTheme);
  };

  React.useEffect(() => {
    document.body.style.paddingTop = "0px";
    return () => {
      document.body.style.paddingTop = "";
    };
  }, []);

  // The sidebar state is shared with the storefront, so always enter the admin with the drawer closed
  React.useEffect(() => {
    setSidebarOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Let Escape close the mobile/tablet drawer
  React.useEffect(() => {
    if (!sidebarOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen, setSidebarOpen]);

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
      group: "Operations",
      items: [
        { name: "Overview", path: "/admin", icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
        { name: "Orders Dispatch", path: "/admin/orders", icon: "M16 11V7a4 4 0 0 0-8 0v4M5 9h14l1 12H4L5 9z" },
        { name: "Shipping & Delivery", path: "/admin/shipping-settings", icon: "M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" },
        { name: "Products", path: "/admin/products", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
        { name: "Categories", path: "/admin/categories", icon: "M4 6h16M4 12h16M4 18h16" },
        { name: "Hero Showcase", path: "/admin/hero-products", icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" },
        { name: "Customers", path: "/admin/customers", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" },
        { name: "Bespoke Submissions", path: "/admin/collaborations", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
      ]
    },
    {
      group: "Marketing & Relations",
      items: [
        { name: "Coupons & Offers", path: "/admin/coupons", icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" },
        { name: "Reviews Moderation", path: "/admin/reviews", icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" },
        { name: "Client Inquiries", path: "/admin/inquiries", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
        { name: "Newsletter", path: "/admin/newsletter", icon: "M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1m2 13a2 2 0 0 1-2-2V7m2 13a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" },
        { name: "Email Templates", path: "/admin/email-templates", icon: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6" },
      ]
    },
    {
      group: "Editorial & Content",
      items: [
        { name: "Website Content", path: "/admin/content", icon: "M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5zm0 8a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6zm10 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-6z" },
        { name: "Architectural Projects", path: "/admin/projects", icon: "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z" },
        { name: "Journal & Blogs", path: "/admin/blogs", icon: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15z" },
        { name: "Client Stories", path: "/admin/testimonials", icon: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" },
        { name: "FAQs Knowledge", path: "/admin/faqs", icon: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
      ]
    },
    {
      group: "Intelligence & Security",
      items: [
        { name: "Visitor Analytics", path: "/admin/analytics", icon: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" },
        { name: "Security Audit Logs", path: "/admin/audit-logs", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M12 8v4l3 3" },
        { name: "API Reference", path: "/admin/docs", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" }
      ]
    }
  ];

  const isItemActive = (path: string) => pathname === path || (path !== "/admin" && pathname.startsWith(path));
  const activeItemName =
    menuItems.flatMap((group) => group.items).find((item) => isItemActive(item.path))?.name || "Admin";

  const logoSrc = theme === "light" ? "/images/logos/de_luzex_black.svg" : "/images/logos/de_luzex_white.svg";

  return (
    <div className={`${styles.adminRoot} ${plusJakarta.variable} ${jetbrainsMono.variable} ${plusJakarta.className}`} data-admin-root data-theme={theme}>
      <div className={styles.dashboardContainer} data-drawer-open={sidebarOpen ? "true" : undefined}>
        {/* Sidebar: full width on desktop (or a 64px rail), off-canvas drawer below 1025px */}
        <aside
          id="admin-sidebar"
          className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarCollapsed} ${railCollapsed ? styles.sidebarRail : ""}`}
          aria-label="Admin navigation"
        >
          <div className={styles.sidebarBrand}>
            <Link href="/admin" title="De Luzex Admin">
              <img src={logoSrc} alt="De Luzex" />
            </Link>
            {/* Drawer close button (hidden on desktop via CSS) */}
            <button
              type="button"
              className={styles.drawerCloseBtn}
              onClick={() => setSidebarOpen(false)}
              aria-label="Close navigation menu"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <nav className={styles.sidebarInner}>
            {menuItems.map((group, idx) => (
              <div key={idx} className={styles.menuGroup}>
                <h4 className={styles.groupTitle}>{group.group}</h4>
                <ul className={styles.menuList}>
                  {group.items.map((item, i) => {
                    const isActive = isItemActive(item.path);
                    return (
                      <li key={i}>
                        <Link
                          href={item.path}
                          prefetch={false}
                          title={item.name}
                          aria-current={isActive ? "page" : undefined}
                          className={`${styles.menuLink} ${isActive ? styles.activeLink : ""}`}
                          onClick={() => setSidebarOpen(false)}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
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

            <div className={styles.sidebarFooter}>
              <button
                type="button"
                className={styles.themeToggleBtn}
                onClick={toggleTheme}
                title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {theme === "dark" ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="5" />
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
                <span className={styles.menuLinkText}>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
                <span className={styles.themePill}>{theme === "dark" ? "DARK" : "LIGHT"}</span>
              </button>
              {confirmLogout ? (
                <div className={styles.logoutConfirm}>
                  <div className={styles.logoutConfirmTitle}>Confirm sign out?</div>
                  <div className={styles.logoutConfirmActions}>
                    <button type="button" className={styles.logoutConfirmPrimary} onClick={handleLogout}>
                      Logout
                    </button>
                    <button type="button" onClick={() => setConfirmLogout(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className={styles.logoutBtn} onClick={() => setConfirmLogout(true)} title="Sign Out">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9" />
                  </svg>
                  <span className={styles.menuLinkText}>Sign Out</span>
                </button>
              )}
            </div>
          </nav>
        </aside>

        {/* Mobile/tablet backdrop for the sidebar drawer (hidden on desktop via CSS) */}
        {sidebarOpen && (
          <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />
        )}

        <div className={styles.mainWrapper}>
          <header className={styles.topBar}>
            <div className={styles.topBarLeft}>
              <button
                type="button"
                className={styles.mobileMenuBtn}
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label="Open navigation menu"
                aria-controls="admin-sidebar"
                aria-expanded={sidebarOpen}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>
              <button
                type="button"
                className={styles.collapseBtn}
                onClick={toggleRail}
                aria-label={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-controls="admin-sidebar"
                aria-expanded={!railCollapsed}
                title={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <line x1="9" y1="4" x2="9" y2="20" />
                </svg>
              </button>
              <span className={styles.topBarTitle}>{activeItemName}</span>
            </div>
            <div className={styles.topBarRight}>
              <Link href="/" target="_blank" rel="noopener noreferrer" className={styles.storefrontLink} title="Open the live storefront in a new tab">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                <span className={styles.storefrontLinkText}>View Storefront</span>
              </Link>
            </div>
          </header>
          <main className={styles.mainContent}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
