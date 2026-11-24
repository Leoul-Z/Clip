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

from backend.auth import get_admin_token, get_current_admin, set_active_admin_password, verify_admin_password
from backend.config import ADMIN_PORTAL_PASSWORD, CORS_ORIGINS, PORT
from backend.database import backend_db
from backend.telegram import send_telegram_message

logging.basicConfig(level=logging.INFO)

@asynccontextmanager
async def lifespan(app: FastAPI):
    await backend_db.connect()
    # Initialize / load persisted admin password
    saved_pwd = await backend_db.get_app_setting("admin_password")
    if saved_pwd:
        set_active_admin_password(saved_pwd)
    else:
        await backend_db.set_app_setting("admin_password", ADMIN_PORTAL_PASSWORD)
        set_active_admin_password(ADMIN_PORTAL_PASSWORD)
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

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

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
    status: Optional[str] = None

class ReviewSocialRequest(BaseModel):
    status: str
    message: Optional[str] = None
    notify_user: bool = True

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

class UpdateRatesRequest(BaseModel):
    rates: dict[str, float]

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

@app.post("/api/admin/change-password")
async def admin_change_password(body: ChangePasswordRequest):
    if not verify_admin_password(body.current_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current master password is incorrect",
        )
    new_pwd = body.new_password.strip()
    if len(new_pwd) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 4 characters long",
        )
    await backend_db.set_app_setting("admin_password", new_pwd)
    set_active_admin_password(new_pwd)
    return {
        "success": True,
        "token": get_admin_token(),
        "message": "Master password changed successfully",
    }

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
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Admins cannot edit clipper usernames or bank details. Clippers manage their own credentials via Telegram.",
    )

@app.delete("/api/admin/users/{chat_id}")
async def delete_user(chat_id: int, _: bool = Depends(get_current_admin)):
    success = await backend_db.delete_user(chat_id)
    return {"success": success, "message": "User deleted"}

@app.post("/api/admin/users/{chat_id}/socials")
async def add_social_for_user(chat_id: int, body: CreateSocialRequest, _: bool = Depends(get_current_admin)):
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Clippers must link their own social accounts via the Telegram bot.",
    )

@app.put("/api/admin/socials/{account_id}")
async def update_social(account_id: int, body: UpdateSocialRequest, _: bool = Depends(get_current_admin)):
    # Admin cannot edit account handles or platforms - only password
    success = await backend_db.update_social_account(
        account_id=account_id,
        platform=None,
        handle=None,
        password=body.password,
    )
    return {"success": success, "message": "Social account password updated"}

@app.post("/api/admin/socials/{account_id}/review")
async def review_social(account_id: int, body: ReviewSocialRequest, _: bool = Depends(get_current_admin)):
    st = body.status.strip().lower()
    if st not in ("approved", "rejected", "pending"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be 'approved', 'rejected', or 'pending'",
        )

    res = await backend_db.review_social_account(account_id=account_id, status=st)
    if not res:
        raise HTTPException(status_code=404, detail=f"Social account #{account_id} not found")

    # If notification is enabled, send Telegram DM
    if body.notify_user and res.get("chat_id"):
        plat_name = (res.get("platform") or "Social").title()
        handle_val = res.get("handle") or ""
        custom_note = f"\n📝 <b>Admin Note:</b> <i>{html.escape(body.message.strip())}</i>\n" if body.message and body.message.strip() else ""

        if st == "approved":
            msg_text = (
                f"🎉 <b>Social Account Approved!</b>\n\n"
                f"Your <b>{plat_name}</b> account (<code>{html.escape(handle_val)}</code>) has been approved by the admin.\n"
                f"{custom_note}\n"
                f"🚀 You can now submit your video clips posted from this handle under <b>➕ Submit Link</b>!"
            )
        elif st == "rejected":
            msg_text = (
                f"⚠️ <b>Social Account Not Approved</b>\n\n"
                f"Your <b>{plat_name}</b> account (<code>{html.escape(handle_val)}</code>) was not approved by the admin.\n"
                f"{custom_note}\n"
                f"Please verify your handle/password and link your account again under <b>📱 Link Social Account</b>."
            )
        else:
            msg_text = (
                f"ℹ️ <b>Social Account Status Update</b>\n\n"
                f"Your <b>{plat_name}</b> account (<code>{html.escape(handle_val)}</code>) is marked as: <b>Pending Review</b>.\n"
                f"{custom_note}"
            )
        await send_telegram_message(res["chat_id"], msg_text)

    return {"success": True, "social": res}

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

# --- PLATFORM RATES ---
@app.get("/api/admin/rates")
async def get_platform_rates_endpoint(_: bool = Depends(get_current_admin)):
    rates = await backend_db.get_platform_rates()
    return {"rates": rates}

@app.put("/api/admin/rates")
async def update_platform_rates_endpoint(body: UpdateRatesRequest, _: bool = Depends(get_current_admin)):
    updated = await backend_db.update_platform_rates(body.rates)
    return {"success": True, "rates": updated}

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
