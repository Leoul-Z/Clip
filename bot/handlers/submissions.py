import html
import logging
from aiogram import types
from aiogram.fsm.context import FSMContext
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from bot.config import ADMIN_IDS
from bot.database import db
from bot.keyboards import get_back_keyboard, get_main_menu_keyboard
from bot.services.discord import send_discord_notification
from bot.states import BotStates

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
        acc_status = (matching_account.get("status") or "approved").lower()
        if acc_status == "pending":
            await message.answer(
                f"⏳ <b>Account Under Review</b>\n\n"
                f"Your <b>{matching_account['platform'].title()}</b> account (<code>{matching_account['handle']}</code>) is currently pending admin review.\n\n"
                f"You will receive a notification here as soon as an admin approves your handle. Once approved, you can immediately submit your clips!",
                reply_markup=get_back_keyboard(),
            )
            return
        elif acc_status == "rejected":
            await message.answer(
                f"❌ <b>Account Not Approved</b>\n\n"
                f"Your <b>{matching_account['platform'].title()}</b> account (<code>{matching_account['handle']}</code>) was not approved by the admin.\n\n"
                f"Please update or re-link your account under <b>📱 Link Social Account</b> before submitting clips.",
                reply_markup=get_back_keyboard(),
            )
            return

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
    buttons = []
    for s in user_socials:
        status_tag = ""
        st = (s.get("status") or "approved").lower()
        if st == "pending":
            status_tag = " (⏳ Pending)"
        elif st == "rejected":
            status_tag = " (❌ Rejected)"
        buttons.append([InlineKeyboardButton(
            text=f"{s['platform'].title()}: {s['handle']}{status_tag}",
            callback_data=f"subacc_{s['id']}"
        )])
    buttons.append([InlineKeyboardButton(text="🔙 Back to Menu", callback_data="back_to_menu")])
    await message.answer(
        "Which of your linked accounts is this video clip posted on?",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons)
    )

async def submission_account_selected(callback: types.CallbackQuery, state: FSMContext):
    sa_id = int(callback.data.split("_")[1])
    chat_id = callback.message.chat.id
    user_socials = await db.get_user_social_accounts_full(chat_id)
    selected_acc = next((s for s in user_socials if s["id"] == sa_id), None)
    if selected_acc:
        acc_status = (selected_acc.get("status") or "approved").lower()
        if acc_status == "pending":
            await callback.answer("⏳ This account is currently pending admin review.", show_alert=True)
            return
        elif acc_status == "rejected":
            await callback.answer("❌ This account was not approved by admin. Please re-link in menu.", show_alert=True)
            return

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
