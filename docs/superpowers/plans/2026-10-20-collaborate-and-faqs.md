# Fullstack Collaboration Submissions & Dynamic FAQs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the static "Submit Your Lighting Concept" forms (Homepage modal + `/collaborate` page) and the "Frequently asked questions" accordion into fully dynamic full-stack features with FastAPI backend routes, MongoDB persistence, file upload handling, and Admin Panel management.

**Architecture:** 
- Backend: FastAPI route handlers in `backend/app/api/endpoints/collaborations.py` and `faqs.py`, backed by Pydantic v2 models in `backend/app/models/` and MongoDB Atlas collections (`collaborations`, `faqs`). File attachments are uploaded via ImageKit/local storage service.
- Frontend Storefront: Next.js components in `app/components/CollaborateSection.tsx` and `app/collaborate/page.tsx` wired up to `app/services/api.ts` API functions with responsive feedback, form validations, and graceful fallback handling.
- Admin Panel: Next.js admin dashboards in `app/admin/collaborations/page.tsx` and `app/admin/faqs/page.tsx` with sidebar navigation integration in `app/admin/layout.tsx`.

**Tech Stack:** Next.js 16 (React 19, TypeScript), FastAPI (Python 3.11+, PyMongo, Pydantic v2), MongoDB, ImageKit CDN.

---

## Global Constraints

- Backend routing is served under `/api/v1` prefix.
- Use relative API URLs (`/api/v1/...`) via `app/services/api.ts` which handles telemetry logging and session expiry.
- Preserve existing Deluzex dark/gold luxury aesthetic in Admin Panel and storefront.
- Storefront components must have fallback to default static content if the backend is temporarily unreachable.
- File upload must handle image formats (JPG, PNG), CAD/3D files (DWG, OBJ, STEP) or PDF documents up to 25MB.

---

### Task 1: Backend Models & API Endpoints for Collaboration Submissions

**Files:**
- Create: `backend/app/models/collaboration.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/app/api/endpoints/collaborations.py`
- Modify: `backend/app/api/__init__.py`

**Interfaces:**
- Produces: `POST /api/v1/collaborations` (public form submission with optional file upload)
- Produces: `GET /api/v1/collaborations` (admin list with filters: `status`, `role`, pagination `skip`, `limit`)
- Produces: `GET /api/v1/collaborations/{id}` (admin view single submission)
- Produces: `PATCH /api/v1/collaborations/{id}/status` (admin update status)
- Produces: `DELETE /api/v1/collaborations/{id}` (admin delete submission)

- [ ] **Step 1: Create Collaboration Pydantic Model**
Create `backend/app/models/collaboration.py` with fields: `name`, `email`, `phone`, `city`, `role`, `studio_or_college`, `has_made_before`, `concept_title`, `description`, `portfolio_link`, `file_url`, `status`, `source`, `created_at`.

- [ ] **Step 2: Register Collaboration model in `backend/app/models/__init__.py`**
Import `CollaborationSubmission` into `backend/app/models/__init__.py`.

- [ ] **Step 3: Create Collaboration API endpoints in `backend/app/api/endpoints/collaborations.py`**
Implement FastAPI router with endpoints for creating submission (handling JSON or multipart form data with `upload_image_to_imagekit`), querying list with filters, updating status, and deleting submission.

- [ ] **Step 4: Register collaborations router in `backend/app/api/__init__.py`**
Mount router under `prefix="/collaborations"`.

---

### Task 2: Backend Models & API Endpoints for Dynamic FAQs

**Files:**
- Create: `backend/app/models/faq.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/app/api/endpoints/faqs.py`
- Modify: `backend/app/api/__init__.py`

**Interfaces:**
- Produces: `GET /api/v1/faqs` (public list filtered by optional `category`, automatic seed of defaults if collection empty)
- Produces: `POST /api/v1/faqs` (admin create FAQ)
- Produces: `PUT /api/v1/faqs/{id}` (admin update FAQ)
- Produces: `DELETE /api/v1/faqs/{id}` (admin delete FAQ)
- Produces: `PATCH /api/v1/faqs/reorder` (admin reorder sequence)

- [ ] **Step 1: Create FAQ Pydantic Model**
Create `backend/app/models/faq.py` with fields: `question`, `answer`, `category` (default "collaborate"), `sequence`, `is_active`, `created_at`, `updated_at`.

- [ ] **Step 2: Register FAQ model in `backend/app/models/__init__.py`**
Import `FAQItem` into `backend/app/models/__init__.py`.

- [ ] **Step 3: Create FAQ API endpoints in `backend/app/api/endpoints/faqs.py`**
Implement router with `GET /faqs` (including seed of default 6 Collaborate FAQs and 3 Support FAQs if collection is empty), `POST /faqs`, `PUT /faqs/{id}`, `DELETE /faqs/{id}`, and `PATCH /faqs/reorder`.

- [ ] **Step 4: Register faqs router in `backend/app/api/__init__.py`**
Mount router under `prefix="/faqs"`.

---

### Task 3: Frontend API Client Methods in `app/services/api.ts`

**Files:**
- Modify: `app/services/api.ts`

**Interfaces:**
- Produces: `submitCollaboration(data: FormData | Record<string, unknown>): Promise<{ success: boolean; data: any }>`
- Produces: `fetchCollaborations(params?: string): Promise<any[]>`
- Produces: `updateCollaborationStatus(id: string, status: string): Promise<any>`
- Produces: `deleteCollaboration(id: string): Promise<{ success: boolean }>`
- Produces: `fetchFaqs(category?: string): Promise<FAQItem[]>`
- Produces: `createFaq(faq: Partial<FAQItem>): Promise<FAQItem>`
- Produces: `updateFaq(id: string, faq: Partial<FAQItem>): Promise<FAQItem>`
- Produces: `deleteFaq(id: string): Promise<{ success: boolean }>`

- [ ] **Step 1: Add TypeScript interfaces**
Define `CollaborationSubmission` and `FAQItem` interfaces in `app/services/api.ts`.

- [ ] **Step 2: Implement Collaboration API methods**
Add `submitCollaboration`, `fetchCollaborations`, `updateCollaborationStatus`, and `deleteCollaboration` in `app/services/api.ts`.

- [ ] **Step 3: Implement FAQ API methods**
Add `fetchFaqs`, `createFaq`, `updateFaq`, and `deleteFaq` in `app/services/api.ts`.

---

### Task 4: Connect Storefront Forms to Backend API

**Files:**
- Modify: `app/components/CollaborateSection.tsx` (Homepage modal)
- Modify: `app/collaborate/page.tsx` (`/collaborate` page form and FAQ accordion)

**Interfaces:**
- Consumes: `submitCollaboration` and `fetchFaqs` from `app/services/api.ts`

- [ ] **Step 1: Connect Homepage Modal form in `CollaborateSection.tsx`**
Update `handleSubmit` to call `submitCollaboration`, manage `isSubmitting` loading state, display validation/error toast if failed, and show modal success state on successful DB persistence.

- [ ] **Step 2: Connect Collaborate Page submission form in `collaborate/page.tsx`**
Update `handleSubmit` to build `FormData` (including attached `selectedFile`, city, role, bio, and portfolio link), call `submitCollaboration`, manage loading indicator, and reset form on success.

- [ ] **Step 3: Connect Collaborate Page FAQs to Dynamic API in `collaborate/page.tsx`**
Add `useEffect` to fetch FAQs via `fetchFaqs("collaborate")`, with fallback to the local `FAQ_DATA` array so the page renders reliably under any network state.

---

### Task 5: Admin Panel Design Submissions Dashboard

**Files:**
- Create: `app/admin/collaborations/page.tsx`
- Modify: `app/admin/layout.tsx` (add sidebar menu item)

**Interfaces:**
- Consumes: `fetchCollaborations`, `updateCollaborationStatus`, `deleteCollaboration` from `app/services/api.ts`

- [ ] **Step 1: Build `/admin/collaborations` Page**
Create dashboard view with:
  - Metric cards: Total Submissions, Pending Review, Shortlisted, Archived.
  - Search bar by designer name, email, or concept title.
  - Status filter tabs (All, Pending, Reviewed, Shortlisted, Archived).
  - Data table displaying Date, Designer Name, Role, Concept Title, Source, Status, and Action buttons.
  - Detail Modal drawer displaying full submission content (Bio, Firm, Prior manufacturing experience, Direct link to view/download attached sketches/drawings).
  - Status selector dropdown to transition submission states.

- [ ] **Step 2: Add Design Submissions to Admin Sidebar Menu**
Update `menuItems` in `app/admin/layout.tsx` to include `{ name: "Design Submissions", path: "/admin/collaborations", icon: "..." }`.

---

### Task 6: Admin Panel FAQ Management Dashboard

**Files:**
- Create: `app/admin/faqs/page.tsx`
- Modify: `app/admin/layout.tsx` (add sidebar menu item)

**Interfaces:**
- Consumes: `fetchFaqs`, `createFaq`, `updateFaq`, `deleteFaq` from `app/services/api.ts`

- [ ] **Step 1: Build `/admin/faqs` Page**
Create FAQ manager view with:
  - Category selector tabs (All, Collaborate, Support, General).
  - "Add FAQ" modal with Question, Answer, Category, Sequence, and Active toggle.
  - Interactive table/accordion list with Edit, Toggle Active, and Delete capabilities.
  - Quick Seed button to reset default FAQs if needed.

- [ ] **Step 2: Add FAQs to Admin Sidebar Menu**
Update `menuItems` in `app/admin/layout.tsx` to include `{ name: "FAQs", path: "/admin/faqs", icon: "..." }`.

---

### Task 7: End-to-End Verification & Sanity Testing

**Files:**
- Test API routes and storefront form submissions.
- Test Admin panel moderation workflows.

- [ ] **Step 1: Test Public Submission via Home Modal**
Fill and submit concept from homepage modal. Verify document is saved in MongoDB `collaborations` collection.

- [ ] **Step 2: Test Public Submission via `/collaborate` Page with File Upload**
Fill form with test image/document on `/collaborate` page and submit. Verify file upload URL is saved in MongoDB.

- [ ] **Step 3: Test Dynamic FAQ Fetching**
Verify FAQs render dynamically on `/collaborate` page from API.

- [ ] **Step 4: Test Admin Panel Workflow**
Open `/admin/collaborations`, view submission details, download file, update status to "Shortlisted". Open `/admin/faqs`, add a new question, verify it appears in storefront.
