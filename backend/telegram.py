import logging
import httpx
from backend.config import BOT_TOKEN

async def send_telegram_message(chat_id: int, text: str, parse_mode: str = "HTML") -> bool:
    if not BOT_TOKEN:
        logging.warning("BOT_TOKEN is not configured; skipping Telegram notification.")
        return False
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                return True
            logging.warning(f"Telegram API error {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        logging.warning(f"Failed to send Telegram notification to {chat_id}: {e}")
        return False
