import { getAuthHeaders } from "./api";

export type EmailEvent = "verification" | "password_reset";
export interface EmailTemplateInput {
  name: string;
  subject: string;
  text_body: string;
  html_body: string;
  event: EmailEvent | null;
}
export interface EmailTemplate extends EmailTemplateInput { id: string }
export interface TemplateCatalog {
  items: EmailTemplate[];
  defaults: EmailTemplateInput[];
  variables: string[];
}
export interface TemplatePreview { subject: string; text_body: string; html_body: string }
const base = `${process.env.NEXT_PUBLIC_API_URL || "/api/v1"}/email-templates`;

async function request<T>(path: string, method = "GET", body?: EmailTemplateInput): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method, headers: getAuthHeaders(), cache: "no-store",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data.detail === "string" ? data.detail : Array.isArray(data.detail)
      ? data.detail.map((error: { msg: string }) => error.msg).join(". ") : "Unable to update email templates.";
    throw new Error(message);
  }
  return data as T;
}

export const loadEmailTemplates = () => request<TemplateCatalog>("");
export const saveEmailTemplate = (input: EmailTemplateInput, id?: string) =>
  request<EmailTemplate>(id ? `/${id}` : "", id ? "PUT" : "POST", input);
export const deleteEmailTemplate = (id: string) => request<void>(`/${id}`, "DELETE");
export const previewEmailTemplate = (input: EmailTemplateInput) => request<TemplatePreview>("/preview", "POST", input);
