# Leather Dashboard

A dashboard for monitoring day-to-day tasks appointed to staff, built for leather garments manufacturing and export businesses.

## Features

- Task management with types: Sample Dispatch, General Task, Discussion Point
- Merchant and buyer management
- Calendar view for due dates
- Status tracking (Pending / Completed)

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Framer Motion
- **Backend:** Express.js, SQLite (better-sqlite3)
- **Build:** Vite 6

## Local Development

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000)

## Deployment

This app is configured for Vercel. See [README_VERCEL.md](README_VERCEL.md) for deployment steps and the SQLite persistence caveat.
