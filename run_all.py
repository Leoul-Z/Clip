"""
Unified launcher for Ethio Clippers.
Runs FastAPI (serving the Admin Website + REST API) on $PORT
and simultaneously runs the Aiogram Telegram bot polling.
"""
import asyncio
import logging
import os
import uvicorn
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from bot.config import TOKEN
from bot.database import db as bot_db
from bot.handlers import register_all_handlers
from backend.main import app as fastapi_app

logging.basicConfig(level=logging.INFO)

async def run_bot():
    await bot_db.connect()
    bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()
    register_all_handlers(dp)
    logging.info("🤖 Bot polling started...")
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        await dp.start_polling(bot)
    finally:
        await bot.session.close()
        await bot_db.close()

async def run_web():
    port = int(os.environ.get("PORT", 8080))
    config = uvicorn.Config(fastapi_app, host="0.0.0.0", port=port, log_level="info")
    server = uvicorn.Server(config)
    logging.info(f"🌐 Admin Website & Backend running on port {port}")
    await server.serve()

async def main():
    # Run both web server and bot concurrently
    await asyncio.gather(
        run_web(),
        run_bot(),
    )

if __name__ == "__main__":
    asyncio.run(main())
