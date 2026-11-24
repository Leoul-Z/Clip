import html
import logging
from aiogram import types
from bot.config import ADMIN_IDS
from bot.database import db
from bot.keyboards import get_main_menu_keyboard
from bot.utils import format_user_data_card

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
    plat = res.get("platform") or "youtube"
    rate = await db.get_platform_rate(plat)
    auto_pay = round((views / 1000.0) * rate, 2)

    # Automatically set payment amount based on platform rate and approve
    await db.update_submission_payment(sub_id, auto_pay, views=views)

    await message.answer(
        f"✅ Views for Submission <code>#{sub_id}</code> updated to <b>{views:,}</b>!\n"
        f"💰 Payment auto-calculated at <b>{rate:,.2f} ETB/1k views</b> ({plat.title()}): <b>{auto_pay:,.2f} ETB</b> (Status: Approved)"
    )

    try:
        await message.bot.send_message(
            user_chat_id,
            f"🎉 <b>Submission Verified & Paid!</b>\n\n"
            f"Your submission (ID: #{sub_id}) on <b>{plat.title()}</b> has been verified!\n"
            f"🔗 <b>Link:</b> {html.escape(sub_link)}\n"
            f"👁 <b>Views:</b> {views:,}\n"
            f"💰 <b>Earned:</b> <b>{auto_pay:,.2f} ETB</b> ({rate:,.2f} ETB/1,000 views)\n\n"
            f"Check your updated balance under <b>📊 Stats</b>.",
            disable_web_page_preview=True,
        )
    except Exception as e:
        logging.warning(f"Could not notify user {user_chat_id} about views update: {e}")

async def rates_command(message: types.Message):
    rates = await db.get_platform_rates()
    yt = rates.get("youtube", 60.0)
    tt = rates.get("tiktok", 60.0)
    tw = rates.get("twitter", 45.0)
    ig = rates.get("instagram", 40.0)

    rates_text = (
        "💰 <b>Official Campaign Payout Rates</b>\n"
        "<i>Earnings are paid in Ethiopian Birr (ETB) per 1,000 verified views:</i>\n\n"
        f"📺 <b>YouTube:</b> <code>{yt:,.2f} ETB</code> / 1,000 views\n"
        f"🎵 <b>TikTok:</b> <code>{tt:,.2f} ETB</code> / 1,000 views\n"
        f"🐦 <b>Twitter / X:</b> <code>{tw:,.2f} ETB</code> / 1,000 views\n"
        f"📸 <b>Instagram:</b> <code>{ig:,.2f} ETB</code> / 1,000 views\n\n"
        "💡 <i>Admins can adjust future price ranges from the Web Admin Portal.</i>"
    )
    await message.answer(rates_text)
