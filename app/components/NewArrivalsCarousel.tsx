"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "../page.module.css";
import AddToCartButton from "./AddToCartButton";
import WishlistButton from "./WishlistButton";
import { Product, fetchProducts } from "../services/api";

interface NewArrivalsCarouselProps {
  products?: Product[];
}

const formatPrice = (price?: string | number) => {
  if (!price && price !== 0) return "Price on request";
  const str = String(price).trim();
  if (str.startsWith("$") || str.startsWith("₹")) return str;
  const num = Number(str.replace(/[^\d.-]/g, ""));
  if (!isNaN(num) && num > 0) {
    return `₹${num.toLocaleString("en-IN")}`;
  }
  return `₹${str}`;
};

export default function NewArrivalsCarousel({ products }: NewArrivalsCarouselProps) {
  const [activeProducts, setActiveProducts] = useState<Product[]>(
    products || []
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const scrollLeftStartRef = useRef(0);
  const hasDraggedRef = useRef(false);

  useEffect(() => {
    if (products && products.length > 0) {
      setActiveProducts(products);
    }
    fetchProducts("is_new_arrival=true")
      .then((data) => {
        setActiveProducts(data);
      })
      .catch(() => { });
  }, [products]);

  // Keep up to 6 products to display the grid/carousel as shown in design
  const displayList = activeProducts.slice(0, 6);

  const handleScroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const firstCard = container.querySelector(`.${styles.newArrivalCard}`) as HTMLElement | null;
    const cardWidth = firstCard ? firstCard.offsetWidth : 215;
    const gap = 14;
    const scrollAmount = cardWidth + gap;

    if (direction === "left") {
      container.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    } else {
      container.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    hasDraggedRef.current = false;
    startXRef.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeftStartRef.current = scrollRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.2;
    if (Math.abs(walk) > 6) {
      hasDraggedRef.current = true;
    }
    scrollRef.current.scrollLeft = scrollLeftStartRef.current - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 150);
  };

  return (
    <>
      <div
        ref={scrollRef}
        className={styles.newArrivalsGrid}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={isDragging ? { cursor: "grabbing" } : undefined}
      >
        {displayList.map((product, idx) => {
          const pId = String(product._id || product.id || idx);
          const title = product.product_title || product.name || "Product";
          const price = formatPrice(product.product_price);
          const rating = product.product_rating;

          return (
            <div
              key={`${pId}-${idx}`}
              className={styles.newArrivalCard}
            >
              <div className={styles.newArrivalImgBox}>
                <Link
                  href={`/product/${pId}`}
                  className={styles.newArrivalImgLink}
                  title={title}
                  onClick={(e) => {
                    if (hasDraggedRef.current) e.preventDefault();
                  }}
                >
                  <Image
                    src={
                      product.product_main_image ||
                      "/images/lamp_modern_tall_1784107732736.jpg"
                    }
                    alt={title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
                    style={{ objectFit: "cover" }}
                    draggable={false}
                  />
                </Link>
                <WishlistButton product={product} variant="floating" />
                <AddToCartButton product={product} variant="plus" />
              </div>

              <div className={styles.newArrivalInfo}>
                <div className={styles.newArrivalTopRow}>
                  <Link
                    href={`/product/${pId}`}
                    style={{ textDecoration: "none", color: "inherit", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}
                    onClick={(e) => {
                      if (hasDraggedRef.current) e.preventDefault();
                    }}
                  >
                    <h4 className={styles.newArrivalName} title={title}>
                      {title}
                    </h4>
                  </Link>
                  <span className={styles.newArrivalPrice}>{price}</span>
                </div>
                <div className={styles.newArrivalRating}>
                  <span className={styles.newArrivalStar}>★</span>
                  <span className={styles.newArrivalRatingText}>
                    {rating ? `${rating} / 5` : "Not rated yet"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Arrows (matching Figma) */}
      <div className={styles.newArrivalArrows}>
        <button
          type="button"
          className={styles.newArrivalArrowBtn}
          onClick={() => handleScroll("left")}
          aria-label="Previous new arrivals"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <button
          type="button"
          className={`${styles.newArrivalArrowBtn} ${styles.newArrivalArrowActive}`}
          onClick={() => handleScroll("right")}
          aria-label="Next new arrivals"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </>
  );
}
