"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "../page.module.css";
import { Category, fetchCategories } from "../services/api";

export interface CategoryItem {
  id?: string | number;
  _id?: string;
  name?: string;
  image_url?: string;
  image?: string;
}

interface CategoriesCarouselProps {
  categories?: (Category | CategoryItem)[];
}

const DEFAULT_CATEGORIES: CategoryItem[] = [
  {
    id: "pendant-lights",
    name: "Pendant Lights",
    image_url: "/images/category_chandelier_1784107756268.jpg",
  },
  {
    id: "chandeliers",
    name: "Chandeliers",
    image_url: "/images/about_chandelier_1784107790569.jpg",
  },
  {
    id: "cob",
    name: "COB",
    image_url: "/images/project_lobby_1784107778993.jpg",
  },
  {
    id: "table-lamps",
    name: "Table Lamps",
    image_url: "/images/lamp_black_gold_1784107745696.jpg",
  },
];

export default function CategoriesCarousel({ categories }: CategoriesCarouselProps) {
  const [list, setList] = useState<(Category | CategoryItem)[]>(
    categories && categories.length > 0 ? categories : []
  );

  useEffect(() => {
    if (categories && categories.length > 0) {
      setList(categories);
    } else {
      fetchCategories()
        .then((data) => {
          if (data && data.length > 0) setList(data);
        })
        .catch(() => {});
    }
  }, [categories]);

  const displayCategories = list.length > 0 ? list : DEFAULT_CATEGORIES;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Drag interaction refs
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const scrollLeftStartRef = useRef(0);
  const hasDraggedRef = useRef(false);

  // Update scroll progress bar
  const updateProgress = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll > 0) {
      setScrollProgress(Math.min(1, Math.max(0, scrollLeft / maxScroll)));
    } else {
      setScrollProgress(0);
    }
  }, []);

  const handleScrollStep = useCallback((direction: "prev" | "next") => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const firstCard = container.querySelector(`.${styles.catCard}`) as HTMLElement | null;
    const cardWidth = firstCard ? firstCard.getBoundingClientRect().width : 280;
    const gap = 24;
    const scrollAmount = cardWidth + gap;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    const maxScroll = Math.max(0, scrollWidth - clientWidth);

    if (maxScroll <= 5) return;

    if (direction === "next") {
      if (scrollLeft >= maxScroll - 10) {
        // Smooth loop back to beginning
        container.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        const target = Math.min(scrollLeft + scrollAmount, maxScroll);
        container.scrollTo({ left: target, behavior: "smooth" });
      }
    } else {
      if (scrollLeft <= 10) {
        container.scrollTo({ left: maxScroll, behavior: "smooth" });
      } else {
        const target = Math.max(scrollLeft - scrollAmount, 0);
        container.scrollTo({ left: target, behavior: "smooth" });
      }
    }
  }, []);

  // Automatic scrolling timer (5 seconds)
  useEffect(() => {
    if (isPaused || isDragging || displayCategories.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      handleScrollStep("next");
    }, 5000);

    return () => window.clearInterval(timer);
  }, [isPaused, isDragging, displayCategories.length, handleScrollStep]);

  // Attach scroll listener to update scrollbar thumb
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener("scroll", updateProgress, { passive: true });
    updateProgress();

    return () => {
      el.removeEventListener("scroll", updateProgress);
    };
  }, [updateProgress]);

  // Mouse drag handlers
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
    const walk = (x - startXRef.current) * 1.3;
    if (Math.abs(walk) > 6) {
      hasDraggedRef.current = true;
    }
    scrollRef.current.scrollLeft = scrollLeftStartRef.current - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 120);
  };

  return (
    <div
      className={styles.categoriesCarouselWrapper}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => {
        if (isDragging) handleMouseUp();
        setIsPaused(false);
      }}
      onFocus={() => setIsPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setIsPaused(false);
        }
      }}
    >
      {/* Previous Button */}
      <button
        type="button"
        className={`${styles.catNavBtn} ${styles.catNavBtnPrev}`}
        onClick={() => handleScrollStep("prev")}
        aria-label="Previous categories"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Categories Scroll Track */}
      <div
        ref={scrollRef}
        className={styles.categoryGrid}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        {displayCategories.map((cat, idx) => {
          const catIdentifier = cat.name || cat._id || cat.id || "All";
          const rawImg = cat.image_url || (cat as any).image;
          const imgSrc = rawImg && rawImg.trim() ? rawImg.trim() : (list.length === 0 ? DEFAULT_CATEGORIES[idx % DEFAULT_CATEGORIES.length].image_url : null);

          return (
            <Link
              key={cat.id || cat._id || idx}
              href={`/shop?category=${encodeURIComponent(catIdentifier)}`}
              className={styles.catCard}
              onClick={(e) => {
                if (hasDraggedRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              draggable={false}
            >
              {imgSrc ? (
                <Image
                  src={imgSrc}
                  alt={cat.name || "Category"}
                  fill
                  sizes="(max-width: 768px) 240px, 320px"
                  style={{ objectFit: "cover", pointerEvents: "none" }}
                  draggable={false}
                />
              ) : (
                <div className={styles.catCardPlaceholder}>
                  <span className={styles.catCardPlaceholderIcon}>✦</span>
                  <span className={styles.catCardPlaceholderSub}>Signature Family</span>
                </div>
              )}
              <div className={styles.catCardLabel}>
                <span>{cat.name}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Next Button */}
      <button
        type="button"
        className={`${styles.catNavBtn} ${styles.catNavBtnNext}`}
        onClick={() => handleScrollStep("next")}
        aria-label="Next categories"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Subtle Progress Scrollbar Indicator */}
      <div className={styles.categoriesScrollbarTrack} aria-hidden="true">
        <div
          className={styles.categoriesScrollbarThumb}
          style={{
            transform: `translateX(${scrollProgress * 200}%)`,
          }}
        />
      </div>
    </div>
  );
}
