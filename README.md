# Deluzex — Luxury Architectural Lighting

Fullstack e-commerce monorepo powering the [Deluzex Lighting](https://www.deluzexlighting.com) brand, featuring custom lighting fixtures, bespoke design consultations, and automated commerce workflows.

---

## Architecture Stack

- **Frontend**: Next.js 16 (App Router, React 19, TypeScript, TailwindCSS v4)
- **Backend**: FastAPI (Python 3.11+, PyMongo, Pydantic v2)
- **Database**: MongoDB Atlas (`Deluzex`)
- **Payments**: Razorpay (Dual Sandbox / Live Support)
- **CDN & Storage**: Cloudinary & ImageKit
- **Deployment**: Vercel (Dual projects: Staging & Production)

---

## Quick Start (Local Development)

### 1. Install All Dependencies (Node + Python)
```bash
npm run install:all
```

### 2. Start Both Frontend & Backend Concurrently
```bash
npm run dev
```

- **Frontend Application**: [http://localhost:3000](http://localhost:3000)
- **Backend API Server**: [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger Docs**: [http://localhost:8000/api/v1/docs](http://localhost:8000/api/v1/docs)

---

## Monorepo NPM Scripts

| Command | Description |
|---|---|
| `npm run dev` | Runs Next.js (`:3000`) and FastAPI (`:8000`) concurrently |
| `npm run dev:frontend` | Starts only the Next.js frontend |
| `npm run dev:backend` | Starts only the FastAPI Python backend |
| `npm run build` | Compiles the Next.js production build |
| `npm run start` | Boots the Next.js production server |
| `npm run lint` | Runs ESLint checks |
| `npm run install:backend` | Installs Python packages from `backend/requirements.txt` |
| `npm run install:all` | Installs both Node.js and Python dependencies |

---

## Comprehensive Documentatio

For complete operational details, Vercel multi-environment deployment configurations, API proxy rewrites, and environment variable references, consult the [Monorepo Guide](MONOREPO_GUIDE.md).
