# Production Dockerfile for Clipper Bot & Admin Dashboard
FROM python:3.12-slim

# Prevent Python from writing .pyc and enable buffer-less stdout
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY bot/ ./bot/
COPY backend/ ./backend/
COPY Frontend/dist/ ./Frontend/dist/
COPY code.py .
COPY run_all.py .

EXPOSE 8080

# Run unified launcher (FastAPI website + Aiogram Telegram Bot)
CMD ["python", "run_all.py"]
