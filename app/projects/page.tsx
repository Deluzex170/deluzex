"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import styles from "./projects.module.css";
import Image from "next/image";
import Link from "next/link";
import { fetchProjects, Project } from "../services/api";

const CATEGORIES = [
  "All Projects",
  "Residential",
  "Commercial",
  "Hospitality",
  "Public Spaces",
];

const PROJECT_TYPES = [
  { label: "Residential", value: "Residential" },
  { label: "Commercial", value: "Commercial" },
  { label: "Hospitality", value: "Hospitality" },
  { label: "Public Spaces", value: "Public Spaces" },
  { label: "Bespoke Installation", value: "Bespoke Design" },
];

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All Projects");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(6);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    projectType: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [isProjectTypeOpen, setIsProjectTypeOpen] = useState(false);
  const projectTypeRef = useRef<HTMLDivElement>(null);

  // Close project type dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        projectTypeRef.current &&
        !projectTypeRef.current.contains(event.target as Node)
      ) {
        setIsProjectTypeOpen(false);
      }
    }
    if (isProjectTypeOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isProjectTypeOpen]);

  const handleSelectProjectType = (val: string) => {
    setFormData((prev) => ({ ...prev, projectType: val }));
    setIsProjectTypeOpen(false);
  };

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: "", email: "", phone: "", projectType: "" });
    }, 4000);
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetchProjects();
        setProjects(data);
      } catch (err) {
        console.error("Failed to load projects:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    setVisibleLimit(6);
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      if (activeCategory === "All Projects") return true;
      return project.category === activeCategory;
    });
  }, [projects, activeCategory]);

  return (
    <main className={styles.main}>
      {/* HERO SECTION */}
      <section className={styles.hero}>
        <div className={styles.heroBg}>
          <Image
            src="/images/hero_bg_1784107713316.jpg"
            alt="Projects Hero"
            fill
            style={{ objectFit: "cover" }}
            priority
          />
        </div>
        <div className={styles.heroOverlay}></div>
        <div className={styles.heroContent}>
          <p className={styles.heroSub}>OUR WORK</p>
          <h1 className={styles.heroTitle}>Featured Projects</h1>
          <p className={styles.heroDesc}>
            Discover how De Luzex lighting transforms spaces across the globe, from intimate residences to grand commercial venues.
          </p>
        </div>
      </section>

      {/* FILTER SECTION */}
      <section className={styles.filterSection}>
        <div className={styles.filters}>
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryChange(cat)}
                className={`${styles.filterBtn} ${isActive ? styles.activeFilter : ""}`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </section>

      {/* EXPANDED PROJECT SPOTLIGHT (WHEN SELECTED) */}
      {selectedProject && (
        <section
          style={{
            maxWidth: "1280px",
            margin: "0 auto 3rem",
            padding: "2rem",
            background: "#ffffff",
            borderRadius: "16px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
            <div>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "var(--color-primary, #C49A45)",
                }}
              >
                {selectedProject.category} • {selectedProject.location || "Global"}
              </span>
              <h2 style={{ fontSize: "1.8rem", margin: "0.4rem 0 0", fontFamily: "var(--font-libre), serif" }}>
                {selectedProject.title}
              </h2>
              {selectedProject.subtitle && (
                <p style={{ color: "#666", fontSize: "0.95rem", margin: "0.25rem 0 0" }}>
                  {selectedProject.subtitle}
                </p>
              )}
            </div>
            <button
              onClick={() => setSelectedProject(null)}
              style={{
                background: "#f1f5f9",
                border: "none",
                borderRadius: "50%",
                width: "36px",
                height: "36px",
                cursor: "pointer",
                fontSize: "1.2rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✕
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "2rem",
              alignItems: "center",
            }}
          >
            <div
              style={{
                position: "relative",
                height: "320px",
                borderRadius: "12px",
                overflow: "hidden",
              }}
            >
              <Image
                src={selectedProject.image_url || "/images/project_lounge_1784107767735.jpg"}
                alt={selectedProject.title}
                fill
                style={{ objectFit: "cover" }}
              />
            </div>
            <div>
              <h4 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem" }}>
                Architectural Overview
              </h4>
              <p style={{ color: "#444", lineHeight: 1.8, fontSize: "0.95rem" }}>
                {selectedProject.description ||
                  "A bespoke architectural lighting commission integrating tailored fixtures to elevate the spatial experience and reflect luxury design principles."}
              </p>
              <div style={{ marginTop: "1.25rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                {selectedProject.installations_count && (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      background: "#f8fafc",
                      padding: "0.6rem 1.2rem",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "var(--color-primary, #C49A45)",
                    }}
                  >
                    <span>✨ {selectedProject.installations_count}</span>
                  </div>
                )}
                <Link
                  href="/contact"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.6rem 1.25rem",
                    background: "var(--color-primary, #C49A45)",
                    color: "#ffffff",
                    borderRadius: "8px",
                    textDecoration: "none",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                  }}
                >
                  Inquire About This Commission →
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* PROJECTS GRID */}
      <section className={styles.projectsSection}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem 0", color: "#666" }}>
            Loading architectural portfolio...
          </div>
        ) : filteredProjects.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 0", color: "#666" }}>
            <p style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>
              No projects found in category &quot;{activeCategory}&quot;.
            </p>
            <button
              onClick={() => handleCategoryChange("All Projects")}
              className={styles.btnPrimaryRounded}
            >
              Show All Projects
            </button>
          </div>
        ) : (
          <div className={styles.projectGrid}>
            {filteredProjects.slice(0, visibleLimit).map((project) => {
              const coverImg =
                project.image_url || "/images/project_lounge_1784107767735.jpg";

              return (
                <Link
                  key={project.id || project._id}
                  href={`/projects/${project._id || project.id}`}
                  className={styles.projectCard}
                >
                  <Image
                    src={coverImg}
                    alt={project.title}
                    fill
                    style={{ objectFit: "cover" }}
                  />
                  <div className={styles.projectLabelBox}>
                    <div className={styles.plbTextContainer}>
                      <span className={styles.plbTitle}>{project.title}</span>
                      <span className={styles.plbSub}>
                        <span className={styles.plbSubLocation}>{project.location || "Global"}</span>
                        <span className={styles.plbSubDetails}> • {project.installations_count || "View Details >"}</span>
                      </span>
                    </div>
                    <span
                      className={styles.iconBtnRoundWhite}
                      aria-label="View Project Details"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                      >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {filteredProjects.length > visibleLimit && (
          <div className={styles.centerBtn}>
            <button
              className={styles.loadMoreBtn}
              type="button"
              onClick={() => setVisibleLimit((prev) => prev + 6)}
            >
              Load More masterpeice
            </button>
          </div>
        )}
      </section>

      {/* CUSTOM LIGHTING CONSULTATION SECTION (#FEEDDF) */}
      <section className={styles.consultationSection}>
        <div className={styles.consultationContainer}>
          <div className={styles.consultationLeft}>
            <span className={styles.consultationTagline}>bespoke lighting design</span>
            <h2 className={styles.consultationHeading}>
              Custom Lighting<br />Consultation
            </h2>
            <p className={styles.consultationDesc}>
              Bring Your Unique Vision To Life. Our Lighting Specialists Collaborate With Architects, Interior Designers,
            </p>

            <form onSubmit={handleFormSubmit} className={styles.formCard}>
              {submitted && (
                <div className={styles.successMsg}>
                  Thank you! Our lighting specialist will contact you shortly.
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="name">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Enter your name"
                  value={formData.name}
                  onChange={handleFormChange}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="email">
                  Email<span style={{ color: "#e11d48" }}>*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="Enter your mail"
                  value={formData.email}
                  onChange={handleFormChange}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="phone">
                  Phone Number
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="Enter your Number"
                  value={formData.phone}
                  onChange={handleFormChange}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup} ref={projectTypeRef}>
                <label className={styles.formLabel} id="projectTypeLabel">
                  Project Type
                </label>
                <input
                  type="hidden"
                  name="projectType"
                  value={formData.projectType}
                />
                <button
                  type="button"
                  id="projectType"
                  aria-labelledby="projectTypeLabel"
                  aria-haspopup="listbox"
                  aria-expanded={isProjectTypeOpen}
                  className={`${styles.customSelectBtn} ${
                    isProjectTypeOpen ? styles.customSelectBtnOpen : ""
                  }`}
                  onClick={() => setIsProjectTypeOpen((prev) => !prev)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
                      e.preventDefault();
                      setIsProjectTypeOpen((prev) => !prev);
                    } else if (e.key === "Escape") {
                      setIsProjectTypeOpen(false);
                    }
                  }}
                >
                  <span
                    className={
                      formData.projectType
                        ? styles.selectValueText
                        : styles.selectPlaceholderText
                    }
                  >
                    {PROJECT_TYPES.find(
                      (p) => p.value === formData.projectType
                    )?.label || "Select your project type"}
                  </span>
                  <svg
                    className={`${styles.selectChevron} ${
                      isProjectTypeOpen ? styles.selectChevronOpen : ""
                    }`}
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>

                {isProjectTypeOpen && (
                  <ul
                    className={styles.selectDropdownMenu}
                    role="listbox"
                    aria-labelledby="projectTypeLabel"
                  >
                    {PROJECT_TYPES.map((pt) => {
                      const isSelected = formData.projectType === pt.value;
                      return (
                        <li
                          key={pt.value}
                          role="option"
                          aria-selected={isSelected}
                          className={`${styles.selectOption} ${
                            isSelected ? styles.selectOptionActive : ""
                          }`}
                          onClick={() => handleSelectProjectType(pt.value)}
                        >
                          <span>{pt.label}</span>
                          {isSelected && (
                            <svg
                              className={styles.checkIcon}
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <button type="submit" className={styles.submitBtn}>
                Start Collaboration
              </button>
            </form>
          </div>

          <div className={styles.consultationRight}>
            <Image
              src="/images/consultation_lounge.jpg"
              alt="Custom Lighting Consultation"
              fill
              style={{ objectFit: "cover" }}
              sizes="(max-width: 992px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
