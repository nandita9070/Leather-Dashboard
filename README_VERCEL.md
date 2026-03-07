# Vercel Deployment Guide

Your LeatherOps dashboard is now structured to be compatible with Vercel.

## 1. Database Warning
This application currently uses **SQLite** (`better-sqlite3`), which is a file-based database. 
**Vercel's filesystem is read-only and ephemeral.** This means:
- Any data you add while the app is running on Vercel will be **lost** when the serverless function restarts.
- The database file is currently set to `/tmp/leather_ops.db` in production to allow temporary writes.

**Recommendation:** For a real production deployment, you should switch to a managed database like:
- **Vercel Postgres**
- **Supabase** (PostgreSQL)
- **MongoDB Atlas**

## 2. Deployment Steps
1. Push your code to GitHub.
2. Connect your GitHub repository to Vercel.
3. Vercel will automatically detect the `vercel.json` and build the application.
4. The API will be available at `/api/*` and the frontend will be served at the root.

## 3. Environment Variables
If you switch to a remote database, make sure to add your connection string (e.g., `DATABASE_URL`) to the Vercel project settings.
