# Morija Cantiques

Morija Cantiques is a React + Express hymn application backed by Neon PostgreSQL. The consolidated deployable project lives in this repository.

## Project Structure

- `frontend/` - React, React Query, React Router, Tailwind, and PWA configuration.
- `backend/` - Express API, Prisma schema/migrations, import scripts, and the canonical hymn dataset.
- `backend/data/cantiques-hymns.json` - 13 collections and 6,209 hymns.

## Local Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`.
2. Install dependencies:

```bash
npm ci
```

3. Prepare the database and hymn data:

```bash
npm run setup
```

4. Start development servers:

```bash
npm run dev
```

Frontend runs on `http://localhost:5173`; backend runs on `http://localhost:5000`.

## Verification

```bash
npm run hymns:validate
npm run build
```

The API health endpoint is available at `/api/health` and reports database connectivity plus collection/hymn counts.

## GitHub Deployment

This repo includes `render.yaml` for a single Render web service. The service builds the backend and frontend, applies Prisma migrations, validates/imports the hymn dataset, and serves the React app from Express.

Set `DATABASE_URL` in the hosting platform to the Neon pooled PostgreSQL URL. If the Render service name changes, update `CORS_ORIGIN` in `render.yaml` to the deployed service URL.

If using another Node-capable platform, use:

```bash
npm ci
npm run build
npm run db:migrate
npm run hymns:import
npm start
```
