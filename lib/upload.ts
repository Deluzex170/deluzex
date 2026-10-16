/**
 * Client-side helper for uploading files to Cloudinary via Next.js API
 */

export type UploadFolder =
  | "products"
  | "gallery"
  | "projects"
  | "cms"
  | "categories"
  | "datasheets";

export interface UploadResult {
  url: string;
  public_id: string;
  width?: number;
  height?: number;
  format?: string;
}

/**
 * Upload an image or file to Cloudinary with folder routing
 */
export async function uploadFileToCloudinary(
  file: File,
  folder: UploadFolder = "cms"
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to upload file to Cloudinary");
  }

  return {
    url: data.url,
    public_id: data.public_id,
    width: data.width,
    height: data.height,
    format: data.format,
  };
}
