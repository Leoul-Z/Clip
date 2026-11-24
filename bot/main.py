import asyncio
import logging
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from bot.config import TOKEN
from bot.database import db
from bot.handlers import register_all_handlers

bot_instance: Bot | None = None

async def start_bot():
    global bot_instance
    await db.connect()
    bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    bot_instance = bot
    dp = Dispatcher()

    register_all_handlers(dp)

    print("🤖 Bot is up and running...")
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        await dp.start_polling(bot)
    finally:
        await bot.session.close()
        await db.close()

if __name__ == "__main__":
    asyncio.run(start_bot())
