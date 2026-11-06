"use client";

import React, { useEffect, useState } from "react";
import styles from "./WishlistContent.module.css";
import { useDispatch } from "react-redux";
import { addToCart, openCart } from "../store/cartSlice";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWishlist } from "../context/WishlistContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { WishlistItem } from "../services/api";

function LampPlaceholder() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        aspectRatio: "1",
        background: "linear-gradient(135deg, #c5b49a 0%, #8a7560 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width="64" height="80" viewBox="0 0 64 80" fill="none">
        <line x1="32" y1="0" x2="32" y2="18" stroke="#d4c5a9" strokeWidth="2" />
        <ellipse cx="32" cy="20" rx="12" ry="4" fill="#b8a282" />
        <path d="M20 20 Q16 50 10 70 Q32 76 54 70 Q48 50 44 20 Z" fill="#c4a97a" />
        <ellipse cx="32" cy="70" rx="22" ry="5" fill="#b8a282" />
        <ellipse cx="32" cy="55" rx="12" ry="8" fill="rgba(255,240,200,0.3)" />
      </svg>
    </div>
  );
}

export default function WishlistContent() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, openLoginModal } = useAuth();
  const toast = useToast();

  const {
    wishlistItems: items,
    removeFromWishlist: globalRemove,
    refreshWishlist,
    isLoading: loading,
  } = useWishlist();

  const [search, setSearch] = useState("");
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const [isMovingAll, setIsMovingAll] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      refreshWishlist();
    }
  }, [isAuthenticated, refreshWishlist]);

  const removeItem = async (item: WishlistItem) => {
    const pId = item.product_id || item.id || item._id;
    const itemId = item.id || item._id;
    const title = item.product_title;
    if (!pId && !itemId) return;

    try {
      await globalRemove(pId || itemId || "", itemId, title);
      toast.info(`"${item.product_title}" removed from your wishlist.`);
    } catch (err) {
      console.error("Failed to remove item from wishlist:", err);
      toast.error("Failed to remove piece from wishlist.");
    }
  };

  const handleAddToCart = (item: WishlistItem) => {
    const pId = String(item.product_id || item.id || item._id || "");
    setAddingId(pId);
    const rawPrice = String(item.product_price).replace(/[^\d.]/g, "");
    dispatch(
      addToCart({
        id: item.product_id || item.id || item._id || String(Date.now()),
        _id: item.product_id || item.id || item._id || String(Date.now()),
        product_title: item.product_title,
        product_price: rawPrice || "0",
        product_main_image: item.product_image || "/images/lamp_modern_tall_1784107732736.jpg",
      })
    );
    dispatch(openCart());
    toast.success(`"${item.product_title}" added to your shopping bag.`);
    setTimeout(() => setAddingId(null), 600);
  };

  const handleMoveAllToCart = () => {
    if (isMovingAll || items.length === 0) return;
    setIsMovingAll(true);
    items.forEach((item) => {
      const rawPrice = String(item.product_price).replace(/[^\d.]/g, "");
      dispatch(
        addToCart({
          id: item.product_id || item.id || item._id || String(Date.now()),
          _id: item.product_id || item.id || item._id || String(Date.now()),
          product_title: item.product_title,
          product_price: rawPrice || "0",
          product_main_image: item.product_image || "/images/lamp_modern_tall_1784107732736.jpg",
        })
      );
    });
    dispatch(openCart());
    toast.success("All pieces moved to your shopping bag.");
    setTimeout(() => setIsMovingAll(false), 800);
  };

  // State 1: Authenticating / Checking Auth State
  if (authLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>My Wishlist</h1>
          <p className={styles.subtitle}>Your favourite lighting pieces, saved for you.</p>
        </div>
        <div className={styles.loadingState}>
          <svg className={styles.btnSpinner} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C49A45" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
          <span>Verifying authentication...</span>
        </div>
      </div>
    );
  }

  // State 2: Unauthenticated Visitor / Guest
  if (!isAuthenticated) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>My Wishlist</h1>
          <p className={styles.subtitle}>Your favourite lighting pieces, saved for you.</p>
        </div>

        <div className={styles.unauthCard}>
          <div className={styles.unauthIconWrapper} aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>

          <h2 className={styles.unauthTitle}>Sign In to View Your Wishlist</h2>
          <p className={styles.unauthSubtitle}>
            Save and curate your bespoke lighting pieces. Sign in to your Deluzex account to access your saved favorites across all your devices.
          </p>

          <div className={styles.unauthActions}>
            <button
              type="button"
              className={styles.btnSignIn}
              onClick={() => {
                if (openLoginModal) {
                  openLoginModal(undefined, "Please sign in to access your personal wishlist.");
                } else {
                  router.push("/login");
                }
              }}
            >
              Sign In Now
            </button>
            <button
              type="button"
              className={styles.btnExploreSecondary}
              onClick={() => router.push("/shop")}
            >
              Explore Collection
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State 3: Authenticated User with Wishlist
  const filtered = items.filter((item) =>
    item.product_title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>My Wishlist</h1>
        <p className={styles.subtitle}>Your favourite lighting pieces, saved for you.</p>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search Wishlist..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          className={styles.btnMoveAll}
          type="button"
          onClick={handleMoveAllToCart}
          disabled={items.length === 0 || isMovingAll}
        >
          {isMovingAll ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
              <svg className={styles.btnSpinner} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
              Moving to Cart...
            </span>
          ) : (
            "Move All To Cart"
          )}
        </button>
      </div>

      {/* Product Grid */}
      <div className={styles.productGrid}>
        {loading ? (
          <p style={{ gridColumn: "1 / -1", textAlign: "center", padding: "3rem 1rem", color: "#777" }}>
            Loading your wishlist...
          </p>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <h3 className={styles.emptyTitle}>
              {search ? "No Matching Items Found" : "Your Wishlist is Empty"}
            </h3>
            <p className={styles.emptySubtitle}>
              {search
                ? `No pieces found matching "${search}". Try searching for something else.`
                : "Explore our curated collection of luxury illumination and save pieces you adore."}
            </p>
            <button
              type="button"
              className={styles.btnAddFirst}
              onClick={() => router.push("/shop")}
            >
              Explore Collection
            </button>
          </div>
        ) : (
          filtered.map((item, idx) => {
            const itemId = item.id || item._id || String(idx);
            const hasImg = item.product_image && !imgErrors[itemId];
            const displayPrice =
              typeof item.product_price === "number"
                ? `₹${item.product_price}`
                : item.product_price.startsWith("₹")
                ? item.product_price
                : `₹${item.product_price}`;

            const productTarget = item.product_slug || item.product_id || item.id || item._id;
            const productHref = productTarget ? `/product/${productTarget}` : null;

            return (
              <div key={itemId} className={styles.productCard}>
                <div className={styles.imgWrapper}>
                  {productHref ? (
                    <Link href={productHref} className={styles.imgLink} title={`View ${item.product_title}`}>
                      {hasImg ? (
                        <img
                          src={item.product_image!}
                          alt={item.product_title}
                          className={styles.productImg}
                          onError={() =>
                            setImgErrors((prev) => ({ ...prev, [itemId]: true }))
                          }
                        />
                      ) : (
                        <LampPlaceholder />
                      )}
                    </Link>
                  ) : hasImg ? (
                    <img
                      src={item.product_image!}
                      alt={item.product_title}
                      className={styles.productImg}
                      onError={() =>
                        setImgErrors((prev) => ({ ...prev, [itemId]: true }))
                      }
                    />
                  ) : (
                    <LampPlaceholder />
                  )}
                  <button
                    className={styles.removeBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      removeItem(item);
                    }}
                    aria-label="Remove item"
                    title="Remove from wishlist"
                  >
                    ✕
                  </button>
                </div>
                <div className={styles.productInfo}>
                  {productHref ? (
                    <Link
                      href={productHref}
                      className={styles.productNameLink}
                      title={`View details for ${item.product_title}`}
                    >
                      <div className={styles.productName}>{item.product_title}</div>
                    </Link>
                  ) : (
                    <div className={styles.productName}>{item.product_title}</div>
                  )}
                  <div className={styles.productPrice}>{displayPrice}</div>
                  <div className={styles.actionsRow}>
                    {productHref && (
                      <Link href={productHref} className={styles.btnViewDetails}>
                        View Details
                      </Link>
                    )}
                    <button
                      className={styles.btnAddToCart}
                      type="button"
                      onClick={() => handleAddToCart(item)}
                      disabled={addingId === String(item.product_id || item.id || item._id || itemId)}
                    >
                      {addingId === String(item.product_id || item.id || item._id || itemId) ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                          <svg className={styles.btnSpinner} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                            <path d="M12 2a10 10 0 0 1 10 10" />
                          </svg>
                          Adding...
                        </span>
                      ) : (
                        "Add To Cart"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Banner */}
      <div className={styles.footerBanner}>
        <div className={styles.footerLeft}>
          <div className={styles.footerIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <div className={styles.footerText}>
            <h4>Don&apos;t see something you like?</h4>
            <p>
              Explore{" "}
              <a href="/shop" style={{ color: "var(--color-primary)" }}>
                our latest collection
              </a>{" "}
              and find the perfect lighting for your space.
            </p>
          </div>
        </div>
        <button
          className={styles.btnExplore}
          type="button"
          onClick={() => router.push("/shop")}
        >
          Explore Our Collection
        </button>
      </div>
    </div>
  );
}
