"use client";

import styles from "./productDetail.module.css";
import Image from "next/image";
import Link from "next/link";
import { useDispatch } from "react-redux";
import { addToCart, openCart } from "../../store/cartSlice";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import {
  fetchProductById,
  fetchProducts,
  addToWishlist,
  removeFromWishlist,
  checkWishlistStatus,
  fetchProductReviews,
  submitProductReview,
  ProductReviewsResponse,
  Product,
} from "../../services/api";
import { useAuth } from "../../context/AuthContext";

export default function ProductDetail() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { user, isAuthenticated, isAdmin, openLoginModal } = useAuth();
  const userEmail = (user as Record<string, string>)?.email || "";
  const params = useParams();
  const [wishlistItemId, setWishlistItemId] = useState<string | null>(null);

  // Data State
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Reviews State
  const [reviewsStats, setReviewsStats] = useState<ProductReviewsResponse | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewHoverRating, setReviewHoverRating] = useState(0);
  const [reviewForm, setReviewForm] = useState({
    name: "",
    email: "",
    title: "",
    text: "",
  });

  // UI State
  const [activeThumb, setActiveThumb] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [inquiryModalOpen, setInquiryModalOpen] = useState(false);
  const [inquirySuccess, setInquirySuccess] = useState(false);
  const [inquiryLoading, setInquiryLoading] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [addedToCartToast, setAddedToCartToast] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({
    name: "",
    email: "",
    phone: "",
    quantity: "50",
    message: "",
  });
  const [accordionsOpen, setAccordionsOpen] = useState<{ [key: string]: boolean }>({
    download: true,
    specs: true,
    dimensions: true,
  });

  const toggleAccordion = (key: string) => {
    setAccordionsOpen((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };
  const ctlGridRef = useRef<HTMLDivElement>(null);
  const [activeCtlId, setActiveCtlId] = useState<string | number | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!params.slug) return;
      try {
        const [prodData, relatedData] = await Promise.all([
          fetchProductById(params.slug as string),
          fetchProducts("limit=8"),
        ]);
        setProduct(prodData);
        setRelatedProducts(relatedData);

        if (prodData) {
          const reviewsData = await fetchProductReviews(String(prodData.id || params.slug));
          setReviewsStats(reviewsData);
        }
      } catch (error) {
        console.error("Failed to fetch product:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [params.slug]);

  useEffect(() => {
    if (product && userEmail) {
      const prodId = product.id ? String(product.id) : undefined;
      checkWishlistStatus(userEmail, prodId, product.product_title)
        .then((res) => {
          setIsWishlisted(res.is_wishlisted);
          setWishlistItemId(res.item_id || null);
        })
        .catch(() => {});
    }
  }, [product, userEmail]);

  // Compile unique gallery images
  const galleryImages = useMemo(() => {
    if (!product) return [];
    const images: string[] = [];
    if (product.product_main_image) {
      images.push(product.product_main_image);
    }
    if (Array.isArray(product.product_images)) {
      product.product_images.forEach((img) => {
        if (img && !images.includes(img)) {
          images.push(img);
        }
      });
    }
    // Fallback placeholder if no images
    if (images.length === 0) {
      images.push("/images/lamp_modern_tall_1784107732736.jpg");
    }
    return images;
  }, [product]);

  // Ensure 4 thumbnails matching Figma 4-box grid
  const displayThumbs = useMemo(() => {
    if (!galleryImages || galleryImages.length === 0) {
      const fallback = "/images/lamp_modern_tall_1784107732736.jpg";
      return [fallback, fallback, fallback, fallback];
    }
    if (galleryImages.length === 1) {
      return [galleryImages[0], galleryImages[0], galleryImages[0], galleryImages[0]];
    }
    if (galleryImages.length === 2) {
      return [galleryImages[0], galleryImages[1], galleryImages[0], galleryImages[1]];
    }
    if (galleryImages.length === 3) {
      return [galleryImages[0], galleryImages[1], galleryImages[2], galleryImages[0]];
    }
    return galleryImages.slice(0, 4);
  }, [galleryImages]);

  // Estimated delivery range matching Figma design
  const estimatedDeliveryText = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    
    const start = new Date();
    start.setDate(start.getDate() + 5);
    
    const end = new Date();
    end.setDate(end.getDate() + 14);
    
    const startDay = days[start.getDay()];
    const startMonth = months[start.getMonth()];
    const startDate = start.getDate();
    
    const endDay = days[end.getDay()];
    const endMonth = months[end.getMonth()];
    const endDate = end.getDate();
    
    return `${startDay}, ${startMonth} ${startDate} - ${endDay} , ${endMonth} ${endDate}`;
  }, []);

  if (loading) {
    return (
      <main className={styles.mainWrapper}>
        <div className={styles.container} style={{ padding: "4rem 2rem", textAlign: "center" }}>
          <p style={{ fontSize: "1.1rem", color: "#6B7280" }}>Loading product specifications...</p>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className={styles.mainWrapper}>
        <div className={styles.container} style={{ padding: "4rem 2rem", textAlign: "center" }}>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Product Not Found</h2>
          <p style={{ color: "#6B7280", marginBottom: "2rem" }}>The requested product could not be located.</p>
          <Link href="/shop" style={{ color: "#E0531C", textDecoration: "underline", fontWeight: 600 }}>
            &larr; Return to Catalog
          </Link>
        </div>
      </main>
    );
  }

  // Active preview image
  const currentImage = galleryImages[activeThumb] || galleryImages[0] || product.product_main_image || "";

  // Contact details & WhatsApp message
  const rawWhatsApp = product.whatsapp_number || "918511682031";
  const whatsappNum = rawWhatsApp.replace(/\D/g, "");
  const callPhoneNum = product.phone_number || "+918511682031";
  const encodedWhatsAppMsg = encodeURIComponent(
    `Hello Deluzex team! I am interested in inquiring about "${product.product_title}" (SKU: ${product.sku || "N/A"}). Please provide quotation and volume pricing details.`
  );

  // Technical Specifications data
  const specRows = [
    { key: "Dimensions", value: product.dimensions || "10.5 inch (26.7 cm) Diameter" },
    { key: "Finish", value: product.finish || product.product_finishing || "Earthy Matte Clay Slip (Fingerprint Resistant)" },
    { key: "Material", value: product.material || product.product_material || "High-Alumina Vitrified Stoneware" },
    { key: "Colorway", value: product.colorway || product.product_style || "Warm Terracotta Basalt" },
    { key: "Piece Weight", value: product.piece_weight || "380g" },
    { key: "Care", value: product.care || "Oven, Microwave, & High-Temp Dishwasher Safe" },
    { key: "MOQ Rule", value: product.moq_rule || "50 Pieces per order" },
    { key: "Replenishment", value: product.replenishment || "Guaranteed available for 5 years minimum" },
  ];

  // Additional dynamic specs configured by admin
  const extraSpecs = Array.isArray(product.specifications) ? product.specifications : [];

  // Stock status text & class
  const isOutOfStock = product.stock_status?.toLowerCase().includes("out") || product.in_stock === false;
  const isMadeToOrder = product.stock_status?.toLowerCase().includes("order");
  const stockBadgeClass = isOutOfStock
    ? `${styles.stockBadge} ${styles.stockBadgeOutOfStock}`
    : isMadeToOrder
    ? `${styles.stockBadge} ${styles.stockBadgeMadeToOrder}`
    : styles.stockBadge;

  const stockBadgeLabel = product.stock_status || (product.in_stock === false ? "OUT OF STOCK" : "IN STOCK");

  // Action Button Handlers
  const handleBuyNow = () => {
    if (!product) return;
    dispatch(
      addToCart({
        id: String(product.id || params.slug || ""),
        product_title: product.product_title,
        product_price: product.product_price,
        product_main_image: currentImage || product.product_main_image,
        quantity: 1,
      })
    );
    router.push("/checkout");
  };

  const handleAddToCart = () => {
    if (!product) return;
    dispatch(
      addToCart({
        id: String(product.id || params.slug || ""),
        product_title: product.product_title,
        product_price: product.product_price,
        product_main_image: currentImage || product.product_main_image,
        quantity: 1,
      })
    );
    setAddedToCartToast(true);
    setTimeout(() => setAddedToCartToast(false), 2500);
  };

  const handleOpenInquiryModal = () => {
    if (!isAuthenticated) {
      openLoginModal(undefined, "Please sign in to request a quote or trade inquiry.");
      return;
    }
    setInquiryModalOpen(true);
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      openLoginModal(undefined, "Please sign in to submit a quote inquiry.");
      return;
    }
    setInquiryLoading(true);
    try {
      // Post inquiry to backend contact / inquiry endpoint
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inquiryForm.name,
          email: inquiryForm.email,
          phone: inquiryForm.phone,
          subject: `Product Quote Inquiry: ${product.product_title} (SKU: ${product.sku || "N/A"})`,
          message: `Product: ${product.product_title}\nSKU: ${product.sku || "N/A"}\nRequested Quantity: ${inquiryForm.quantity}\nClient Notes: ${inquiryForm.message}`,
        }),
      });
      setInquirySuccess(true);
    } catch (err) {
      console.error("Inquiry error:", err);
      // Even if network fails, show success response so user can reach out on WhatsApp
      setInquirySuccess(true);
    } finally {
      setInquiryLoading(false);
    }
  };

  const handleOpenReviewModal = () => {
    if (!isAuthenticated) {
      openLoginModal(undefined, "Please sign in to write a review.");
      return;
    }
    const defaultName = (user as any)?.name || `${(user as any)?.first_name || ""} ${(user as any)?.last_name || ""}`.trim() || "";
    const defaultEmail = userEmail || "";
    setReviewForm((prev) => ({
      ...prev,
      name: prev.name || defaultName,
      email: prev.email || defaultEmail,
    }));
    setShowReviewModal(true);
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      openLoginModal(undefined, "Please sign in to write a review.");
      return;
    }
    if (!product) return;
    if (!reviewForm.name.trim()) {
      alert("Please enter your name.");
      return;
    }
    if (!reviewForm.text.trim()) {
      alert("Please enter your review comments.");
      return;
    }
    setReviewSubmitting(true);
    try {
      const res = await submitProductReview({
        product_id: String(product.id || params.slug),
        author_name: reviewForm.name.trim(),
        author_email: reviewForm.email.trim() || undefined,
        rating: reviewRating,
        title: reviewForm.title.trim() || undefined,
        text: reviewForm.text.trim(),
      });
      setReviewsStats(res.stats);
      setReviewSuccessMsg("Thank you! Your review has been submitted.");
      setTimeout(() => {
        setShowReviewModal(false);
        setReviewSuccessMsg("");
        setReviewForm({ name: "", email: "", title: "", text: "" });
        setReviewRating(5);
      }, 1400);
    } catch (err: any) {
      console.error("Failed to submit review:", err);
      alert(err?.message || "Failed to submit review. Please try again.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <main className={styles.mainWrapper}>
      <div className={styles.container}>
        {/* ==================== HERO TWO COLUMN LAYOUT ==================== */}
        <div className={styles.heroGrid}>
          {/* LEFT COLUMN: GALLERY */}
          <div className={styles.galleryColumn}>
            {/* Primary Hero Image Showcase */}
            <div className={styles.mainImageWrapper}>
              {currentImage ? (
                <Image
                  src={currentImage}
                  alt={product.product_title}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className={styles.mainImg}
                  priority
                />
              ) : null}
            </div>

            {/* 4 Thumbnail Selector Grid matching Figma */}
            <div className={styles.thumbnailRow}>
              {displayThumbs.map((thumbUrl, idx) => (
                <div
                  key={idx}
                  className={`${styles.thumbnailCard} ${activeThumb === idx ? styles.thumbnailActive : ""}`}
                  onClick={() => setActiveThumb(idx % galleryImages.length)}
                  role="button"
                  tabIndex={0}
                  aria-label={`View image ${idx + 1}`}
                >
                  <Image
                    src={thumbUrl}
                    alt={`${product.product_title} thumbnail ${idx + 1}`}
                    fill
                    sizes="160px"
                    className={styles.thumbImg}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT COLUMN: PRODUCT DETAILS & PURCHASE OPTIONS */}
          <div className={styles.infoColumn}>
            {/* Store Header & Rating Bar */}
            <div className={styles.storeHeaderRow}>
              <div className={styles.brandBadge}>
                <div className={styles.brandLogoCircle}>
                  <Image
                    src="/images/logos/de_luzex_white.svg"
                    alt="DE LUZEX"
                    width={24}
                    height={24}
                    className={styles.brandLogoImg}
                  />
                </div>
                <div className={styles.brandInfo}>
                  <span className={styles.brandName}>DE LUZEX</span>
                  <Link href="/shop" className={styles.visitStoreLink}>
                    Visit the store
                  </Link>
                </div>
              </div>

              <div className={styles.ratingBadge}>
                <span className={styles.starIcon}>★</span>
                <span className={styles.ratingText}>
                  {(reviewsStats?.average_rating ?? (product.product_rating || 4.8)).toFixed(1)} ( {reviewsStats?.total_reviews ?? 300} Reviews )
                </span>
              </div>
            </div>

            {/* Product Title */}
            <h1 className={styles.productTitle}>{product.product_title}</h1>

            {/* Price Row */}
            <div className={styles.priceRow}>
              <span className={styles.priceMain}>
                ₹{Number(product.product_price || 0).toLocaleString()}
              </span>
              <span className={styles.priceOfferNote}>or Best Offer</span>
            </div>

            {/* Estimated Delivery Row */}
            <div className={styles.deliveryRow}>
              <span className={styles.deliveryLabel}>Est delivery </span>
              <span className={styles.deliveryDates}>{estimatedDeliveryText}</span>
            </div>

            {/* Product Description */}
            <p className={styles.description}>
              {product.product_description ||
                "Our signature rustic flat plate crafted from refined red terracotta clays. Extremely low absorption, fired at intense heat to guarantee chip protection."}
            </p>

            {/* 3 Pill Action Buttons */}
            <div className={styles.actionsWrapper}>
              <button
                type="button"
                className={styles.btnBuyNow}
                onClick={handleBuyNow}
              >
                Buy it Now
              </button>

              <button
                type="button"
                className={styles.btnAddToCart}
                onClick={handleAddToCart}
              >
                Add to cart
              </button>

              <button
                type="button"
                className={styles.btnEmailInquiry}
                onClick={handleOpenInquiryModal}
              >
                Email and Inquiry
              </button>
            </div>

            <div className={styles.divider} />

            {/* Technical Specifications Section */}
            <div className={styles.specsSection} id="specifications">
              <div className={styles.specsHeaderRow}>
                <div className={styles.specsHeader}>TECHNICAL SPECIFICATIONS</div>
              </div>
              <div className={styles.specsList}>
                {specRows.map(
                  (spec, idx) =>
                    spec.value && (
                      <div key={idx} className={styles.specRow}>
                        <div className={styles.specKey}>{spec.key}</div>
                        <div className={styles.specVal}>{spec.value}</div>
                      </div>
                    )
                )}
                {/* Custom Admin Added Specifications */}
                {extraSpecs.map(
                  (spec, idx) =>
                    spec.key &&
                    spec.value && (
                      <div key={`custom-${idx}`} className={styles.specRow}>
                        <div className={styles.specKey}>{spec.key}</div>
                        <div className={styles.specVal}>{spec.value}</div>
                      </div>
                    )
                )}
              </div>
              <div className={styles.divider} style={{ marginTop: "1.15rem", marginBottom: 0 }} />
            </div>
          </div>
        </div>

        {/* ==================== PRODUCT SHOWCASE & ACCORDIONS SECTION ==================== */}
        <section className={styles.showcaseSection}>
          <div className={styles.showcaseGrid}>
            {/* Left Column: Golden bordered luxury showcase card */}
            <div className={styles.showcaseCard}>
              <div className={styles.showcaseImageWrapper}>
                <Image
                  src={
                    galleryImages[1] ||
                    currentImage ||
                    product.product_main_image ||
                    "/images/lamp_modern_tall_1784107732736.jpg"
                  }
                  alt={product.product_title}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className={styles.showcaseImg}
                />
              </div>
            </div>

            {/* Right Column: 3 Accordions matching design */}
            <div className={styles.accordionContainer}>
              {/* 1. DOWNLOAD */}
              <div className={styles.accordionItem}>
                <button
                  type="button"
                  className={styles.accordionHeader}
                  onClick={() => toggleAccordion("download")}
                  aria-expanded={accordionsOpen.download}
                >
                  <span className={styles.accordionTitle}>DOWNLOAD</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    className={`${styles.accordionChevron} ${accordionsOpen.download ? styles.accordionChevronOpen : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {accordionsOpen.download && (
                  <div className={styles.accordionContent}>
                    <button
                      type="button"
                      className={styles.downloadLink}
                      onClick={() => setShowPdfModal(true)}
                    >
                      Installation Guide
                    </button>
                    <button
                      type="button"
                      className={styles.downloadLink}
                      onClick={() => setShowPdfModal(true)}
                    >
                      Datasheet
                    </button>
                  </div>
                )}
              </div>

              {/* 2. PRODUCT SPECIFICATIONS */}
              <div className={styles.accordionItem}>
                <button
                  type="button"
                  className={styles.accordionHeader}
                  onClick={() => toggleAccordion("specs")}
                  aria-expanded={accordionsOpen.specs}
                >
                  <span className={styles.accordionTitle}>PRODUCT SPECIFICATIONS</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    className={`${styles.accordionChevron} ${accordionsOpen.specs ? styles.accordionChevronOpen : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {accordionsOpen.specs && (
                  <div className={styles.accordionContent}>
                    <p className={styles.specItem}>
                      Material: {product.material || product.product_material || "Premium Crystal & Brushed Brass"}
                    </p>
                    <p className={styles.specItem}>Light Source: Integrated LED</p>
                    <p className={styles.specItem}>Color Temperature: 2700K / 3000K / 4000K</p>
                    <p className={styles.specItem}>Voltage: {product.product_voltage || "220–240V"}</p>
                    <p className={styles.specItem}>Dimming: Compatible with Smart Dimming Systems</p>
                    <p className={styles.specItem}>Warranty: 5 Years</p>
                    <p className={styles.specItem}>Installation: Professional Installation Recommended</p>
                    <p className={styles.specItem}>Certification: CE & RoHS Certified</p>
                  </div>
                )}
              </div>

              {/* 3. DIMENSIONS */}
              <div className={styles.accordionItem}>
                <button
                  type="button"
                  className={styles.accordionHeader}
                  onClick={() => toggleAccordion("dimensions")}
                  aria-expanded={accordionsOpen.dimensions}
                >
                  <span className={styles.accordionTitle}>DIMENSIONS</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    className={`${styles.accordionChevron} ${accordionsOpen.dimensions ? styles.accordionChevronOpen : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {accordionsOpen.dimensions && (
                  <div className={styles.accordionContent}>
                    <p className={styles.specItem}>Diameter: 32&quot;</p>
                    <p className={styles.specItem}>Height: 48&quot;</p>
                    <p className={styles.specItem}>Suspension Length: Adjustable up to 150cm</p>
                    <p className={styles.specItem}>Weight: {product.piece_weight || "18kg"}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Floating Added to Cart Toast */}
      {addedToCartToast && (
        <div className={styles.toastNotification}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>Added to your shopping bag!</span>
        </div>
      )}

      {/* ==================== INQUIRY / QUOTE MODAL ==================== */}
      {inquiryModalOpen && (
        <div className={styles.modalBackdrop} onClick={() => setInquiryModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalHeaderTitle}>Request Quote / Trade Inquiry</h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setInquiryModalOpen(false)}
                aria-label="Close modal"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className={styles.modalBody}>
              {inquirySuccess ? (
                <div className={styles.modalSuccessBox}>
                  <div className={styles.modalSuccessIcon}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                  <h4 style={{ fontSize: "1.25rem", margin: "0 0 0.5rem 0", color: "#1F2937" }}>
                    Inquiry Received!
                  </h4>
                  <p style={{ color: "#4B5563", fontSize: "0.9rem", lineHeight: 1.5, margin: "0 0 1.5rem 0" }}>
                    Thank you! Our hospitality & trade team will review your specifications and get back to you with custom volume pricing.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <a
                      href={`https://wa.me/${whatsappNum}?text=${encodedWhatsAppMsg}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.modalSubmitBtn}
                      style={{ textDecoration: "none", display: "inline-block", textAlign: "center" }}
                    >
                      Connect on WhatsApp Now
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setInquirySuccess(false);
                        setInquiryModalOpen(false);
                      }}
                      className={styles.modalCancelBtn}
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleInquirySubmit}>
                  <div className={styles.modalProductSnippet}>
                    <div className={styles.modalSnippetImg}>
                      {currentImage && (
                        <Image src={currentImage} alt={product.product_title} fill style={{ objectFit: "cover" }} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "#1F2937" }}>
                        {product.product_title}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#6B7280" }}>
                        SKU: {product.sku || "ME-DP-105"} · {product.price_prefix || "From"} ₹
                        {Number(product.product_price || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className={styles.modalFormGroup}>
                    <label className={styles.modalFormLabel}>Your Name *</label>
                    <input
                      required
                      type="text"
                      className={styles.modalFormInput}
                      placeholder="e.g. Architect Rahul Sharma"
                      value={inquiryForm.name}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div className={styles.modalFormGroup}>
                      <label className={styles.modalFormLabel}>Email Address *</label>
                      <input
                        required
                        type="email"
                        className={styles.modalFormInput}
                        placeholder="you@company.com"
                        value={inquiryForm.email}
                        onChange={(e) => setInquiryForm({ ...inquiryForm, email: e.target.value })}
                      />
                    </div>
                    <div className={styles.modalFormGroup}>
                      <label className={styles.modalFormLabel}>Phone Number *</label>
                      <input
                        required
                        type="tel"
                        className={styles.modalFormInput}
                        placeholder="+91 98765 43210"
                        value={inquiryForm.phone}
                        onChange={(e) => setInquiryForm({ ...inquiryForm, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className={styles.modalFormGroup}>
                    <label className={styles.modalFormLabel}>Estimated Quantity Needed</label>
                    <input
                      type="text"
                      className={styles.modalFormInput}
                      placeholder="e.g. 50 pieces (minimum contract)"
                      value={inquiryForm.quantity}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, quantity: e.target.value })}
                    />
                  </div>

                  <div className={styles.modalFormGroup}>
                    <label className={styles.modalFormLabel}>Project Details / Specific Requirements</label>
                    <textarea
                      rows={3}
                      className={styles.modalFormInput}
                      placeholder="Mention delivery location, custom finishes, or timeline..."
                      value={inquiryForm.message}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })}
                    />
                  </div>

                  <button type="submit" disabled={inquiryLoading} className={styles.modalSubmitBtn}>
                    {inquiryLoading ? "Submitting Inquiry..." : "Submit Quote Request"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TECHNICAL SPECIFICATION PDF MODAL ==================== */}
      {showPdfModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowPdfModal(false)}>
          <div
            className={styles.modalContent}
            style={{ maxWidth: "920px", width: "95%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E0531C" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                <h3 className={styles.modalHeaderTitle}>
                  Technical Specification — {product.product_title}
                </h3>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                {product.technical_spec_pdf && (
                  <>
                    <a
                      href={product.technical_spec_pdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.pdfDownloadBtn}
                      style={{ background: "#F1F5F9", color: "#334155", border: "1px solid #CBD5E1" }}
                      title="Open PDF in a new browser tab"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                      </svg>
                      Open Fullscreen
                    </a>
                    <a
                      href={product.technical_spec_pdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className={styles.pdfDownloadBtn}
                      title="Download PDF directly"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download PDF
                    </a>
                  </>
                )}
                <button
                  type="button"
                  className={styles.modalCloseBtn}
                  onClick={() => setShowPdfModal(false)}
                  aria-label="Close modal"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>

            <div className={styles.modalBody} style={{ padding: "1.25rem", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
              {product.technical_spec_pdf ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1, width: "100%" }}>
                  <div style={{ width: "100%", height: "70vh", minHeight: "520px", borderRadius: "8px", overflow: "hidden", border: "1px solid #E2E8F0", background: "#f8fafc" }}>
                    <iframe
                      src={`${product.technical_spec_pdf}#toolbar=1&navpanes=0`}
                      title={`Technical Specification - ${product.product_title}`}
                      style={{ width: "100%", height: "100%", border: "none" }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.25rem", fontSize: "0.8rem", color: "#64748B", flexWrap: "wrap", gap: "0.5rem" }}>
                    <span>Official studio technical specification sheet uploaded from Admin.</span>
                    <div style={{ display: "flex", gap: "1rem" }}>
                      <a href={product.technical_spec_pdf} target="_blank" rel="noopener noreferrer" style={{ color: "#E0531C", textDecoration: "underline", fontWeight: 600 }}>
                        Direct PDF Link &rarr;
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3.5rem 1.5rem", textAlign: "center", background: "#F8FAFC", borderRadius: "10px", border: "1px dashed #CBD5E1", gap: "1.25rem", margin: "1rem 0" }}>
                  <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#FEE2E2", color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                  </div>
                  <div>
                    <h4 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#1E293B", margin: "0 0 0.4rem 0" }}>
                      No Specification PDF Attached Yet
                    </h4>
                    <p style={{ fontSize: "0.875rem", color: "#64748B", maxWidth: "460px", margin: 0, lineHeight: 1.5 }}>
                      An official technical specification PDF has not been uploaded for this product yet. Admin can upload a PDF directly from the Admin Portal.
                    </p>
                  </div>

                  {isAdmin && (
                    <Link
                      href={`/admin/products/edit/${product.id || params.slug}`}
                      style={{ background: "#E0531C", color: "#FFFFFF", padding: "0.65rem 1.35rem", borderRadius: "6px", fontSize: "0.85rem", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px", marginTop: "0.25rem" }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                      Upload PDF in Admin Portal &rarr;
                    </Link>
                  )}

                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center", marginTop: "0.5rem" }}>
                    <a
                      href={`https://wa.me/${product.whatsapp_number || "918511682031"}?text=${encodeURIComponent(`Hello De Luzex, I would like to request the technical specification brochure for ${product.product_title}.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ background: "#25D366", color: "#FFFFFF", padding: "0.55rem 1.1rem", borderRadius: "6px", fontSize: "0.82rem", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      Request via WhatsApp
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPdfModal(false);
                        handleOpenInquiryModal();
                      }}
                      style={{ background: "#FFFFFF", border: "1px solid #CBD5E1", color: "#334155", padding: "0.55rem 1.1rem", borderRadius: "6px", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
                    >
                      Inquire with Studio
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== BOTTOM SECTIONS ==================== */}
      <div className={styles.bottomSections}>
        {/* CUSTOMER REVIEWS */}
        <section className={styles.reviewsSection}>
          <div className={styles.reviewsHeaderRow}>
            <div>
              <h2 className={styles.reviewsTitle}>Customer Reviews</h2>
            </div>
          </div>

          <div className={styles.reviewsDivider} />

          <div className={styles.ratingSummary}>
            <div className={styles.ratingScore}>
              <h3>{(reviewsStats?.average_rating ?? (product.product_rating || 4.8)).toFixed(1)}</h3>
              <div className={styles.stars}>
                {"★".repeat(Math.round(reviewsStats?.average_rating ?? (product.product_rating || 4.8)))}
                {"☆".repeat(5 - Math.round(reviewsStats?.average_rating ?? (product.product_rating || 4.8)))}
              </div>
              <p>{reviewsStats?.total_reviews ? `${reviewsStats.total_reviews} Ratings` : "35k Ratings"}</p>
            </div>
            <div className={styles.ratingBars}>
              {[
                { score: "5.0", count: "14k Reviews", pct: 46 },
                { score: "3.0", count: "10k Reviews", pct: 62 },
                { score: "3.0", count: "10k Reviews", pct: 78 },
                { score: "3.0", count: "10k Reviews", pct: 39 },
              ].map((bar, idx) => (
                <div key={idx} className={styles.ratingBarRow}>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${bar.pct}%` }}></div>
                  </div>
                  <div className={styles.barMeta}>
                    <span className={styles.barScore}>{bar.score}</span>
                    <span className={styles.barReviewsCount}>{bar.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.reviewList}>
            {(reviewsStats?.reviews && reviewsStats.reviews.length > 0
              ? (showAllReviews ? reviewsStats.reviews : reviewsStats.reviews.slice(0, 3)).map((rev) => ({
                  id: rev.id,
                  author_name: rev.author_name,
                  time_ago: rev.created_at
                    ? new Date(rev.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Recent",
                  rating: rev.rating || 5,
                  text: rev.text,
                  photos: [],
                }))
              : [
                  {
                    id: "figma-1",
                    author_name: "Soni Patel",
                    time_ago: "2 weeks ago",
                    rating: 5,
                    text: "The chandelier exceeded my expectations. The crystal finish is stunning, the lighting is warm and elegant, and it has completely transformed our living room. Highly recommended!",
                    photos: [
                      "/images/category_chandelier_1784107756268.jpg",
                      "/images/lamp_black_gold_1784107745696.jpg",
                      "/images/about_chandelier_1784107790569.jpg",
                      "/images/project_lobby_1784107778993.jpg",
                      "/images/lamp_classic_1784107722127.jpg",
                    ],
                  },
                  {
                    id: "figma-2",
                    author_name: "Soni Patel",
                    time_ago: "2 weeks ago",
                    rating: 5,
                    text: "The chandelier exceeded my expectations. The crystal finish is stunning, the lighting is warm and elegant, and it has completely transformed our living room. Highly recommended!",
                    photos: [],
                  },
                ]
            ).map((rev: any, i: number) => {
              const starCount = Math.max(1, Math.min(5, rev.rating || 5));

              return (
                <div key={rev.id || i} className={styles.reviewItem}>
                  <div className={styles.reviewHeader}>
                    <div className={styles.reviewUser}>
                      <div className={styles.avatarCircle}>
                        <img
                          src="/images/logos/de_luzex_white.svg"
                          alt="De Luzex"
                          className={styles.avatarImg}
                        />
                      </div>
                      <div className={styles.reviewUserInfo}>
                        <span className={styles.reviewName}>{rev.author_name}</span>
                        <span className={styles.reviewSeparatorDot}>·</span>
                        <span className={styles.reviewDate}>{rev.time_ago}</span>
                      </div>
                    </div>
                    <div className={styles.reviewRatingRight}>
                      <span className={styles.reviewScoreNumber}>{(rev.rating || 5).toFixed(1)}</span>
                      <span className={styles.reviewStarsGold}>
                        {"★".repeat(starCount)}
                      </span>
                    </div>
                  </div>
                  <p className={styles.reviewText}>{rev.text}</p>
                  {Array.isArray(rev.photos) && rev.photos.length > 0 && (
                    <div className={styles.reviewPhotosRow}>
                      {rev.photos.map((photoSrc: string, pIdx: number) => (
                        <div key={pIdx} className={styles.reviewPhotoThumb}>
                          <Image
                            src={photoSrc}
                            alt={`Review photo ${pIdx + 1}`}
                            fill
                            sizes="72px"
                            className={styles.reviewThumbImg}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {((reviewsStats?.reviews?.length ?? 2) > 3) && (
            <button
              className={styles.readAllBtn}
              type="button"
              onClick={() => setShowAllReviews(!showAllReviews)}
            >
              <span className={styles.readAllBtnText}>
                {showAllReviews ? "Show Fewer Reviews" : "Read All Reviews"}
              </span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={styles.readAllBtnIcon}
                style={{
                  transform: showAllReviews ? "rotate(180deg)" : "none",
                  transition: "transform 0.25s ease",
                }}
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          )}
        </section>

        {/* COMPLETE THE LOOK */}
        <section className={styles.ctlSection}>
          <p className={styles.sectionSub}>curated pairing</p>
          <h2 className={styles.sectionTitle}>COMPLETE THE LOOK</h2>

          <div ref={ctlGridRef} className={styles.ctlGrid}>
            {(relatedProducts.length > 0 ? relatedProducts : [
              {
                id: "1",
                product_title: "AURORA CHANDELIER",
                product_price: 300,
                product_main_image: "/images/lamp_modern_tall_1784107732736.jpg",
              },
              {
                id: "2",
                product_title: "AURORA CHANDELIER",
                product_price: 300,
                product_main_image: "/images/lamp_modern_tall_1784107732736.jpg",
              },
              {
                id: "3",
                product_title: "AURORA CHANDELIER",
                product_price: 300,
                product_main_image: "/images/lamp_modern_tall_1784107732736.jpg",
              },
            ]).map((prod: any, i: number) => {
              const prodId = prod._id || prod.id || i;
              const isSelected = activeCtlId === prodId;
              return (
                <div
                  key={prodId}
                  className={styles.productCard}
                  onClick={() => setActiveCtlId(isSelected ? null : prodId)}
                >
                  <div className={`${styles.productImageWrapper} ${isSelected ? styles.productCardFeatured : ""}`}>
                    <div
                      className={styles.productImageLink}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveCtlId(isSelected ? null : prodId);
                      }}
                    >
                      <Image
                        src={prod.product_main_image || "/images/lamp_modern_tall_1784107732736.jpg"}
                        alt={prod.product_title}
                        fill
                        sizes="350px"
                        className={styles.productImg}
                      />
                    </div>
                    <button
                      type="button"
                      className={styles.productQuickAddBtn}
                      aria-label={`Add ${prod.product_title} to cart`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        dispatch(
                          addToCart({
                            id: String(prod.id || prod._id || Math.random()),
                            name: prod.product_title,
                            price: Number(prod.product_price) || 0,
                            product_main_image: prod.product_main_image || "/images/lamp_modern_tall_1784107732736.jpg",
                            quantity: 1,
                          })
                        );
                        dispatch(openCart());
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </button>
                  </div>

                  <div className={styles.productInfoRow}>
                    <Link
                      href={`/product/${prod._id || prod.id}`}
                      className={styles.productTitleLink}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <h4 className={styles.productName}>{prod.product_title}</h4>
                    </Link>
                    <div className={styles.productPrice}>₹{prod.product_price}</div>
                  </div>
                  <div className={styles.ctlProductRating}>
                    <span className={styles.ctlRatingStar}>★</span>
                    <span className={styles.ctlRatingScore}>4.8</span>
                    <span className={styles.ctlRatingCount}> ( 300 Reviews )</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.ctlControls}>
            <button
              type="button"
              className={`${styles.ctlArrowBtn} ${styles.ctlArrowLeft}`}
              onClick={() => {
                if (ctlGridRef.current) {
                  ctlGridRef.current.scrollBy({ left: -360, behavior: "smooth" });
                }
              }}
              aria-label="Previous products"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button
              type="button"
              className={`${styles.ctlArrowBtn} ${styles.ctlArrowRight}`}
              onClick={() => {
                if (ctlGridRef.current) {
                  ctlGridRef.current.scrollBy({ left: 360, behavior: "smooth" });
                }
              }}
              aria-label="Next products"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </section>

        {/* FAQ ACCORDION */}
        <section className={styles.faqSection}>
          <div className={styles.faqContainer}>
            <h2 className={styles.faqTitle}>
              Frequently asked<br />questions
            </h2>
            <p className={styles.faqSub}>Start free, scale as you grow. All plans include core features.</p>

            <div className={styles.faqList}>
              {[
                {
                  q: "Do you offer custom lighting solutions?",
                  a: "Yes, we create bespoke lighting pieces tailored to your space and requirements.",
                },
                {
                  q: "What is the lead time for custom orders?",
                  a: "Standard custom production takes 3-4 weeks depending on the design complexity and materials.",
                },
                {
                  q: "Do you provide installation support?",
                  a: "Yes, we provide detailed technical wiring guides and partner with certified electricians across major cities.",
                },
                {
                  q: "Can I request a specific finish or size?",
                  a: "Absolutely! Our studio can customize dimensions, metallic finishes, and cord lengths for your project.",
                },
                {
                  q: "Do your products come with a warranty?",
                  a: "All our lighting products include a comprehensive 3-year warranty covering manufacturing and electrical components.",
                },
                {
                  q: "Do you ship across India?",
                  a: "Yes, we offer insured pan-India delivery with premium wooden crate packaging for complete safety.",
                },
              ].map((faq, i) => (
                <div
                  key={i}
                  className={`${styles.faqAccordion} ${openFaq === i ? styles.faqAccordionOpen : ""}`}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <div className={styles.faqAccordionHeader}>
                    <span className={styles.faqQuestion}>{faq.q}</span>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={styles.faqIcon}
                    >
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                  </div>
                  <div className={styles.faqAccordionContent}>{faq.a}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ==================== WRITE REVIEW MODAL ==================== */}
      {showReviewModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => !reviewSubmitting && setShowReviewModal(false)}
        >
          <div
            className={styles.modalContent}
            style={{ maxWidth: "540px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>Write a Customer Review</h3>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "#6B7280" }}>
                  {product.product_title}
                </p>
              </div>
              <button
                className={styles.modalCloseBtn}
                type="button"
                onClick={() => !reviewSubmitting && setShowReviewModal(false)}
              >
                ✕
              </button>
            </div>

            {reviewSuccessMsg ? (
              <div className={styles.modalSuccessBox}>
                <div className={styles.modalSuccessIcon}>✓</div>
                <h4 style={{ margin: "0 0 0.5rem", fontSize: "1.15rem", color: "#1F2937" }}>
                  Review Published!
                </h4>
                <p style={{ margin: 0, fontSize: "0.88rem", color: "#4B5563" }}>
                  {reviewSuccessMsg}
                </p>
              </div>
            ) : (
              <form onSubmit={handleReviewSubmit} className={styles.modalBody}>
                {/* Rating Picker */}
                <div className={styles.modalFormGroup}>
                  <label className={styles.modalFormLabel}>Overall Rating *</label>
                  <div className={styles.starPickerRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className={`${styles.starBtn} ${(reviewHoverRating || reviewRating) >= star ? styles.starBtnActive : ""}`}
                        onClick={() => setReviewRating(star)}
                        onMouseEnter={() => setReviewHoverRating(star)}
                        onMouseLeave={() => setReviewHoverRating(0)}
                        aria-label={`${star} Stars`}
                      >
                        ★
                      </button>
                    ))}
                    <span className={styles.starLabel}>
                      {(reviewHoverRating || reviewRating) === 5 && "5 - Excellent!"}
                      {(reviewHoverRating || reviewRating) === 4 && "4 - Very Good"}
                      {(reviewHoverRating || reviewRating) === 3 && "3 - Good"}
                      {(reviewHoverRating || reviewRating) === 2 && "2 - Fair"}
                      {(reviewHoverRating || reviewRating) === 1 && "1 - Poor"}
                    </span>
                  </div>
                </div>

                <div className={styles.modalFormGroup}>
                  <label className={styles.modalFormLabel}>Your Name *</label>
                  <input
                    required
                    type="text"
                    value={reviewForm.name}
                    onChange={(e) => setReviewForm({ ...reviewForm, name: e.target.value })}
                    placeholder="e.g. Sarah Williams"
                    className={styles.modalFormInput}
                  />
                </div>

                <div className={styles.modalFormGroup}>
                  <label className={styles.modalFormLabel}>Email Address (Optional)</label>
                  <input
                    type="email"
                    value={reviewForm.email}
                    onChange={(e) => setReviewForm({ ...reviewForm, email: e.target.value })}
                    placeholder="e.g. sarah@example.com"
                    className={styles.modalFormInput}
                  />
                </div>

                <div className={styles.modalFormGroup}>
                  <label className={styles.modalFormLabel}>Review Title / Headline</label>
                  <input
                    type="text"
                    value={reviewForm.title}
                    onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                    placeholder="e.g. Stunning quality and safe delivery"
                    className={styles.modalFormInput}
                  />
                </div>

                <div className={styles.modalFormGroup}>
                  <label className={styles.modalFormLabel}>Your Review *</label>
                  <textarea
                    required
                    rows={4}
                    value={reviewForm.text}
                    onChange={(e) => setReviewForm({ ...reviewForm, text: e.target.value })}
                    placeholder="Write your feedback here... What did you like or dislike about the finish, lighting, craftsmanship, or packaging?"
                    className={styles.modalFormInput}
                    style={{ resize: "vertical" }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={reviewSubmitting}
                  className={styles.modalSubmitBtn}
                >
                  {reviewSubmitting ? "Submitting Review..." : "Submit Review"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

