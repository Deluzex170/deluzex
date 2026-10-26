import type { Metadata } from "next";
import { fetchProductById } from "@/app/services/api";

type LayoutProps = {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://deluzexlighting.com";

  try {
    const product = await fetchProductById(slug);

    if (!product) {
      return {
        title: "Bespoke Luminaire | Deluzex Luxury Lighting",
        description: "Handcrafted architectural luxury lighting tailored for discerning residences and hospitality spaces.",
      };
    }

    const title = product.title || product.product_title || product.name || "Bespoke Luminaire";
    const descText = product.description || product.product_description;
    const description = descText
      ? descText.slice(0, 160)
      : `Explore the handcrafted ${title} by Deluzex. Luxury architectural lighting and bespoke chandeliers.`;
    const rawImage = product.image || product.product_main_image || product.image_url;
    const imageUrl = rawImage
      ? (rawImage.startsWith("http") ? rawImage : `${baseUrl}${rawImage}`)
      : `${baseUrl}/images/card1.jpg`;

    return {
      title: `${title} | Deluzex Luxury Lighting`,
      description,
      openGraph: {
        title: `${title} | Deluzex Luxury Lighting`,
        description,
        url: `${baseUrl}/product/${slug}`,
        siteName: "Deluzex Luxury Lighting",
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: `${title} | Deluzex Luxury Lighting`,
        description,
        images: [imageUrl],
      },
    };
  } catch {
    return {
      title: "Bespoke Luminaire | Deluzex Luxury Lighting",
      description: "Handcrafted architectural luxury lighting tailored for discerning residences and hospitality spaces.",
    };
  }
}

export default async function ProductLayout({ params, children }: LayoutProps) {
  const { slug } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://deluzexlighting.com";

  let schemaJson = null;
  try {
    const product = await fetchProductById(slug);
    if (product) {
      const title = product.title || product.product_title || product.name || "Bespoke Luminaire";
      const rawImage = product.image || product.product_main_image || product.image_url;
      const imageUrl = rawImage
        ? (rawImage.startsWith("http") ? rawImage : `${baseUrl}${rawImage}`)
        : `${baseUrl}/images/card1.jpg`;
      const numPrice = typeof product.price === "number" ? product.price : parseFloat(String(product.product_price || product.price || 0)) || 0;

      schemaJson = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: title,
        image: [imageUrl],
        description: product.description || product.product_description || `Luxury architectural luminaire ${title} by Deluzex Atelier.`,
        sku: String(product.sku || product.id || product._id || slug),
        brand: {
          "@type": "Brand",
          name: "Deluzex",
        },
        offers: {
          "@type": "Offer",
          url: `${baseUrl}/product/${slug}`,
          priceCurrency: "INR",
          price: numPrice,
          availability:
            product.in_stock !== false && (product.stock_count ?? 1) > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
        },
      };
    }
  } catch {
    schemaJson = null;
  }

  return (
    <>
      {schemaJson && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaJson) }}
        />
      )}
      {children}
    </>
  );
}
