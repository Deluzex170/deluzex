import fs from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";

// Parse .env.local manually
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

const cloud_name = process.env.CLOUDINARY_CLOUD_NAME || "xyl1w0pz";
const api_key = process.env.CLOUDINARY_API_KEY;
const api_secret = process.env.CLOUDINARY_API_SECRET;

if (!api_key || !api_secret) {
  console.error("Missing CLOUDINARY_API_KEY or CLOUDINARY_API_SECRET in .env.local!");
  process.exit(1);
}

cloudinary.config({
  cloud_name,
  api_key,
  api_secret,
  secure: true,
});

console.log(`Configured Cloudinary for cloud_name: ${cloud_name}`);

// List of files to upload with their desired folder in Cloudinary
const filesToUpload = [
  // Logos / Branding
  { local: "public/deluzex-logo.jpeg", folder: "deluzex/branding", publicId: "deluzex_logo" },
  { local: "public/deluzex-black-logo.jpeg", folder: "deluzex/branding", publicId: "deluzex_black_logo" },
  { local: "public/images/logos/De Luzex Final Favicon Url png logo.png", folder: "deluzex/branding", publicId: "favicon_logo" },
  { local: "public/images/logos/De Luzex Png Black Logo.png", folder: "deluzex/branding", publicId: "deluzex_png_black_logo" },
  { local: "public/images/logos/De Luzex Png White Logo.png", folder: "deluzex/branding", publicId: "deluzex_png_white_logo" },
  { local: "public/images/logos/de_luzex_black.png", folder: "deluzex/branding", publicId: "de_luzex_black" },
  { local: "public/images/logos/de_luzex_white.png", folder: "deluzex/branding", publicId: "de_luzex_white" },
  
  // Products
  { local: "public/images/lamp_black_gold_1784107745696.jpg", folder: "deluzex/products/covers", publicId: "lamp_black_gold" },
  { local: "public/images/lamp_classic_1784107722127.jpg", folder: "deluzex/products/covers", publicId: "lamp_classic" },
  { local: "public/images/lamp_modern_tall_1784107732736.jpg", folder: "deluzex/products/covers", publicId: "lamp_modern_tall" },
  { local: "public/images/category_chandelier_1784107756268.jpg", folder: "deluzex/categories", publicId: "category_chandelier" },

  // Projects
  { local: "public/images/project_lobby_1784107778993.jpg", folder: "deluzex/projects", publicId: "project_lobby" },
  { local: "public/images/project_lounge_1784107767735.jpg", folder: "deluzex/projects", publicId: "project_lounge" },

  // CMS & Banners
  { local: "public/images/hero_bg.png", folder: "deluzex/cms", publicId: "hero_bg" },
  { local: "public/images/about_chandelier_1784107790569.jpg", folder: "deluzex/cms", publicId: "about_chandelier" },
  { local: "public/images/avatar_woman_1784107804209.jpg", folder: "deluzex/testimonials", publicId: "avatar_woman" },
  { local: "public/images/coming-soon-desktop-bg.jpg", folder: "deluzex/cms", publicId: "coming_soon_desktop_bg" },
  { local: "public/images/coming-soon-desktop-ref.jpg", folder: "deluzex/cms", publicId: "coming_soon_desktop_ref" },
  { local: "public/images/coming-soon-mobile-bg.png", folder: "deluzex/cms", publicId: "coming_soon_mobile_bg" },
  { local: "public/images/coming-soon-mobile-ref.png", folder: "deluzex/cms", publicId: "coming_soon_mobile_ref" },

  // Coming Soon assets
  { local: "public/coming-soon/logo.png", folder: "deluzex/branding", publicId: "coming_soon_logo" },
  { local: "public/coming-soon/00d77533f67bac5a13fc4b0d78146c44e5ab38f6.png", folder: "deluzex/cms", publicId: "coming_soon_ref" },

  // Vector / Icons
  { local: "public/images/logos/amazon.svg", folder: "deluzex/icons", publicId: "amazon" },
  { local: "public/images/logos/flipkart.svg", folder: "deluzex/icons", publicId: "flipkart" },
  { local: "public/images/logos/instagram.svg", folder: "deluzex/icons", publicId: "instagram" },
  { local: "public/images/logos/whatsapp.svg", folder: "deluzex/icons", publicId: "whatsapp" },
  { local: "public/images/logos/De Luzex Final Favicon Url png logo.svg", folder: "deluzex/branding", publicId: "favicon_svg" },
  { local: "public/images/logos/De Luzex Svg logo black.svg", folder: "deluzex/branding", publicId: "logo_svg_black" },
  { local: "public/images/logos/De Luzex_white_logo.svg", folder: "deluzex/branding", publicId: "logo_svg_white" },
];

async function run() {
  const results = {};
  console.log(`Starting upload of ${filesToUpload.length} files to Cloudinary...`);

  for (const item of filesToUpload) {
    const fullPath = path.resolve(process.cwd(), item.local);
    if (!fs.existsSync(fullPath)) {
      console.warn(`[SKIP] File not found: ${item.local}`);
      continue;
    }

    try {
      const isSvg = item.local.endsWith(".svg");
      const res = await cloudinary.uploader.upload(fullPath, {
        folder: item.folder,
        public_id: item.publicId,
        resource_type: isSvg ? "image" : "image",
        overwrite: true,
      });

      console.log(`[SUCCESS] ${item.local} -> ${res.secure_url}`);
      results[item.local] = {
        secure_url: res.secure_url,
        public_id: res.public_id,
        folder: item.folder,
        format: res.format,
        width: res.width,
        height: res.height,
      };
    } catch (err) {
      console.error(`[ERROR] Failed to upload ${item.local}:`, err.message || err);
    }
  }

  const outputPath = path.resolve(process.cwd(), "cloudinary_uploaded_urls.json");
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nAll uploaded mappings written to: ${outputPath}`);
}

run();
