"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import styles from "../page.module.css";
import { fetchTestimonials, Testimonial } from "../services/api";

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    _id: "story_1",
    id: "story_1",
    author_name: "Anna Clark",
    author_title: "Interior Designer",
    text: "The quality and craftsmanship are truly exceptional. The chandelier we chose became the highlight of our home.",
    rating: 5,
    avatar_url: "/images/avatar_woman_1784107804209.jpg",
  },
  {
    _id: "story_2",
    id: "story_2",
    author_name: "David Miller",
    author_title: "Architect, Studio Form",
    text: "De Luzex fixtures provide the exact color temperature and architectural finish our luxury residential clients demand.",
    rating: 5,
    avatar_url: "/images/avatar_woman_1784107804209.jpg",
  },
  {
    _id: "story_3",
    id: "story_3",
    author_name: "Sophia Reynolds",
    author_title: "Homeowner, Mumbai",
    text: "From packaging to final installation, the experience was seamless. The warm illumination completely transformed our living room.",
    rating: 5,
    avatar_url: "/images/avatar_woman_1784107804209.jpg",
  },
  {
    _id: "story_4",
    id: "story_4",
    author_name: "Marcus Vance",
    author_title: "Hospitality Consultant",
    text: "We specified De Luzex COB and pendant luminaires for a boutique hotel lobby. The feedback from guests has been phenomenal.",
    rating: 4.5,
    avatar_url: "/images/avatar_woman_1784107804209.jpg",
  },
];

interface CustomerStoriesCarouselProps {
  initialStories?: Testimonial[];
}

export default function CustomerStoriesCarousel({
  initialStories,
}: CustomerStoriesCarouselProps) {
  const [stories, setStories] = useState<Testimonial[]>(
    initialStories && initialStories.length > 0 ? initialStories : DEFAULT_TESTIMONIALS
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const scrollLeftStartRef = useRef(0);
  const hasDraggedRef = useRef(false);

  // Client-side refresh from API in case admin updated stories
  useEffect(() => {
    fetchTestimonials()
      .then((data) => {
        if (data && data.length > 0) {
          setStories(data);
        }
      })
      .catch(() => {
        // Keep initial or fallback stories
      });
  }, []);

  const items = stories.length < 4 ? [...stories, ...stories] : stories;

  const handleScroll = (direction: "left" | "right") => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const firstCard = container.querySelector(`.${styles.storyCard}`) as HTMLElement | null;
    const cardWidth = firstCard ? firstCard.offsetWidth : 400;
    const gap = 28;
    const scrollAmount = cardWidth + gap;

    if (direction === "left") {
      if (container.scrollLeft <= 15) {
        container.scrollTo({ left: container.scrollWidth, behavior: "smooth" });
      } else {
        container.scrollBy({ left: -scrollAmount, behavior: "smooth" });
      }
    } else {
      const maxScroll = container.scrollWidth - container.clientWidth;
      if (container.scrollLeft >= maxScroll - 15) {
        container.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        container.scrollBy({ left: scrollAmount, behavior: "smooth" });
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    hasDraggedRef.current = false;
    startXRef.current = e.pageX - containerRef.current.offsetLeft;
    scrollLeftStartRef.current = containerRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.3;
    if (Math.abs(walk) > 6) {
      hasDraggedRef.current = true;
    }
    containerRef.current.scrollLeft = scrollLeftStartRef.current - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 150);
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

  return (
    <>
      <div
        ref={containerRef}
        className={styles.storiesMarquee}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          cursor: isDragging ? "grabbing" : "grab",
          userSelect: "none",
        }}
      >
        <div className={styles.marqueeGroupStories}>
          {items.map((story, idx) => {
            const sId = String(story._id || story.id || idx);

            return (
              <div key={`${sId}-${idx}`} className={styles.storyCard}>
                <div className={styles.storyStars}>
                  {renderStars(story.rating || 5)}
                </div>

                <p className={styles.storyText}>{story.text}</p>

                <div className={styles.storyAuthor}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      overflow: "hidden",
                      position: "relative",
                      flexShrink: 0,
                      border: "2px solid #F0E8DA",
                    }}
                  >
                    <Image
                      src={story.avatar_url || "/images/avatar_woman_1784107804209.jpg"}
                      alt={story.author_name}
                      fill
                      draggable={false}
                      sizes="56px"
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
      </div>

      {/* ARROW NAVIGATION BUTTONS */}
      <div className={styles.arrowGroup}>
        <button
          type="button"
          className={styles.arrowOutline}
          onClick={() => handleScroll("left")}
          aria-label="Previous customer stories"
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
        <button
          type="button"
          className={styles.arrowSolid}
          onClick={() => handleScroll("right")}
          aria-label="Next customer stories"
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
    </>
  );
}
