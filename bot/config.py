import base64
import hashlib
import logging
import os
from cryptography.fernet import Fernet
from dotenv import load_dotenv

# Load variables from .env
load_dotenv()

# --- BOT CONFIGURATION ---
TOKEN = os.getenv("BOT_TOKEN")
DATABASE_URL = os.getenv("DATABASE_URL")
ADMIN_IDS = [
    int(x.strip()) for x in os.getenv("ADMIN_IDS", "").split(",") if x.strip().isdigit()
]
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "").strip()
ADMIN_PORTAL_PASSWORD = os.getenv("ADMIN_PORTAL_PASSWORD", "admin123")
ADMIN_TOKEN_SECRET = os.getenv("ADMIN_TOKEN_SECRET", "clipper_portal_secret_key_882")

logging.basicConfig(level=logging.INFO)

# --- ENCRYPTION HELPERS ---
def get_fernet() -> Fernet:
    key = os.getenv("ENCRYPTION_KEY")
    if not key:
        raw = hashlib.sha256((TOKEN or "fallback_encryption_secret_key").encode()).digest()
        key = base64.urlsafe_b64encode(raw).decode()
    return Fernet(key.encode())

def encrypt_password(plain: str) -> str:
    if not plain:
        return ""
    return get_fernet().encrypt(plain.encode()).decode()

def decrypt_password(cipher: str | None) -> str:
    if not cipher:
        return ""
    try:
        return get_fernet().decrypt(cipher.encode()).decode()
    except Exception:
        return cipher
