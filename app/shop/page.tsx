"use client";

import styles from "./shop.module.css";
import Image from "next/image";
import Link from "next/link";
import { useSelector, useDispatch } from "react-redux";
import { addToCart, updateQuantity, removeFromCart, getMaxQuantity } from "../store/cartSlice";
import { RootState } from "../store/store";
import { useEffect, useState, useMemo, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { fetchCategories, fetchProducts, Category, Product } from "../services/api";

const SORT_OPTIONS = [
  { label: "Featured", value: "FEATURED" },
  { label: "Price: Low to High", value: "PRICE: LOW TO HIGH" },
  { label: "Price: High to Low", value: "PRICE: HIGH TO LOW" },
  { label: "Newest Arrivals", value: "NEWEST ARRIVALS" },
];

function ShopContent() {
  const dispatch = useDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category");
  const searchParam = searchParams.get("search") || searchParams.get("q") || "";
  const priceParam = searchParams.get("price") || "ALL";

  const cartItems = useSelector((state: RootState) => state.cart.cartItems);

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryParam);
  const [searchQuery, setSearchQuery] = useState<string>(searchParam);
  const [priceRange, setPriceRange] = useState<string>(priceParam);
  const [sortBy, setSortBy] = useState<string>("FEATURED");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategory && selectedCategory.toLowerCase() !== "all") count += 1;
    if (priceRange && priceRange !== "ALL") count += 1;
    return count;
  }, [selectedCategory, priceRange]);

  // Close sort dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    }
    if (isSortOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSortOpen]);

  // Sync category and search params from URL

  useEffect(() => {
    setSelectedCategory(categoryParam);
    setCurrentPage(1);
  }, [categoryParam]);

  useEffect(() => {
    setSearchQuery(searchParam);
    setCurrentPage(1);
  }, [searchParam]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  useEffect(() => {
    async function loadData() {
      try {
        const [cats, prods] = await Promise.all([
          fetchCategories(),
          fetchProducts(),
        ]);
        setCategories(Array.isArray(cats) ? cats : []);
        setProducts(Array.isArray(prods) ? prods : []);
      } catch (error) {
        console.error("Failed to load shop data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter products by selected category, search query, and price range
  const filteredProducts = useMemo(() => {
    let list = products;

    // 1. Category Filter
    if (selectedCategory && selectedCategory.toLowerCase() !== "all") {
      const sel = selectedCategory.toLowerCase().trim();
      list = list.filter((product) => {
        const prodCategory = String(product.product_category || "").toLowerCase().trim();
        if (prodCategory === sel) return true;

        const matchedCat = categories.find(
          (c) =>
            String(c._id || c.id || c.category_id || "").toLowerCase().trim() === sel ||
            c.name.toLowerCase().trim() === sel
        );

        if (matchedCat) {
          const catName = matchedCat.name.toLowerCase().trim();
          const catId = String(matchedCat._id || matchedCat.id || matchedCat.category_id || "").toLowerCase().trim();
          if (prodCategory === catName || prodCategory === catId) return true;
          if (prodCategory.includes(catName) || catName.includes(prodCategory)) return true;
          if (String(product.product_title || "").toLowerCase().includes(catName)) return true;
        }

        if (prodCategory.includes(sel) || sel.includes(prodCategory)) return true;
        if (String(product.product_title || "").toLowerCase().includes(sel)) return true;

        return false;
      });
    }

    // 2. Search Query Filter (Title, Description, SKU, Category)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((product) => {
        const title = String(product.product_title || "").toLowerCase();
        const desc = String(product.product_description || "").toLowerCase();
        const sku = String(product.sku || "").toLowerCase();
        const cat = String(product.product_category || "").toLowerCase();
        return title.includes(q) || desc.includes(q) || sku.includes(q) || cat.includes(q);
      });
    }

    // 3. Price Range Filter
    if (priceRange === "UNDER_25K") {
      list = list.filter((p) => Number(p.product_price || 0) < 25000);
    } else if (priceRange === "25K_50K") {
      list = list.filter((p) => Number(p.product_price || 0) >= 25000 && Number(p.product_price || 0) <= 50000);
    } else if (priceRange === "ABOVE_50K") {
      list = list.filter((p) => Number(p.product_price || 0) > 50000);
    }

    return list;
  }, [products, selectedCategory, searchQuery, priceRange, categories]);

  // Sort filtered products
  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    if (sortBy === "PRICE: LOW TO HIGH") {
      return list.sort((a, b) => Number(a.product_price || 0) - Number(b.product_price || 0));
    }
    if (sortBy === "PRICE: HIGH TO LOW") {
      return list.sort((a, b) => Number(b.product_price || 0) - Number(a.product_price || 0));
    }
    if (sortBy === "NEWEST ARRIVALS") {
      return list.sort((a, b) => (b.is_new_arrival ? 1 : 0) - (a.is_new_arrival ? 1 : 0));
    }
    if (sortBy === "RATING: HIGH TO LOW") {
      return list.sort((a, b) => Number(b.product_rating || 0) - Number(a.product_rating || 0));
    }
    return list;
  }, [filteredProducts, sortBy]);

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage) || 1;
  const currentProducts = sortedProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 400, behavior: "smooth" });
    }
  };

  const handleSelectCategory = (catIdentifier: string | null) => {
    const params = new URLSearchParams(window.location.search);
    if (!catIdentifier || catIdentifier.toLowerCase() === "all" || selectedCategory === catIdentifier) {
      setSelectedCategory(null);
      params.delete("category");
    } else {
      setSelectedCategory(catIdentifier);
      params.set("category", catIdentifier);
    }
    const newUrl = params.toString() ? `/shop?${params.toString()}` : "/shop";
    router.push(newUrl, { scroll: false });
    setCurrentPage(1);
  };

  const handleClearAllFilters = () => {
    setSelectedCategory(null);
    setSearchQuery("");
    setPriceRange("ALL");
    setSortBy("FEATURED");
    router.push("/shop", { scroll: false });
    setCurrentPage(1);
  };

  // Find user-friendly display name of currently active category
  const activeCategoryDisplayName = useMemo(() => {
    if (!selectedCategory) return null;
    const matched = categories.find(
      (c) =>
        String(c._id || c.id || c.category_id || "").toLowerCase().trim() ===
          selectedCategory.toLowerCase().trim() ||
        c.name.toLowerCase().trim() === selectedCategory.toLowerCase().trim()
    );
    return matched ? matched.name : selectedCategory;
  }, [selectedCategory, categories]);

  return (
    <main className={styles.main}>
      {/* HERO SECTION */}
      <section className={styles.hero}>
        <div className={styles.heroBg}>
          <Image
            src="/images/hero_bg_1784107713316.jpg"
            alt="Shop Hero Background"
            fill
            style={{ objectFit: "cover" }}
          />
        </div>
        <div className={styles.heroOverlay}></div>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Timeless<br />
            Illumination
          </h1>
          <p className={styles.heroSub}>Luxury Lighting Designed For Modern Interiors.</p>
        </div>
      </section>

      {/* CATEGORIES SECTION */}
      <section className={styles.categoriesSection}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionSub}>Lighting for every interior</p>
          <h2 className={styles.sectionTitle}>Discover Our Categories</h2>
        </div>
        <div className={styles.categoriesGrid}>
          {categories.map((cat, i) => {
            const catId = cat._id || cat.id || cat.category_id || cat.name;
            const isSelected =
              selectedCategory !== null &&
              (selectedCategory.toLowerCase() === cat.name.toLowerCase() ||
                selectedCategory.toLowerCase() === String(catId).toLowerCase());

            return (
              <div
                key={catId || i}
                onClick={() => handleSelectCategory(cat.name)}
                className={`${styles.categoryCard} ${isSelected ? styles.categoryCardActive : ""}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleSelectCategory(cat.name);
                  }
                }}
                aria-label={`Filter by ${cat.name}`}
              >
                <Image
                  src={cat.image_url || "/images/category_chandelier_1784107756268.jpg"}
                  alt={cat.name}
                  fill
                  style={{ objectFit: "cover" }}
                />
                <div className={styles.categoryOverlay}>
                  <h3 className={styles.categoryTitle}>{cat.name}</h3>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* LUXURY COMPACT BAR (Style A) */}
      <section className={styles.compactBar}>
        {/* Left: Compact, elegant search bar */}
        <div className={styles.compactSearchWrapper}>
          <span className={styles.compactSearchIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </span>
          <input
            type="text"
            className={styles.compactSearchInput}
            placeholder="Search fixtures, SKU (e.g. ME-DP-105)..."
            value={searchQuery}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              setCurrentPage(1);
              const params = new URLSearchParams(window.location.search);
              if (val.trim()) {
                params.set("search", val.trim());
              } else {
                params.delete("search");
              }
              const newUrl = params.toString() ? `/shop?${params.toString()}` : "/shop";
              router.replace(newUrl, { scroll: false });
            }}
          />
          {searchQuery && (
            <button
              type="button"
              className={styles.compactClearBtn}
              onClick={() => {
                setSearchQuery("");
                setCurrentPage(1);
                const params = new URLSearchParams(window.location.search);
                params.delete("search");
                const newUrl = params.toString() ? `/shop?${params.toString()}` : "/shop";
                router.replace(newUrl, { scroll: false });
              }}
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>

        {/* Right: Filter trigger button & Sort dropdown */}
        <div className={styles.compactActions}>
          <button
            type="button"
            className={`${styles.filterTriggerBtn} ${activeFilterCount > 0 ? styles.filterTriggerBtnActive : ""}`}
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Open filter options"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="21" x2="4" y2="14"></line>
              <line x1="4" y1="10" x2="4" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12" y2="3"></line>
              <line x1="20" y1="21" x2="20" y2="16"></line>
              <line x1="20" y1="12" x2="20" y2="3"></line>
              <line x1="1" y1="14" x2="7" y2="14"></line>
              <line x1="9" y1="8" x2="15" y2="8"></line>
              <line x1="17" y1="16" x2="23" y2="16"></line>
            </svg>
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className={styles.filterCountBadge}>{activeFilterCount}</span>
            )}
          </button>

          <div className={styles.compactSort}>
            <span className={styles.compactSortLabel}>Sort:</span>
            <select
              className={styles.compactSortSelect}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option>FEATURED</option>
              <option>PRICE: LOW TO HIGH</option>
              <option>PRICE: HIGH TO LOW</option>
              <option>NEWEST ARRIVALS</option>
              <option>RATING: HIGH TO LOW</option>
            </select>
          </div>
        </div>
      </section>

      {/* ACTIVE FILTER CHIPS (Under bar) */}
      {(selectedCategory || priceRange !== "ALL" || searchQuery.trim()) && (
        <div className={styles.activeChipsRow}>
          <span className={styles.activeChipsLabel}>Active:</span>
          {selectedCategory && (
            <button
              type="button"
              className={styles.chip}
              onClick={() => handleSelectCategory(null)}
              title="Remove category filter"
            >
              {activeCategoryDisplayName} <span>&times;</span>
            </button>
          )}
          {priceRange !== "ALL" && (
            <button
              type="button"
              className={styles.chip}
              onClick={() => setPriceRange("ALL")}
              title="Remove price filter"
            >
              {priceRange === "UNDER_25K"
                ? "Under ₹25k"
                : priceRange === "25K_50K"
                ? "₹25k - ₹50k"
                : "Above ₹50k"}{" "}
              <span>&times;</span>
            </button>
          )}
          {searchQuery.trim() && (
            <button
              type="button"
              className={styles.chip}
              onClick={() => {
                setSearchQuery("");
                const params = new URLSearchParams(window.location.search);
                params.delete("search");
                const newUrl = params.toString() ? `/shop?${params.toString()}` : "/shop";
                router.replace(newUrl, { scroll: false });
              }}
              title="Clear search term"
            >
              &quot;{searchQuery}&quot; <span>&times;</span>
            </button>
          )}
          <button
            type="button"
            className={styles.clearAllLink}
            onClick={handleClearAllFilters}
          >
            Reset all
          </button>
          <span className={styles.chipsProductCount}>
            ({filteredProducts.length} {filteredProducts.length === 1 ? "fixture" : "fixtures"})
          </span>
        </div>
      )}

      {/* LUXURY SLIDE-OUT DRAWER */}
      {isDrawerOpen && (
        <div className={styles.drawerOverlay} onClick={() => setIsDrawerOpen(false)}>
          <div className={styles.drawerContent} onClick={(e) => e.stopPropagation()}>
            {/* Drawer Header */}
            <div className={styles.drawerHeader}>
              <div className={styles.drawerTitleRow}>
                <h3 className={styles.drawerTitle}>Filters</h3>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    className={styles.drawerResetBtn}
                    onClick={handleClearAllFilters}
                  >
                    Reset All
                  </button>
                )}
              </div>
              <button
                type="button"
                className={styles.drawerCloseBtn}
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Close filters"
              >
                &times;
              </button>
            </div>

            {/* Drawer Body */}
            <div className={styles.drawerBody}>
              {/* Category Options */}
              <div className={styles.drawerSection}>
                <h4 className={styles.drawerSectionTitle}>Categories</h4>
                <div className={styles.drawerItemList}>
                  <button
                    type="button"
                    className={`${styles.drawerItem} ${!selectedCategory ? styles.drawerItemActive : ""}`}
                    onClick={() => handleSelectCategory(null)}
                  >
                    <span>All Categories</span>
                    {!selectedCategory && <span className={styles.checkIcon}>✓</span>}
                  </button>
                  {categories.map((cat, i) => {
                    const catId = cat._id || cat.id || cat.category_id || cat.name;
                    const isSelected =
                      selectedCategory !== null &&
                      (selectedCategory.toLowerCase() === cat.name.toLowerCase() ||
                        selectedCategory.toLowerCase() === String(catId).toLowerCase());

                    return (
                      <button
                        key={catId || i}
                        type="button"
                        className={`${styles.drawerItem} ${isSelected ? styles.drawerItemActive : ""}`}
                        onClick={() => handleSelectCategory(cat.name)}
                      >
                        <span>{cat.name}</span>
                        {isSelected && <span className={styles.checkIcon}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Price Range Options */}
              <div className={styles.drawerSection}>
                <h4 className={styles.drawerSectionTitle}>Price Range</h4>
                <div className={styles.drawerItemList}>
                  {[
                    { label: "All Prices", value: "ALL" },
                    { label: "Under ₹25,000", value: "UNDER_25K" },
                    { label: "₹25,000 – ₹50,000", value: "25K_50K" },
                    { label: "Above ₹50,000", value: "ABOVE_50K" },
                  ].map((p) => {
                    const isSelected = priceRange === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        className={`${styles.drawerItem} ${isSelected ? styles.drawerItemActive : ""}`}
                        onClick={() => setPriceRange(p.value)}
                      >
                        <span>{p.label}</span>
                        {isSelected && <span className={styles.checkIcon}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className={styles.drawerFooter}>
              <button
                type="button"
                className={styles.applyBtn}
                onClick={() => setIsDrawerOpen(false)}
              >
                View {filteredProducts.length} {filteredProducts.length === 1 ? "Fixture" : "Fixtures"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCT GRID */}
      <section className={styles.productsSection}>
        <div className={styles.productGrid}>
          {loading ? (
            <p style={{ gridColumn: "1 / -1", textAlign: "center", padding: "3rem" }}>Loading products...</p>
          ) : currentProducts.length === 0 ? (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "3rem 1rem" }}>
              <p style={{ fontSize: "1.2rem", marginBottom: "1rem", color: "var(--color-text)" }}>
                No fixtures found matching your search or filters.
              </p>
              <button
                type="button"
                onClick={handleClearAllFilters}
                className={styles.clearFilterBtn}
                style={{ margin: "0 auto" }}
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            currentProducts.map((product, i) => {
              const pId = String(product._id || product.id || i);
              const cartItem = cartItems.find((item) => String(item.id) === pId);
              const isOutOfStock =
                product.in_stock === false ||
                String(product.stock_status || "").toUpperCase() === "OUT OF STOCK";

              return (
                <div key={pId} className={styles.productCard}>
                  <div className={styles.productImageWrapper}>
                    <Link
                      href={`/product/${pId}`}
                      className={styles.productImageLink}
                    >
                      <Image
                        src={
                          product.product_main_image ||
                          "/images/lamp_modern_tall_1784107732736.jpg"
                        }
                        alt={product.product_title}
                        fill
                        sizes="(max-width: 768px) 50vw, 33vw"
                        className={styles.productImage}
                      />
                    </Link>

                    {isOutOfStock && (
                      <span className={styles.outOfStockBadge}>Out of Stock</span>
                    )}

                    {isOutOfStock ? (
                      <div className={styles.outOfStockBtn} title="Currently unavailable">
                        Out of Stock
                      </div>
                    ) : cartItem ? (
                      <div className={styles.cartQuantityControl}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            if (cartItem.quantity === 1) {
                              dispatch(removeFromCart(pId));
                            } else {
                              dispatch(updateQuantity({ id: pId, change: -1 }));
                            }
                          }}
                        >
                          −
                        </button>
                        <span>{cartItem.quantity}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            dispatch(updateQuantity({ id: pId, change: 1, max_quantity: getMaxQuantity(product) }));
                          }}
                          disabled={cartItem.maxQuantity !== undefined && cartItem.quantity >= cartItem.maxQuantity}
                          title={
                            cartItem.maxQuantity !== undefined && cartItem.quantity >= cartItem.maxQuantity
                              ? `Only ${cartItem.maxQuantity} in stock`
                              : undefined
                          }
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={styles.addToCartBtn}
                        onClick={(e) => {
                          e.preventDefault();
                          dispatch(addToCart({ ...product, max_quantity: getMaxQuantity(product) }));
                        }}
                        aria-label="Add to cart"
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className={styles.productInfo}>
                    <div className={styles.productInfoRow}>
                      <Link href={`/product/${pId}`} className={styles.productNameLink}>
                        <h4 className={styles.productName}>{product.product_title}</h4>
                      </Link>
                      <div className={styles.productPrice}>₹{product.product_price}</div>
                    </div>
                    <div className={styles.productRating}>
                      <svg
                        className={styles.starIcon}
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                      </svg>
                      <span>{product.product_rating ? `${product.product_rating} / 5` : "Not rated yet"}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* PAGINATION */}
        {!loading && totalPages > 1 && (
          <div className={styles.pagination}>
            <div
              className={styles.pageNav}
              onClick={() => handlePageChange(currentPage - 1)}
              style={{
                opacity: currentPage === 1 ? 0.5 : 1,
                pointerEvents: currentPage === 1 ? "none" : "auto",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Previous
            </div>

            {Array.from({ length: totalPages }).map((_, index) => {
              const pageNum = index + 1;
              return (
                <div
                  key={pageNum}
                  className={`${styles.pageItem} ${
                    currentPage === pageNum ? styles.pageActive : ""
                  }`}
                  onClick={() => handlePageChange(pageNum)}
                >
                  {pageNum}
                </div>
              );
            })}

            <div
              className={styles.pageNav}
              onClick={() => handlePageChange(currentPage + 1)}
              style={{
                opacity: currentPage === totalPages ? 0.5 : 1,
                pointerEvents: currentPage === totalPages ? "none" : "auto",
              }}
            >
              Next
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export default function Shop() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p>Loading collection...</p>
        </div>
      }
    >
      <ShopContent />
    </Suspense>
  );
}
