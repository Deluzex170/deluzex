import { logger } from "@/lib/logger";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const originalFetch = globalThis.fetch;

export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    const match =
      localStorage.getItem('authToken') ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('token');
    if (match) return match;

    try {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'access_token' || name === 'accessToken' || name === 'session') {
          return decodeURIComponent(value);
        }
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export const getStoredAuthToken = getAuthToken;

export function getAuthHeaders(isFormData = false): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

let isHandlingSessionExpiry = false;

export function handleSessionExpired(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem("authToken");
    localStorage.removeItem("access_token");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax";
  } catch {
    // ignore
  }

  window.dispatchEvent(new CustomEvent("auth:session-expired"));

  const path = window.location.pathname;
  if (path.startsWith("/admin") && path !== "/admin/login") {
    if (!isHandlingSessionExpiry) {
      isHandlingSessionExpiry = true;
      const redirectUrl = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/admin/login?expired=1&redirect=${redirectUrl}`;
    }
  }
}

async function loggedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

  // On the server (SSR), prepend the host for relative paths so fetch doesn't throw Invalid URL
  if (typeof window === "undefined" && url.startsWith("/")) {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://127.0.0.1:8000";
    url = `${base}${url}`;
    input = url;
  }

  // Attach stored auth token if available and not explicitly provided
  const token = getStoredAuthToken();
  let modifiedInit = init;
  if (token) {
    const headers = new Headers(init?.headers);
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
      modifiedInit = {
        ...init,
        headers,
      };
    }
  }

  const method = modifiedInit?.method || "GET";
  const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();

  try {
    const res = await originalFetch(input, modifiedInit);
    const durationMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - startTime;

    let previewData: unknown = undefined;
    try {
      const clone = res.clone();
      const contentType = clone.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        previewData = await clone.json();
      }
    } catch {
      // Ignore preview parsing error
    }

    logger.api({
      method,
      url,
      status: res.status,
      durationMs,
      reqData: init?.body,
      resData: previewData,
    });

    if (res.status === 401 && !url.includes("/auth/login") && !url.includes("/auth/admin/login")) {
      handleSessionExpired();
    }

    return res;
  } catch (error) {
    const durationMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - startTime;
    logger.api({
      method,
      url,
      status: 0,
      durationMs,
      reqData: init?.body,
      error,
    });
    throw error;
  }
}

// Scoped alias for fetch so every API operation in this module automatically routes through telemetry
const fetch = loggedFetch;

type JsonObject = Record<string, unknown>;

type ApiMutationBody = JsonObject | FormData;

export interface Category {
  _id?: string;
  id?: string | number;
  category_id?: string | number;
  name: string;
  image_url?: string | null;
  description?: string | null;
}

export interface Testimonial {
  _id?: string;
  id?: string;
  author_name: string;
  author_title?: string | null;
  text: string;
  rating: number;
  avatar_url?: string | null;
  created_at?: string;
}

export interface Blog {
  _id?: string;
  id?: string | number;
  title: string;
  slug?: string;
  category: string;
  author: string;
  read_time: string;
  excerpt?: string | null;
  content: string;
  image: string;
  is_featured?: boolean;
  status: string; // "Published" | "Draft"
  sequence: number;
  created_at?: string;
  updated_at?: string;
}

export interface Project {
  _id?: string;
  id?: string | number;
  title: string;
  location?: string | null;
  category?: string;
  subtitle?: string | null;
  description?: string | null;
  installations_count?: string | null;
  image_url?: string;
  gallery_images?: string[];
  videos?: string[];
  year?: string | null;
  scope?: string | null;
  area?: string | null;
  client?: string | null;
  is_featured?: boolean;
  sequence?: number;
  created_at?: string;
}

export interface ProductSpecification {
  key: string;
  value: string;
}

export interface Product {
  _id?: string | number;
  id?: string | number;
  slug?: string;
  title?: string;
  name?: string;
  price?: string | number;
  rating?: number;
  image?: string;
  image_url?: string;
  description?: string;
  reviews_count?: number;
  product_title: string;
  product_price: string | number;
  product_description: string;
  product_category: string;
  product_material?: string;
  product_voltage?: string;
  product_style?: string;
  product_finishing?: string;
  stock_count?: number;
  product_rating?: number;
  is_featured?: boolean;
  is_new_arrival?: boolean;
  product_main_image?: string;
  product_images?: string[];

  // Technical Specifications & Reference Design Fields
  sku?: string;
  stock_status?: string;
  in_stock?: boolean;
  price_prefix?: string;
  price_note?: string;
  dimensions?: string;
  finish?: string;
  material?: string;
  colorway?: string;
  piece_weight?: string;
  care?: string;
  moq_rule?: string;
  replenishment?: string;
  whatsapp_number?: string;
  phone_number?: string;
  specifications?: ProductSpecification[];
  technical_spec_pdf?: string;
}

export interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  country?: string | null;
  is_verified: boolean;
  is_admin?: boolean;
  created_at: string;
}

export interface UserProfileUpdate {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  city?: string;
  country?: string;
}

export interface PasswordUpdate {
  current_password: string;
  new_password: string;
}


async function getApiError(res: Response, fallback: string): Promise<Error> {
  if (res.status === 401) {
    handleSessionExpired();
  }
  const body = await res.json().catch(() => ({}));
  const detail = body.detail || body.message;
  return new Error(typeof detail === "string" ? detail : fallback);
}

function getResponseData<T>(body: { data?: T } | T): T {
  return (body && typeof body === "object" && "data" in body ? body.data : body) as T;
}

export async function fetchUserProfile(): Promise<UserProfile> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (res.ok) {
      const data = getResponseData<UserProfile>(await res.json());
      if (typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(data));
      }
      return data;
    }
    if (res.status === 401 || res.status === 403) {
      handleSessionExpired();
      throw new Error("Could not validate credentials");
    }
  } catch (err: any) {
    if (err?.message === "Could not validate credentials") {
      throw err;
    }
    // Network or offline fallback
  }

  if (typeof window !== "undefined" && typeof navigator !== "undefined" && !navigator.onLine) {
    try {
      const local = JSON.parse(localStorage.getItem("user") || "null");
      if (local && (local.email || local.first_name)) {
        return local;
      }
    } catch {
      // ignore
    }
  }

  throw new Error("Could not validate credentials");
}

export async function updateUserProfile(profile: UserProfileUpdate): Promise<UserProfile> {
  // Update local storage first so user profile updates immediately
  if (typeof window !== "undefined") {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      const merged = { ...stored, ...profile };
      localStorage.setItem("user", JSON.stringify(merged));
    } catch {
      // ignore
    }
  }

  try {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(profile),
    });
    if (res.ok) {
      const data = getResponseData<UserProfile>(await res.json());
      if (typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(data));
      }
      return data;
    }
    const err = await getApiError(res, "Failed to update profile.");
    // If validation error from backend (like email in use), throw to show user
    if (res.status === 400) {
      throw err;
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("already in use")) {
      throw err;
    }
    console.warn("Backend update failed, saved to local profile:", err);
  }

  // Fallback to local profile object if offline or remote API has issues
  const localUser = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}") : {};
  return {
    id: localUser.id || "user_local",
    first_name: profile.first_name || localUser.first_name || "",
    last_name: profile.last_name || localUser.last_name || "",
    email: profile.email || localUser.email || "",
    phone: profile.phone || localUser.phone || "",
    city: profile.city || localUser.city || "",
    country: profile.country || localUser.country || "",
    is_verified: Boolean(localUser.is_verified),
    is_admin: Boolean(localUser.is_admin),
    created_at: localUser.created_at || new Date().toISOString(),
  };
}

export async function updateUserPassword(password: PasswordUpdate): Promise<void> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/me/password`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(password),
    });
    if (!res.ok) {
      throw await getApiError(res, "Failed to update password.");
    }
    return;
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Current password") || error.message.includes("least 6"))) {
      throw error;
    }
    // If backend is offline or network error, save timestamp locally
    if (typeof window !== "undefined") {
      localStorage.setItem("deluzex_password_updated_at", new Date().toISOString());
    }
    return;
  }
}


export async function deleteUserProfile(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw await getApiError(res, "Failed to delete account.");
}

export async function fetchCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/categories`, {
      headers: getAuthHeaders(),
      next: { revalidate: 60 } // Revalidate cache every 60s
    });
    if (!res.ok) throw new Error("Failed to fetch categories");
    const data = await res.json();
    
    // Support direct arrays [...] or response wrappers like { data: [...] }
    return Array.isArray(data) ? data : (data.data || []);
    return [];
  } catch (error) {
    logger.error("API", "Error fetching categories:", error);
    return []; // Return empty array on failure so UI doesn't crash
  }
}

export async function fetchProducts(queryParams?: URLSearchParams | string): Promise<Product[]> {
  try {
    const queryStr = queryParams ? `?${queryParams.toString()}` : '';
    const res = await fetch(`${API_BASE_URL}/products${queryStr}`, {
      headers: getAuthHeaders(),
      next: { revalidate: 60 }
    });
    if (!res.ok) throw new Error("Failed to fetch products");
    const data = await res.json();
    
    return data.data || data || [];
  } catch (error) {
    logger.error("API", "Error fetching products:", error);
    return [];
  }
}

export async function fetchProductById(id: string): Promise<Product | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/products/${id}`, {
      headers: getAuthHeaders(),
      next: { revalidate: 60 }
    });
    if (!res.ok) throw new Error(`Failed to fetch product ${id}`);
    const data = await res.json();
    
    return data.data || data || null;
  } catch (error) {
    logger.error("API", `Error fetching product ${id}:`, error);
    return null;
  }
}

// --- ADMIN MUTATIONS ---

export async function createProduct(productData: ApiMutationBody) {
  const isFormData = productData instanceof FormData;
  const res = await fetch(`${API_BASE_URL}/products`, {
    method: 'POST',
    headers: getAuthHeaders(isFormData),
    body: isFormData ? productData : JSON.stringify(productData)
  });
  if (!res.ok) throw await getApiError(res, 'Failed to create product');
  return res.json();
}

export async function updateProduct(id: string | number, productData: ApiMutationBody) {
  const isFormData = productData instanceof FormData;
  const res = await fetch(`${API_BASE_URL}/products/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(isFormData),
    body: isFormData ? productData : JSON.stringify(productData)
  });
  if (!res.ok) throw await getApiError(res, 'Failed to update product');
  return res.json();
}

export async function deleteProduct(id: string | number) {
  const res = await fetch(`${API_BASE_URL}/products/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete product');
  return res.json();
}

export async function toggleProductNewArrival(id: string | number, isNewArrival?: boolean): Promise<Product> {
  const url = `${API_BASE_URL}/products/${id}/new-arrival`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(isNewArrival !== undefined ? { is_new_arrival: isNewArrival } : {})
  });
  if (!res.ok) throw new Error('Failed to update product new arrival status');
  const data = await res.json();
  return data.data || data;
}

export async function createCategory(categoryData: JsonObject) {
  const res = await fetch(`${API_BASE_URL}/categories`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(categoryData)
  });
  if (!res.ok) throw new Error('Failed to create category');
  return res.json();
}

export async function updateCategory(id: string | number, categoryData: JsonObject) {
  const res = await fetch(`${API_BASE_URL}/categories/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(categoryData)
  });
  if (!res.ok) throw new Error('Failed to update category');
  return res.json();
}

export async function deleteCategory(id: string | number) {
  const res = await fetch(`${API_BASE_URL}/categories/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete category');
  return res.json();
}

// --- HERO PRODUCTS ---

export interface HeroProduct {
  _id?: string;
  id?: string;
  image: string;
  name: string;
  price: number;
  count?: number;
  alt: string;
  created_at?: string;
}

export async function fetchHeroProducts(): Promise<HeroProduct[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/hero-products`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch hero products");
    const data = await res.json();
    return Array.isArray(data) ? data : data.data || [];
  } catch (error) {
    logger.error("API", "Error fetching hero products:", error);
    return [];
  }
}

export async function createHeroProduct(heroData: ApiMutationBody) {
  const isFormData = heroData instanceof FormData;
  const res = await fetch(`${API_BASE_URL}/hero-products`, {
    method: "POST",
    headers: getAuthHeaders(isFormData),
    body: isFormData ? heroData : JSON.stringify(heroData),
  });
  if (!res.ok) throw new Error("Failed to create hero product");
  return res.json();
}

export async function updateHeroProduct(id: string | number, heroData: ApiMutationBody) {
  const isFormData = heroData instanceof FormData;
  const res = await fetch(`${API_BASE_URL}/hero-products/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(isFormData),
    body: isFormData ? heroData : JSON.stringify(heroData),
  });
  if (!res.ok) throw new Error("Failed to update hero product");
  return res.json();
}

export async function deleteHeroProduct(id: string | number) {
  const res = await fetch(`${API_BASE_URL}/hero-products/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete hero product");
  return res.json();
}

// TESTIMONIALS (CUSTOMER STORIES)
export async function fetchTestimonials(): Promise<Testimonial[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/testimonials`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch testimonials");
    const data = await res.json();
    return Array.isArray(data) ? data : data.data || [];
  } catch (error) {
    logger.error("API", "Error fetching testimonials:", error);
    return [];
  }
}

export async function createTestimonial(testimonialData: ApiMutationBody) {
  const isFormData = testimonialData instanceof FormData;
  const res = await fetch(`${API_BASE_URL}/testimonials`, {
    method: "POST",
    headers: getAuthHeaders(isFormData),
    body: isFormData ? testimonialData : JSON.stringify(testimonialData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || "Failed to create testimonial");
  }
  return res.json();
}

export async function updateTestimonial(id: string | number, testimonialData: ApiMutationBody) {
  const isFormData = testimonialData instanceof FormData;
  const res = await fetch(`${API_BASE_URL}/testimonials/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(isFormData),
    body: isFormData ? testimonialData : JSON.stringify(testimonialData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || "Failed to update testimonial");
  }
  return res.json();
}

export async function deleteTestimonial(id: string | number) {
  const res = await fetch(`${API_BASE_URL}/testimonials/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || "Failed to delete testimonial");
  }
  return res.json();
}

// ==========================================
// BLOGS API
// ==========================================

export async function fetchBlogs(queryParams?: URLSearchParams | string): Promise<Blog[]> {
  try {
    const queryStr = queryParams ? `?${queryParams.toString()}` : "";
    const res = await fetch(`${API_BASE_URL}/blogs${queryStr}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch blogs");
    const data = await res.json();
    return Array.isArray(data) ? data : data.data || [];
  } catch (error) {
    logger.error("API", "Error fetching blogs:", error);
    return [];
  }
}

export async function fetchBlogBySlugOrId(idOrSlug: string): Promise<Blog | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/blogs/${idOrSlug}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Failed to fetch blog ${idOrSlug}`);
    const data = await res.json();
    return data.data || data || null;
  } catch (error) {
    logger.error("API", `Error fetching blog ${idOrSlug}:`, error);
    return null;
  }
}

export async function createBlog(blogData: ApiMutationBody): Promise<Blog> {
  const isFormData = blogData instanceof FormData;
  const res = await fetch(`${API_BASE_URL}/blogs`, {
    method: "POST",
    headers: getAuthHeaders(isFormData),
    body: isFormData ? blogData : JSON.stringify(blogData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || "Failed to create blog");
  }
  return res.json();
}

export async function updateBlog(id: string | number, blogData: ApiMutationBody): Promise<Blog> {
  const isFormData = blogData instanceof FormData;
  const res = await fetch(`${API_BASE_URL}/blogs/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(isFormData),
    body: isFormData ? blogData : JSON.stringify(blogData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || "Failed to update blog");
  }
  return res.json();
}

export async function deleteBlog(id: string | number) {
  const res = await fetch(`${API_BASE_URL}/blogs/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || "Failed to delete blog");
  }
  return res.json();
}

export async function swapBlogSequence(id: string | number, direction: "up" | "down") {
  const res = await fetch(`${API_BASE_URL}/blogs/${id}/swap?direction=${direction}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `Failed to move blog ${direction}`);
  }
  return res.json();
}

export async function reorderBlogs(items: { id: string; sequence: number }[]) {
  const res = await fetch(`${API_BASE_URL}/blogs/reorder`, {
    method: "PATCH",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(items),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || "Failed to reorder blogs");
  }
  return res.json();
}

// ==========================================
// PROJECTS API
// ==========================================

export async function fetchProjects(queryParams?: URLSearchParams | string): Promise<Project[]> {
  try {
    const queryStr = queryParams ? `?${queryParams.toString()}` : "";
    const res = await fetch(`${API_BASE_URL}/projects${queryStr}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch projects");
    const data = await res.json();
    return Array.isArray(data) ? data : data.data || [];
  } catch (error) {
    logger.error("API", "Error fetching projects:", error);
    return [];
  }
}

export async function fetchProjectById(id: string | number): Promise<Project | null> {
  const strId = String(id);
  try {
    const res = await fetch(`${API_BASE_URL}/projects/${encodeURIComponent(strId)}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      return data.data || data || null;
    }
  } catch {
    // fallback
  }

  try {
    const all = await fetchProjects();
    const found = all.find(
      (p) =>
        String(p._id) === strId ||
        String(p.id) === strId ||
        p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") === strId.toLowerCase()
    );
    return found || null;
  } catch (error) {
    logger.error("API", `Error fetching project ${id}:`, error);
    return null;
  }
}

export async function createProject(projectData: ApiMutationBody): Promise<Project> {
  const isFormData = projectData instanceof FormData;
  const res = await fetch(`${API_BASE_URL}/projects`, {
    method: "POST",
    headers: getAuthHeaders(isFormData),
    body: isFormData ? projectData : JSON.stringify(projectData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || "Failed to create project");
  }
  return res.json();
}

export async function updateProject(id: string | number, projectData: ApiMutationBody): Promise<Project> {
  const isFormData = projectData instanceof FormData;
  const res = await fetch(`${API_BASE_URL}/projects/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(isFormData),
    body: isFormData ? projectData : JSON.stringify(projectData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || "Failed to update project");
  }
  return res.json();
}

export async function deleteProject(id: string | number) {
  const res = await fetch(`${API_BASE_URL}/projects/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || "Failed to delete project");
  }
  return res.json();
}

export async function toggleProjectFeatured(id: string | number): Promise<Project> {
  const res = await fetch(`${API_BASE_URL}/projects/${id}/featured`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || "Failed to toggle project featured status");
  }
  return res.json();
}

export async function swapProjectSequence(id: string | number, direction: "up" | "down") {
  const res = await fetch(`${API_BASE_URL}/projects/${id}/swap?direction=${direction}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `Failed to move project ${direction}`);
  }
  return res.json();
}


export async function submitContactForm(contactData: JsonObject) {
  const res = await fetch(`${API_BASE_URL}/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(contactData)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to submit contact form');
  }
  return res.json();
}

export interface Inquiry {
  _id: string;
  id?: string;
  name?: string;
  email: string;
  phone?: string;
  message: string;
  status?: "new" | "contacted" | "resolved" | "archived" | string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
}

export interface InquiryStats {
  total: number;
  new: number;
  contacted: number;
  resolved: number;
  archived: number;
}

export async function fetchInquiries(params?: { status?: string; search?: string }): Promise<Inquiry[]> {
  try {
    const query = new URLSearchParams();
    if (params?.status && params.status !== "all") query.append("status", params.status);
    if (params?.search && params.search.trim()) query.append("search", params.search.trim());

    const qs = query.toString() ? `?${query.toString()}` : "";
    const res = await fetch(`${API_BASE_URL}/contact${qs}`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch inquiries");
    const data = await res.json();
    return Array.isArray(data) ? data : data.data || [];
  } catch (error) {
    logger.error("API", "Error fetching inquiries:", error);
    return [];
  }
}

export async function fetchInquiryStats(): Promise<InquiryStats> {
  try {
    const res = await fetch(`${API_BASE_URL}/contact/stats`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch inquiry statistics");
    return await res.json();
  } catch (error) {
    logger.error("API", "Error fetching inquiry stats:", error);
    return { total: 0, new: 0, contacted: 0, resolved: 0, archived: 0 };
  }
}

export async function updateInquiryStatus(id: string, status: string): Promise<Inquiry> {
  const res = await fetch(`${API_BASE_URL}/contact/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || "Failed to update inquiry status");
  }
  return res.json();
}

export async function deleteInquiry(id: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE_URL}/contact/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || "Failed to delete inquiry");
  }
  return res.json();
}

// --- PAYMENTS ---

export interface PaymentMethod {
  id: string;
  name: string;
  description: string;
  razorpay_method: string;
  icon: string;
}

export interface OrderItemPayload {
  product_id: string;
  title: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface ShippingAddressPayload {
  first_name: string;
  last_name: string;
  street: string;
  city: string;
  state: string;
  pin_code: string;
}

export interface OrderPayload {
  email: string;
  phone: string;
  shipping_address: ShippingAddressPayload;
  items: OrderItemPayload[];
  subtotal: number;
  discount?: number;
  coupon_code?: string;
  gst: number;
  delivery: number;
  total: number;
}

export async function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  const res = await fetch(`${API_BASE_URL}/payments/methods`);
  if (!res.ok) throw new Error("Failed to fetch payment methods");
  return res.json();
}

export async function createPaymentOrder(
  payload: OrderPayload & {
    payment_method: string;
    razorpay_method: string;
    idempotency_key?: string;
    existing_order_id?: string;
    upi_vpa?: string;
    card_last4?: string;
    bank_code?: string;
  }
) {
  const res = await fetch(`${API_BASE_URL}/payments/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to create payment order");
  return data as {
    success: boolean;
    order_id: string;
    razorpay_order_id: string;
    amount: number;
    currency: string;
    key_id: string;
    is_resumed?: boolean;
    is_already_paid?: boolean;
  };
}

export async function verifyPayment(payload: {
  order_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  const res = await fetch(`${API_BASE_URL}/payments/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Payment verification failed");
  return data as { success: boolean; order_id: string; message: string };
}

export async function createCodOrder(
  payload: OrderPayload & {
    idempotency_key?: string;
    existing_order_id?: string;
  }
) {
  const res = await fetch(`${API_BASE_URL}/payments/cod`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to place order");
  return data as { success: boolean; order_id: string; message: string };
}

export interface InitiateUpiPayload {
  email: string;
  phone: string;
  shipping_address: {
    first_name: string;
    last_name: string;
    street: string;
    city: string;
    state: string;
    pin_code: string;
  };
  items: Array<{
    product_id: string;
    title: string;
    price: number;
    quantity: number;
    image?: string;
  }>;
  subtotal: number;
  gst: number;
  delivery: number;
  total: number;
  upi_vpa: string;
  idempotency_key?: string;
  existing_order_id?: string;
}

export interface InitiateUpiResponse {
  success: boolean;
  order_id: string;
  razorpay_order_id?: string;
  upi_vpa: string;
  amount: number;
  status: string;
  message: string;
  payment_url?: string;
  expires_in_seconds: number;
}

export async function initiateUpiPayment(payload: InitiateUpiPayload): Promise<InitiateUpiResponse> {
  const res = await fetch(`${API_BASE_URL}/payments/initiate-upi`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.message || "Failed to initiate UPI request.");
  return data;
}

export interface PaymentStatusCheckResponse {
  success: boolean;
  order_id: string;
  status: string;
  payment_id?: string;
  message: string;
  error_description?: string;
}

export async function checkPaymentStatus(orderId: string): Promise<PaymentStatusCheckResponse> {
  const res = await fetch(`${API_BASE_URL}/payments/status/${orderId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to check payment status.");
  return data;
}


export interface PaymentFailurePayload {
  order_id: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  status: "failed";
  error_code?: string;
  error_description?: string;
  error_source?: string;
  error_step?: string;
  error_reason?: string;
}

export async function recordPaymentFailure(payload: PaymentFailurePayload) {
  try {
    const res = await fetch(`${API_BASE_URL}/payments/failure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      // Also attempt fallback endpoint
      const fallback = await fetch(`${API_BASE_URL}/payments/failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (fallback.ok) return await fallback.json();
    } else {
      return await res.json();
    }
  } catch (err) {
    console.warn("Could not record payment failure to backend:", err);
  }
}

// --- USER SAVED ADDRESSES & CARDS ---

export interface SavedAddress {
  id?: string;
  _id?: string;
  user_id?: string;
  user_email: string;
  user_phone?: string;
  type?: "Home" | "Work" | "Other" | string;
  first_name: string;
  last_name: string;
  street: string;
  city: string;
  state: string;
  pin_code: string;
  phone: string;
  is_default?: boolean;
  created_at?: string;
}

export interface SavedCard {
  id?: string;
  _id?: string;
  user_id?: string;
  user_email: string;
  card_holder: string;
  card_number_masked: string;
  card_last4: string;
  card_type: "visa" | "mastercard" | "rupay" | "amex" | "other" | string;
  expiry: string;
  is_default?: boolean;
  created_at?: string;
}

export interface WishlistItem {
  id?: string;
  _id?: string;
  user_email: string;
  product_id?: string | null;
  product_title: string;
  product_price: string | number;
  product_image?: string | null;
  product_slug?: string | null;
  created_at?: string;
}

// Addresses API
export async function fetchUserAddresses(email?: string): Promise<SavedAddress[]> {
  try {
    const query = email ? `?email=${encodeURIComponent(email)}` : "";
    const res = await fetch(`${API_BASE_URL}/user/addresses${query}`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      const serverList: SavedAddress[] = Array.isArray(data) ? data : data.data || [];
      return serverList;
    }
  } catch (error) {
    console.warn("Could not fetch addresses from server:", error);
  }
  return [];
}

export async function saveUserAddress(address: SavedAddress): Promise<SavedAddress> {
  const payload = {
    user_email: address.user_email,
    type: address.type || "Home",
    first_name: address.first_name,
    last_name: address.last_name || "",
    street: address.street,
    city: address.city,
    state: address.state,
    pin_code: address.pin_code,
    phone: address.phone,
    is_default: Boolean(address.is_default),
  };

  const res = await fetch(`${API_BASE_URL}/user/addresses`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to save address to database");
  }

  const data = await res.json();
  return data.data || data;
}

export async function deleteUserAddress(addressId: string, email?: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/user/addresses/${addressId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    return res.ok;
  } catch (error) {
    console.error("Failed to delete address:", error);
    return false;
  }
}

export async function setDefaultUserAddress(addressId: string): Promise<SavedAddress | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/user/addresses/${addressId}/default`, {
      method: "PUT",
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      return data.data || data;
    }
  } catch (error) {
    console.error("Failed to set default address:", error);
  }
  return null;
}

// Cards API
export async function fetchUserCards(email?: string): Promise<SavedCard[]> {
  try {
    const query = email ? `?email=${encodeURIComponent(email)}` : "";
    const res = await fetch(`${API_BASE_URL}/user/cards${query}`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      const serverList: SavedCard[] = Array.isArray(data) ? data : data.data || [];
      return serverList;
    }
  } catch (error) {
    console.error("Failed to fetch user cards from server:", error);
  }
  return [];
}

export async function saveUserCard(card: SavedCard): Promise<SavedCard> {
  const res = await fetch(`${API_BASE_URL}/user/cards`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(card),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to save card");
  }
  const data = await res.json();
  return data.data || data;
}

export async function setDefaultUserCard(cardId: string): Promise<SavedCard> {
  const res = await fetch(`${API_BASE_URL}/user/cards/${cardId}/default`, {
    method: "PUT",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to set default card");
  }
  const data = await res.json();
  return data.data || data;
}

export async function deleteUserCard(cardId: string, email?: string): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/user/cards/${cardId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return res.ok;
}

// ==========================================
// WISHLIST API
// ==========================================

export async function fetchUserWishlist(email?: string): Promise<WishlistItem[]> {
  try {
    const query = email ? `?email=${encodeURIComponent(email)}` : "";
    const res = await fetch(`${API_BASE_URL}/user/wishlist${query}`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : data.data || [];
    }
  } catch (error) {
    console.error("Failed to fetch wishlist items from server:", error);
  }
  return [];
}

export async function addToWishlist(item: Partial<WishlistItem>): Promise<WishlistItem> {
  const res = await fetch(`${API_BASE_URL}/user/wishlist`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(item),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to add to wishlist");
  }
  const data = await res.json();
  return data.data || data;
}

export async function removeFromWishlist(itemId: string): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/user/wishlist/${itemId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return res.ok;
}

export async function clearUserWishlist(email: string): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/user/wishlist?email=${encodeURIComponent(email)}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return res.ok;
}

export async function checkWishlistStatus(
  email: string,
  productId?: string,
  productTitle?: string
): Promise<{ is_wishlisted: boolean; item_id?: string | null }> {
  try {
    const params = new URLSearchParams({ email });
    if (productId) params.append("product_id", productId);
    if (productTitle) params.append("product_title", productTitle);

    const res = await fetch(`${API_BASE_URL}/user/wishlist/check?${params.toString()}`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (error) {
    console.error("Failed to check wishlist status:", error);
  }
  return { is_wishlisted: false, item_id: null };
}

// --- USER ORDERS API ---

export interface OrderItem {
  product_id?: string | number;
  title: string;
  price: number | string;
  quantity: number;
  image?: string;
  variant?: string;
}

export interface UserOrder {
  _id?: string;
  id?: string;
  order_id: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  user_email?: string;
  user_phone?: string;
  customer_name?: string;
  shipping_address?: {
    first_name?: string;
    last_name?: string;
    street?: string;
    city?: string;
    state?: string;
    pin_code?: string;
  };
  items: OrderItem[];
  subtotal?: number;
  gst?: number;
  delivery?: number;
  total: number;
  amount?: number;
  status: "Processing" | "Shipped" | "Delivered" | "Cancelled" | "Pending" | string;
  tracking_number?: string;
  courier_partner?: string;
  notes?: string;
  payment_method?: string;
  payment_status?: string;
  created_at?: string;
  createdAt?: string;
  date?: string;
}

// Helper to normalize backend order objects into standard UserOrder format
export function normalizeUserOrder(raw: Record<string, unknown>): UserOrder {
  const orderId =
    (raw.order_id as string) ||
    (raw.orderId as string) ||
    (raw.id as string) ||
    (raw._id as string) ||
    `DLX${Date.now().toString().slice(-4)}`;

  const rawItems = (raw.items || raw.order_items || raw.products || []) as Record<string, unknown>[];
  const items: OrderItem[] = Array.isArray(rawItems)
    ? rawItems.map((it: Record<string, unknown>) => ({
        product_id: (it.product_id || it.productId || it.id || it._id) as string | number | undefined,
        title:
          (it.title as string) ||
          (it.product_title as string) ||
          (it.name as string) ||
          (it.product_name as string) ||
          "Luxury Luminaire",
        price: (it.price || it.unit_price || it.product_price || 0) as number | string,
        quantity: (it.quantity || it.qty || 1) as number,
        image:
          (it.image as string) ||
          (it.image_url as string) ||
          (it.product_main_image as string) ||
          (it.img as string) ||
          "/images/category_chandeliers_1784107850024.png",
        variant: (it.variant || it.selected_variant || it.product_variant || "") as string,
      }))
    : [];

  const rawTotal = raw.total || raw.total_amount || raw.amount || raw.grand_total || 0;
  const numTotal =
    typeof rawTotal === "string"
      ? parseFloat(rawTotal.replace(/[^\d.]/g, ""))
      : Number(rawTotal) || 0;

  const rawDate = (raw.date || raw.order_date || raw.created_at || raw.createdAt) as string | undefined;
  const formattedDate = rawDate
    ? new Date(rawDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

  return {
    _id: String(raw._id || raw.id || orderId),
    id: String(raw.id || raw._id || orderId),
    order_id: String(orderId),
    razorpay_order_id: (raw.razorpay_order_id || raw.razorpayOrderId) as string | undefined,
    razorpay_payment_id: (raw.razorpay_payment_id || raw.razorpayPaymentId) as string | undefined,
    user_email: (raw.user_email || raw.email) as string | undefined,
    user_phone: (raw.user_phone || raw.phone) as string | undefined,
    customer_name:
      (raw.customer_name as string) ||
      (raw.customerName as string) ||
      (raw.shipping_address
        ? `${(raw.shipping_address as Record<string, string>).first_name || ""} ${(raw.shipping_address as Record<string, string>).last_name || ""}`.trim()
        : ""),
    shipping_address: (raw.shipping_address || raw.shippingAddress || raw.address) as UserOrder["shipping_address"],
    items,
    subtotal: (raw.subtotal || raw.sub_total || (numTotal > 0 ? numTotal * 0.82 : 0)) as number,
    gst: (raw.gst || raw.tax || (numTotal > 0 ? numTotal * 0.18 : 0)) as number,
    delivery: (raw.delivery || raw.shipping_fee || 0) as number,
    total: numTotal,
    amount: numTotal,
    status: (raw.status || raw.order_status || "Processing") as string,
    tracking_number: (raw.tracking_number || raw.trackingNumber) as string | undefined,
    courier_partner: (raw.courier_partner || raw.courierPartner) as string | undefined,
    notes: (raw.notes || raw.order_notes) as string | undefined,
    payment_method: (raw.payment_method || raw.paymentMethod || "Online") as string,
    payment_status: (raw.payment_status || raw.paymentStatus || "Paid") as string,
    created_at: (raw.created_at || raw.createdAt || new Date().toISOString()) as string,
    createdAt: (raw.createdAt || raw.created_at || new Date().toISOString()) as string,
    date: formattedDate,
  };
}

export async function fetchUserOrders(email?: string): Promise<UserOrder[]> {
  const localKey = `deluzex_orders_${email ? email.toLowerCase().trim() : "default"}`;
  let localData: UserOrder[] = [];

  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(localKey);
      if (stored) {
        localData = JSON.parse(stored);
      }
    } catch {
      // ignore
    }
  }

  // 1. Primary Attempt: GET /api/v1/orders/my-orders (authenticated user)
  try {
    const res = await fetch(`${API_BASE_URL}/orders/my-orders`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      const rawList = (Array.isArray(data)
        ? data
        : data.data || data.orders || data.items || []) as Record<string, unknown>[];
      if (Array.isArray(rawList) && rawList.length > 0) {
        const normalizedList = rawList.map(normalizeUserOrder);
        if (typeof window !== "undefined") {
          localStorage.setItem(localKey, JSON.stringify(normalizedList));
        }
        return normalizedList;
      }
    }
  } catch (error) {
    console.warn("Error calling GET /orders/my-orders:", error);
  }

  // 2. Fallback Attempt: GET /api/v1/orders?email=...
  if (email && email.trim()) {
    try {
      const query = `?email=${encodeURIComponent(email.trim())}`;
      const res = await fetch(`${API_BASE_URL}/orders${query}`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const rawList = (Array.isArray(data)
          ? data
          : data.data || data.orders || data.items || []) as Record<string, unknown>[];
        if (Array.isArray(rawList) && rawList.length > 0) {
          const normalizedList = rawList.map(normalizeUserOrder);
          if (typeof window !== "undefined") {
            localStorage.setItem(localKey, JSON.stringify(normalizedList));
          }
          return normalizedList;
        }
      }
    } catch (error) {
      console.warn("Error calling GET /orders fallback:", error);
    }
  }

  // 3. Fallback to cached local orders for this email if available
  if (localData.length > 0) {
    return localData.map((d) => normalizeUserOrder(d as unknown as Record<string, unknown>));
  }

  return [];
}

export async function fetchOrderById(orderId: string): Promise<UserOrder | null> {
  const cleanId = orderId.replace("#", "").trim();

  // 1. Primary Attempt: GET /api/v1/orders/{order_id}
  try {
    const res = await fetch(`${API_BASE_URL}/orders/${cleanId}`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      const rawOrder = (data.data || data.order || data) as Record<string, unknown>;
      if (rawOrder) {
        return normalizeUserOrder(rawOrder);
      }
    }
  } catch (error) {
    console.warn(`Error fetching GET /orders/${cleanId}:`, error);
  }

  // 2. Check local storage cache
  if (typeof window !== "undefined") {
    try {
      const allKeys = Object.keys(localStorage).filter((k) => k.startsWith("deluzex_orders"));
      for (const k of allKeys) {
        const list: UserOrder[] = JSON.parse(localStorage.getItem(k) || "[]");
        const found = list.find((o) => (o.order_id || o.id || "").replace("#", "") === cleanId);
        if (found) return normalizeUserOrder(found as unknown as Record<string, unknown>);
      }
    } catch {
      // ignore
    }
  }

  return null;
}

export async function savePlacedOrder(order: UserOrder): Promise<UserOrder> {
  const normalizedOrder: UserOrder = {
    ...order,
    id: order.id || order.order_id,
    created_at: order.created_at || new Date().toISOString(),
    date: order.date || new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }),
    status: order.status || "Processing",
  };

  const userKey = `deluzex_orders_${order.user_email ? order.user_email.toLowerCase().trim() : "default"}`;
  if (typeof window !== "undefined") {
    try {
      // Save to user scoped storage
      const userOrders = await fetchUserOrders(order.user_email);
      const updatedUser = [normalizedOrder, ...userOrders.filter((o) => (o.order_id || o.id) !== normalizedOrder.order_id)];
      localStorage.setItem(userKey, JSON.stringify(updatedUser));

      // Save to global storage
      const globalStr = localStorage.getItem("deluzex_orders_global");
      const globalOrders: UserOrder[] = globalStr ? JSON.parse(globalStr) : [];
      const updatedGlobal = [normalizedOrder, ...globalOrders.filter((o) => (o.order_id || o.id) !== normalizedOrder.order_id)];
      localStorage.setItem("deluzex_orders_global", JSON.stringify(updatedGlobal));
    } catch {
      // ignore
    }
  }

  try {
    const res = await fetch(`${API_BASE_URL}/orders`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(normalizedOrder),
    });
    if (res.ok) {
      const data = await res.json();
      return data.data || data;
    }
  } catch (error) {
    console.warn("Could not save order to remote server, stored locally:", error);
  }

  return normalizedOrder;
}

export async function cancelUserOrder(orderId: string, email?: string): Promise<boolean> {
  const cleanId = orderId.replace("#", "").trim();
  const localKey = `deluzex_orders_${email ? email.toLowerCase().trim() : "default"}`;

  if (typeof window !== "undefined") {
    try {
      const orders = await fetchUserOrders(email);
      const updated = orders.map((o) => {
        if ((o.order_id || o.id || "").replace("#", "") === cleanId) {
          return { ...o, status: "Cancelled" };
        }
        return o;
      });
      localStorage.setItem(localKey, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }

  try {
    const res = await fetch(`${API_BASE_URL}/orders/${cleanId}/cancel`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    return res.ok;
  } catch {
    return true;
  }
}

export interface OrderStats {
  total_orders: number;
  pending: number;
  processing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  total_revenue: number;
}

export async function fetchOrderStats(): Promise<OrderStats> {
  try {
    const res = await fetch(`${API_BASE_URL}/orders/stats`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("Error fetching order stats:", err);
  }
  return {
    total_orders: 0,
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    total_revenue: 0,
  };
}

export async function fetchAdminOrders(params?: {
  status?: string;
  search?: string;
  skip?: number;
  limit?: number;
}): Promise<UserOrder[]> {
  try {
    const q = new URLSearchParams();
    if (params?.status && params.status !== "All") q.append("status", params.status);
    if (params?.search) q.append("search", params.search);
    if (params?.skip !== undefined) q.append("skip", String(params.skip));
    if (params?.limit !== undefined) q.append("limit", String(params.limit));

    const res = await fetch(`${API_BASE_URL}/orders?${q.toString()}`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.orders || [];
      return list.map(normalizeUserOrder);
    }
  } catch (err) {
    console.error("Error fetching admin orders:", err);
  }
  return [];
}

export async function updateAdminOrderStatus(
  orderId: string,
  payload: { status: string; tracking_number?: string; courier_partner?: string; notes?: string }
): Promise<{ success: boolean; order?: UserOrder; error?: string }> {
  try {
    const cleanId = orderId.replace("#", "").trim();
    const res = await fetch(`${API_BASE_URL}/orders/${cleanId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, order: normalizeUserOrder(data) };
    }
    const errData = await res.json().catch(() => ({}));
    return { success: false, error: errData.detail || "Failed to update order status" };
  } catch (err: any) {
    return { success: false, error: err.message || "Network error" };
  }
}

export async function deleteAdminOrder(orderId: string): Promise<{ success: boolean; message?: string }> {
  try {
    const cleanId = orderId.replace("#", "").trim();
    const res = await fetch(`${API_BASE_URL}/orders/${cleanId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error("Failed to delete order:", err);
  }
  return { success: false };
}

export async function subscribeNewsletter(email: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/newsletter/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });

    if (res.ok) {
      return { success: true, message: "Thank you for subscribing to De Luzex updates!" };
    }

    const data = await res.json().catch(() => null);
    if (res.status === 400 && data?.detail?.toLowerCase().includes("already")) {
      return { success: true, message: "You are already subscribed to our newsletter." };
    }

    return {
      success: false,
      message: data?.detail || "Could not subscribe at this moment. Please try again.",
    };
  } catch {
    // If backend is offline or network fails, store locally so user has smooth experience
    if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(localStorage.getItem("deluzex_newsletter_subscribers") || "[]");
        if (!stored.includes(email.trim().toLowerCase())) {
          stored.push(email.trim().toLowerCase());
          localStorage.setItem("deluzex_newsletter_subscribers", JSON.stringify(stored));
        }
      } catch {
        // ignore
      }
    }
    return { success: true, message: "Thank you for subscribing to De Luzex updates!" };
  }
}

export interface NewsletterSubscriberItem {
  id: string;
  _id?: string;
  email: string;
  subscribed_at: string;
  is_notified: boolean;
  notified_at?: string | null;
  source?: string;
}

export interface NewsletterSubscribersResponse {
  total: number;
  pending: number;
  notified: number;
  subscribers: NewsletterSubscriberItem[];
}

export async function fetchNewsletterSubscribers(filters?: {
  skip?: number;
  limit?: number;
  notified?: boolean;
  search?: string;
}): Promise<NewsletterSubscribersResponse> {
  const params = new URLSearchParams();
  if (filters?.skip !== undefined) params.append("skip", filters.skip.toString());
  if (filters?.limit !== undefined) params.append("limit", filters.limit.toString());
  if (filters?.notified !== undefined) params.append("notified", filters.notified.toString());
  if (filters?.search) params.append("search", filters.search);

  const res = await fetch(`${API_BASE_URL}/newsletter/subscribers?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch newsletter subscribers");
  return await res.json();
}

export async function updateSubscriberNotified(
  subscriberId: string,
  isNotified: boolean
): Promise<{ message: string; subscriber: NewsletterSubscriberItem }> {
  const res = await fetch(`${API_BASE_URL}/newsletter/subscribers/${encodeURIComponent(subscriberId)}/notified`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_notified: isNotified }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update notification status");
  }
  return await res.json();
}

export async function deleteNewsletterSubscriber(subscriberId: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/newsletter/subscribers/${encodeURIComponent(subscriberId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to delete subscriber");
  }
  return await res.json();
}

export function getNewsletterCsvExportUrl(): string {
  return `${API_BASE_URL}/newsletter/export-csv`;
}


// ==========================================
// SITE CONTENT (CMS) API
// ==========================================

export interface SiteContent<T = Record<string, any>> {
  _id?: string;
  id?: string;
  key: string;
  data: T;
  updated_at?: string;
}

export async function fetchSiteContent<T = Record<string, any>>(key: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/content/${key}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Failed to fetch content block for ${key}`);
    const doc: SiteContent<T> = await res.json();
    return doc.data || null;
  } catch (error) {
    logger.error("API", `Error fetching content for ${key}:`, error);
    return null;
  }
}

export async function fetchAllSiteContent(): Promise<SiteContent[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/content`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch all site content");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    logger.error("API", "Error fetching all site content:", error);
    return [];
  }
}

export async function updateSiteContent(key: string, data: Record<string, any>): Promise<SiteContent> {
  const res = await fetch(`${API_BASE_URL}/content/${key}`, {
    method: "PUT",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `Failed to update content for ${key}`);
  }
  return res.json();
}

export async function uploadCmsImage(file: File): Promise<string> {
  // First attempt uploading via Next.js Cloudinary API route
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "cms");

    const cloudRes = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    if (cloudRes.ok) {
      const data = await cloudRes.json();
      if (data.success && data.url) {
        return data.url;
      }
    }
  } catch {
    // If local/Cloudinary endpoint unavailable, fallback to backend API
  }

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/content/upload-image`, {
    method: "POST",
    headers: getAuthHeaders(true),
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || "Failed to upload image");
  }

  const result = await res.json();
  return result.url;
}

// ==========================================
// VISITOR TRACKING & ANALYTICS API
// ==========================================

export interface VisitorLogItem {
  id: string;
  visitor_id: string;
  session_id: string;
  path: string;
  referrer?: string;
  ip_address?: string;
  device_type: "Desktop" | "Mobile" | "Tablet" | string;
  browser: string;
  os: string;
  is_member: boolean;
  user_email?: string | null;
  user_name?: string | null;
  user_id?: string | null;
  created_at: string;
}

export interface AnalyticsStats {
  total_page_views: number;
  total_unique_visitors: number;
  total_member_visitors: number;
  total_guest_visitors: number;
  active_now: number;
  devices: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  top_pages: {
    path: string;
    views: number;
  }[];
  daily_trends: {
    date: string;
    total_views: number;
    unique_visitors: number;
    member_views: number;
  }[];
}

export interface MemberActivity {
  email: string;
  name: string;
  total_visits: number;
  last_seen: string;
  last_path: string;
}

export interface RecordVisitPayload {
  visitor_id: string;
  session_id: string;
  path: string;
  referrer?: string;
  user_agent?: string;
  screen_width?: number;
  is_member?: boolean;
  user_email?: string | null;
  user_name?: string | null;
  user_id?: string | null;
}

export async function recordVisit(payload: RecordVisitPayload): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/analytics/visit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      // Keepalive allows the request to outlive the page unload if user is navigating away
      keepalive: true,
    });
  } catch (error) {
    // Non-blocking, tracking failure should not disrupt user experience
    console.debug("Visitor tracking ping skipped or failed:", error);
  }
}

export async function fetchAnalyticsStats(): Promise<AnalyticsStats | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/analytics/stats`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch analytics stats");
    return await res.json();
  } catch (error) {
    logger.error("API", "Error fetching analytics stats:", error);
    return null;
  }
}

export async function fetchVisitorLogs(params?: {
  limit?: number;
  skip?: number;
  filter_type?: "all" | "members" | "guests";
  search?: string;
}): Promise<VisitorLogItem[]> {
  try {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.skip) searchParams.append("skip", params.skip.toString());
    if (params?.filter_type) searchParams.append("filter_type", params.filter_type);
    if (params?.search) searchParams.append("search", params.search);

    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const res = await fetch(`${API_BASE_URL}/analytics/visitors${query}`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch visitor logs");
    return await res.json();
  } catch (error) {
    logger.error("API", "Error fetching visitor logs:", error);
    return [];
  }
}

export async function fetchMemberVisitors(): Promise<MemberActivity[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/analytics/members`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch member visitors");
    return await res.json();
  } catch (error) {
    logger.error("API", "Error fetching member visitors:", error);
    return [];
  }
}


// ==========================================
// AUDIT LOG & TELEMETRY API
// ==========================================

export interface AuditLogItem {
  id: string;
  user_id?: string | null;
  actor_email?: string | null;
  actor_name?: string | null;
  actor_role: "Admin" | "Customer" | "Guest" | "System" | string;
  action: string;
  action_category: "auth" | "catalog" | "orders" | "cms" | "security" | "general" | string;
  target_type?: string | null;
  target_id?: string | null;
  target_name?: string | null;
  description?: string | null;
  details?: string | null;
  changes?: Record<string, any> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  status: "SUCCESS" | "FAILED" | "WARNING" | string;
  created_at: string;
}

export interface AuditStats {
  total_events: number;
  total_logins: number;
  total_modifications: number;
  total_unique_actors: number;
  recent_24h_events: number;
  category_counts: {
    auth: number;
    catalog: number;
    orders: number;
    cms: number;
    [key: string]: number;
  };
}

export async function fetchAuditLogs(params?: {
  category?: string;
  search?: string;
  status?: string;
  limit?: number;
  skip?: number;
}): Promise<AuditLogItem[]> {
  try {
    const searchParams = new URLSearchParams();
    if (params?.category && params.category !== "all") searchParams.append("category", params.category);
    if (params?.search) searchParams.append("search", params.search);
    if (params?.status) searchParams.append("status", params.status);
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.skip) searchParams.append("skip", params.skip.toString());

    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const res = await fetch(`${API_BASE_URL}/audit/logs${query}`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch audit logs");
    return await res.json();
  } catch (error) {
    logger.error("API", "Error fetching audit logs:", error);
    return [];
  }
}

export async function fetchAuditStats(): Promise<AuditStats | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/audit/stats`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch audit stats");
    return await res.json();
  } catch (error) {
    logger.error("API", "Error fetching audit stats:", error);
    return null;
  }
}

export async function fetchAuditLogDetail(logId: string): Promise<AuditLogItem | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/audit/logs/${logId}`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch audit log detail");
    return await res.json();
  } catch (error) {
    logger.error("API", "Error fetching audit log detail:", error);
    return null;
  }
}


export interface ProductReviewItem {
  id: string;
  product_id: string;
  author_name: string;
  author_email?: string;
  rating: number;
  title?: string;
  text: string;
  is_approved?: boolean;
  created_at: string;
  product?: {
    name: string;
    image?: string | null;
  };
}

export interface RatingBreakdownItem {
  count: number;
  pct: number;
}

export interface ProductReviewsResponse {
  average_rating: number;
  total_reviews: number;
  breakdown: Record<string, RatingBreakdownItem>;
  reviews: ProductReviewItem[];
}

export interface ReviewStats {
  total: number;
  approved: number;
  pending: number;
  average_rating: number;
}

export interface ReviewSubmitPayload {
  product_id: string;
  author_name: string;
  author_email?: string;
  rating: number;
  title?: string;
  text: string;
}

export async function fetchProductReviews(productId: string): Promise<ProductReviewsResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/reviews?product_id=${encodeURIComponent(productId)}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch product reviews");
    return await res.json();
  } catch (error) {
    logger.error("API", "Error fetching product reviews:", error);
    return {
      average_rating: 0, total_reviews: 0,
      breakdown: { "5": { count: 0, pct: 0 }, "4": { count: 0, pct: 0 },
        "3": { count: 0, pct: 0 }, "2": { count: 0, pct: 0 }, "1": { count: 0, pct: 0 } },
      reviews: [],
    };
  }
}

export async function submitProductReview(
  payload: ReviewSubmitPayload
): Promise<{ message: string; review: ProductReviewItem; stats: ProductReviewsResponse }> {
  const res = await fetch(`${API_BASE_URL}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to submit review");
  }
  return await res.json();
}

export async function fetchAdminReviews(filters?: {
  status?: string;
  search?: string;
  product_id?: string;
  skip?: number;
  limit?: number;
}): Promise<ProductReviewItem[]> {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== "all") params.append("status", filters.status);
  if (filters?.search) params.append("search", filters.search);
  if (filters?.product_id) params.append("product_id", filters.product_id);
  if (filters?.skip !== undefined) params.append("skip", filters.skip.toString());
  if (filters?.limit !== undefined) params.append("limit", filters.limit.toString());

  const res = await fetch(`${API_BASE_URL}/reviews/all?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch admin reviews");
  return await res.json();
}

export async function fetchReviewStats(): Promise<ReviewStats> {
  const res = await fetch(`${API_BASE_URL}/reviews/stats`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch review statistics");
  return await res.json();
}

export async function updateReviewApproval(
  reviewId: string,
  isApproved: boolean
): Promise<{ message: string; review: ProductReviewItem }> {
  const res = await fetch(`${API_BASE_URL}/reviews/${encodeURIComponent(reviewId)}/approval`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_approved: isApproved }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update review approval");
  }
  return await res.json();
}

export async function deleteReview(reviewId: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/reviews/${encodeURIComponent(reviewId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to delete review");
  }
  return await res.json();
}

// ─────────────────────────────────────────────────────────────
// CART BACKEND SYNC API
// ─────────────────────────────────────────────────────────────
export interface BackendCartItem {
  id: string;
  product_id: string;
  title: string;
  price: number;
  image: string;
  quantity: number;
  stock?: number;
  session_id?: string;
  user_email?: string;
}

export function getCartSessionId(): string {
  if (typeof window === "undefined") return "server_session";
  try {
    let sid = localStorage.getItem("deluzex_cart_session");
    if (!sid) {
      sid = "guest_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now().toString(36);
      localStorage.setItem("deluzex_cart_session", sid);
    }
    return sid;
  } catch {
    return "guest_fallback_session";
  }
}

export async function fetchBackendCart(identifier: string): Promise<BackendCartItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/cart/${encodeURIComponent(identifier)}`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    logger.error("API", "Error fetching backend cart:", error);
    return [];
  }
}

export async function addToBackendCart(payload: {
  session_id: string;
  product_id: string;
  quantity: number;
  user_email?: string;
  title?: string;
  price?: number;
  image?: string;
}): Promise<BackendCartItem | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/cart/add`, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    logger.error("API", "Error adding item to backend cart:", error);
    return null;
  }
}

export async function updateBackendCartItem(
  identifier: string,
  productId: string,
  quantity: number
): Promise<BackendCartItem | null> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/cart/${encodeURIComponent(identifier)}/items/${encodeURIComponent(productId)}`,
      {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    logger.error("API", "Error updating backend cart item:", error);
    return null;
  }
}

export async function removeBackendCartItem(
  identifier: string,
  productId: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/cart/${encodeURIComponent(identifier)}/items/${encodeURIComponent(productId)}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(),
      }
    );
    return res.ok;
  } catch (error) {
    logger.error("API", "Error removing backend cart item:", error);
    return false;
  }
}

export async function clearBackendCart(identifier: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/cart/${encodeURIComponent(identifier)}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    return res.ok;
  } catch (error) {
    logger.error("API", "Error clearing backend cart:", error);
    return false;
  }
}

export async function syncBackendCart(
  sessionId: string,
  userEmail: string
): Promise<BackendCartItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/cart/sync`, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, user_email: userEmail }),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    logger.error("API", "Error syncing backend cart:", error);
    return [];
  }
}

export async function sendWhatsAppOtp(phone: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/whatsapp/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.detail || data.message || "Failed to send WhatsApp verification code.");
    }
    return data;
  } catch (error: any) {
    logger.error("API", "Error sending WhatsApp OTP:", error);
    throw error;
  }
}

export async function verifyWhatsAppOtp(
  phone: string,
  otp: string,
  firstName?: string,
  lastName?: string
): Promise<{ success: boolean; message: string; access_token: string; data: any }> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/whatsapp/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        otp,
        first_name: firstName,
        last_name: lastName,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.detail || data.message || "Invalid verification code.");
    }
    return data;
  } catch (error: any) {
    logger.error("API", "Error verifying WhatsApp OTP:", error);
    throw error;
  }
}

export async function verifyEmailOtp(
  email: string,
  otp: string
): Promise<{ success: boolean; message: string; access_token?: string; data?: any }> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/verify-email-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), otp: otp.trim() }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.detail || data.message || 'Failed to verify email code.');
    }
    return data;
  } catch (error: any) {
    logger.error('API', 'Error verifying email OTP:', error);
    throw error;
  }
}

export async function resendEmailOtp(
  email: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/resend-email-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.detail || data.message || 'Failed to resend verification code.');
    }
    return data;
  } catch (error: any) {
    logger.error('API', 'Error resending email OTP:', error);
    throw error;
  }
}

export async function requestPasswordReset(
  email: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    const contentType = res.headers.get("content-type") || "";
    let data: any = {};
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = { detail: res.status === 404 ? "Account not found with this email." : text };
    }
    if (!res.ok || !data.success) {
      throw new Error(data.detail || data.message || "Failed to send password reset code.");
    }
    return data;
  } catch (error: any) {
    logger.error("API", "Error requesting password reset:", error);
    throw error;
  }
}

export async function resetPasswordWithOtp(
  email: string,
  otp: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        new_password: newPassword,
      }),
    });
    const contentType = res.headers.get("content-type") || "";
    let data: any = {};
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = { detail: text };
    }
    if (!res.ok || !data.success) {
      throw new Error(data.detail || data.message || "Failed to reset password.");
    }
    return data;
  } catch (error: any) {
    logger.error("API", "Error resetting password with OTP:", error);
    throw error;
  }
}

/* ==========================================================================
   COLLABORATION & DESIGN SUBMISSION APIS
   ========================================================================== */

export interface CollaborationSubmission {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  role?: string;
  studio_or_college?: string;
  has_made_before?: string;
  concept_title: string;
  description?: string;
  portfolio_link?: string;
  file_url?: string;
  status: string; // "pending" | "reviewed" | "shortlisted" | "archived"
  source?: string; // "collaborate_page" | "homepage_modal"
  created_at?: string;
}

export async function submitCollaboration(
  data: FormData | Record<string, unknown>
): Promise<{ success: boolean; id: string; message: string; data?: any }> {
  try {
    const isFormData = typeof FormData !== "undefined" && data instanceof FormData;
    const res = await fetch(`${API_BASE_URL}/collaborations`, {
      method: "POST",
      headers: isFormData ? undefined : { "Content-Type": "application/json" },
      body: isFormData ? data : JSON.stringify(data),
    });

    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.success) {
      throw new Error(result.detail || result.message || "Failed to submit design concept.");
    }
    return result;
  } catch (error: any) {
    logger.error("API", "Error submitting collaboration concept:", error);
    throw error;
  }
}

export async function fetchCollaborations(
  queryString: string = ""
): Promise<{ total: number; items: CollaborationSubmission[]; skip: number; limit: number }> {
  try {
    const query = queryString ? (queryString.startsWith("?") ? queryString : `?${queryString}`) : "";
    const res = await fetch(`${API_BASE_URL}/collaborations${query}`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || "Failed to fetch collaborations.");
    }
    return res.json();
  } catch (error: any) {
    logger.error("API", "Error fetching collaborations:", error);
    throw error;
  }
}

export async function updateCollaborationStatus(
  id: string,
  status: string
): Promise<{ success: boolean; status: string; id: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/collaborations/${id}/status`, {
      method: "PATCH",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || "Failed to update submission status.");
    }
    return res.json();
  } catch (error: any) {
    logger.error("API", "Error updating collaboration status:", error);
    throw error;
  }
}

export async function deleteCollaboration(
  id: string
): Promise<{ success: boolean; id: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/collaborations/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || "Failed to delete collaboration.");
    }
    return res.json();
  } catch (error: any) {
    logger.error("API", "Error deleting collaboration:", error);
    throw error;
  }
}

/* ==========================================================================
   DYNAMIC FAQS APIS
   ========================================================================== */

export interface FAQItem {
  _id?: string;
  id?: string | number;
  question: string;
  answer: string;
  category: string; // "collaborate" | "support" | "general"
  sequence: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export async function fetchFaqs(
  category?: string,
  includeInactive: boolean = false
): Promise<FAQItem[]> {
  try {
    const params = new URLSearchParams();
    if (category && category !== "all") params.append("category", category);
    if (includeInactive) params.append("include_inactive", "true");

    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${API_BASE_URL}/faqs${qs}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || "Failed to fetch FAQs.");
    }
    return res.json();
  } catch (error: any) {
    logger.error("API", "Error fetching FAQs:", error);
    return [];
  }
}

export async function createFaq(
  faq: Partial<FAQItem>
): Promise<FAQItem> {
  try {
    const res = await fetch(`${API_BASE_URL}/faqs`, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(faq),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || "Failed to create FAQ.");
    }
    return res.json();
  } catch (error: any) {
    logger.error("API", "Error creating FAQ:", error);
    throw error;
  }
}

export async function updateFaq(
  id: string,
  faq: Partial<FAQItem>
): Promise<FAQItem> {
  try {
    const res = await fetch(`${API_BASE_URL}/faqs/${id}`, {
      method: "PUT",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(faq),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || "Failed to update FAQ.");
    }
    return res.json();
  } catch (error: any) {
    logger.error("API", "Error updating FAQ:", error);
    throw error;
  }
}

export async function deleteFaq(
  id: string
): Promise<{ success: boolean; id: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/faqs/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || "Failed to delete FAQ.");
    }
    return res.json();
  } catch (error: any) {
    logger.error("API", "Error deleting FAQ:", error);
    throw error;
  }
}

export async function seedDefaultFaqs(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/faqs/seed`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    return res.json();
  } catch (error: any) {
    logger.error("API", "Error seeding FAQs:", error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// ADMIN CUSTOMERS & USERS MANAGEMENT API
// ─────────────────────────────────────────────────────────────

export interface AdminCustomerItem {
  id: string;
  _id?: string;
  first_name: string;
  last_name: string;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
  is_admin: boolean;
  is_verified: boolean;
  is_active: boolean;
  created_at?: string;
  orders_count: number;
  total_spent: number;
  last_order_date?: string | null;
}

export interface AdminCustomerStats {
  total_users: number;
  total_customers: number;
  total_admins: number;
  verified_users: number;
  active_users: number;
  total_orders: number;
  total_spend: number;
}

export async function fetchAdminCustomers(filters?: {
  search?: string;
  role?: string;
  skip?: number;
  limit?: number;
}): Promise<AdminCustomerItem[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.append("search", filters.search);
  if (filters?.role && filters.role !== "all") params.append("role", filters.role);
  if (filters?.skip !== undefined) params.append("skip", filters.skip.toString());
  if (filters?.limit !== undefined) params.append("limit", filters.limit.toString());

  const res = await fetch(`${API_BASE_URL}/auth/users?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch customers");
  return await res.json();
}

export async function fetchAdminCustomerStats(): Promise<AdminCustomerStats> {
  const res = await fetch(`${API_BASE_URL}/auth/users/stats`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch customer statistics");
  return await res.json();
}

export async function updateCustomerStatus(
  userId: string,
  isActive: boolean
): Promise<{ message: string; is_active: boolean }> {
  const res = await fetch(`${API_BASE_URL}/auth/users/${encodeURIComponent(userId)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_active: isActive }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update customer status");
  }
  return await res.json();
}

export async function updateCustomerRole(
  userId: string,
  isAdmin: boolean
): Promise<{ message: string; is_admin: boolean }> {
  const res = await fetch(`${API_BASE_URL}/auth/users/${encodeURIComponent(userId)}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_admin: isAdmin }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update customer role");
  }
  return await res.json();
}

export async function fetchCustomerOrders(userId: string): Promise<any[]> {
  const res = await fetch(`${API_BASE_URL}/auth/users/${encodeURIComponent(userId)}/orders`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch customer orders");
  return await res.json();
}

export interface DashboardSummaryResponse {
  revenue: {
    total: number;
    orders_count: number;
    pending_orders: number;
    delivered_orders: number;
    recent_orders: Array<{
      id: string;
      order_number: string;
      customer_name: string;
      total_amount: number;
      status: string;
      created_at: string;
    }>;
  };
  inventory: {
    total_products: number;
    low_stock_count: number;
    out_of_stock_count: number;
    low_stock_items: Array<{
      id: string;
      name: string;
      stock: number;
    }>;
  };
  operations: {
    pending_inquiries: number;
    pending_reviews: number;
    total_customers: number;
    newsletter_subscribers: number;
    total_visits: number;
  };
}

export async function fetchDashboardSummary(): Promise<DashboardSummaryResponse> {
  const res = await fetch(`${API_BASE_URL}/analytics/dashboard-summary`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch dashboard summary");
  return await res.json();
}

// ==========================================
// COUPON & DISCOUNT PROMOTIONS APIS
// ==========================================

export interface AvailableCoupon {
  code: string;
  title: string;
  description?: string;
  discount_type: "percentage" | "flat" | "free_shipping";
  discount_value: number;
  max_discount_cap?: number | null;
  min_order_value: number;
  is_first_order_only: boolean;
  expiry_date?: string | null;
}

export interface CouponValidateResponse {
  valid: boolean;
  code: string;
  reason?: string | null;
  message: string;
  discount_type?: "percentage" | "flat" | "free_shipping" | null;
  discount_value?: number | null;
  discount_amount: number;
  discount_breakdown?: Record<string, any> | null;
  new_subtotal: number;
  gst: number;
  delivery: number;
  grand_total: number;
  required_more?: number | null;
}

export interface AdminCoupon {
  _id: string;
  code: string;
  title: string;
  description?: string;
  discount_type: "percentage" | "flat" | "free_shipping";
  discount_value: number;
  max_discount_cap?: number | null;
  min_order_value: number;
  is_active: boolean;
  is_public: boolean;
  is_first_order_only: boolean;
  start_date?: string | null;
  expiry_date?: string | null;
  max_uses?: number | null;
  times_used: number;
  max_uses_per_user: number;
  created_at: string;
  updated_at?: string | null;
}

export interface CouponCreateInput {
  code: string;
  title: string;
  description?: string;
  discount_type: "percentage" | "flat" | "free_shipping";
  discount_value: number;
  max_discount_cap?: number | null;
  min_order_value: number;
  is_active?: boolean;
  is_public?: boolean;
  is_first_order_only?: boolean;
  start_date?: string | null;
  expiry_date?: string | null;
  max_uses?: number | null;
  max_uses_per_user?: number;
}

export async function fetchAvailableCoupons(): Promise<AvailableCoupon[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/coupons/available`, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    logger.error("API", "Error fetching available coupons:", err);
    return [];
  }
}

export async function validateCoupon(
  code: string,
  subtotal: number,
  email?: string
): Promise<CouponValidateResponse> {
  const res = await fetch(`${API_BASE_URL}/coupons/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, subtotal, email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return {
      valid: false,
      code,
      message: err.detail || "Failed to validate coupon.",
      discount_amount: 0,
      new_subtotal: subtotal,
      gst: subtotal * 0.18,
      delivery: subtotal >= 1999 ? 0 : 99,
      grand_total: subtotal + subtotal * 0.18 + (subtotal >= 1999 ? 0 : 99),
    };
  }
  return await res.json();
}

export async function fetchAdminCoupons(): Promise<AdminCoupon[]> {
  const res = await fetch(`${API_BASE_URL}/admin/coupons`, {
    headers: { ...getAuthHeaders() },
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch admin coupons");
  }
  return await res.json();
}

export async function createAdminCoupon(payload: CouponCreateInput): Promise<AdminCoupon> {
  const res = await fetch(`${API_BASE_URL}/admin/coupons`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to create coupon");
  return data;
}

export async function updateAdminCoupon(
  id: string,
  payload: Partial<CouponCreateInput>
): Promise<AdminCoupon> {
  const res = await fetch(`${API_BASE_URL}/admin/coupons/${id}`, {
    method: "PUT",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to update coupon");
  return data;
}

export async function toggleAdminCoupon(id: string): Promise<AdminCoupon> {
  const res = await fetch(`${API_BASE_URL}/admin/coupons/${id}/toggle`, {
    method: "PATCH",
    headers: { ...getAuthHeaders() },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to toggle coupon");
  return data;
}

export async function deleteAdminCoupon(id: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE_URL}/admin/coupons/${id}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to delete coupon");
  return data;
}

