import logging
from datetime import datetime, timezone
import aiohttp
from bot.config import DISCORD_WEBHOOK_URL

async def send_discord_notification(
    title: str,
    fields: list[dict],
    color: int = 0x5865F2,
    url: str | None = None,
):
    if not DISCORD_WEBHOOK_URL:
        return
    embed = {
        "title": title,
        "color": color,
        "fields": fields,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if url:
        embed["url"] = url
    payload = {"embeds": [embed]}
    try:
        async with aiohttp.ClientSession() as session:
            await session.post(DISCORD_WEBHOOK_URL, json=payload, timeout=5)
    except Exception as e:
        logging.warning(f"Could not forward to Discord webhook: {e}")
