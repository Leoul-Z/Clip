# Standalone Clipper Admin Backend

FastAPI backend providing REST APIs for the Clipper Admin Dashboard.
Can be deployed as an independent Web Service (e.g., on Render, Railway, Fly.io, or VPS).

## Features
- **FastAPI with asyncpg**: High performance, non-blocking asynchronous PostgreSQL queries.
- **Auto-generated Documentation**: Swagger UI at `/docs` and ReDoc at `/redoc`.
- **CORS Enabled**: Works out of the box with Vite/React, Next.js, or any frontend origin.
- **Standalone Telegram Notifications**: Dispatches Telegram bot DM alerts via HTTP without requiring a running bot polling process.
- **Full CRUD for Admin**:
  - Edit user usernames and bank details
  - View, edit, add, or delete linked social accounts & unencrypted passwords
  - Edit submission views, payment amount, status, link, caption
  - Delete submissions or users

## Environment Variables
Set the following in your deployment environment (or in a `.env` file):

```env
DATABASE_URL=postgresql://user:password@ep-xyz.region.aws.neon.tech/neondb?sslmode=require
BOT_TOKEN=your_telegram_bot_token
ADMIN_PORTAL_PASSWORD=admin123
ADMIN_TOKEN_SECRET=any_random_secret_token
PORT=8080
CORS_ORIGINS=*
```

## Running Locally
```bash
# From project root:
uvicorn backend.main:app --host 0.0.0.0 --port 8080 --reload
```

## Deploying on Render (Standalone Web Service)
1. In Render dashboard, click **New +** → **Web Service**.
2. Connect your GitHub repository.
3. Configure the service:
   - **Name**: `clipper-admin-api`
   - **Root Directory**: leave blank (or `backend`)
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
4. Add the Environment Variables:
   - `DATABASE_URL`
   - `BOT_TOKEN`
   - `ADMIN_PORTAL_PASSWORD`
   - `ADMIN_TOKEN_SECRET`
