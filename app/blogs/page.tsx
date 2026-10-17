"use client";

import { useEffect, useState, useMemo } from "react";
import styles from "./blogs.module.css";
import Image from "next/image";
import Link from "next/link";
import { fetchBlogs, Blog } from "../services/api";

const CATEGORIES = [
  "All Blogs",
  "Design & Inspiration",
  "Architectural Blogs",
  "Products Blogs",
  "Buying Guide",
  "Case Study",
];

export default function Blogs() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All Blogs");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(6);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetchBlogs();
        setBlogs(data);
      } catch (err) {
        console.error("Failed to load blogs:", err);
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

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setVisibleLimit(6);
  };

  const filteredBlogs = useMemo(() => {
    return blogs.filter((blog) => {
      // Category filter
      if (activeCategory !== "All Blogs") {
        if (blog.category !== activeCategory) {
          return false;
        }
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = blog.title?.toLowerCase().includes(q);
        const matchesAuthor = blog.author?.toLowerCase().includes(q);
        const matchesCategory = blog.category?.toLowerCase().includes(q);
        const matchesExcerpt = blog.excerpt?.toLowerCase().includes(q);
        return matchesTitle || matchesAuthor || matchesCategory || matchesExcerpt;
      }

      return true;
    });
  }, [blogs, activeCategory, searchQuery]);

  function formatDate(isoOrStr?: string) {
    if (!isoOrStr) return "June 02, 2024";
    try {
      const d = new Date(isoOrStr);
      if (isNaN(d.getTime())) return isoOrStr;
      return d.toLocaleDateString("en-US", {
        month: "long",
        day: "2-digit",
        year: "numeric",
      });
    } catch {
      return "June 02, 2024";
    }
  }

  return (
    <main className={styles.main}>
      {/* HERO SECTION */}
      <section className={styles.hero}>
        <div className={styles.heroBg}>
          <Image
            src="/images/hero_bg_1784107713316.jpg"
            alt="Hero Background"
            fill
            style={{ objectFit: "cover" }}
            priority
          />
        </div>
        <div className={styles.heroOverlay}></div>
        <div className={styles.heroContent}>
          <p className={styles.heroSub}>INSIGHTS &amp; INSPIRATION</p>
          <h1 className={styles.heroTitle}>The Art Of Lighting</h1>
          <p className={styles.heroDesc}>
            Explore Design Trends, Lighting Inspiration, And Expert Insights For
            <br />
            Creating Extraordinary Interiors.
          </p>
          {blogs.length > 0 && (
            <Link
              href={`/blogs/${blogs[0].slug || blogs[0].id || blogs[0]._id}`}
              className={styles.btnOutlineHero}
            >
              Read Article
            </Link>
          )}
        </div>
      </section>

      {/* FILTER BAR */}
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
        <div className={styles.searchAndAdd}>
          <div className={styles.searchBox}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#D8A56E"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <Link href="/admin/blogs" className={styles.btnAddBlog}>
            <span>+</span>
            <span>Add Your Blog</span>
          </Link>
        </div>
      </section>

      {/* BLOG GRID */}
      <section className={styles.blogGridSection}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem 0", color: "#666" }}>
            Loading luxury articles...
          </div>
        ) : filteredBlogs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 0", color: "#666" }}>
            <p style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>
              No articles found matching &quot;{searchQuery || activeCategory}&quot;.
            </p>
            <button
              onClick={() => {
                handleCategoryChange("All Blogs");
                handleSearchChange("");
              }}
              className={styles.btnPrimaryRounded}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className={styles.blogGrid}>
            {filteredBlogs.slice(0, visibleLimit).map((blog) => {
              const targetSlug = blog.slug || blog.id || blog._id;
              const coverImg =
                blog.image || "/images/category_chandelier_1784107756268.jpg";

              return (
                <Link
                  href={`/blogs/${targetSlug}`}
                  key={blog.id || blog._id || blog.slug}
                  className={styles.blogCard}
                >
                  <div className={styles.blogImage}>
                    <Image
                      src={coverImg}
                      alt={blog.title}
                      fill
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                  <div className={styles.blogContent}>
                    <div className={styles.authorBadge}>
                      <div className={styles.authorAvatar}>
                        <span className={styles.authorMiniLogo}>deluzex</span>
                      </div>
                      <span className={styles.authorName}>{blog.author || "De Luzex"}</span>
                    </div>
                    <h3 className={styles.blogTitle}>{blog.title}</h3>
                    <div className={styles.blogFooter}>
                      <span className={styles.blogMeta}>
                        {formatDate(blog.created_at)} • {blog.read_time || "6 min read"}
                      </span>
                      <span className={styles.arrowWrap}>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {filteredBlogs.length > visibleLimit && (
          <div className={styles.centerBtn}>
            <button
              className={styles.btnPrimaryRounded}
              type="button"
              onClick={() => setVisibleLimit((prev) => prev + 6)}
            >
              Show More ({filteredBlogs.length - visibleLimit} Remaining)
            </button>
          </div>
        )}
      </section>

      {/* CTA SECTION */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaBg}>
          <Image
            src="/images/cta_bg.jpg"
            alt="Custom Lighting"
            fill
            sizes="100vw"
            style={{ objectFit: "cover" }}
          />
          <div className={styles.ctaOverlay}></div>
        </div>
        <div className={styles.ctaContent}>
          <h2 className={styles.ctaTitle}>
            Custom Lighting For
            <br />
            Every Project
          </h2>
          <p className={styles.ctaDesc}>
            We Create Custom Chandeliers, Wall, Ceiling, Pendant, And Table Lights For
            <br />
            Homes, Hotels, And Commercial Spaces.
          </p>
          <div className={styles.ctaButtons}>
            <Link href="/contact" className={styles.btnPrimaryRounded}>
              Start Your Project
            </Link>
            <Link href="/projects" className={styles.btnOutlineRounded}>
              View Our Projects
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
