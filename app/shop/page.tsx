"use client";

import styles from "./shop.module.css";
import Image from "next/image";
import Link from "next/link";
import { useSelector, useDispatch } from "react-redux";
import { addToCart, updateQuantity, removeFromCart } from "../store/cartSlice";
import { RootState } from "../store/store";
import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { fetchCategories, fetchProducts, Category, Product } from "../services/api";
import { useAuth } from "../context/AuthContext";

const FALLBACK_CATEGORIES: Category[] = [
  { id: "chandeliers", name: "Chandeliers", image_url: "/images/about_chandelier_1784107790569.jpg" },
  { id: "pendant-lights", name: "Pendant Lights", image_url: "/images/category_chandelier_1784107756268.jpg" },
  { id: "cob", name: "COB", image_url: "/images/project_lobby_1784107778993.jpg" },
  { id: "table-lamps", name: "Table Lamps", image_url: "/images/lamp_black_gold_1784107745696.jpg" },
  { id: "floor-lamps", name: "Floor Lamps", image_url: "/images/lamp_modern_tall_1784107732736.jpg" },
  { id: "wall-lights", name: "Wall Lights", image_url: "/images/lamp_classic_1784107722127.jpg" },
];

const FALLBACK_PRODUCTS: Product[] = [
  {
    _id: "prod_pendant_1",
    id: "prod_pendant_1",
    product_title: "Linear Wood LED Pendant",
    product_price: "42500",
    product_description: "Minimalist natural oak LED linear suspension bar for dining islands and conference tables.",
    product_category: "Pendant Lights",
    product_rating: 4.9,
    product_main_image: "/images/category_chandelier_1784107756268.jpg",
  },
  {
    _id: "prod_pendant_2",
    id: "prod_pendant_2",
    product_title: "Smoked Glass Drop Pendant",
    product_price: "28900",
    product_description: "Handblown smoked glass globe with brushed brass hardware and warm filament glow.",
    product_category: "Pendant Lights",
    product_rating: 4.8,
    product_main_image: "/images/category_chandelier_1784107756268.jpg",
  },
  {
    _id: "prod_chandelier_1",
    id: "prod_chandelier_1",
    product_title: "Vera Tiered Crystal Chandelier",
    product_price: "194900",
    product_description: "Grand multi-tier faceted crystal fixture with hand-finished electroplated gold framework.",
    product_category: "Chandeliers",
    product_rating: 5.0,
    product_main_image: "/images/about_chandelier_1784107790569.jpg",
  },
  {
    _id: "prod_chandelier_2",
    id: "prod_chandelier_2",
    product_title: "Aurora Modern Radial Chandelier",
    product_price: "135000",
    product_description: "Contemporary radial brass arms extending into frosted optical glass diffusers.",
    product_category: "Chandeliers",
    product_rating: 4.9,
    product_main_image: "/images/about_chandelier_1784107790569.jpg",
  },
  {
    _id: "prod_cob_1",
    id: "prod_cob_1",
    product_title: "Architectural Deep COB Downlight",
    product_price: "8500",
    product_description: "Anti-glare recessed architectural spotlight with 24-degree narrow beam and high CRI 95+.",
    product_category: "COB",
    product_rating: 4.7,
    product_main_image: "/images/project_lobby_1784107778993.jpg",
  },
  {
    _id: "prod_cob_2",
    id: "prod_cob_2",
    product_title: "Surface-Mounted Cylindrical COB",
    product_price: "11200",
    product_description: "Matte black and champagne gold directional spot spotlight for gallery ceilings.",
    product_category: "COB",
    product_rating: 4.8,
    product_main_image: "/images/project_lobby_1784107778993.jpg",
  },
  {
    _id: "prod_table_1",
    id: "prod_table_1",
    product_title: "Modern Brass Desk Lamp",
    product_price: "23100",
    product_description: "Precision-turned brass articulating arm with matte black shade and touch dimmer.",
    product_category: "Table Lamps",
    product_rating: 4.8,
    product_main_image: "/images/lamp_black_gold_1784107745696.jpg",
  },
  {
    _id: "prod_table_2",
    id: "prod_table_2",
    product_title: "Vintage Pleated Silk Lamp",
    product_price: "19500",
    product_description: "Warm antique gold cast base paired with a pleated ivory silk shade.",
    product_category: "Table Lamps",
    product_rating: 4.9,
    product_main_image: "/images/lamp_classic_1784107722127.jpg",
  },
  {
    _id: "prod_floor_1",
    id: "prod_floor_1",
    product_title: "Cylindrical Architectural Floor Lamp",
    product_price: "34900",
    product_description: "Minimalist vertical column diffuser with warm white LED light and marble base.",
    product_category: "Floor Lamps",
    product_rating: 4.9,
    product_main_image: "/images/lamp_modern_tall_1784107732736.jpg",
  },
  {
    _id: "prod_wall_1",
    id: "prod_wall_1",
    product_title: "Luxe Minimalist Dual Sconce",
    product_price: "18500",
    product_description: "Up-and-down ambient wall wash fixture in brushed champagne bronze.",
    product_category: "Wall Lights",
    product_rating: 4.8,
    product_main_image: "/images/lamp_classic_1784107722127.jpg",
  },
];

function ShopContent() {
  const dispatch = useDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category");
  const searchParam = searchParams.get("search") || searchParams.get("q") || "";
  const priceParam = searchParams.get("price") || "ALL";

  const { isAuthenticated, openLoginModal } = useAuth();
  const cartItems = useSelector((state: RootState) => state.cart.cartItems);

  const [categories, setCategories] = useState<Category[]>(FALLBACK_CATEGORIES);
  const [products, setProducts] = useState<Product[]>(FALLBACK_PRODUCTS);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryParam);
  const [searchQuery, setSearchQuery] = useState<string>(searchParam);
  const [priceRange, setPriceRange] = useState<string>(priceParam);
  const [sortBy, setSortBy] = useState<string>("FEATURED");
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategory && selectedCategory.toLowerCase() !== "all") count += 1;
    if (priceRange && priceRange !== "ALL") count += 1;
    return count;
  }, [selectedCategory, priceRange]);

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
        if (cats && cats.length > 0) {
          setCategories(cats);
        }
        if (prods && prods.length > 0) {
          // Merge MongoDB products with catalog defaults so all luxury categories remain rich
          const merged = [...prods];
          FALLBACK_PRODUCTS.forEach((fb) => {
            if (!merged.some((p) => String(p._id || p.id) === String(fb._id || fb.id) || p.product_title === fb.product_title)) {
              merged.push(fb);
            }
          });
          setProducts(merged);
        }
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
                      style={{ display: "block", width: "100%", height: "100%", position: "relative", overflow: "hidden", borderRadius: "10px" }}
                    >
                      <Image
                        src={
                          product.product_main_image ||
                          "/images/lamp_modern_tall_1784107732736.jpg"
                        }
                        alt={product.product_title}
                        fill
                        sizes="(max-width: 768px) 50vw, 33vw"
                        style={{ objectFit: "cover" }}
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
                          onClick={(e) => {
                            e.preventDefault();
                            if (cartItem.quantity === 1) {
                              dispatch(removeFromCart(pId));
                            } else {
                              dispatch(updateQuantity({ id: pId, change: -1 }));
                            }
                          }}
                        >
                          -
                        </button>
                        <span>{cartItem.quantity}</span>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            if (!isAuthenticated) {
                              openLoginModal(product, "Please log in to update your cart items.");
                              return;
                            }
                            dispatch(updateQuantity({ id: pId, change: 1 }));
                          }}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        className={styles.addToCartBtn}
                        onClick={(e) => {
                          e.preventDefault();
                          if (!isAuthenticated) {
                            openLoginModal(
                              product,
                              `Please log in to add ${product.product_title || "this lamp"} to your cart.`
                            );
                            return;
                          }
                          dispatch(addToCart(product));
                        }}
                        aria-label="Add to cart"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          height="24"
                          viewBox="0 0 24 24"
                          width="24"
                        >
                          <path d="M0 0h24v24H0V0z" fill="none" />
                          <path d="M11 9h2V6h3V4h-3V1h-2v3H8v2h3v3zm-4 9c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2zm-8.9-5h7.45c.75 0 1.41-.41 1.75-1.03l3.86-7.01L19.42 4l-3.87 7H8.53L4.27 2H1v2h2l3.6 7.59L3.62 17H19v-2H7l1.1-2z" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className={styles.productInfo}>
                    <div className={styles.productInfoRow}>
                      <h4 className={styles.productName}>{product.product_title}</h4>
                      <div className={styles.productPrice}>₹{product.product_price}</div>
                    </div>
                    <div className={styles.productRating}>
                      <svg
                        className={styles.starIcon}
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                      </svg>
                      {product.product_rating || 4.8} ({35} Reviews)
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
