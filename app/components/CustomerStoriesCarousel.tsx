"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import styles from "../page.module.css";
import { fetchTestimonials, Testimonial } from "../services/api";

interface CustomerStoriesCarouselProps {
  initialStories?: Testimonial[];
}

const DEFAULT_STORIES: Testimonial[] = [
  {
    id: "default-1",
    author_name: "Anna Clark",
    author_title: "Interior Architect, Studio Aura",
    text: "The quality and craftsmanship are truly exceptional. The bespoke chandelier we ordered for our penthouse project became the defining statement piece of the entire home.",
    rating: 5,
    avatar_url: "/images/avatar_woman_1784107804209.jpg",
  },
  {
    id: "default-2",
    author_name: "Marcus Vance",
    author_title: "Principal Architect, Vance & Co.",
    text: "Deluzex lighting transformed our luxury villa project. The hand-finished brass and warm ambient diffusion exceeded all our architectural standards.",
    rating: 5,
    avatar_url: "/images/logos/de_luzex_black.svg",
  },
  {
    id: "default-3",
    author_name: "Priya Sharma",
    author_title: "Residential Interior Designer, Mumbai",
    text: "From the initial design consultation to white-glove delivery, the experience was flawless. Our clients were stunned by the crystal detailing and warm illumination.",
    rating: 5,
    avatar_url: "/images/avatar_woman_1784107804209.jpg",
  },
  {
    id: "default-4",
    author_name: "Devang Patel",
    author_title: "Heritage Homeowner, Ahmedabad",
    text: "Finding fixtures that blend classical grandeur with contemporary elegance is rare. Deluzex delivers perfection in every handcrafted dimension.",
    rating: 5,
    avatar_url: "/images/logos/de_luzex_black.svg",
  },
  {
    id: "default-5",
    author_name: "Sophia Moreau",
    author_title: "Hospitality Lighting Consultant",
    text: "We specified Deluzex luminaires for a boutique hotel lounge. The precision of the dimming and the tactile richness of the brushed metals were simply unmatched.",
    rating: 5,
    avatar_url: "/images/avatar_woman_1784107804209.jpg",
  },
  {
    id: "default-6",
    author_name: "Vikramaditya Roy",
    author_title: "Design Director, Atelier Luxe",
    text: "The level of engineering behind their pendant lamps is extraordinary. It feels more like living sculpture than mere functional illumination.",
    rating: 5,
    avatar_url: "/images/logos/de_luzex_black.svg",
  },
];

export default function CustomerStoriesCarousel({
  initialStories,
}: CustomerStoriesCarouselProps) {
  const [stories, setStories] = useState<Testimonial[]>(
    initialStories && initialStories.length > 0 ? initialStories : DEFAULT_STORIES
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const scrollLeftStartRef = useRef(0);
  const hasDraggedRef = useRef(false);

  // Client-side refresh from API in case admin updated stories
  useEffect(() => {
    fetchTestimonials()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setStories(data);
        }
      })
      .catch(() => {
        // Keep current stories
      });
  }, []);

  const count = stories.length;

  const scrollToStory = useCallback(
    (targetIndex: number) => {
      if (!trackRef.current || count <= 1) return;
      const track = trackRef.current;
      const cards = track.querySelectorAll<HTMLElement>(`.${styles.storyCard}`);
      if (!cards.length) return;

      const normalized = ((targetIndex % count) + count) % count;
      const targetCard = cards[normalized];
      if (targetCard) {
        const cardLeft = targetCard.offsetLeft;
        const cardWidth = targetCard.offsetWidth;
        const trackWidth = track.clientWidth;
        const targetScroll = cardLeft - (trackWidth - cardWidth) / 2;

        track.scrollTo({
          left: Math.max(0, targetScroll),
          behavior: "smooth",
        });
        setActiveIndex(normalized);
      }
    },
    [count]
  );

  // Auto-advance interval (every 5 seconds when multiple stories exist)
  useEffect(() => {
    if (count <= 1 || isPaused || isDragging) return;

    const timer = window.setInterval(() => {
      scrollToStory(activeIndex + 1);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [count, isPaused, isDragging, activeIndex, scrollToStory]);

  // Sync activeIndex with user manual scroll or swipe
  useEffect(() => {
    const track = trackRef.current;
    if (!track || count <= 1) return;

    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!track) return;
        const trackCenter = track.scrollLeft + track.clientWidth / 2;
        const cards = track.querySelectorAll<HTMLElement>(`.${styles.storyCard}`);
        let closestIdx = 0;
        let minDiff = Infinity;
        cards.forEach((card, idx) => {
          const cardCenter = card.offsetLeft + card.offsetWidth / 2;
          const diff = Math.abs(trackCenter - cardCenter);
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = idx;
          }
        });
        setActiveIndex(closestIdx);
      });
    };

    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [count]);

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!trackRef.current || count <= 1) return;
    setIsDragging(true);
    hasDraggedRef.current = false;
    startXRef.current = e.pageX - trackRef.current.offsetLeft;
    scrollLeftStartRef.current = trackRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !trackRef.current || count <= 1) return;
    e.preventDefault();
    const x = e.pageX - trackRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.3;
    if (Math.abs(walk) > 6) {
      hasDraggedRef.current = true;
    }
    trackRef.current.scrollLeft = scrollLeftStartRef.current - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 150);
  };

  // Touch handlers for mobile swipe
  const handleTouchStart = () => {
    if (count > 1) {
      setIsDragging(true);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const renderStars = (rating: number = 5) => {
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        stars.push(
          <span key={i} style={{ color: "#D79322" }}>
            ★
          </span>
        );
      } else if (i === fullStars + 1 && hasHalf) {
        stars.push(
          <span key={i} style={{ color: "#D79322" }}>
            ★
          </span>
        );
      } else {
        stars.push(
          <span key={i} style={{ color: "#E0D5C7" }}>
            ☆
          </span>
        );
      }
    }
    return stars;
  };

  // If no stories at all, return null
  if (count === 0) {
    return null;
  }

  // CASE 1: EXACTLY 1 STORY -> Dedicated Luxury Centered Spotlight Card (No arrows, no carousel clutter)
  if (count === 1) {
    const story = stories[0];
    return (
      <div className={styles.singleStoryWrapper}>
        <div className={styles.singleStoryCard}>
          <div className={styles.singleStoryHeader}>
            <div className={styles.storyStars}>
              {renderStars(story.rating || 5)}
            </div>
            <div className={styles.quoteDecor} aria-hidden="true">
              <svg width="34" height="28" viewBox="0 0 32 26" fill="none">
                <path
                  d="M8.88889 0C3.98222 0 0 4.10667 0 9.17333C0 14.24 3.98222 18.3467 8.88889 18.3467C9.33333 18.3467 9.76 18.3111 10.1689 18.24C9.28 22.3644 5.61778 25.4578 1.17333 25.6V26C8.07111 26 13.6889 20.2133 13.6889 13.1022V9.17333C13.6889 4.10667 9.68889 0 8.88889 0ZM27.2 0C22.2933 0 18.3111 4.10667 18.3111 9.17333C18.3111 14.24 22.2933 18.3467 27.2 18.3467C27.6444 18.3467 28.0711 18.3111 28.48 18.24C27.5911 22.3644 23.9289 25.4578 19.4844 25.6V26C26.3822 26 32 20.2133 32 13.1022V9.17333C32 4.10667 28 0 27.2 0Z"
                  fill="#C49A45"
                  fillOpacity="0.35"
                />
              </svg>
            </div>
          </div>

          <p className={styles.singleStoryText}>{story.text}</p>

          <div className={styles.singleStoryAuthor}>
            <div className={styles.singleStoryAvatarWrap}>
              <Image
                src={story.avatar_url || "/images/logos/de_luzex_black.svg"}
                alt={story.author_name}
                fill
                draggable={false}
                sizes="60px"
                style={{ objectFit: "cover" }}
              />
            </div>
            <div className={styles.storyAuthorInfo}>
              <h5>{story.author_name}</h5>
              <div className={styles.authorMetaRow}>
                <span>{story.author_title || "Client"}</span>
                <span className={styles.verifiedBadge}>
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#C28928"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  Verified Experience
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // CASE 2+: MULTIPLE STORIES (2 to 10+) -> Responsive Carousel with 5s Auto-Advance, Centering & Controls
  return (
    <div
      className={styles.storiesCarouselWrapper}
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
      <div
        ref={trackRef}
        className={`${styles.storiesTrack} ${count <= 2 ? styles.storiesTrackCentered : ""}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          cursor: isDragging ? "grabbing" : "grab",
          userSelect: "none",
        }}
      >
        {stories.map((story, idx) => {
          const sId = String(story._id || story.id || idx);
          const isActive = idx === activeIndex;

          return (
            <div
              key={`${sId}-${idx}`}
              className={`${styles.storyCard} ${isActive ? styles.storyCardActive : ""}`}
              onClick={() => {
                if (!hasDraggedRef.current) {
                  scrollToStory(idx);
                }
              }}
            >
              <div className={styles.storyCardHeader}>
                <div className={styles.storyStars}>
                  {renderStars(story.rating || 5)}
                </div>
                <div className={styles.quoteDecorMini} aria-hidden="true">
                  <svg width="24" height="20" viewBox="0 0 32 26" fill="none">
                    <path
                      d="M8.88889 0C3.98222 0 0 4.10667 0 9.17333C0 14.24 3.98222 18.3467 8.88889 18.3467C9.33333 18.3467 9.76 18.3111 10.1689 18.24C9.28 22.3644 5.61778 25.4578 1.17333 25.6V26C8.07111 26 13.6889 20.2133 13.6889 13.1022V9.17333C13.6889 4.10667 9.68889 0 8.88889 0ZM27.2 0C22.2933 0 18.3111 4.10667 18.3111 9.17333C18.3111 14.24 22.2933 18.3467 27.2 18.3467C27.6444 18.3467 28.0711 18.3111 28.48 18.24C27.5911 22.3644 23.9289 25.4578 19.4844 25.6V26C26.3822 26 32 20.2133 32 13.1022V9.17333C32 4.10667 28 0 27.2 0Z"
                      fill="#C49A45"
                      fillOpacity={isActive ? "0.45" : "0.2"}
                    />
                  </svg>
                </div>
              </div>

              <p className={styles.storyText}>{story.text}</p>

              <div className={styles.storyAuthor}>
                <div className={styles.storyAvatarWrap}>
                  <Image
                    src={story.avatar_url || "/images/logos/de_luzex_black.svg"}
                    alt={story.author_name}
                    fill
                    draggable={false}
                    sizes="52px"
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <div className={styles.storyAuthorInfo}>
                  <h5>{story.author_name}</h5>
                  <span>{story.author_title || "Client"}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ARROW BUTTONS & PAGINATION DOTS */}
      <div className={styles.storiesControls}>
        <button
          type="button"
          className={styles.arrowOutline}
          onClick={() => scrollToStory(activeIndex - 1)}
          aria-label="Previous customer story"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div
          className={styles.storiesDots}
          role="tablist"
          aria-label="Customer stories pagination"
        >
          {stories.map((_, dotIdx) => (
            <button
              key={dotIdx}
              type="button"
              role="tab"
              aria-selected={dotIdx === activeIndex}
              aria-label={`Go to customer story ${dotIdx + 1}`}
              className={`${styles.storyDot} ${dotIdx === activeIndex ? styles.storyDotActive : ""}`}
              onClick={() => scrollToStory(dotIdx)}
            />
          ))}
        </div>

        <button
          type="button"
          className={styles.arrowSolid}
          onClick={() => scrollToStory(activeIndex + 1)}
          aria-label="Next customer story"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
