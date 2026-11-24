"""
Entrypoint for Render deployment and local execution.
Runs the Telegram bot and keep-alive web server.
"""
import asyncio
import logging
import os
from aiohttp import web
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from bot.config import TOKEN
from bot.database import db
from bot.handlers import register_all_handlers

logging.basicConfig(level=logging.INFO)

async def handle_ping(request):
    return web.Response(text="Bot is alive!")

async def start_web_server():
    app = web.Application()
    app.router.add_get("/", handle_ping)
    app.router.add_get("/ping", handle_ping)

    runner = web.AppRunner(app)
    await runner.setup()
    port = int(os.environ.get("PORT", 8080))
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    logging.info(f"🌐 Keepalive web server running on port {port}")
    return runner

async def main():
    await db.connect()
    runner = await start_web_server()
    bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()

    register_all_handlers(dp)

    print("🤖 Ethio Clippers Bot is up and running...")
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        await dp.start_polling(bot)
    finally:
        await runner.cleanup()
        await bot.session.close()
        await db.close()

if __name__ == "__main__":
    asyncio.run(main())
