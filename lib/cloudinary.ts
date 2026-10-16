import { v2 as cloudinary, UploadApiResponse, UploadApiOptions } from "cloudinary";

// Configure Cloudinary server-side
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "xyl1w0pz",
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Standardized Cloudinary Folder Structure for Deluzex
 */
export const CLOUDINARY_FOLDERS = {
  PRODUCTS_COVER: "deluzex/products/covers",
  PRODUCTS_GALLERY: "deluzex/products/gallery",
  PROJECTS: "deluzex/projects",
  CMS: "deluzex/cms",
  CATEGORIES: "deluzex/categories",
  DATASHEETS: "deluzex/datasheets",
} as const;

export type CloudinaryFolderType = keyof typeof CLOUDINARY_FOLDERS;

/**
 * Resolve folder string or alias to full Cloudinary folder path
 */
export function resolveFolder(folderInput?: string): string {
  if (!folderInput) return CLOUDINARY_FOLDERS.CMS;

  const normalized = folderInput.toLowerCase().trim();
  switch (normalized) {
    case "products":
    case "product":
    case "cover":
    case "products/covers":
      return CLOUDINARY_FOLDERS.PRODUCTS_COVER;
    case "gallery":
    case "products/gallery":
      return CLOUDINARY_FOLDERS.PRODUCTS_GALLERY;
    case "projects":
    case "project":
      return CLOUDINARY_FOLDERS.PROJECTS;
    case "categories":
    case "category":
      return CLOUDINARY_FOLDERS.CATEGORIES;
    case "datasheet":
    case "datasheets":
    case "pdf":
      return CLOUDINARY_FOLDERS.DATASHEETS;
    case "cms":
    case "banner":
    case "banners":
      return CLOUDINARY_FOLDERS.CMS;
    default:
      return folderInput.startsWith("deluzex/") ? folderInput : `deluzex/${folderInput}`;
  }
}

/**
 * Upload buffer or base64 to Cloudinary
 */
export async function uploadToCloudinary(
  fileBuffer: Buffer | string,
  folder: string = CLOUDINARY_FOLDERS.CMS,
  options?: UploadApiOptions
): Promise<UploadApiResponse> {
  const resolvedFolder = resolveFolder(folder);

  const defaultOptions: UploadApiOptions = {
    folder: resolvedFolder,
    resource_type: "auto",
    use_filename: true,
    unique_filename: true,
    overwrite: false,
    quality: "auto",
    fetch_format: "auto",
    ...options,
  };

  if (typeof fileBuffer === "string" && (fileBuffer.startsWith("http://") || fileBuffer.startsWith("https://") || fileBuffer.startsWith("data:"))) {
    return cloudinary.uploader.upload(fileBuffer, defaultOptions);
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      defaultOptions,
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Cloudinary upload failed"));
        } else {
          resolve(result);
        }
      }
    );

    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    uploadStream.end(buffer);
  });
}

export default cloudinary;
