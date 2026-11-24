import html
from contextlib import suppress
from aiogram import types
from aiogram.exceptions import TelegramBadRequest
from aiogram.fsm.context import FSMContext
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from bot.database import db
from bot.keyboards import get_back_keyboard, get_main_menu_keyboard, get_platforms_keyboard
from bot.states import BotStates
from bot.utils import mask_username

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
                total_views = user["views"]
                total_money = user["money"]
                username_str = html.escape(username or "User")

                platform_stats = await db.get_user_platform_stats(chat_id)

                platform_icons = {
                    "tiktok": "🎵",
                    "youtube": "▶️",
                    "instagram": "📸",
                    "twitter": "𝕏",
                }

                lines = [
                    f"📊 <b>Your Stats</b> (<i>{username_str}</i>)\n",
                    f"👁 Total Views: <b>{total_views:,}</b>",
                    f"💰 Total Earnings: <b>{total_money:,.2f} ETB</b>\n",
                    "━━━━━━━━━━━━━━━━━━",
                    "📱 <b>Stats by Platform:</b>",
                ]

                if platform_stats:
                    for ps in platform_stats:
                        p_raw = (ps.get("platform") or "").lower()
                        icon = platform_icons.get(p_raw, "🌐")
                        p_name = p_raw.capitalize() if p_raw != "twitter" else "Twitter / X"
                        p_views = ps.get("views", 0)
                        p_money = float(ps.get("money", 0.0))
                        lines.append(
                            f"{icon} <b>{p_name}:</b>\n"
                            f"   👁 Views: <b>{p_views:,}</b> | 💰 <b>{p_money:,.2f} ETB</b>"
                        )
                else:
                    lines.append("• <i>No linked platform activity yet. Link your socials to track stats!</i>")

                await callback.message.edit_text(
                    "\n".join(lines),
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
                        f"   👁 <b>Views:</b> {views:,} | 💰 <b>Payment:</b> {payment:,.2f} ETB\n"
                        f"   📌 <b>Status:</b> {html.escape(status)}"
                    )
                lines.append(f"\n💵 <b>Total Approved Earnings:</b> <b>{total_payout:,.2f} ETB</b>")
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
                    raw_uname = clipper.get("telegram_username")
                    masked = mask_username(raw_uname)
                    views = clipper["views"]
                    money = clipper["money"]
                    lines.append(
                        f"{medal} <b>{html.escape(masked)}</b>\n"
                        f"   👁 Views: <b>{views:,}</b> | 💰 Earnings: <b>{money:,.2f} ETB</b>\n"
                    )
                lines.append("🔥 <i>Keep clipping and posting to climb the ranks!</i>")
                text = "\n".join(lines)

            await callback.message.edit_text(
                text,
                reply_markup=get_back_keyboard(),
            )
        elif data == "menu_rates":
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
                "💡 <b>How it works:</b>\n"
                "• Link your accounts under <b>📱 Link Social Account</b>\n"
                "• Post clips and submit video links under <b>🔗 Submission Links</b>\n"
                "• Payout is automatically calculated based on verified views!"
            )
            await callback.message.edit_text(
                rates_text,
                reply_markup=get_back_keyboard(),
            )
        elif data == "sub_new":
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
