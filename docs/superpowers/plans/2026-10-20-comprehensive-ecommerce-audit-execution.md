# Comprehensive E-Commerce Website Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all missing fullstack e-commerce modules identified in the website audit, eliminating every business gap between Customer Storefront, Admin Panel, Backend APIs, and MongoDB Atlas.

**Architecture:** Monorepo with Next.js 16 (App Router, React 19, Redux Toolkit, CSS Modules) frontend and FastAPI (pymongo, ImageKit, Razorpay, SMTP) backend.

**Tech Stack:** Next.js 16, React 19, Redux, FastAPI, MongoDB Atlas, Pydantic, TypeScript, Python 3.11.

---

## Phase 1: Super Critical E-Commerce Core (P0)

### Task 1: Admin Orders Management (`/admin/orders`)
- [ ] **Step 1.1: Verify & enhance Backend Orders Endpoints**
  - File: `backend/app/api/endpoints/orders.py`
  - Ensure `GET /orders` supports admin querying with search (order_id, email, phone, status), pagination, and sorting.
  - Ensure `PATCH /orders/{order_id}/status` supports `courier_partner` alongside `tracking_number` and `notes`.
  - Add `DELETE /orders/{order_id}` for admin cleanup if needed with audit logging.
- [ ] **Step 1.2: Add Admin Order API Service Functions**
  - File: `app/services/api.ts`
  - Export `fetchAdminOrders(params)` and `updateAdminOrderStatus(orderId, payload)`.
- [ ] **Step 1.3: Build Admin Orders UI Page & Components**
  - Files: `app/admin/orders/page.tsx`, `app/admin/orders/orders.module.css`
  - Features: Summary stat cards (Total, Paid, Shipped, Delivered, Cancelled), filter tabs, search input, responsive order table.
  - Order Detail Drawer: Customer details, shipping address, ordered items with image and pricing breakdown (subtotal, GST, total), status changer dropdown, tracking number and courier inputs.
- [ ] **Step 1.4: Update Admin Sidebar Navigation**
  - File: `app/admin/layout.tsx`
  - Add "Orders" with shopping bag SVG icon right below "Overview".
- [ ] **Step 1.5: Test Scenarios (Positive, Negative & Edge Cases)**
  - Positive: Fetch orders, filter by status, change status to "shipped" with courier details, verify reflected in customer `/dashboard/orders`.
  - Negative: Attempt updating non-existent order ID, invalid status transition, unauthorized non-admin access.
- [ ] **Step 1.6: Commit Task 1**
  - Git commit: `feat: implement admin orders management system with status and tracking controls`

---

### Task 2: Stock Decrement, Out-of-Stock Protection & Admin Stock Input
- [ ] **Step 2.1: Implement Atomic Stock Decrement on Order Success**
  - File: `backend/app/api/endpoints/payments.py`
  - In `verify_payment` and `create_cod_order`, atomically decrement `stock_count` for each item.
  - If `stock_count` reaches 0 or below, set `in_stock = False` and `stock_status = "OUT OF STOCK"`.
- [ ] **Step 2.2: Add Stock Count Input in Admin Product Create & Edit**
  - Files: `app/admin/products/create/page.tsx`, `app/admin/products/edit/[id]/page.tsx`
  - Add integer input field for `stock_count` with real-time stock status badge.
- [ ] **Step 2.3: Enforce Out-of-Stock & Max Quantity Guards in Storefront**
  - Files: `app/components/AddToCartButton.tsx`, `app/product/[slug]/page.tsx`, `app/checkout/page.tsx`
  - Disable Add to Cart button when `in_stock === false` or `stock_count <= 0`.
  - Show "Out of Stock" badge; prevent quantity increase beyond available stock.
- [ ] **Step 2.4: Test Scenarios (Positive, Negative & Edge Cases)**
  - Positive: Complete order -> stock decrements in MongoDB. Decrement to 0 -> product shows "OUT OF STOCK".
  - Negative: Attempt to buy product with 0 stock -> checkout or add-to-cart blocks action with warning.
- [ ] **Step 2.5: Commit Task 2**
  - Git commit: `feat: implement inventory stock decrementing and out-of-stock protections`

---

### Task 3: Automated Order Confirmation Email
- [ ] **Step 3.1: Build Responsive Luxury Order Confirmation Email Template**
  - File: `backend/app/services/email.py`
  - Implement `send_order_confirmation_email(order_dict)`.
  - Luxury gold/dark styling, order ID, items list, address, pricing summary, tracking info.
- [ ] **Step 3.2: Hook Email Dispatch into Payment & COD Endpoints**
  - File: `backend/app/api/endpoints/payments.py`
  - Call `send_order_confirmation_email` via background task or safe try-except upon order creation.
- [ ] **Step 3.3: Test Scenarios**
  - Positive: Trigger order -> confirm email function constructs valid HTML and sends via SMTP.
  - Negative: SMTP failure does not crash or rollback the order; error is logged in server logs.
- [ ] **Step 3.4: Commit Task 3**
  - Git commit: `feat: add automated order confirmation email system for online and COD orders`

---

## Phase 2: Customer Leads & Admin Operations (P1)

### Task 4: Projects Page Consultation Form Integration
- [ ] **Step 4.1: Connect Projects Form to Real Backend Contact API**
  - File: `app/projects/page.tsx`
  - Replace dummy `setTimeout` with `submitContactForm` sending scope `[Project Scope: Custom Consultation]`.
- [ ] **Step 4.2: Test Scenarios**
  - Positive: Submit form -> verify saved in MongoDB `contacts` collection and displayed in Admin Inquiries.
  - Negative: Missing required fields or invalid email shows proper error toast.
- [ ] **Step 4.3: Commit Task 4**
  - Git commit: `feat: connect projects consultation form to backend inquiries system`

---

### Task 5: Admin Inquiries Management Enhancement
- [ ] **Step 5.1: Backend Status & Actions for Inquiries**
  - File: `backend/app/api/endpoints/contact.py`
  - Add `status` field ("new", "contacted", "resolved", "archived") and `PATCH /contact/{id}/status`, `DELETE /contact/{id}`.
- [ ] **Step 5.2: Admin Inquiries UI Upgrade**
  - Files: `app/admin/inquiries/page.jsx` (convert to TypeScript `page.tsx` if desired)
  - Add filter tabs, status badges, view full message modal, change status, delete inquiry.
- [ ] **Step 5.3: Test Scenarios**
  - Positive: Update inquiry status to "resolved", delete inquiry, filter by status.
- [ ] **Step 5.4: Commit Task 5**
  - Git commit: `feat: upgrade admin inquiries management with status workflow and delete controls`

---

### Task 6: Product Reviews Moderation (`/admin/reviews`)
- [ ] **Step 6.1: Backend Review Moderation Endpoints**
  - File: `backend/app/api/endpoints/reviews.py`
  - Add `is_approved` boolean to review schema.
  - Add `GET /reviews/all` for admin, `PATCH /reviews/{id}/approval`, and `DELETE /reviews/{id}`.
- [ ] **Step 6.2: Admin Reviews Management Page**
  - Files: `app/admin/reviews/page.tsx`, `app/admin/reviews/reviews.module.css`
  - Approve/Reject toggles, star ratings, review content, delete button. Add to Admin Sidebar.
- [ ] **Step 6.3: Test Scenarios**
  - Positive: New review submitted -> admin can approve or reject -> approved reviews appear on product page.
- [ ] **Step 6.4: Commit Task 6**
  - Git commit: `feat: implement product review moderation and admin reviews management`

---

### Task 7: Newsletter Subscribers Admin Page (`/admin/newsletter`)
- [ ] **Step 7.1: Build Admin Newsletter Page**
  - Files: `app/admin/newsletter/page.tsx`, `app/admin/newsletter/newsletter.module.css`
  - Connect to `GET /api/v1/newsletter/subscribers` and `GET /api/v1/newsletter/export-csv`.
  - Search, pagination, 1-click "Download CSV", delete subscriber. Add to Admin Sidebar.
- [ ] **Step 7.2: Test Scenarios**
  - Positive: View subscriber list, export CSV file, delete subscriber.
- [ ] **Step 7.3: Commit Task 7**
  - Git commit: `feat: implement admin newsletter subscribers view with CSV export`

---

## Phase 3: Advanced E-Commerce Enhancements (P2)

### Task 8: Admin Customers Management (`/admin/customers`)
- [ ] **Step 8.1: Backend User Listing Endpoint**
  - File: `backend/app/api/endpoints/auth.py`
  - Add `GET /auth/users` for admins with customer stats (order count, total spend, registration date).
- [ ] **Step 8.2: Admin Customers UI Page**
  - Files: `app/admin/customers/page.tsx`, `app/admin/customers/customers.module.css`
  - Customer directory with search, filter, and detail view. Add to Admin Sidebar.
- [ ] **Step 8.3: Commit Task 8**
  - Git commit: `feat: add admin customers directory with customer order metrics`

---

### Task 9: Dynamic Admin Overview Dashboard
- [ ] **Step 9.1: Admin Dashboard Analytics Aggregator**
  - File: `backend/app/api/endpoints/analytics.py`
  - Add `GET /analytics/dashboard-summary` returning Total Revenue, Total Orders, Pending Orders, Inquiries Count, Products Count.
- [ ] **Step 9.2: Redesign Admin Home Overview**
  - File: `app/admin/page.tsx`
  - Replace static placeholder with dynamic KPI cards, recent orders table, quick actions.
- [ ] **Step 9.3: Commit Task 9**
  - Git commit: `feat: redesign admin overview dashboard with live e-commerce KPIs and metrics`

---

### Task 10: Tax Invoice Generation & Customer Order Enhancements
- [ ] **Step 10.1: Invoice Printable / Download Component**
  - Files: `app/components/OrderInvoiceModal.tsx`, `app/dashboard/orders/page.tsx`, `app/admin/orders/page.tsx`
  - Clean luxury tax invoice with GST breakdown, company details, line items, print/PDF button.
- [ ] **Step 10.2: Commit Task 10**
  - Git commit: `feat: add printable tax invoice generation for customers and admin`
