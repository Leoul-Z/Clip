# 🚀 Ethio Clippers Deployment Guide

This guide explains how to deploy the entire system (**Telegram Bot + Admin Website + REST API**) to production.

---

## 📋 Required Environment Variables

Configure these variables on your hosting provider or in your server's `.env`:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | Neon PostgreSQL Connection URI | `postgresql://user:pass@ep-xyz.region.neon.tech/neondb?sslmode=require` |
| `TOKEN` | Telegram Bot Token (for the bot) | `7931320492:AAG...` |
| `BOT_TOKEN` | Telegram Bot Token (for backend alerts) | `7931320492:AAG...` |
| `ADMIN_PORTAL_PASSWORD` | Master Admin password for website login | `admin123` (or your chosen secure password) |
| `ADMIN_TOKEN_SECRET` | Secret key for JWT auth sessions | `any_random_32_char_secret_key` |
| `FERNET_KEY` | 32-byte Fernet key for encrypting passwords | `YourExistingFernetKey=` |
| `ADMIN_IDS` | Telegram Admin Chat IDs (comma-separated) | `1115428157` |
| `PORT` | Web server listening port | `8080` (automatically set by Render) |

---

## 🌟 Method 1: Deploy on Render (Recommended)

Render allows you to host the entire system on a **single Web Service** (Free Tier compatible).

### Option A: All-in-One Service (Bot + Website + Backend in 1 Web Service)
1. Go to your [Render Dashboard](https://dashboard.render.com/) and click **New +** → **Web Service**.
2. Connect your GitHub repository (`https://github.com/Leoul-Z/Clip.git`).
3. Set the following settings:
   - **Name**: `clipper-all-in-one`
   - **Environment**: `Python 3`
   - **Region**: Choose the closest region to your Neon DB (e.g. Frankfurt or Ohio)
   - **Branch**: `main`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python run_all.py`
4. In the **Environment Variables** tab, add the environment variables listed in the table above.
5. Click **Create Web Service**.
   - Your Telegram Bot will start polling immediately.
   - Your Admin Dashboard website will be live at `https://your-service-name.onrender.com/`.

---

### Option B: Two Standalone Services (Independent Scaling)
If you prefer to separate the Telegram Bot from the Admin Website:

#### 1. Bot Service (Worker / Web Service)
- **Start Command**: `python code.py`
- **Build Command**: `pip install -r requirements.txt`
- **Env Variables**: `DATABASE_URL`, `TOKEN`, `FERNET_KEY`, `ADMIN_IDS`

#### 2. Admin Website Service (Web Service)
- **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
- **Build Command**: `pip install -r backend/requirements.txt`
- **Env Variables**: `DATABASE_URL`, `BOT_TOKEN`, `ADMIN_PORTAL_PASSWORD`, `ADMIN_TOKEN_SECRET`, `FERNET_KEY`

---

## 🖥️ Method 2: Deploy Directly on Linux OS (Ubuntu / Debian VPS with systemd)

If you are deploying directly onto a Linux VPS (Ubuntu / Debian on AWS EC2, DigitalOcean, Hetzner, etc.):

1. **Install Python 3 and PostgreSQL client libraries**:
   ```bash
   sudo apt update
   sudo apt install -y python3 python3-pip python3-venv git
   ```

2. **Clone and setup virtual environment**:
   ```bash
   git clone https://github.com/Leoul-Z/Clip.git /opt/clipper
   cd /opt/clipper
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Create systemd background service**:
   ```bash
   sudo nano /etc/systemd/system/clipper.service
   ```
   Paste the following:
   ```ini
   [Unit]
   Description=Ethio Clippers Bot and Admin Portal
   After=network.target

   [Service]
   Type=simple
   User=root
   WorkingDirectory=/opt/clipper
   EnvironmentFile=/opt/clipper/.env
   ExecStart=/opt/clipper/venv/bin/python run_all.py
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```

4. **Enable and start the service**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable clipper
   sudo systemctl start clipper
   ```

5. **Check service status**:
   ```bash
   sudo systemctl status clipper
   ```

---

## 🔍 Health Checks & Verification
- Health endpoint: `http://<your-domain-or-ip>:8080/health` → returns `{"status": "ok"}`
- Web Admin Portal: `http://<your-domain-or-ip>:8080/`
- Swagger API Docs: `http://<your-domain-or-ip>:8080/docs`
