import html
from aiogram import BaseMiddleware, types
from aiogram.types import TelegramObject
from bot.config import ADMIN_IDS
from bot.database import db

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
