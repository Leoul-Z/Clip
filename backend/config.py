import base64
import hashlib
import os
from cryptography.fernet import Fernet
from dotenv import load_dotenv

# Load variables from root .env or local .env
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
BOT_TOKEN = os.getenv("BOT_TOKEN")
ADMIN_PORTAL_PASSWORD = os.getenv("ADMIN_PORTAL_PASSWORD", "admin123")
ADMIN_TOKEN_SECRET = os.getenv("ADMIN_TOKEN_SECRET", "clipper_portal_secret_key_882")
PORT = int(os.getenv("PORT", 8080))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

def get_fernet() -> Fernet:
    key = os.getenv("ENCRYPTION_KEY")
    if not key:
        raw = hashlib.sha256((BOT_TOKEN or "fallback_encryption_secret_key").encode()).digest()
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
