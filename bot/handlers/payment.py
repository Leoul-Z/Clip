import html
import logging
from aiogram import types
from aiogram.fsm.context import FSMContext
from bot.config import ADMIN_IDS
from bot.database import db
from bot.keyboards import get_back_keyboard, get_main_menu_keyboard
from bot.services.discord import send_discord_notification
from bot.states import BotStates

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
