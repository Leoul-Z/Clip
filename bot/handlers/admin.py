import html
import logging
from aiogram import types
from aiogram.fsm.context import FSMContext
from bot.config import ADMIN_IDS
from bot.database import db
from bot.keyboards import get_back_keyboard, get_main_menu_keyboard
from bot.states import BotStates
from bot.utils import format_user_data_card

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
        f"💰 Money: <b>{new_money:,.2f} ETB</b>"
    )

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
        f"✅ Payment for Submission <code>#{sub_id}</code> updated to <b>{amount:,.2f} ETB</b>!"
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
            f"💰 <b>Payment:</b> <b>{amount:,.2f} ETB</b>\n\n"
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
