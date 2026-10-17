import styles from "./about.module.css";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { fetchSiteContent } from "../services/api";

export default async function About() {
  const cmsAbout = await fetchSiteContent("about");

  const heroTitle = cmsAbout?.hero?.title || "Crafting Light For\nExtraordinary Interiors";
  const storyTitle = cmsAbout?.story?.title || "A Passion For Light.\nA Commitment To Excellence.";
  const ctaTitle = cmsAbout?.cta?.title || "Custom Lighting For\nEvery Project";

  const defaultFeatures = [
    { icon: "/images/logos/BespokeDesign.svg", title: "Bespoke Design" },
    { icon: "/images/logos/HandcraftedExcellence.svg", title: "Handcrafted Excellence" },
    { icon: "/images/logos/PremiumCraftmanship.svg", title: "Luxury Finishes" },
  ];

  const features = cmsAbout?.story?.features || defaultFeatures;

  const defaultStats = [
    { number: "10+", label: "Years Of Excellence" },
    { number: "98%", label: "Client Satisfaction" },
    { number: "500+", label: "Lighting Installations" },
    { number: "50K", label: "Happy Customers" },
  ];

  const stats = cmsAbout?.stats || defaultStats;

  const defaultPillars = [
    {
      title: "Timeless Design Excellence",
      description: "Inspired by modern luxury and classic aesthetics, our lighting collections are designed to remain elegant for years to come.",
    },
    {
      title: "Exceptional Craftsmanship",
      description: "Every fixture is meticulously crafted with precision, attention to detail, and uncompromising quality.",
    },
    {
      title: "Premium Materials",
      description: "We source the finest metals, crystal, and glass to ensure durability, beauty, and lasting performance.",
    },
    {
      title: "Bespoke Lighting Solutions",
      description: "From custom finishes to tailored dimensions, we create lighting that perfectly complements your vision.",
    },
  ];

  const pillars = cmsAbout?.why_choose_us?.items || defaultPillars;

  return (
    <main className={styles.main}>
      {/* HERO SECTION */}
      <section className={styles.hero}>
        <div className={styles.heroBg}>
          <Image
            src={cmsAbout?.hero?.bg_image || "/images/project_lobby_1784107778993.jpg"}
            alt="Hero Background"
            fill
            style={{ objectFit: "cover" }}
            priority
          />
        </div>
        <div className={styles.heroOverlay}></div>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            {heroTitle.split("\n").map((line: string, i: number) => (
              <React.Fragment key={i}>
                {line}
                {i === 0 && <br />}
              </React.Fragment>
            ))}
          </h1>
          <p className={styles.heroDesc}>
            {cmsAbout?.hero?.description || (
              <>
                We Create Timeless Lighting Pieces That Blend Artistry, Craftsmanship, And
                <br />
                Innovation To Elevate Every Space.
              </>
            )}
          </p>
          <Link href={cmsAbout?.hero?.btn_link || "/projects"} className={styles.btnOutlineHero}>
            {cmsAbout?.hero?.btn_text || "Signature peice"}
          </Link>
        </div>
      </section>

      {/* PASSION SECTION */}
      <section className={styles.passionSection}>
        <div className={styles.passionContent}>
          <div className={styles.passionText}>
            <p className={styles.sectionSub}>{cmsAbout?.story?.subtitle || "OUR STORY"}</p>
            <h2 className={styles.sectionTitle}>
              {storyTitle.split("\n").map((line: string, i: number) => (
                <React.Fragment key={i}>
                  {line}
                  {i === 0 && <br />}
                </React.Fragment>
              ))}
            </h2>
            <p className={styles.passionDesc}>
              {cmsAbout?.story?.description || (
                <>
                  De Luzex Was Born Out Of A Shared Passion For Transformative Design. We Believe That Light Is More Than Just A Functional Element; It Is A Medium For Artistic Expression.
                  <br />
                  <br />
                  Every Chandelier, Wall Light, And Pendant We Create Is Handcrafted With Precision By Master Artisans Who Share Our Vision For Bringing Elegance And Brilliance Into Every Space.
                </>
              )}
            </p>

            <div className={styles.passionIcons}>
              {features.map((f: any, idx: number) => {
                const defaultIcon =
                  idx === 0
                    ? "/images/logos/BespokeDesign.svg"
                    : idx === 1
                    ? "/images/logos/HandcraftedExcellence.svg"
                    : "/images/logos/PremiumCraftmanship.svg";
                const iconSrc =
                  f.icon && typeof f.icon === "string" && f.icon.startsWith("/images/")
                    ? f.icon
                    : defaultIcon;

                return (
                  <div key={idx} className={styles.iconItem}>
                    <Image
                      src={iconSrc}
                      alt={f.title || "Feature"}
                      width={68}
                      height={68}
                      className={styles.featureSvg}
                    />
                    <span>{f.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className={styles.passionImage}>
            <Image
              src={cmsAbout?.story?.image || "/images/project_lounge_1784107767735.jpg"}
              alt="Passion for Light"
              fill
              style={{ objectFit: "cover" }}
            />
          </div>
        </div>
      </section>

      {/* STATS SECTION */}
      <section className={styles.statsBanner}>
        {stats.map((st: any, idx: number) => (
          <div key={idx} className={styles.statCard}>
            <div className={styles.statCardBg}>
              <Image
                src={st.image || "/images/stats_trophy.jpg"}
                alt={st.label || "Statistic"}
                fill
                style={{ objectFit: "cover" }}
              />
            </div>
            <div className={styles.statCardOverlay}></div>
            <div className={styles.statCardContent}>
              <h3 className={styles.statNumber}>{st.number}</h3>
              <p className={styles.statLabel}>{st.label}</p>
            </div>
          </div>
        ))}
      </section>

      {/* WHY CHOOSE US SECTION */}
      <section className={styles.chooseSection}>
        <div className={styles.chooseGrid}>
          <div className={styles.chooseImage}>
            <Image
              src={cmsAbout?.why_choose_us?.image || "/images/about_chandelier_1784107790569.jpg"}
              alt="Why Choose Us"
              fill
              style={{ objectFit: "cover" }}
            />
          </div>
          <div className={styles.chooseText}>
            <p className={styles.chooseSub}>{cmsAbout?.why_choose_us?.subtitle || "why choose us"}</p>
            <h2 className={styles.chooseTitle}>{cmsAbout?.why_choose_us?.title || "Why client Choose Us"}</h2>

            <div className={styles.chooseDivider}>
              <span className={styles.chooseDividerLine}></span>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D79322" strokeWidth="1.5" className={styles.chooseDividerIcon}>
                <circle cx="12" cy="12" r="3" />
                <circle cx="12" cy="6" r="2.2" />
                <circle cx="12" cy="18" r="2.2" />
                <circle cx="6.8" cy="9" r="2.2" />
                <circle cx="17.2" cy="9" r="2.2" />
                <circle cx="6.8" cy="15" r="2.2" />
                <circle cx="17.2" cy="15" r="2.2" />
              </svg>
              <span className={styles.chooseDividerLine}></span>
            </div>

            <p className={styles.chooseDesc}>
              {cmsAbout?.why_choose_us?.description ||
                "Every lighting piece is thoughtfully designed and expertly crafted to bring elegance, warmth, and sophistication to extraordinary spaces."}
            </p>

            <div className={styles.pillarList}>
              {pillars.map((p: any, idx: number) => (
                <div key={idx} className={styles.pillarItem}>
                  <h4 className={styles.pillarTitle}>{p.title}</h4>
                  <p className={styles.pillarDesc}>{p.description}</p>
                </div>
              ))}
            </div>

            <Link href={cmsAbout?.why_choose_us?.btn_link || "/shop"} className={styles.btnExploreCollection}>
              {cmsAbout?.why_choose_us?.btn_text || "Explore Collection"}
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURED PROJECTS */}
      <section className={styles.projectsSection}>
        <h2 className={styles.sectionTitleCenter}>Our Featured Projects.</h2>
        <div className={styles.projectGrid}>
          <Link href="/projects" className={styles.projectCard}>
            <Image
              src="/images/project_lounge_1784107767735.jpg"
              alt="Luxury Villa Residence"
              fill
              style={{ objectFit: "cover" }}
            />
            <div className={styles.projectLabelBox}>
              <div>
                <span className={styles.plbTitle}>Luxury Villa Residence</span>
                <span className={styles.plbSub}>View Details &gt;</span>
              </div>
              <span
                className={styles.iconBtnRoundWhite}
                aria-label="View Project"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          </Link>
          <Link href="/projects" className={styles.projectCard}>
            <Image
              src="/images/project_lobby_1784107778993.jpg"
              alt="The Grand Hotel Lobby"
              fill
              style={{ objectFit: "cover" }}
            />
            <div className={styles.projectLabelBox}>
              <div>
                <span className={styles.plbTitle}>The Grand Hotel Lobby</span>
                <span className={styles.plbSub}>View Details &gt;</span>
              </div>
              <span
                className={styles.iconBtnRoundWhite}
                aria-label="View Project"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          </Link>
        </div>
        <div className={styles.centerBtn}>
          <Link href="/projects" className={styles.btnExploreProjects}>
            Explore All Projects
          </Link>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaBg}>
          <Image
            src={cmsAbout?.cta?.bg_image || "/images/cta_bg.jpg"}
            alt="Custom Lighting"
            fill
            sizes="100vw"
            style={{ objectFit: "cover" }}
          />
          <div className={styles.ctaOverlay}></div>
        </div>
        <div className={styles.ctaContent}>
          <h2 className={styles.ctaTitle}>
            {ctaTitle.split("\n").map((line: string, i: number) => (
              <React.Fragment key={i}>
                {line}
                {i === 0 && <br />}
              </React.Fragment>
            ))}
          </h2>
          <p className={styles.ctaDesc}>
            {cmsAbout?.cta?.description ||
              "We Create Custom Chandeliers, Wall, Ceiling, Pendant, And Table Lights For Homes, Hotels, And Commercial Spaces."}
          </p>
          <div className={styles.ctaButtons}>
            <Link href={cmsAbout?.cta?.btn_primary_link || "/contact"} className={styles.btnPrimaryRounded}>
              {cmsAbout?.cta?.btn_primary_text && cmsAbout?.cta?.btn_primary_text !== "Book A Consultation"
                ? cmsAbout.cta.btn_primary_text
                : "Start Your Project"}
            </Link>
            <Link href={cmsAbout?.cta?.btn_secondary_link || "/projects"} className={styles.btnOutlineRounded}>
              {cmsAbout?.cta?.btn_secondary_text || "View Our Projects"}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
