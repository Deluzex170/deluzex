"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import styles from "./blogDetail.module.css";
import Image from "next/image";
import Link from "next/link";
import { fetchBlogBySlugOrId, fetchBlogs, Blog } from "../../services/api";

export default function BlogDetail() {
  const params = useParams();
  const slug = params?.slug as string;

  const [blog, setBlog] = useState<Blog | null>(null);
  const [relatedBlogs, setRelatedBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!slug) return;
      setLoading(true);
      try {
        const [blogData, allBlogs] = await Promise.all([
          fetchBlogBySlugOrId(slug),
          fetchBlogs(),
        ]);
        setBlog(blogData);
        // Filter out the current blog and pick 3 related ones
        const others = allBlogs.filter(
          (b) =>
            (b.slug && b.slug !== slug) &&
            (b.id !== slug && b._id !== slug)
        );
        setRelatedBlogs(others.slice(0, 3));
      } catch (err) {
        console.error("Failed to load blog detail:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug]);

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

  if (loading) {
    return (
      <main className={styles.main}>
        <div style={{ textAlign: "center", padding: "10rem 2rem", color: "#666" }}>
          Loading luxury editorial article...
        </div>
      </main>
    );
  }

  if (!blog) {
    return (
      <main className={styles.main}>
        <div style={{ textAlign: "center", padding: "10rem 2rem", color: "#666" }}>
          <h2 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Article Not Found</h2>
          <p style={{ marginBottom: "2rem" }}>
            The requested blog article may have been moved or removed.
          </p>
          <Link href="/blogs" className={styles.btnPrimaryRounded} style={{ textDecoration: "none" }}>
            Back to All Blogs
          </Link>
        </div>
      </main>
    );
  }

  // Split content by double linebreaks into paragraphs
  const paragraphs = blog.content
    ? blog.content.split(/\n\n+/).filter((p) => p.trim().length > 0)
    : [];

  const coverImg = blog.image || "/images/hero_bg_1784107713316.jpg";

  return (
    <main className={styles.main}>
      {/* HERO SECTION */}
      <section className={styles.hero}>
        <div className={styles.heroBg}>
          <Image
            src={coverImg}
            alt={blog.title}
            fill
            style={{ objectFit: "cover" }}
            priority
          />
        </div>
        <div className={styles.heroOverlay}></div>
        <div className={styles.heroContent}>
          <p className={styles.heroSub}>{blog.category || "DESIGN INSPIRATION"}</p>
          <h1 className={styles.heroTitle}>{blog.title}</h1>
        </div>
      </section>

      {/* ARTICLE CONTENT */}
      <section className={styles.articleSection}>
        <div className={styles.authorInfo}>
          <div className={styles.avatar}>
            <span className={styles.avatarMiniLogo}>deluzex</span>
          </div>
          <div>
            <h5 className={styles.authorName}>{blog.author || "De Luzex"}</h5>
            <p className={styles.authorDate}>
              {formatDate(blog.created_at)} • {blog.read_time || "6 min read"}
            </p>
          </div>
        </div>

        {blog.excerpt && (
          <div style={{ maxWidth: "700px", width: "100%", padding: "0 2rem", marginBottom: "0.5rem" }}>
            <h2 className={styles.contentSubtitle} style={{ marginTop: 0 }}>
              {blog.excerpt}
            </h2>
          </div>
        )}

        <article className={styles.articleBody}>
          {paragraphs.length > 0 ? (
            paragraphs.map((p, i) => {
              const lines = p.split("\n").map((l) => l.trim()).filter(Boolean);
              const isHeading =
                lines.length > 1 &&
                (/^(\d+[:.]|Step\s+\d+:|#+\s+|[A-Za-z0-9\s]{2,45}:)/i.test(lines[0]) ||
                  lines[0].length <= 50);

              return (
                <div key={i}>
                  {isHeading ? (
                    <>
                      <h2 className={styles.contentSubtitle}>
                        {lines[0].replace(/^#+\s*/, "")}
                      </h2>
                      <p className={styles.paragraphText}>{lines.slice(1).join(" ")}</p>
                    </>
                  ) : /^(\d+[:.]|Step\s+\d+:|#+\s+)/i.test(p) ? (
                    <h2 className={styles.contentSubtitle}>
                      {p.replace(/^#+\s*/, "")}
                    </h2>
                  ) : (
                    <p className={styles.paragraphText}>{p}</p>
                  )}

                  {i === 1 && coverImg && (
                    <div className={styles.articleImage} style={{ margin: "2rem 0" }}>
                      <Image
                        src={coverImg}
                        alt={blog.title}
                        fill
                        style={{ objectFit: "cover" }}
                      />
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <p className={styles.paragraphText}>{blog.content}</p>
          )}
        </article>

        {/* SHARE SECTION */}
        <div className={styles.shareSection}>
          <span className={styles.writtenByText}>
            WRITTEN BY {blog.author ? blog.author.toUpperCase() : "SEO FATBUZZ"}
          </span>
          <div className={styles.shareIcons}>
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent((blog.title || "De Luzex Blog") + " " + (typeof window !== "undefined" ? window.location.href : ""))}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" />
                <circle cx="4" cy="4" r="2" />
              </svg>
            </a>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(blog.title)}&url=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Twitter"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
              </svg>
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* READ MORE SECTION */}
      {relatedBlogs.length > 0 && (
        <section className={styles.readMoreSection}>
          <h2 className={styles.readMoreTitle}>Read more</h2>
          <div className={styles.blogGrid}>
            {relatedBlogs.map((rel) => {
              const relSlug = rel.slug || rel.id || rel._id;
              const relImg = rel.image || "/images/category_chandelier_1784107756268.jpg";

              return (
                <Link
                  href={`/blogs/${relSlug}`}
                  key={rel.id || rel._id || rel.slug}
                  className={styles.blogCard}
                >
                  <div className={styles.blogImageSmall}>
                    <Image
                      src={relImg}
                      alt={rel.title}
                      fill
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                  <div className={styles.blogContentSmall}>
                    <div className={styles.authorBadge}>
                      <div className={styles.authorAvatar}>
                        <span className={styles.authorMiniLogo}>deluzex</span>
                      </div>
                      <span className={styles.authorName}>{rel.author || "De Luzex"}</span>
                    </div>
                    <h3 className={styles.blogTitleSmall}>{rel.title}</h3>
                    <div className={styles.blogFooter}>
                      <span className={styles.blogMeta}>
                        {formatDate(rel.created_at)} • {rel.read_time || "6 min read"}
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
        </section>
      )}

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
