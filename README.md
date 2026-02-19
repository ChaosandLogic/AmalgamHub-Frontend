# Timesheet Tracker — Frontend

Next.js frontend for the Timesheet Tracker app. This directory can be used as its own Git repository (e.g. `timesheet-tracker-frontend`).

## Setup

1. Create a `.env.local` (or `.env`) with the backend API URL:

   ```bash
   API_URL=http://localhost:3002
   ```

   Omit for local dev if the backend runs on the default port; the app defaults to `http://localhost:3002`.

2. Install and run:

   ```bash
   npm install
   npm run dev
   ```

   App runs at `http://localhost:3003` by default.

## Backend

This app proxies `/api/*` and `/uploads/*` to the backend. Run the backend (see `../backend/README.md` or the backend repo) and set `API_URL` to its base URL when they are on different hosts or ports.

## Scripts

- `npm run dev` — development with Turbopack
- `npm run build` — production build
- `npm start` — run production server

## Docker

Build and run the frontend in a container (uses Next.js standalone output):

```bash
docker build -t timesheet-frontend .
docker run -p 3003:3003 -e API_URL=http://host.docker.internal:3002 timesheet-frontend
```

Set `API_URL` to your backend base URL (e.g. `http://backend:3002` when the backend runs in another container on the same Docker network).
