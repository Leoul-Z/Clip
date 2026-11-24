"""
Entrypoint for Render deployment and local execution.
Runs the Telegram bot and the FastAPI Admin Website & Backend concurrently.
"""
import asyncio
from run_all import main

if __name__ == "__main__":
    asyncio.run(main())
