"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Header.module.css";
import { useDispatch, useSelector } from "react-redux";
import { openCart } from "../store/cartSlice";
import { useSidebar } from "../context/SidebarContext";
import { useEffect, useState, useRef, useMemo } from "react";
import { RootState } from "../store/store";
import Image from "next/image";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { useWishlist } from "../context/WishlistContext";

const NAV_ITEMS = [
  { name: "Home", href: "/" },
  { name: "Shop", href: "/shop" },
  { name: "Projects", href: "/projects" },
  { name: "Collaborate", href: "/collaborate" },
  { name: "About", href: "/about" },
  { name: "Contact", href: "/contact" },
  { name: "Blogs", href: "/blogs" },
];

const HERO_ROUTES = ["/", "/shop", "/projects", "/about", "/blogs"];

interface HeaderProps {
  hasBackgroundImage?: boolean;
}

export default function Header({ hasBackgroundImage: propHasBg }: HeaderProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch();
  const { sidebarOpen, toggleSidebar } = useSidebar();
  const { isAuthenticated, user, openLoginModal } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { cartItems } = useSelector((state: RootState) => state.cart);
  const { wishlistCount } = useWishlist();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Dynamically determine if the current page has a background hero image
  const pageHasBg = useMemo(() => {
    if (typeof propHasBg === "boolean") return propHasBg;
    if (!pathname) return false;
    if (HERO_ROUTES.includes(pathname)) return true;
    if (pathname.startsWith("/blogs/") || pathname.startsWith("/projects/")) return true;
    return false;
  }, [pathname, propHasBg]);

  // Reset scroll and recheck scroll state on pathname change
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.location.hash) {
        // If navigating to an anchor hash (like #submission-form), don't force reset to top
        const id = window.location.hash.replace("#", "");
        setTimeout(() => {
          const el = document.getElementById(id);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 80);
        return;
      }
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      setScrolled(false);
    }
  }, [pathname]);

  // Track scroll position to trigger State 1 -> State 2 transition
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 60);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

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

  const isExcludedPage =
    pathname?.startsWith("/admin") ||
    pathname?.includes("/login") ||
    pathname?.includes("/signup") ||
    pathname?.includes("/signin");
  if (isExcludedPage) return null;

  const isItemActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/collaborate") {
      return pathname === "/collaborate" || pathname.startsWith("/collaborate/");
    }
    if (href === "/shop") {
      return (
        pathname === "/shop" ||
        pathname.startsWith("/shop/") ||
        pathname.startsWith("/product/") ||
        pathname.startsWith("/categories")
      );
    }
    if (href === "/blogs") {
      return pathname === "/blogs" || pathname.startsWith("/blogs/");
    }
    if (href === "/projects") {
      return pathname === "/projects" || pathname.startsWith("/projects/");
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  const handleNavClick = (_e: React.MouseEvent<HTMLAnchorElement>, _href: string) => {
    // Normal client routing
  };

  const isState1 = pageHasBg && !scrolled;
  const headerClass = isState1 ? styles.headerState1 : styles.headerState2;

  return (
    <header className={`${styles.header} ${headerClass}`}>
      <div className={styles.logoRow}>
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
              src="/images/logos/de_luzex_black.svg"
              alt="De Luzex"
              height="36"
              width="130"
              className={styles.logoBlack}
            />
            <img
              src="/images/logos/de_luzex_white.svg"
              alt="De Luzex"
              height="36"
              width="130"
              className={styles.logoWhite}
            />
          </Link>
        </div>
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const active = isItemActive(item.href);
          const cutoutMaskPath =
            "M 0,46 C 14,46 20,36 22,24 C 24,12 30,0 44,0 L 116,0 C 130,0 136,12 138,24 C 140,36 146,46 160,46 L 160,100 L 0,100 Z";
          const solidTabPath =
            "M 0,46 C 14,46 20,36 22,24 C 24,12 30,0 44,0 L 116,0 C 130,0 136,12 138,24 C 140,36 146,46 160,46 L 160,52 L 0,52 Z";
          const maskId = `tab-cutout-mask-${item.name}`;

          if (active) {
            return (
              <Link
                key={item.name}
                href={item.href}
                className={styles.activeTab}
              >
                <span className={styles.tabLabel}>{item.name}</span>
                <div className={styles.tabBgWrapper}>
                  {isState1 ? (
                    <svg
                      viewBox="0 0 160 46"
                      className={styles.tabCutoutSvg}
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <mask id={maskId}>
                          <rect x="-3000" y="-1000" width="6000" height="3000" fill="#ffffff" />
                          <path d={cutoutMaskPath} fill="#000000" />
                        </mask>
                      </defs>
                      <rect
                        x="-3000"
                        y="-1000"
                        width="6000"
                        height="3000"
                        fill="#F8F1EA"
                        mask={`url(#${maskId})`}
                      />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 160 46"
                      className={styles.tabSolidSvg}
                      preserveAspectRatio="none"
                    >
                      <path d={solidTabPath} fill="#F8F1EA" />
                    </svg>
                  )}
                </div>
              </Link>
            );
          }
          return (
            <Link
              key={item.name}
              href={item.href}
              className={styles.navLink}
              onClick={(e) => handleNavClick(e, item.href)}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className={styles.headerIcons}>
        <div className={styles.searchWrapper}>
          {searchOpen && (
            <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search lamps, chandeliers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
              <button
                type="button"
                className={styles.searchCloseBtn}
                onClick={() => {
                  setSearchOpen(false);
                  setSearchQuery("");
                }}
                title="Close search"
                aria-label="Close search"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </form>
          )}
          <button
            className={styles.iconBtn}
            type="button"
            onClick={() => {
              if (searchOpen && searchQuery.trim()) {
                handleSearchSubmit({ preventDefault: () => { } } as any);
              } else {
                setSearchOpen(!searchOpen);
              }
            }}
            aria-label="Search"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 21L15 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className={styles.cartIconWrapper}>
          <Link
            href={isAuthenticated ? "/dashboard/wishlist" : "/wishlist"}
            className={styles.iconBtn}
            aria-label="Wishlist"
            title="My Wishlist"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          {mounted && wishlistCount > 0 && (
            <span className={styles.cartBadge}>{wishlistCount}</span>
          )}
        </div>

        <Link
          href="/dashboard/wishlist"
          className={styles.iconBtn}
          aria-label="Wishlist"
          title="Wishlist"
          onClick={(e) => {
            // Wishlist lives in the account area, so prompt guests to sign in in place
            if (!isAuthenticated) {
              e.preventDefault();
              openLoginModal(undefined, "Sign in to view and save items to your wishlist.");
            }
          }}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </Link>

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
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="6" cy="19" r="2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="17" cy="19" r="2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M17 17H6V3H4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 5L20 6L19 13H6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className={styles.cartBadge}>{mounted && cartItems.length > 0 ? cartItems.length : "0"}</span>
        </div>
      </div>
    </header>
  );
}
