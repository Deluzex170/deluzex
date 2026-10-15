"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Header.module.css";
import { useDispatch, useSelector } from "react-redux";
import { openCart } from "../store/cartSlice";
import { useSidebar } from "../context/SidebarContext";
import { useEffect, useState, useRef } from "react";
import { RootState } from "../store/store";
import Image from "next/image";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch();
  const { sidebarOpen, toggleSidebar } = useSidebar();
  const { isAuthenticated, user, isAdmin } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { cartItems } = useSelector((state: RootState) => state.cart);

  useEffect(() => {
    setMounted(true);
  }, []);

  const userRecord = user as Record<string, any> | null;
  const localAvatar = mounted && typeof window !== "undefined" ? localStorage.getItem("user_avatar") : null;
  const avatarUrl =
    userRecord?.avatar_url ||
    userRecord?.avatar ||
    userRecord?.image_url ||
    userRecord?.image ||
    userRecord?.profile_image ||
    userRecord?.photo_url ||
    userRecord?.picture ||
    localAvatar;

  useEffect(() => {
    setAvatarError(false);
  }, [avatarUrl]);

  const firstName = userRecord?.first_name || (typeof userRecord?.name === "string" ? userRecord.name.split(" ")[0] : "");
  const lastName = userRecord?.last_name || (typeof userRecord?.name === "string" ? userRecord.name.split(" ").slice(1).join(" ") : "");
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || userRecord?.email || "My Profile";
  const initial = (firstName?.[0] || userRecord?.email?.[0] || "U").toUpperCase();

  const isHome = pathname === "/";

  // Listen to scroll only on home page
  useEffect(() => {
    if (!isHome) return;

    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  // On home: transparent → scrolled solid. On other pages: always solid.
  const headerClass = isHome
    ? scrolled
      ? styles.headerSolid
      : styles.headerTransparent
    : styles.headerSolid;

  const isExcludedPage =
    pathname?.startsWith("/admin") ||
    pathname?.includes("/login") ||
    pathname?.includes("/signup") ||
    pathname?.includes("/signin");
  if (isExcludedPage) return null;

  return (
    <header className={`${styles.header} ${headerClass}`}>

      <div className={styles.logoRow}>
        {/* Hamburger — visible on mobile/tablet */}
        <button
          className={styles.hamburgerBtn}
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          {sidebarOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>

        <div className={styles.logo}>
          <Link href="/" className={styles.logoLink} aria-label="De Luzex Lighting Home">
            <img
              src="/images/logos/de_luzex_white.svg"
              alt="De Luzex"
              height="38"
              width="130"
              className={styles.logoWhite}
            />
            <img
              src="/images/logos/de_luzex_black.svg"
              alt="De Luzex"
              height="38"
              width="130"
              className={styles.logoBlack}
            />
          </Link>
        </div>
      </div>

      <nav className={styles.nav}>
        <Link href="/">Lighting</Link>
        <Link href="/categories">Categories</Link>
        <Link href="/shop">Shop</Link>
        <Link href="/projects">Projects</Link>
        <Link href="/blogs">Blogs</Link>
        <Link href="/about">About</Link>
        <Link href="/contact">Contact</Link>
        {isAdmin && (
          <Link href="/admin" style={{ color: "#C49A45", fontWeight: 700, letterSpacing: "0.05em" }}>
            Admin
          </Link>
        )}
      </nav>

      <div className={styles.headerIcons}>
        {searchOpen && (
          <form onSubmit={handleSearchSubmit} style={{ display: "flex", alignItems: "center" }}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search lamps, chandeliers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: "rgba(255,255,255,0.9)",
                border: "1px solid #C49A45",
                borderRadius: "20px",
                padding: "0.35rem 0.85rem",
                fontSize: "0.85rem",
                color: "#111",
                outline: "none",
                width: "180px",
              }}
            />
          </form>
        )}
        <button
          className={styles.iconBtn}
          type="button"
          onClick={() => {
            if (searchOpen && searchQuery.trim()) {
              handleSearchSubmit({ preventDefault: () => {} } as any);
            } else {
              setSearchOpen(!searchOpen);
            }
          }}
          aria-label="Search"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>

        {mounted && isAuthenticated ? (
          <Link href="/dashboard/profile" className={styles.userIcon} aria-label={displayName}>
            {avatarUrl && !avatarError ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                width={28}
                height={28}
                unoptimized
                className={styles.userAvatar}
                onError={() => setAvatarError(true)}
              />
            ) : (
              <span className={styles.userInitials} title={displayName}>
                {initial}
              </span>
            )}
          </Link>
        ) : (
          <Link href="/login" className={styles.iconBtn} aria-label="Sign In / Login">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </Link>
        )}
        <div className={styles.cartIconWrapper}>
          <button className={styles.iconBtn} onClick={() => dispatch(openCart())} aria-label="Cart">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </button>
          <span className={styles.cartBadge}>{cartItems.length != 0 ? cartItems.length : "0"}</span>
        </div>
      </div>
    </header>
  );
}
