import styles from "./categories.module.css";
import Image from "next/image";
import Link from "next/link";
import { fetchCategories, Category } from "../services/api";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore Categories | Deluzex Luxury Lighting",
  description:
    "Explore our complete portfolio of luxury architectural and decorative lighting fixtures: chandeliers, pendant lights, COB, table lamps, and custom installations.",
};

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const apiCategories = await fetchCategories();

  const categoriesList: (Category & { description?: string | null })[] = apiCategories || [];

  return (
    <main className={styles.main}>
      {/* HERO SECTION */}
      <section className={styles.hero}>
        <div className={styles.heroBg}>
          <Image
            src="/images/hero_bg.png"
            alt="Deluzex Categories"
            fill
            style={{ objectFit: "cover" }}
            priority
          />
        </div>
        <div className={styles.heroOverlay}></div>

        <div className={styles.heroContent}>
          <div className={styles.breadcrumbs}>
            <Link href="/" className={styles.breadcrumbLink}>
              Home
            </Link>
            <span>/</span>
            <span>Categories</span>
          </div>
          <p className={styles.heroSub}>Collections</p>
          <h1 className={styles.heroTitle}>Explore Categories</h1>
          <p className={styles.heroDesc}>
            Discover our curated lighting families, crafted with timeless craftsmanship, exceptional materials, and modern architectural precision.
          </p>
        </div>
      </section>

      {/* CATEGORIES GRID SECTION */}
      <section className={styles.categoriesSection}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionSub}>Lighting For Every Interior</p>
          <h2 className={styles.sectionTitle}>Curated Collections</h2>
          <p className={styles.sectionDesc}>
            Select any category below to browse all available fixtures, specifications, and finish options.
          </p>
        </div>

        <div className={styles.categoriesGrid}>
          {categoriesList.map((cat, index) => {
            const catIdentifier = cat._id || cat.id || cat.category_id || cat.name;
            const linkHref = `/shop?category=${encodeURIComponent(catIdentifier)}`;

            return (
              <Link
                key={catIdentifier || index}
                href={linkHref}
                className={styles.categoryCard}
              >
                <div className={styles.cardImageWrapper}>
                  <Image
                    src={cat.image_url || "/images/category_chandelier_1784107756268.jpg"}
                    alt={cat.name}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className={styles.cardImage}
                  />
                </div>
                <div className={styles.cardOverlay}></div>

                <div className={styles.cardContent}>
                  <span className={styles.categoryTag}>Collection #{String(index + 1).padStart(2, "0")}</span>
                  <h3 className={styles.categoryName}>{cat.name}</h3>
                  {cat.description && (
                    <p className={styles.categoryDesc}>{cat.description}</p>
                  )}
                  <div className={styles.cardFooter}>
                    <span className={styles.viewProductsText}>
                      View All Products
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </span>
                    <span className={styles.cardArrow} aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* BESPOKE ASSISTANCE BANNER */}
        <div className={styles.bespokeSection}>
          <div className={styles.bespokeContent}>
            <p className={styles.bespokeSub}>Custom Architecture</p>
            <h3 className={styles.bespokeTitle}>Looking for Bespoke Lighting Solutions?</h3>
            <p className={styles.bespokeDesc}>
              We collaborate directly with architects, interior designers, and luxury homeowners to craft custom dimensions, finishes, and smart lighting controls.
            </p>
          </div>
          <Link href="/contact" className={styles.bespokeBtn}>
            Speak with a Specialist
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>
      </section>
    </main>
  );
}
