"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import { useAuth } from "../context/AuthContext";
import styles from "./MainSidebar.module.css";

export default function MainSidebar() {
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const { isAdmin } = useAuth();
  const pathname = usePathname();

  // Do not render on dashboard pages, because dashboard has its own sidebar
  if (pathname.startsWith("/dashboard")) return null;

  return (
    <>
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarCollapsed}`}>
        <div className={styles.sidebarHeader}>
          <Link href="/" onClick={() => setSidebarOpen(false)} className={styles.logo}>
            <img src="/images/logos/de_luzex_black.svg" alt="De Luzex" height="38" style={{ height: "38px", width: "auto" }} />
          </Link>
          <button className={styles.closeBtn} onClick={() => setSidebarOpen(false)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <nav className={styles.nav}>
          <Link href="/" onClick={() => setSidebarOpen(false)}>Home</Link>
          <Link href="/shop" onClick={() => setSidebarOpen(false)}>Shop</Link>
          <Link href="/projects" onClick={() => setSidebarOpen(false)}>Projects</Link>
          <Link href="/about" onClick={() => setSidebarOpen(false)}>About</Link>
          <Link href="/contact" onClick={() => setSidebarOpen(false)}>Contact</Link>
          <Link href="/blogs" onClick={() => setSidebarOpen(false)}>Blogs</Link>
        </nav>
      </aside>

      {sidebarOpen && (
        <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />
      )}
    </>
  );
}
