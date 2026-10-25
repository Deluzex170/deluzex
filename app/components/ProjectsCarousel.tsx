"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "../page.module.css";
import { Project, fetchProjects } from "../services/api";

interface ProjectsCarouselProps {
  projects?: Project[];
}

const DEFAULT_PROJECTS: Partial<Project>[] = [
  {
    id: "project-1",
    _id: "project-1",
    title: "Luxury Lounge Luminary",
    location: "Global",
    image_url: "/images/project_lounge_1784107767735.jpg",
  },
  {
    id: "project-2",
    _id: "project-2",
    title: "Grand Lobby Chandelier",
    location: "Mumbai",
    image_url: "/images/project_lobby_1784107778993.jpg",
  },
  {
    id: "project-3",
    _id: "project-3",
    title: "Opulent Dining Illumination",
    location: "Delhi",
    image_url: "/images/about_chandelier_1784107790569.jpg",
  },
];

export default function ProjectsCarousel({ projects }: ProjectsCarouselProps) {
  const [list, setList] = useState<Project[]>(
    projects && projects.length > 0 ? projects : []
  );

  useEffect(() => {
    if (projects && projects.length > 0) {
      setList(projects);
    } else {
      fetchProjects()
        .then((data) => {
          if (data && data.length > 0) setList(data);
        })
        .catch(() => {});
    }
  }, [projects]);

  const displayProjects = list.length > 0 ? list : (DEFAULT_PROJECTS as Project[]);

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
    const firstCard = container.querySelector(`.${styles.projectCard}`) as HTMLElement | null;
    const cardWidth = firstCard ? firstCard.getBoundingClientRect().width : 600;
    const gap = 24;
    const scrollAmount = cardWidth + gap;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    const maxScroll = Math.max(0, scrollWidth - clientWidth);

    if (maxScroll <= 5) return;

    if (direction === "next") {
      if (scrollLeft >= maxScroll - 10) {
        // Smooth loop back to the beginning
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
    if (isPaused || isDragging || displayProjects.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      handleScrollStep("next");
    }, 5000);

    return () => window.clearInterval(timer);
  }, [isPaused, isDragging, displayProjects.length, handleScrollStep]);

  // Attach scroll listener
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
      className={styles.projectsCarouselWrapper}
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
        className={`${styles.projNavBtn} ${styles.projNavBtnPrev}`}
        onClick={() => handleScrollStep("prev")}
        aria-label="Previous project"
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

      {/* Projects Track */}
      <div
        ref={scrollRef}
        className={styles.projectGrid}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        {displayProjects.map((proj, idx) => (
          <Link
            key={proj.id || proj._id || idx}
            href={`/projects/${proj._id || proj.id}`}
            className={styles.projectCard}
            onClick={(e) => {
              if (hasDraggedRef.current) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            draggable={false}
          >
            <Image
              src={proj.image_url || "/images/project_lounge_1784107767735.jpg"}
              alt={proj.title || "Project"}
              fill
              sizes="(max-width: 768px) 100vw, 620px"
              style={{ objectFit: "cover", pointerEvents: "none" }}
              draggable={false}
            />
            <div className={styles.projectCardLabel}>
              <div className={styles.projectCardLabelText}>
                <span className={styles.projectCardLabelTitle}>{proj.title}</span>
                <span className={styles.projectCardLabelSub}>{proj.location || "Global"}</span>
              </div>
              <span className={styles.projectArrowBtn}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Next Button */}
      <button
        type="button"
        className={`${styles.projNavBtn} ${styles.projNavBtnNext}`}
        onClick={() => handleScrollStep("next")}
        aria-label="Next project"
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

      {/* Progress Scrollbar Indicator */}
      <div className={styles.projectsScrollbarTrack} aria-hidden="true">
        <div
          className={styles.projectsScrollbarThumb}
          style={{
            transform: `translateX(${scrollProgress * 200}%)`,
          }}
        />
      </div>
    </div>
  );
}
