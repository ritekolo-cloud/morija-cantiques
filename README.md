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

## Render Deployment

This repo is intended to run as one Render web service named `morija-cantiques`. The Express backend serves both `/api/*` and the compiled React app from `frontend/dist`, so the public app URL should be:

```text
https://morija-cantiques-ax20.onrender.com
```

The recommended setup is to create or sync the service from `render.yaml`. The Blueprint creates a Render Postgres database, maps `DATABASE_URL` from that database, generates `JWT_SECRET` and `JWT_REFRESH_SECRET`, builds the backend/frontend, runs Prisma migrations, imports the hymn data, and then starts the Express server.

If the service was created manually in the Render dashboard, `render.yaml` will not automatically supply those settings. In that case, add these environment variables in the Render service before redeploying:

```text
NODE_ENV=production
DATABASE_URL=<your Render Postgres or Neon PostgreSQL connection string>
JWT_SECRET=<a long random secret>
JWT_REFRESH_SECRET=<another long random secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_URL=https://morija-cantiques-ax20.onrender.com
CORS_ORIGIN=https://morija-cantiques-ax20.onrender.com
```

For a manually configured Render web service, use these commands:

```bash
npm install --include=dev && npm run build
npx prisma migrate deploy --schema=backend/prisma/schema.prisma && node backend/scripts/import-hymns.mjs
npm start
```

In the Render dashboard, those correspond to Build Command, Pre-Deploy Command, and Start Command.

Do not use the separate `morija-cantiques-frontend` static site for the main app unless it is configured with its own API backend URL. The current frontend calls `/api` on the same domain, so the unified `morija-cantiques` web service is the simplest free-plan deployment.

If using another Node-capable platform, use:

```bash
npm ci
npm run build
npm run db:migrate
npm run hymns:import
npm start
```
