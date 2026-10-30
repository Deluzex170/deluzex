"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "../page.module.css";
// PREVIOUS API IMPORT - COMMENTED OUT AS PER REQUIREMENT:
// import { fetchHeroProducts } from "../services/api";
import { fetchProducts } from "../services/api";

export type HeroLamp = {
  _id?: string;
  id?: string;
  slug?: string;
  image: string;
  name: string;
  price?: number;
  count?: number;
  alt: string;
};

export default function HeroProductWidget() {
  const router = useRouter();
  const [lamps, setLamps] = useState<HeroLamp[]>([]);
  const [carouselPosition, setCarouselPosition] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    let isMounted = true;
    /* PREVIOUS CODE - COMMENTED OUT AS PER REQUIREMENT:
    fetchHeroProducts()
      .then((data) => {
        if (isMounted && data) {
          const formatted: HeroLamp[] = data.map((item) => ({
            _id: item._id || item.id,
            id: item.id || item._id,
            image: item.image,
            name: item.name,
            price: item.price,
            count: item.count ?? item.price,
            alt: item.alt,
          }));
          setLamps(formatted);
          setCarouselPosition(formatted.length * 2 + 1);
        }
      })
      .catch((err) => {
        console.error("Failed to load hero products from API:", err);
      });
    */

    // NEW IMPLEMENTATION: Load products selected via Admin Products (is_featured = true)
    fetchProducts()
      .then((allProducts) => {
        if (!isMounted || !allProducts) return;

        // Filter products selected in Admin for the Hero section
        const heroSelected = allProducts.filter((p) => p.is_featured);

        // If admin has selected hero products, display those; otherwise fallback to first available products
        const sourceList = heroSelected.length > 0 ? heroSelected : allProducts.slice(0, 5);

        if (sourceList.length > 0) {
          const formatted: HeroLamp[] = sourceList.map((item) => ({
            _id: String(item._id || item.id || ""),
            id: String(item.id || item._id || ""),
            slug: item.slug,
            image: item.product_main_image || item.image || item.image_url || "/placeholder.jpg",
            name: item.product_title || item.title || item.name || "Luxury Fixture",
            price: Number(item.product_price ?? item.price ?? 0),
            count: Number(item.product_price ?? item.price ?? 0),
            alt: item.product_title || item.title || "Luxury Architectural Lighting",
          }));
          setLamps(formatted);
          setCarouselPosition(formatted.length * 2 + 1);
        }
      })
      .catch((err) => {
        console.error("Failed to load products for hero section:", err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartTimeRef = useRef(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const currentDragOffsetRef = useRef(0);
  const hasDraggedRef = useRef(false);

  const mouseStartXRef = useRef<number | null>(null);
  const isMouseDraggingRef = useRef(false);

  const lampCount = lamps.length;
  const carouselLamps = Array.from(
    { length: lampCount * 5 },
    (_, index) => lamps[index % lampCount]
  );
  const activeIndex = lampCount ? ((carouselPosition % lampCount) + lampCount) % lampCount : 0;
  const activeLamp = lamps[activeIndex];

  // Auto-rotation timer
  useEffect(() => {
    if (lampCount < 2 || isPaused || isDragging) {
      return;
    }

    const timer = window.setInterval(() => {
      setCarouselPosition((currentPosition) => currentPosition + 1);
    }, 2000);

    return () => window.clearInterval(timer);
  }, [lampCount, isPaused, isDragging]);

  // Seamless wrap-around boundaries
  useEffect(() => {
    if (!lamps.length) return;
    if (carouselPosition >= lamps.length * 4) {
      const resetTimer = window.setTimeout(() => {
        setIsResetting(true);
        setCarouselPosition((pos) => ((pos % lamps.length) + lamps.length) % lamps.length + lamps.length * 2);
        window.requestAnimationFrame(() => setIsResetting(false));
      }, 550);

      return () => window.clearTimeout(resetTimer);
    } else if (carouselPosition < lamps.length) {
      const resetTimer = window.setTimeout(() => {
        setIsResetting(true);
        setCarouselPosition((pos) => ((pos % lamps.length) + lamps.length) % lamps.length + lamps.length * 2);
        window.requestAnimationFrame(() => setIsResetting(false));
      }, 550);

      return () => window.clearTimeout(resetTimer);
    }
  }, [carouselPosition, lamps.length]);

  const selectLamp = useCallback((targetIndex: number) => {
    const currentNormalized = ((carouselPosition % lamps.length) + lamps.length) % lamps.length;
    let diff = targetIndex - currentNormalized;
    if (diff > lamps.length / 2) diff -= lamps.length;
    if (diff < -lamps.length / 2) diff += lamps.length;
    setCarouselPosition((prev) => prev + diff);
  }, [carouselPosition, lamps.length]);

  // Touch handlers for mobile swipe with bare finger
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    touchStartTimeRef.current = Date.now();
    currentDragOffsetRef.current = 0;
    hasDraggedRef.current = false;
    isHorizontalSwipeRef.current = null;
    setIsDragging(true);
    setIsPaused(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartXRef.current;
    const diffY = currentY - touchStartYRef.current;

    if (isHorizontalSwipeRef.current === null) {
      if (Math.abs(diffX) > 6 || Math.abs(diffY) > 6) {
        isHorizontalSwipeRef.current = Math.abs(diffX) > Math.abs(diffY);
      }
    }

    if (isHorizontalSwipeRef.current) {
      if (Math.abs(diffX) > 4) {
        hasDraggedRef.current = true;
      }
      const acceleratedDiff = diffX * 1.5;
      currentDragOffsetRef.current = acceleratedDiff;
      setDragOffset(acceleratedDiff);
    }
  };

  const handleTouchEnd = () => {
    if (touchStartXRef.current !== null && isHorizontalSwipeRef.current) {
      const diffX = currentDragOffsetRef.current;
      const elapsed = Date.now() - touchStartTimeRef.current;
      const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
      const step = isMobile ? 127 : 204;

      let delta = 0;
      if (Math.abs(diffX) > 15) {
        delta = Math.round(-diffX / step);
        if (delta === 0) {
          delta = diffX < 0 ? 1 : -1;
        }
      } else if (elapsed < 350 && Math.abs(diffX) > 10) {
        delta = diffX < 0 ? 1 : -1;
      }

      if (delta !== 0) {
        setCarouselPosition((prev) => prev + delta);
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isHorizontalSwipeRef.current = null;
    currentDragOffsetRef.current = 0;
    setDragOffset(0);
    setIsDragging(false);

    window.setTimeout(() => {
      hasDraggedRef.current = false;
      setIsPaused(false);
    }, 200);
  };

  // Mouse drag handlers for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    mouseStartXRef.current = e.clientX;
    touchStartTimeRef.current = Date.now();
    currentDragOffsetRef.current = 0;
    hasDraggedRef.current = false;
    isMouseDraggingRef.current = true;
    setIsDragging(true);
    setIsPaused(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDraggingRef.current || mouseStartXRef.current === null) return;
    const diffX = (e.clientX - mouseStartXRef.current) * 1.5;
    if (Math.abs(diffX) > 4) {
      hasDraggedRef.current = true;
    }
    currentDragOffsetRef.current = diffX;
    setDragOffset(diffX);
  };

  const handleMouseUp = () => {
    if (isMouseDraggingRef.current && mouseStartXRef.current !== null) {
      const diffX = currentDragOffsetRef.current;
      const elapsed = Date.now() - touchStartTimeRef.current;
      const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
      const step = isMobile ? 127 : 204;

      let delta = 0;
      if (Math.abs(diffX) > 30) {
        delta = Math.round(-diffX / step);
        if (delta === 0) {
          delta = diffX < 0 ? 1 : -1;
        }
      } else if (elapsed < 300 && Math.abs(diffX) > 18) {
        delta = diffX < 0 ? 1 : -1;
      }

      if (delta !== 0) {
        setCarouselPosition((prev) => prev + delta);
      }
    }

    mouseStartXRef.current = null;
    isMouseDraggingRef.current = false;
    currentDragOffsetRef.current = 0;
    setDragOffset(0);
    setIsDragging(false);

    window.setTimeout(() => {
      hasDraggedRef.current = false;
      setIsPaused(false);
    }, 200);
  };

  const handleMouseLeave = () => {
    if (isMouseDraggingRef.current) {
      handleMouseUp();
    }
    setIsPaused(false);
  };

  if (!activeLamp) return null;

  return (
    <div
      className={styles.heroRight}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={handleMouseLeave}
      onFocus={() => setIsPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsPaused(false);
        }
      }}
    >
      {/* PREVIOUS STATIC SHOP LINK - COMMENTED OUT AS PER REQUIREMENT:
      <Link href="/shop" className={styles.heroInfoCard} aria-live="polite" style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }} title="View product in shop">
      */}
      <Link
        href={activeLamp?._id || activeLamp?.id ? `/product/${activeLamp._id || activeLamp.id}` : "/shop"}
        className={styles.heroInfoCard}
        aria-live="polite"
        style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}
        title={`View ${activeLamp?.name || "product"} details`}
      >
        <div className={styles.heroInfoCardImg}>
          <Image
            src={activeLamp.image}
            alt={activeLamp.alt}
            fill
            sizes="110px"
            style={{ objectFit: "cover" }}
          />
        </div>
        <div className={styles.heroInfoCardContent}>
          <span className={styles.heroInfoCardName}>{activeLamp.name}</span>
          <span className={styles.heroInfoCardCount}>
            ₹{Number(activeLamp.price ?? activeLamp.count ?? 0).toLocaleString("en-IN")}
          </span>
        </div>
      </Link>

      <div
        className={styles.heroLamps}
        aria-label="Featured lighting products"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ cursor: isDragging ? "grabbing" : "grab", touchAction: "pan-y" }}
      >
        <div
          className={styles.heroLampsTrack}
          style={{
            transform: `translateX(calc(50% - var(--hero-card-half) - ${carouselPosition} * var(--hero-carousel-step) + ${dragOffset}px))`,
            transition: isDragging || isResetting ? "none" : "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {carouselLamps.map((lamp, position) => (
            <button
              key={`${lamp.image}-${position}`}
              type="button"
              className={`${styles.heroLampCard} ${position === carouselPosition ? styles.heroLampCardActive : ""
                }`}
              onClick={(e) => {
                if (hasDraggedRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
                // If clicking on active center card, navigate to its product detail page
                if (position === carouselPosition && (lamp._id || lamp.id)) {
                  router.push(`/product/${lamp._id || lamp.id}`);
                  return;
                }
                setCarouselPosition(position);
              }}
              aria-label={`Show ${lamp.name}`}
              aria-pressed={position === carouselPosition}
            >
              <Image
                src={lamp.image}
                alt={lamp.alt}
                fill
                draggable={false}
                sizes="(max-width: 768px) 160px, 240px"
                style={{ objectFit: "cover", pointerEvents: "none" }}
              />
            </button>
          ))}
        </div>
      </div>

      <div className={styles.heroDots} aria-label="Select featured lighting product">
        {[0, 1, 2].map((dotIndex) => {
          const isSelected = ((activeIndex % 3) + 3) % 3 === dotIndex;
          return (
            <button
              key={dotIndex}
              type="button"
              className={`${styles.heroDot} ${isSelected ? styles.heroDotActive : ""}`}
              onClick={() => selectLamp(dotIndex)}
              aria-label={`Select product ${dotIndex + 1}`}
              aria-pressed={isSelected}
            />
          );
        })}
      </div>
    </div>
  );
}
