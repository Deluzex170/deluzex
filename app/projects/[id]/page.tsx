"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { fetchProjectById, Project } from "../../services/api";
import styles from "./projectDetail.module.css";

const FALLBACK_PROJECT_IMAGES = [
  "/images/project_lounge_1784107767735.jpg",
  "/images/category_chandelier_1784107756268.jpg",
  "/images/about_chandelier_1784107790569.jpg",
  "/images/project_lobby_1784107778993.jpg",
  "/images/hero_bg_1784107713316.jpg",
];

function getEmbedVideoUrl(url: string): { isEmbed: boolean; src: string } {
  if (!url) return { isEmbed: false, src: "" };
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    return { isEmbed: true, src: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}` };
  }
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
  if (vimeoMatch) {
    return { isEmbed: true, src: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
  }
  return { isEmbed: false, src: url };
}

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLightboxImg, setActiveLightboxImg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    }
    if (!id) return;
    async function load() {
      setLoading(true);
      try {
        const data = await fetchProjectById(id);
        setProject(data);
      } catch (err) {
        console.error("Failed to load project details:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const currentProject = project || {
    title: "Luxury Villa Residence.",
    category: "HOMES & VILLAS",
    subtitle: "Residential | 2024",
    description:
      "Custom Lighting Design Crafted To Enhance Elegance, Comfort, And A Natural Warmth Throughout The Residence.",
    location: "London, UK",
    year: "2024",
    scope: "Architectural Lighting Design",
    installations_count: "18 Bespoke Fixtures",
    image_url: "/images/project_lounge_1784107767735.jpg",
    gallery_images: FALLBACK_PROJECT_IMAGES,
    videos: [],
  };

  // Compile unique gallery images
  const rawGallery = [
    ...(currentProject.gallery_images || []),
    ...(currentProject.image_url ? [currentProject.image_url] : []),
  ];
  const uniqueGallery = Array.from(new Set(rawGallery.filter(Boolean)));
  const displayGallery = uniqueGallery.length > 0 ? uniqueGallery : FALLBACK_PROJECT_IMAGES;

  // Compile project videos
  const projectVideos = Array.isArray(currentProject.videos)
    ? currentProject.videos.filter((v): v is string => Boolean(v && typeof v === "string" && v.trim()))
    : [];

  // Compile unified media gallery items: all gallery images + all videos
  type MediaItem =
    | { type: "image"; src: string; id: string }
    | { type: "video"; src: string; id: string };

  const galleryItems: MediaItem[] = [
    ...displayGallery.map((img, idx) => ({
      type: "image" as const,
      src: img,
      id: `img-${idx}`,
    })),
    ...projectVideos.map((vid, idx) => ({
      type: "video" as const,
      src: vid,
      id: `vid-${idx}`,
    })),
  ];

  const bgImage = "/images/hero_bg_1784107713316.jpg";

  return (
    <main className={styles.main}>
      {/* ===================== HERO SECTION ===================== */}
      <section className={styles.hero}>
        {/* Full-bleed Background */}
        <div className={styles.heroBg}>
          <Image
            src={bgImage}
            alt={currentProject.title}
            fill
            priority
            style={{ objectFit: "cover" }}
          />
        </div>
        <div className={styles.heroOverlay} />

        {/* Floating Glassmorphism Hero Card (Figma Design) */}
        <div className={styles.heroCard}>
          <p className={styles.cardCategory}>
            {currentProject.category ? (currentProject.category.toLowerCase().includes("featured") ? currentProject.category : `Featured ${currentProject.category}`) : "Featured Project"}
          </p>

          <h1 className={styles.cardTitle}>
            {currentProject.title ? (currentProject.title.endsWith(".") ? currentProject.title : `${currentProject.title}.`) : "Luxury Villa Residence."}
          </h1>

          <p className={styles.cardLocation}>
            {currentProject.location || "Ahmedabad , India"}
          </p>

          <p className={styles.cardDescription}>
            {currentProject.description ||
              "Custom Lighting Design Crafted To Enhance Elegance, Comfort, And Ambiance Throughout The Residence."}
          </p>

          {/* Horizontal Divider Line */}
          <div className={styles.horizontalDivider} />

          {/* 3-column Metadata Bar */}
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Year</span>
              <span className={styles.metaValue}>{currentProject.year || "2025"}</span>
            </div>

            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Project Type</span>
              <span className={styles.metaValue}>{currentProject.category || "Residential"}</span>
            </div>

            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Scope</span>
              <span className={styles.metaValue}>
                {currentProject.scope || currentProject.installations_count || "Complete Lighting Design"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== GALLERY SECTION ===================== */}
      {/* 1-column vertically stacked architectural layout matching Figma */}
      <section className={styles.gallerySection}>
        <div className={styles.galleryGrid}>
          {galleryItems.map((item, idx) => {
            if (item.type === "image") {
              return (
                <div
                  key={item.id}
                  className={styles.galleryCard}
                  onClick={() => setActiveLightboxImg(item.src)}
                >
                  <Image
                    src={item.src}
                    alt={`${currentProject.title} detail ${idx + 1}`}
                    fill
                    sizes="(max-width: 1200px) 100vw, 1200px"
                    className={styles.galleryImg}
                  />
                  <div className={styles.galleryOverlay}>
                    <span className={styles.zoomIcon}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        <line x1="11" y1="8" x2="11" y2="14" />
                        <line x1="8" y1="11" x2="14" y2="11" />
                      </svg>
                    </span>
                  </div>
                </div>
              );
            }

            const { isEmbed, src } = getEmbedVideoUrl(item.src);
            return (
              <div key={item.id} className={styles.videoCard}>
                <div className={styles.videoBadge}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span>Walkthrough Video</span>
                </div>
                {isEmbed ? (
                  <iframe
                    src={src}
                    title={`${currentProject.title} Video ${idx + 1}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className={styles.videoFrame}
                  />
                ) : (
                  <video
                    src={src}
                    controls
                    playsInline
                    preload="metadata"
                    className={styles.videoPlayer}
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Lightbox Modal */}
      {activeLightboxImg && (
        <div className={styles.lightboxModal} onClick={() => setActiveLightboxImg(null)}>
          <button
            className={styles.lightboxClose}
            onClick={() => setActiveLightboxImg(null)}
            aria-label="Close image preview"
          >
            ✕
          </button>
          <div className={styles.lightboxImgWrapper} onClick={(e) => e.stopPropagation()}>
            <Image
              src={activeLightboxImg}
              alt="Expanded view"
              fill
              style={{ objectFit: "contain" }}
            />
          </div>
        </div>
      )}
    </main>
  );
}
