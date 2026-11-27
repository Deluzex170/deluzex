/**
 * Validation utilities for Deluzex Luxury Lighting
 */

// RFC 5322 compatible email format regex
// Requires valid username + @ + valid domain + valid TLD (min 2 characters, e.g. .com, .in, .co.uk)
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Checks if an email string is well-formed.
 */
export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  // Disallow double dots, leading or trailing dots in domain or username
  if (trimmed.includes("..") || trimmed.startsWith(".") || trimmed.endsWith(".")) return false;
  return EMAIL_REGEX.test(trimmed);
}

/**
 * Validates email and returns an error message if invalid, or null if valid.
 */
export function validateEmailFormat(email: string | null | undefined, required = true): string | null {
  if (!email || !email.trim()) {
    return required ? "Email address is required." : null;
  }
  if (!isValidEmail(email)) {
    return "Please enter a valid email address (e.g. name@example.com).";
  }
  return null;
}

/**
 * Sanitizes an email string (trims whitespace, converts to lowercase)
 */
export function sanitizeEmail(email: string | null | undefined): string {
  return (email || "").trim().toLowerCase();
}
