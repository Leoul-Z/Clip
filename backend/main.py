import asyncio
import html
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import FileResponse
from starlette.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.auth import get_admin_token, get_current_admin, verify_admin_password
from backend.config import CORS_ORIGINS, PORT
from backend.database import backend_db
from backend.telegram import send_telegram_message

logging.basicConfig(level=logging.INFO)

@asynccontextmanager
async def lifespan(app: FastAPI):
    await backend_db.connect()
    yield
    await backend_db.close()

app = FastAPI(
    title="Clipper Admin API",
    description="Standalone Backend API for Ethio Clippers Admin Portal & Dashboard",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS configuration for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if "*" in CORS_ORIGINS else CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- REQUEST SCHEMAS ---
class LoginRequest(BaseModel):
    password: str

class UpdateUserRequest(BaseModel):
    telegram_username: Optional[str] = None
    payment_details: Optional[str] = None

class CreateSocialRequest(BaseModel):
    platform: str
    handle: str
    password: str

class UpdateSocialRequest(BaseModel):
    platform: Optional[str] = None
    handle: Optional[str] = None
    password: Optional[str] = None

class UpdateSubmissionRequest(BaseModel):
    views: Optional[int] = None
    payment_amount: Optional[float] = None
    status: Optional[str] = None
    link: Optional[str] = None
    caption: Optional[str] = None
    notify_user: bool = True

class SendMessageRequest(BaseModel):
    chat_id: Optional[int] = None
    message: str

# --- PUBLIC ROUTES ---
@app.get("/health")
@app.get("/ping")
async def health_check():
    return {"status": "ok", "service": "clipper-admin-backend"}

@app.post("/api/admin/login")
async def admin_login(body: LoginRequest):
    if not verify_admin_password(body.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin master password",
        )
    return {"success": True, "token": get_admin_token()}

# --- PROTECTED ADMIN ROUTES ---
@app.get("/api/admin/me")
async def admin_verify(_: bool = Depends(get_current_admin)):
    return {"authenticated": True}

@app.get("/api/admin/stats")
async def get_stats(_: bool = Depends(get_current_admin)):
    return await backend_db.get_stats()

# --- USERS CRUD ---
@app.get("/api/admin/users")
async def list_users(_: bool = Depends(get_current_admin)):
    return await backend_db.get_users()

@app.put("/api/admin/users/{chat_id}")
async def update_user(chat_id: int, body: UpdateUserRequest, _: bool = Depends(get_current_admin)):
    success = await backend_db.update_user(
        chat_id=chat_id,
        telegram_username=body.telegram_username,
        payment_details=body.payment_details,
    )
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "message": "User updated successfully"}

@app.delete("/api/admin/users/{chat_id}")
async def delete_user(chat_id: int, _: bool = Depends(get_current_admin)):
    success = await backend_db.delete_user(chat_id)
    return {"success": success, "message": "User deleted"}

@app.post("/api/admin/users/{chat_id}/socials")
async def add_social_for_user(chat_id: int, body: CreateSocialRequest, _: bool = Depends(get_current_admin)):
    acc_id = await backend_db.add_social_account(
        chat_id=chat_id,
        platform=body.platform,
        handle=body.handle,
        password=body.password,
    )
    if not acc_id:
        raise HTTPException(status_code=404, detail="User not found or account creation failed")
    return {"success": True, "social_account_id": acc_id}

@app.put("/api/admin/socials/{account_id}")
async def update_social(account_id: int, body: UpdateSocialRequest, _: bool = Depends(get_current_admin)):
    success = await backend_db.update_social_account(
        account_id=account_id,
        platform=body.platform,
        handle=body.handle,
        password=body.password,
    )
    return {"success": success, "message": "Social account updated"}

@app.delete("/api/admin/socials/{account_id}")
async def delete_social(account_id: int, _: bool = Depends(get_current_admin)):
    success = await backend_db.delete_social_account(account_id)
    return {"success": success, "message": "Social account deleted"}

# --- SUBMISSIONS CRUD ---
@app.get("/api/admin/submissions")
async def list_submissions(_: bool = Depends(get_current_admin)):
    return await backend_db.get_submissions()

@app.put("/api/admin/submissions/{submission_id}")
async def update_submission(submission_id: int, body: UpdateSubmissionRequest, _: bool = Depends(get_current_admin)):
    res = await backend_db.update_submission(
        submission_id=submission_id,
        views=body.views,
        payment_amount=body.payment_amount,
        status=body.status,
        link=body.link,
        caption=body.caption,
    )
    if not res:
        raise HTTPException(status_code=404, detail=f"Submission #{submission_id} not found")

    # If notification is enabled, send Telegram alert directly
    if body.notify_user and res.get("chat_id"):
        caption_part = f"📝 <b>Caption:</b> <i>{html.escape(res['caption'])}</i>\n" if res.get("caption") else ""
        views_val = res.get("views", 0)
        pay_val = float(res.get("payment_amount", 0.0))
        status_title = str(res.get("status", "approved")).replace("_", " ").title()

        msg_text = (
            f"📢 <b>Submission #{submission_id} Updated by Admin!</b>\n\n"
            f"📌 <b>Status:</b> <b>{status_title}</b>\n"
            f"🔗 <b>Link:</b> {html.escape(res.get('link', ''))}\n"
            f"{caption_part}"
            f"👁 <b>Views:</b> {views_val:,}\n"
            f"💰 <b>Payment:</b> <b>{pay_val:,.2f} ETB</b>\n\n"
            f"Check your updated earnings under <b>📊 Stats</b>."
        )
        await send_telegram_message(res["chat_id"], msg_text)

    return {"success": True, "submission": res}

@app.delete("/api/admin/submissions/{submission_id}")
async def delete_submission(submission_id: int, _: bool = Depends(get_current_admin)):
    success = await backend_db.delete_submission(submission_id)
    return {"success": success, "message": "Submission deleted"}

# --- TELEGRAM MESSAGING & BROADCAST ---
@app.post("/api/admin/send-message")
async def send_message_endpoint(body: SendMessageRequest, _: bool = Depends(get_current_admin)):
    msg = body.message.strip()
    if not msg:
        raise HTTPException(status_code=400, detail="Message content cannot be empty")

    if body.chat_id is not None:
        ok = await send_telegram_message(body.chat_id, msg)
        if not ok:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to deliver message to Telegram user (Chat ID: {body.chat_id}). Verify bot is started and not blocked."
            )
        return {"success": True, "sent": 1, "failed": 0, "total": 1, "target": "single"}
    else:
        chat_ids = await backend_db.get_all_chat_ids()
        if not chat_ids:
            return {"success": True, "sent": 0, "failed": 0, "total": 0, "target": "all"}

        sent = 0
        failed = 0
        for cid in chat_ids:
            try:
                ok = await send_telegram_message(cid, msg)
                if ok:
                    sent += 1
                else:
                    failed += 1
            except Exception:
                failed += 1
            await asyncio.sleep(0.04)

        return {
            "success": True,
            "sent": sent,
            "failed": failed,
            "total": len(chat_ids),
            "target": "all",
        }

# --- OPTIONAL STATIC SERVING OF REACT DIST ---
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Frontend", "dist")
if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    @app.get("/admin")
    async def serve_spa():
        return FileResponse(os.path.join(frontend_dist, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=PORT, reload=True)
