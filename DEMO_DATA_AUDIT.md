# Runtime demo-data removal

Removed from the application:

- Shop and category fallback catalogs with invented product/category IDs.
- Homepage new arrivals, hero lamps, testimonials and featured-project fallback records.
- About-page sample projects and default business statistics without saved CMS data.
- Project-detail fallback residence, gallery, location, year and scope.
- Product-page fabricated specifications, related products, reviews and rating counts.
- Frontend review API fallback comments and ratings.
- Backend read-time seeds for blogs, projects, hero products, testimonials, wishlist and reviews.
- Synthetic review-count offsets in backend aggregation.
- Analytics/audit sample-data generators, API helpers and admin buttons.
- WhatsApp development mode that claimed delivery and revealed the OTP.
- Checkout payment simulator, invented gateway-key fallback, synthetic UPI approval,
  server-side simulated card/UPI payment endpoint, and fabricated order/payment IDs.
- Invented signup phone numbers and shared customer-email fallbacks.
- Blog creation's success redirect when saving failed.
- Placeholder business contact details and statistics in built-in CMS defaults.

Existing database records have not been deleted. Earlier versions inserted demo
records on GET requests without a provenance flag. Those records must be reviewed
in admin before deletion; a matching display name alone is insufficient to
distinguish a seeded record from an edited or genuine record. Existing saved CMS
statistics/contact values also remain editable in Website Content.

Retained intentionally: isolated test fixtures, explicitly labeled email-template
preview sample values, form input hints, decorative site assets, editable layout
copy, and provider credentials/configuration. Real Razorpay gateway verification
continues to work with whichever provider account is configured; the app no
longer simulates successful payment.

Verification: production frontend build, backend tests covering empty read-only
catalogs, genuine review aggregation, unavailable seed/payment-simulation routes,
and failure when WhatsApp credentials are missing.
