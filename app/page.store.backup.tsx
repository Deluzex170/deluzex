import React from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";
import { fetchCategories, fetchProducts, fetchTestimonials, fetchProjects, fetchSiteContent } from "./services/api";
import AddToCartButton from "./components/AddToCartButton";
import HeroProductWidget from "./components/HeroProductWidget";
import AnimatedCounter from "./components/animations/AnimatedCounter";
import NewArrivalsCarousel from "./components/NewArrivalsCarousel";
import CustomerStoriesCarousel from "./components/CustomerStoriesCarousel";

export default async function Home() {
  const [categories, products, newArrivalProducts, testimonials, featuredProjects, cmsHome] = await Promise.all([
    fetchCategories(),
    fetchProducts("limit=8"),
    fetchProducts("is_new_arrival=true"),
    fetchTestimonials(),
    fetchProjects("is_featured=true"),
    fetchSiteContent("homepage"),
  ]);

  return (
    <main className={styles.main}>

      {/* ===================== HERO SECTION ===================== */}
      {/* Figma: 1440x1024, cream background with bg image, cursive headline left, product widget right */}
      <section className={styles.hero}>
        {/* Background image */}
        <div className={styles.heroBg}>
          <Image
            src={cmsHome?.hero?.bg_image || "/images/hero_bg.png"}
            alt="Hero Background"
            fill
            style={{ objectFit: 'cover', height: '100%' }}
          />
        </div>
        <div className={styles.heroOverlay}></div>

        {/* Left content */}
        <div className={styles.heroLeft}>
          <p className={styles.heroTagline}>Celebrate Every Moment with</p>
          <h1 className={styles.heroTitle}>{cmsHome?.hero?.title || "Where Lights become Art"}</h1>
          <p className={styles.heroDesc}>
            {cmsHome?.hero?.description || (
              <>
                Crafted With Exceptional Materials And Refined Details To Elevate<br />
                Modern Living Spaces.
              </>
            )}
          </p>
          <div className={styles.heroBtns}>
            <Link href={cmsHome?.hero?.btn_explore_link || "/shop"} className={styles.btnExplore}>
              {cmsHome?.hero?.btn_explore_text || "Explore Collection"}
            </Link>
            <Link href={cmsHome?.hero?.btn_catalogue_link || "/projects"} className={styles.btncatalogue}>
              View portfolio
            </Link>
          </div>
        </div>

        {/* Right: selected product detail with scrollable lamp choices */}
        <HeroProductWidget />
      </section>

      {/* ===================== STATEMENT SECTION ===================== */}
      {/* Figma: 1440x392, large mixed-color text, centered */}
      <section className={styles.statementSection}>
        <p className={styles.statementText}>
          <span className={styles.statementGold}>
            {cmsHome?.statement?.highlight_text || "Discover lighting crafted with precision and elegance, blending timeless design,"}
          </span>
          {" "}
          {cmsHome?.statement?.sub_text || "exceptional quality, and warm illumination to transform every space."}
        </p>
      </section>

      {/* ===================== CATEGORIES SECTION ===================== */}
      {/* Figma: 1440x636, golden subtitle, 4 category cards, Explore button */}
      <section className={styles.categoriesSection}>
        <div className={styles.categoriesHeader}>
          <p className={styles.categoriesTagline}>lighting for every interior</p>
          <h2 className={styles.categoriesTitle}>Discover Our Categories</h2>
        </div>
        <div className={styles.categoryGrid}>
          {categories.length > 0 ? (
            categories.slice(0, 4).map((cat, i: number) => {
              const catIdentifier = cat.name || cat._id || cat.id || "All";
              return (
                <Link
                  key={cat.id || cat._id || i}
                  href={`/shop?category=${encodeURIComponent(catIdentifier)}`}
                  className={styles.catCard}
                >
                  <Image
                    src={cat.image_url || "/images/category_chandelier_1784107756268.jpg"}
                    alt={cat.name || "Category"}
                    fill
                    style={{ objectFit: "cover" }}
                  />
                  <div className={styles.catCardLabel}>
                    <span>{cat.name}</span>
                  </div>
                </Link>
              );
            })
          ) : (
            <>
              {/* Fallback layout if no API data */}
              <Link href={`/shop?category=${encodeURIComponent("Pendant Lights")}`} className={styles.catCard}>
                <Image src="/images/category_chandelier_1784107756268.jpg" alt="Pendant Lights" fill style={{ objectFit: "cover" }} />
                <div className={styles.catCardLabel}>
                  <span>Pendant Lights</span>
                </div>
              </Link>
              <Link href={`/shop?category=${encodeURIComponent("Chandeliers")}`} className={styles.catCard}>
                <Image src="/images/about_chandelier_1784107790569.jpg" alt="Chandeliers" fill style={{ objectFit: "cover" }} />
                <div className={styles.catCardLabel}>
                  <span>Chandeliers</span>
                </div>
              </Link>
              <Link href={`/shop?category=${encodeURIComponent("COB")}`} className={styles.catCard}>
                <Image src="/images/project_lobby_1784107778993.jpg" alt="COB" fill style={{ objectFit: "cover" }} />
                <div className={styles.catCardLabel}>
                  <span>COB</span>
                </div>
              </Link>
              <Link href={`/shop?category=${encodeURIComponent("Table Lamps")}`} className={styles.catCard}>
                <Image src="/images/lamp_black_gold_1784107745696.jpg" alt="Table Lamps" fill style={{ objectFit: "cover" }} />
                <div className={styles.catCardLabel}>
                  <span>Table Lamps</span>
                </div>
              </Link>
            </>
          )}
        </div>
        <Link href="/categories" className={styles.btnExploreCat}>
          Explore Categories
        </Link>
      </section>

      {/* ===================== FEATURED PROJECTS SECTION ===================== */}
      {/* Figma: 1440x885, "Our Featured Projects." title, 2 large project cards, Explore button */}
      <section className={styles.projectsSection}>
        <h2 className={styles.projectsTitle}>Our Featured Projects.</h2>
        <div className={styles.projectGrid}>
          {featuredProjects && featuredProjects.length > 0 ? (
            featuredProjects.slice(0, 2).map((proj) => (
              <Link key={proj.id || proj._id} href={`/projects/${proj._id || proj.id}`} className={styles.projectCard}>
                <Image
                  src={proj.image_url || "/images/project_lounge_1784107767735.jpg"}
                  alt={proj.title}
                  fill
                  sizes="(max-width: 768px) 50vw, 50vw"
                  style={{ objectFit: "cover" }}
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
            ))
          ) : (
            <>
              <Link href="/projects" className={styles.projectCard}>
                <Image
                  src="/images/project_lounge_1784107767735.jpg"
                  alt="Luxury Villa Residence"
                  fill
                  sizes="(max-width: 768px) 50vw, 50vw"
                  style={{ objectFit: "cover" }}
                />
                <div className={styles.projectCardLabel}>
                  <div className={styles.projectCardLabelText}>
                    <span className={styles.projectCardLabelTitle}>Luxury Villa Residence</span>
                    <span className={styles.projectCardLabelSub}>London, UK</span>
                  </div>
                  <span className={styles.projectArrowBtn}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </Link>
              <Link href="/projects" className={styles.projectCard}>
                <Image
                  src="/images/project_lobby_1784107778993.jpg"
                  alt="Grand Hotel Lobby"
                  fill
                  sizes="(max-width: 768px) 50vw, 50vw"
                  style={{ objectFit: "cover" }}
                />
                <div className={styles.projectCardLabel}>
                  <div className={styles.projectCardLabelText}>
                    <span className={styles.projectCardLabelTitle}>The Grand Hotel Lobby</span>
                    <span className={styles.projectCardLabelSub}>Paris, France</span>
                  </div>
                  <span className={styles.projectArrowBtn}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </Link>
            </>
          )}
        </div>
        <Link href="/projects" className={styles.btnExploreProjects}>
          Explore All Projects
        </Link>
      </section>

      {/* ===================== NEW ARRIVALS SECTION ===================== */}
      {/* Figma: 1440x1099, large spaced title, 3 product cards with + btn, nav arrows */}
      <section className={styles.newArrivalsSection}>
        <div className={styles.newArrivalsHeader}>
          <h2 className={styles.newArrivalsTitle}>NEW ARRIVALS</h2>
          <p className={styles.newArrivalsDesc}>
            Discover Our Newest Lighting Designs, Crafted With Premium Materials<br />
            And Timeless Elegance For Modern Interiors.
          </p>
        </div>
        <NewArrivalsCarousel products={newArrivalProducts.length > 0 ? newArrivalProducts : products} />
      </section>


      {/* ===================== ABOUT US SECTION ===================== */}
      {/* Figma: 1440x1076, left text + right image, stats row with images at bottom */}
      {/* ===================== ABOUT US SECTION ===================== */}
      {/* Figma: 1440x1076, left text + right image, stats row with images at bottom */}
      <section className={styles.aboutSection}>
        <div className={styles.aboutInner}>
          <div className={styles.aboutLeft}>
            <p className={styles.aboutLabel}>{cmsHome?.story?.subtitle || "ABOUT US"}</p>
            <h2 className={styles.aboutTitle}>
              {cmsHome?.story?.title ? (
                cmsHome.story.title.split("\n").map((line: string, i: number) => (
                  <React.Fragment key={i}>
                    {line}
                    {i === 0 && <br />}
                  </React.Fragment>
                ))
              ) : (
                <>Illuminate Every Space With<br />Elegance</>
              )}
            </h2>
            <div className={styles.aboutDivider}></div>
            <p className={styles.aboutDesc}>
              {cmsHome?.story?.description || (
                <>
                  From Statement Chandeliers To Designer Wall Lights, Every Piece<br />
                  Is Crafted To Inspire.
                </>
              )}
            </p>
            <Link href="/about" className={styles.btnDiscoverStory}>
              <span className={styles.btnStoryDesktopText}>Discover Our Story</span>
              <span className={styles.btnStoryMobileText}>Learn more</span>
              <svg className={styles.btnStoryArrow} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
            <div className={styles.aboutFeatures}>
              <div className={styles.aboutFeatureItem}>
                <Image
                  src="/images/logos/PremiumCraftmanship.svg"
                  alt="Premium Craftmanship"
                  width={68}
                  height={68}
                  className={styles.aboutFeatureSvg}
                />
                <span className={styles.aboutFeatureLabel}>Premium Craftmanship</span>
              </div>
              <div className={styles.aboutFeatureDivider}></div>
              <div className={styles.aboutFeatureItem}>
                <Image
                  src="/images/logos/BespokeDesign.svg"
                  alt="Bespoke Design"
                  width={68}
                  height={68}
                  className={styles.aboutFeatureSvg}
                />
                <span className={styles.aboutFeatureLabel}>Bespoke Design</span>
              </div>
              <div className={styles.aboutFeatureDivider}></div>
              <div className={styles.aboutFeatureItem}>
                <Image
                  src="/images/logos/HandcraftedExcellence.svg"
                  alt="Handcrafted Excellence"
                  width={68}
                  height={68}
                  className={styles.aboutFeatureSvg}
                />
                <span className={styles.aboutFeatureLabel}>Handcrafted Excellence</span>
              </div>
            </div>
          </div>
          <div className={styles.aboutRight}>
            <Image
              src={cmsHome?.story?.image || "/images/about_chandelier_1784107790569.jpg"}
              alt="Chandelier"
              fill
              className={styles.aboutRightImg}
              style={{ objectFit: "cover" }}
            />
          </div>
        </div>

        {/* Stats Row - 4 image cards with overlaid text */}
        <div className={styles.statsRow}>
          {(cmsHome?.story?.stats && cmsHome.story.stats.length === 4
            ? cmsHome.story.stats
            : [
              { number: "10+", label: "Years Of Excellence", image: "/images/project_lounge_1784107767735.jpg" },
              { number: "98%", label: "Client Satisfaction", image: "/images/about_chandelier_1784107790569.jpg" },
              { number: "500+", label: "Lighting Installations", image: "/images/project_lobby_1784107778993.jpg" },
              { number: "50K+", label: "Happy Customers", image: "/images/project_lounge_1784107767735.jpg" }
            ]
          ).map((st: any, idx: number) => {
            const numVal = parseInt(st.number.replace(/\D/g, ""), 10) || 10;
            const suffixVal = st.number.replace(/[0-9]/g, "") || "+";
            return (
              <div key={idx} className={styles.statCard}>
                <Image
                  src={st.image || "/images/project_lounge_1784107767735.jpg"}
                  alt={st.label}
                  fill
                  className={styles.statCardImg}
                  style={{ objectFit: "cover" }}
                />
                <div className={styles.statOverlay}>
                  <AnimatedCounter target={numVal} suffix={suffixVal} className={styles.statNum} duration={2 + idx * 0.2} />
                  <span className={styles.statLabel}>{st.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===================== CUSTOMER STORIES SECTION ===================== */}
      {/* Figma: 1440x856, large Libre Caslon title, 3 testimonial cards, nav arrows */}
      <section className={styles.storiesSection}>
        <h2 className={styles.storiesTitle}>CUSTOMER STORIES</h2>
        <CustomerStoriesCarousel initialStories={testimonials} />
      </section>

      {/* ===================== CTA SECTION ===================== */}
      {/* Figma: 1440x518, dark background image with overlay, white serif title, 2 buttons */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaBg}>
          <Image
            src={cmsHome?.cta?.bg_image || "/images/cta_bg.jpg"}
            alt="Lighting Collections"
            fill
            sizes="100vw"
            style={{ objectFit: "cover" }}
          />
          <div className={styles.ctaOverlay}></div>
        </div>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>{cmsHome?.cta?.title || "Discover Timeless Lighting"}</h2>
          <p className={styles.ctaDesc}>
            {cmsHome?.cta?.description || (
              <>
                Elevate Your Interiors With Premium Lighting Collections Crafted To Bring Warmth,<br />
                Elegance, And Sophistication To Every Space.
              </>
            )}
          </p>
          <div className={styles.ctaBtns}>
            <Link href={cmsHome?.cta?.btn_primary_link || "/shop"} scroll={true} className={styles.ctaBtnPrimary}>
              {cmsHome?.cta?.btn_primary_text || "Shop Lighting"}
            </Link>
            <Link href={cmsHome?.cta?.btn_secondary_link || "/about"} scroll={true} className={styles.ctaBtnOutline}>
              {cmsHome?.cta?.btn_secondary_text || "Learn more"}
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}
