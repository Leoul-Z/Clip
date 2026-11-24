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
    fsm_data = await state.get_data()
    mode = fsm_data.get("payment_mode", "add")

    if mode == "replace":
        await db.update_payment_info(chat_id, text)
        updated_details = [text]
    else:
        combined = await db.add_payment_detail(chat_id, text)
        updated_details = [l.strip() for l in combined.split("\n") if l.strip()]

    user = await db.get_user(chat_id)
    telegram_username = user["telegram_username"] if user else f"id_{chat_id}"

    action_label = "Replaced all payment details" if mode == "replace" else "Added new payment method"

    # Notify admin(s) with user bank info
    admin_notification = (
        f"💳 <b>Payment Details Updated!</b>\n\n"
        f"<b>username:</b> {html.escape(telegram_username)}\n"
        f"<b>chat_id:</b> <code>{chat_id}</code>\n"
        f"<b>Action:</b> {action_label}\n\n"
        f"<b>Active Payment Details ({len(updated_details)}):</b>\n"
        + "\n".join([f"• <code>{html.escape(d)}</code>" for d in updated_details])
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
            {"name": "⚙️ Action", "value": action_label, "inline": True},
            {"name": "🏦 Payment Details", "value": "\n".join(updated_details), "inline": False},
        ],
        color=0xF1C40F,
    )

    await state.clear()
    await state.set_state(BotStates.main_menu)

    formatted_list = "\n".join([f"{i}. <code>{html.escape(d)}</code>" for i, d in enumerate(updated_details, 1)])
    await message.answer(
        f"✅ <b>Payment Details Saved!</b>\n\n"
        f"<b>Your Saved Payment Methods ({len(updated_details)}):</b>\n"
        f"{formatted_list}\n\n"
        "💡 <i>You can add more payment accounts or manage them anytime under 💳 Payment.</i>",
        reply_markup=get_main_menu_keyboard(),
    )
