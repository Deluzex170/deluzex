# Deluzex Fullstack Monorepo Architecture & Deployment Guide

This document provides a comprehensive operational guide for the **Deluzex** fullstack monorepo, detailing the architecture, local development workflow, API routing, and dual-project deployment on Vercel (Test and Production).

---

## 1. Architectural Overview

Deluzex operates as a unified **Fullstack Monorepo** combining:
- **Frontend**: Next.js 16 (App Router, React 19, TypeScript, TailwindCSS v4)
- **Backend**: FastAPI (Python 3.11+, ASGI, PyMongo, Pydantic v2)
- **Database**: MongoDB Atlas (`Deluzex`)
- **Payment Gateway**: Razorpay (Dual Sandbox / Live configuration)
- **Media CDN**: Cloudinary & ImageKit

### Elimination of External API Server Dependency
Previously, the backend was deployed separately at `api.deluzexlighting.com`. In this monorepo architecture:
- All frontend API calls use **relative routing (`/api/v1`)**.
- No external API server or separate subdomain is required.
- In **Local Development**, Next.js seamlessly proxies `/api/v1/*` requests to the local FastAPI process (`http://127.0.0.1:8000`).
- In **Vercel Deployments**, Vercel Services builds Next.js and FastAPI separately and routes `/api/v1/*` to the backend service.

---

## 2. Directory Structure

```text
deluzex/
├── app/                        # Next.js App Router (Frontend)
│   ├── about/                  # About page
│   ├── admin/                  # Admin dashboard & management
│   ├── checkout/               # Checkout & Razorpay payment integration
│   ├── shop/                   # Product catalog & filters
│   └── services/               # Frontend API client (api.ts)
├── backend/                    # FastAPI Backend Service
│   ├── app/
│   │   ├── api/endpoints/      # API Route Handlers (auth, products, orders, payments)
│   │   ├── core/               # Database connection, config, logging
│   │   └── services/           # Razorpay, ImageKit, Email handlers
│   ├── main.py                 # FastAPI application entrypoint (app = FastAPI())
│   ├── pyproject.toml          # Python project definitions
│   └── requirements.txt        # Backend Python dependencies
├── components/                 # Reusable React components
├── public/                     # Static media & assets
├── next.config.ts              # Next.js configuration & dev rewrites
├── vercel.json                 # Vercel deployment & production rewrites
├── package.json                # Root package configuration & unified scripts
├── requirements.txt            # Root Python dependencies for Vercel build
└── .vscode/settings.json       # Python interpreter & monorepo IDE paths
```

---

## 3. Local Development

### Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **Python**: `3.11.x`

### Initial Setup
Run the unified installer from the project root:
```bash
npm run install:all
```
*This command runs `npm install` for Node.js dependencies and `pip install -r backend/requirements.txt` for Python dependencies.*

### Running Frontend and Backend Simultaneously
To launch both the Next.js frontend and the FastAPI backend concurrently with synchronized colored output:
```bash
npm run dev
```

- **Frontend**: Accessible at `http://localhost:3000`
- **Backend API**: Accessible at `http://localhost:8000`
- **Interactive API Docs (Swagger UI)**: `http://localhost:8000/api/v1/docs`

### Available NPM Scripts

| Command | Action |
|---|---|
| `npm run dev` | Runs both Next.js (`:3000`) and FastAPI (`:8000`) concurrently |
| `npm run dev:frontend` | Starts only the Next.js development server |
| `npm run dev:backend` | Starts only the FastAPI development server with auto-reload |
| `npm run build` | Builds the production Next.js bundle |
| `npm run start` | Starts the production Next.js server |
| `npm run lint` | Runs ESLint analysis across the frontend |
| `npm run install:backend` | Installs/updates Python requirements |
| `npm run install:all` | Installs both Node.js and Python dependencies |

---

## 4. API Routing & Deployment

The browser uses `NEXT_PUBLIC_API_URL=/api/v1` (also the default).
`npm run dev` starts both processes; `next.config.ts` proxies `/api/v1/*`
to `http://127.0.0.1:8000` only in local development.

Production uses [Vercel Services](https://vercel.com/docs/services), currently
in beta on all plans. The root `vercel.json` declares:

- `frontend`: Next.js in the repository root, built with `npm run build`.
- `backend`: FastAPI in `backend/`, with entrypoint `main:app` and its own Python dependencies.
- `/api/v1/:path*` goes to the backend service with the original path preserved.
- All remaining requests go to Next.js, including `/api/upload`.

The old rewrite to `/api/index.py` did not ensure that a Python function
was built. That file is now only a compatibility entrypoint; import failures
propagate to runtime logs rather than creating a route-less fallback app.

### Test deployment checklist

1. Deploy from the repository root with the committed `vercel.json`.
2. Keep `NEXT_PUBLIC_API_URL=/api/v1`. Configure `MONGODB_URI`,
   `MONGODB_DATABASE`, and the required provider credentials in the test project.
3. In build output, confirm that **both** services were built. A Next.js-only
   build is insufficient. If the configuration is rejected, check Services
   availability and the deployment tooling version; do not remove the backend declaration.
4. Check `GET /api/v1/health-check`: expect HTTP 200 JSON with `status: ok`.
   This checks application loading, **not** database connectivity.
5. Check `GET /api/v1/openapi.json`: expect HTTP 200 JSON containing cart,
   analytics, and auth routes.
6. Check `GET /api/v1/cart/<test-session>` against the deployed database, then
   verify login with a designated test account. Local smoke tests use a mocked
   database and do not prove that deployed credentials or MongoDB access work.

A response with `Content-Type: text/html` and `X-Matched-Path: /404` means
API traffic is still reaching Next.js. Check the domain's active deployment,
service build output, and public routing before debugging login credentials.

Run isolated backend checks with:

```bash
python -m unittest discover -s backend/tests -v
```

---

## 5. Dual Vercel Project Deployment Strategy

The repository supports two independent Vercel projects deploying from the same GitHub repository (`Deluzex170/deluzex`):

```text
                             ┌──> [Test Branch] ──> deluzex-ukyi (Staging / QA)
[GitHub Repository] ─────────┤
                             └──> [main Branch] ──> deluzex (Production Live)
```

### 1. Test Project (`deluzex-ukyi`)
- **Git Branch**: `Test`
- **Domain**: `https://deluzex-ukyi.vercel.app`
- **Purpose**: Internal testing, previewing features, verifying Razorpay sandbox transactions before going live.
- **Vercel Git Settings**: Set **Production Branch** to `Test` under *Settings > Git*.

### 2. Production Project (`deluzex`)
- **Git Branch**: `main`
- **Domain**: `https://www.deluzexlighting.com`
- **Purpose**: Live customer-facing e-commerce storefront.
- **Vercel Git Settings**: Production branch is `main`.

---

## 6. Environment Variables Reference

Configure these environment variables in your Vercel Project Settings (*Project > Settings > Environment Variables*):

| Variable | Environment | Recommended Vercel Type | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | All | **Config** (Plaintext) | Set to `/api/v1` (or leave unset to use default) |
| `MONGODB_URI` | All | **Sensitive** (Secret) | MongoDB Atlas connection string |
| `MONGODB_DATABASE` | All | **Config** (Plaintext) | Database name (e.g., `Deluzex`) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Test | **Config** (Plaintext) | Razorpay Test Key (`rzp_test_...`) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Production | **Config** (Plaintext) | Razorpay Live Key (`rzp_live_...`) |
| `RAZORPAY_KEY_SECRET` | Test | **Sensitive** (Secret) | Razorpay Test Secret |
| `RAZORPAY_KEY_SECRET` | Production | **Sensitive** (Secret) | Razorpay Live Secret |
| `CLOUDINARY_CLOUD_NAME` | All | **Config** (Plaintext) | Cloudinary cloud identifier |
| `CLOUDINARY_API_KEY` | All | **Config** (Plaintext) | Cloudinary API Key |
| `CLOUDINARY_API_SECRET` | All | **Sensitive** (Secret) | Cloudinary API Secret |

> **IMPORTANT**:
> In Vercel, any variable starting with `NEXT_PUBLIC_` must be created as **Config** (not Secret/Sensitive). Marking a `NEXT_PUBLIC_` variable as Sensitive causes Vercel to block the save with:
> *"Remove the public framework prefix to keep this value private."*

---

## 7. Git & Release Workflow

### Step 1: Develop Locally on the Test Branch
```bash
git checkout Test
npm run dev
# Make changes, test at http://localhost:3000
```

### Step 2: Push to Test Staging
```bash
git add .
git commit -m "feat: implement new lighting collection"
git push origin Test
```
*Vercel automatically builds and deploys to `deluzex-ukyi`.*

### Step 3: Promote to Production
Once validated on the test environment, merge into `main`:
```bash
git checkout main
git merge Test
git push origin main
```
*Vercel automatically builds and deploys to `www.deluzexlighting.com`.*

---

## 8. Common Troubleshooting

### Q1: Vercel shows "A variable with the name already exists"
**Solution**: You attempted to click "Add Environment Variable" for a key that is already listed. Scroll down to the existing variables list, locate the variable, click the three dots `...`, and select **Edit** or **Delete**.

### Q2: Build displays 404 for `/content/about` or `/categories`
**Cause**: An outdated `NEXT_PUBLIC_API_URL` pointing to the decommissioned `api.deluzexlighting.com` was configured in Vercel.
**Solution**: Edit `NEXT_PUBLIC_API_URL` in Vercel to `/api/v1` or delete it entirely so the codebase uses the built-in relative fallback.

### Q3: IDE reports "Cannot find module pymongo"
**Cause**: The IDE's Python extension is analyzing an interpreter that does not have the backend packages installed.
**Solution**: The project includes [settings.json](file:///.vscode/settings.json) configured to prioritize the Python environment and `./backend` search path. Ensure dependencies are installed via `npm run install:backend`.
