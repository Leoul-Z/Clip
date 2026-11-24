import logging
from backend.config import DATABASE_URL, decrypt_password, encrypt_password

class BackendDatabase:
    def __init__(self, dsn: str | None = None):
        self.dsn = dsn
        self.is_postgres = bool(dsn)
        self.pool = None
        self.db_path = "bot_database.db"

    async def connect(self):
        if self.is_postgres:
            import asyncpg
            dsn = self.dsn
            if dsn.startswith("postgres://"):
                dsn = dsn.replace("postgres://", "postgresql://", 1)
            self.pool = await asyncpg.create_pool(dsn, min_size=1, max_size=10)
            logging.info("Backend connected to PostgreSQL database.")
        else:
            logging.info("Backend using SQLite fallback.")

    async def close(self):
        if self.is_postgres and self.pool:
            await self.pool.close()

    # --- STATS ---
    async def get_stats(self) -> dict:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow("""
                    SELECT
                        (SELECT COUNT(*) FROM users) AS total_users,
                        (SELECT COUNT(*) FROM submissions) AS total_submissions,
                        (SELECT COUNT(*) FROM submissions WHERE status = 'pending') AS pending_submissions,
                        (SELECT COUNT(*) FROM submissions WHERE status = 'under_review') AS under_review_submissions,
                        (SELECT COUNT(*) FROM submissions WHERE status = 'approved') AS approved_submissions,
                        (SELECT COUNT(*) FROM submissions WHERE status = 'rejected') AS rejected_submissions,
                        (SELECT COALESCE(SUM(views), 0)::BIGINT FROM submissions WHERE status = 'approved') AS total_views,
                        (SELECT COALESCE(SUM(payment_amount), 0.0)::FLOAT FROM submissions WHERE status = 'approved') AS total_payments,
                        (SELECT COUNT(*) FROM social_accounts) AS total_social_accounts
                """)
                return dict(row) if row else {}
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute("""
                    SELECT
                        (SELECT COUNT(*) FROM users) AS total_users,
                        (SELECT COUNT(*) FROM submissions) AS total_submissions,
                        (SELECT COUNT(*) FROM submissions WHERE status = 'pending') AS pending_submissions,
                        (SELECT COUNT(*) FROM submissions WHERE status = 'under_review') AS under_review_submissions,
                        (SELECT COUNT(*) FROM submissions WHERE status = 'approved') AS approved_submissions,
                        (SELECT COUNT(*) FROM submissions WHERE status = 'rejected') AS rejected_submissions,
                        (SELECT COALESCE(SUM(views), 0) FROM submissions WHERE status = 'approved') AS total_views,
                        (SELECT COALESCE(SUM(payment_amount), 0.0) FROM submissions WHERE status = 'approved') AS total_payments,
                        (SELECT COUNT(*) FROM social_accounts) AS total_social_accounts
                """) as cur:
                    row = await cur.fetchone()
                    if row:
                        return {
                            "total_users": row[0],
                            "total_submissions": row[1],
                            "pending_submissions": row[2],
                            "under_review_submissions": row[3],
                            "approved_submissions": row[4],
                            "rejected_submissions": row[5],
                            "total_views": row[6],
                            "total_payments": row[7],
                            "total_social_accounts": row[8],
                        }
                    return {}

    # --- USERS CRUD ---
    async def get_users(self) -> list[dict]:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                user_rows = await conn.fetch("""
                    SELECT 
                        u.id,
                        u.chat_id,
                        u.telegram_username,
                        u.payment_details,
                        u.created_at,
                        COALESCE(SUM(s.views), 0)::INTEGER AS views,
                        COALESCE(SUM(s.payment_amount), 0.0)::FLOAT AS money,
                        (SELECT COUNT(*) FROM submissions sub WHERE sub.user_id = u.id) AS submission_count
                    FROM users u
                    LEFT JOIN submissions s ON s.user_id = u.id AND s.status = 'approved'
                    GROUP BY u.id, u.chat_id, u.telegram_username, u.payment_details, u.created_at
                    ORDER BY u.id DESC
                """)
                social_rows = await conn.fetch("""
                    SELECT id, user_id, platform, handle, password_encrypted, created_at
                    FROM social_accounts
                    ORDER BY id ASC
                """)
                user_list = [dict(r) for r in user_rows]
                social_list = [dict(r) for r in social_rows]
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute("""
                    SELECT 
                        u.id,
                        u.chat_id,
                        u.telegram_username,
                        u.payment_details,
                        u.created_at,
                        COALESCE(SUM(s.views), 0) AS views,
                        COALESCE(SUM(s.payment_amount), 0.0) AS money,
                        (SELECT COUNT(*) FROM submissions sub WHERE sub.user_id = u.id) AS submission_count
                    FROM users u
                    LEFT JOIN submissions s ON s.user_id = u.id AND s.status = 'approved'
                    GROUP BY u.id, u.chat_id, u.telegram_username, u.payment_details, u.created_at
                    ORDER BY u.id DESC
                """) as cur:
                    u_tuples = await cur.fetchall()
                    user_list = [
                        {
                            "id": r[0], "chat_id": r[1], "telegram_username": r[2],
                            "payment_details": r[3], "created_at": r[4], "views": r[5],
                            "money": r[6], "submission_count": r[7]
                        }
                        for r in u_tuples
                    ]
                async with db.execute("SELECT id, user_id, platform, handle, password_encrypted, created_at FROM social_accounts ORDER BY id ASC") as cur:
                    s_tuples = await cur.fetchall()
                    social_list = [
                        {"id": r[0], "user_id": r[1], "platform": r[2], "handle": r[3], "password_encrypted": r[4], "created_at": r[5]}
                        for r in s_tuples
                    ]

        socials_by_user = {}
        for s in social_list:
            uid = s["user_id"]
            if uid not in socials_by_user:
                socials_by_user[uid] = []
            decrypted_pass = decrypt_password(s.get("password_encrypted"))
            socials_by_user[uid].append({
                "id": s["id"],
                "platform": s["platform"],
                "handle": s["handle"],
                "password": decrypted_pass,
                "password_encrypted": s.get("password_encrypted"),
                "created_at": s.get("created_at"),
            })

        res = []
        for u in user_list:
            u["social_accounts"] = socials_by_user.get(u["id"], [])
            res.append(u)
        return res

    async def update_user(self, chat_id: int, telegram_username: str | None = None, payment_details: str | None = None) -> bool:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                await conn.execute("""
                    UPDATE users
                    SET 
                        telegram_username = COALESCE($1, telegram_username),
                        payment_details = COALESCE($2, payment_details)
                    WHERE chat_id = $3
                """, telegram_username, payment_details, chat_id)
                return True
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                updates = []
                params = []
                if telegram_username is not None:
                    updates.append("telegram_username = ?")
                    params.append(telegram_username)
                if payment_details is not None:
                    updates.append("payment_details = ?")
                    params.append(payment_details)
                if updates:
                    params.append(chat_id)
                    await db.execute(f"UPDATE users SET {', '.join(updates)} WHERE chat_id = ?", params)
                    await db.commit()
                return True

    async def delete_user(self, chat_id: int) -> bool:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                await conn.execute("DELETE FROM users WHERE chat_id = $1", chat_id)
                return True
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute("DELETE FROM users WHERE chat_id = ?", (chat_id,))
                await db.commit()
                return True

    # --- SOCIAL ACCOUNTS CRUD ---
    async def add_social_account(self, chat_id: int, platform: str, handle: str, password: str) -> int | None:
        norm_platform = platform.strip().lower()
        encrypted_pass = encrypt_password(password)

        if self.is_postgres:
            async with self.pool.acquire() as conn:
                user = await conn.fetchrow("SELECT id FROM users WHERE chat_id = $1", chat_id)
                if not user:
                    return None
                user_id = user["id"]
                # Enforce limit of 1 per platform
                await conn.execute("DELETE FROM social_accounts WHERE user_id = $1 AND platform = $2", user_id, norm_platform)
                row = await conn.fetchrow("""
                    INSERT INTO social_accounts (user_id, platform, handle, password_encrypted)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id
                """, user_id, norm_platform, handle, encrypted_pass)
                return row["id"]
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute("SELECT id FROM users WHERE chat_id = ?", (chat_id,)) as cur:
                    user = await cur.fetchone()
                if not user:
                    return None
                user_id = user[0]
                await db.execute("DELETE FROM social_accounts WHERE user_id = ? AND platform = ?", (user_id, norm_platform))
                cur = await db.execute("""
                    INSERT INTO social_accounts (user_id, platform, handle, password_encrypted)
                    VALUES (?, ?, ?, ?)
                """, (user_id, norm_platform, handle, encrypted_pass))
                await db.commit()
                return cur.lastrowid

    async def update_social_account(self, account_id: int, platform: str | None = None, handle: str | None = None, password: str | None = None) -> bool:
        encrypted_pass = encrypt_password(password) if password is not None else None
        norm_platform = platform.strip().lower() if platform is not None else None

        if self.is_postgres:
            async with self.pool.acquire() as conn:
                await conn.execute("""
                    UPDATE social_accounts
                    SET 
                        platform = COALESCE($1, platform),
                        handle = COALESCE($2, handle),
                        password_encrypted = COALESCE($3, password_encrypted)
                    WHERE id = $4
                """, norm_platform, handle, encrypted_pass, account_id)
                return True
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                updates = []
                params = []
                if norm_platform is not None:
                    updates.append("platform = ?")
                    params.append(norm_platform)
                if handle is not None:
                    updates.append("handle = ?")
                    params.append(handle)
                if encrypted_pass is not None:
                    updates.append("password_encrypted = ?")
                    params.append(encrypted_pass)
                if updates:
                    params.append(account_id)
                    await db.execute(f"UPDATE social_accounts SET {', '.join(updates)} WHERE id = ?", params)
                    await db.commit()
                return True

    async def delete_social_account(self, account_id: int) -> bool:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                await conn.execute("DELETE FROM social_accounts WHERE id = $1", account_id)
                return True
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute("DELETE FROM social_accounts WHERE id = ?", (account_id,))
                await db.commit()
                return True

    # --- SUBMISSIONS CRUD ---
    async def get_submissions(self) -> list[dict]:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT 
                        s.id,
                        s.user_id,
                        u.chat_id,
                        u.telegram_username,
                        u.payment_details,
                        s.social_account_id,
                        sa.platform,
                        sa.handle,
                        s.link,
                        s.caption,
                        s.views,
                        COALESCE(s.payment_amount, 0.0)::FLOAT AS payment_amount,
                        s.status,
                        s.submitted_at
                    FROM submissions s
                    JOIN users u ON s.user_id = u.id
                    JOIN social_accounts sa ON s.social_account_id = sa.id
                    ORDER BY s.id DESC
                """)
                return [dict(r) for r in rows]
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute("""
                    SELECT 
                        s.id,
                        s.user_id,
                        u.chat_id,
                        u.telegram_username,
                        u.payment_details,
                        s.social_account_id,
                        sa.platform,
                        sa.handle,
                        s.link,
                        s.caption,
                        s.views,
                        COALESCE(s.payment_amount, 0.0) AS payment_amount,
                        s.status,
                        s.submitted_at
                    FROM submissions s
                    JOIN users u ON s.user_id = u.id
                    JOIN social_accounts sa ON s.social_account_id = sa.id
                    ORDER BY s.id DESC
                """) as cur:
                    rows = await cur.fetchall()
                    return [
                        {
                            "id": r[0], "user_id": r[1], "chat_id": r[2],
                            "telegram_username": r[3], "payment_details": r[4],
                            "social_account_id": r[5], "platform": r[6], "handle": r[7],
                            "link": r[8], "caption": r[9], "views": r[10],
                            "payment_amount": r[11], "status": r[12], "submitted_at": r[13]
                        }
                        for r in rows
                    ]

    async def update_submission(
        self,
        submission_id: int,
        views: int | None = None,
        payment_amount: float | None = None,
        status: str | None = None,
        link: str | None = None,
        caption: str | None = None,
    ) -> dict | None:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow("""
                    UPDATE submissions
                    SET 
                        views = COALESCE($1, views),
                        payment_amount = COALESCE($2, payment_amount),
                        status = COALESCE($3, status),
                        link = COALESCE($4, link),
                        caption = COALESCE($5, caption)
                    WHERE id = $6
                    RETURNING 
                        id, user_id, link, caption, views, payment_amount, status, submitted_at,
                        (SELECT chat_id FROM users WHERE id = submissions.user_id) AS chat_id,
                        (SELECT telegram_username FROM users WHERE id = submissions.user_id) AS telegram_username
                """, views, payment_amount, status, link, caption, submission_id)
                return dict(row) if row else None
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                updates = []
                params = []
                if views is not None:
                    updates.append("views = ?")
                    params.append(views)
                if payment_amount is not None:
                    updates.append("payment_amount = ?")
                    params.append(payment_amount)
                if status is not None:
                    updates.append("status = ?")
                    params.append(status)
                if link is not None:
                    updates.append("link = ?")
                    params.append(link)
                if caption is not None:
                    updates.append("caption = ?")
                    params.append(caption)
                if updates:
                    params.append(submission_id)
                    await db.execute(f"UPDATE submissions SET {', '.join(updates)} WHERE id = ?", params)
                    await db.commit()

                async with db.execute("""
                    SELECT s.id, s.user_id, s.link, s.caption, s.views, s.payment_amount, s.status, s.submitted_at,
                           u.chat_id, u.telegram_username
                    FROM submissions s
                    JOIN users u ON s.user_id = u.id
                    WHERE s.id = ?
                """, (submission_id,)) as cur:
                    row = await cur.fetchone()
                    if not row:
                        return None
                    return {
                        "id": row[0], "user_id": row[1], "link": row[2], "caption": row[3],
                        "views": row[4], "payment_amount": row[5], "status": row[6],
                        "submitted_at": row[7], "chat_id": row[8], "telegram_username": row[9]
                    }

    async def delete_submission(self, submission_id: int) -> bool:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                await conn.execute("DELETE FROM submissions WHERE id = $1", submission_id)
                return True
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute("DELETE FROM submissions WHERE id = ?", (submission_id,))
                await db.commit()
                return True

backend_db = BackendDatabase(DATABASE_URL)
