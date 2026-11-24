import html
from aiogram import types
from aiogram.fsm.context import FSMContext
from bot.database import db
from bot.keyboards import get_main_menu_keyboard
from bot.states import BotStates

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
