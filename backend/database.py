import logging
from backend.config import DATABASE_URL, decrypt_password, encrypt_password

class BackendDatabase:
    def __init__(self, dsn: str | None = None):
        self.dsn = dsn
        self.is_postgres = bool(dsn)
        self.pool = None
        self.db_path = "bot_database.db"

    async def connect(self):
        if self.pool is not None:
            return
        if self.is_postgres:
            import asyncpg
            dsn = self.dsn
            if dsn.startswith("postgres://"):
                dsn = dsn.replace("postgres://", "postgresql://", 1)
            self.pool = await asyncpg.create_pool(dsn, min_size=1, max_size=10)
            try:
                async with self.pool.acquire() as conn:
                    await conn.execute("""
                        CREATE TABLE IF NOT EXISTS platform_rates (
                            platform      VARCHAR(20) PRIMARY KEY,
                            rate_per_1000 NUMERIC(10,2) NOT NULL DEFAULT 50.00,
                            updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
                        );
                        CREATE TABLE IF NOT EXISTS app_settings (
                            key        VARCHAR(50) PRIMARY KEY,
                            value      TEXT NOT NULL,
                            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                        );
                        INSERT INTO platform_rates (platform, rate_per_1000)
                        VALUES 
                            ('youtube', 60.00),
                            ('tiktok', 60.00),
                            ('twitter', 45.00),
                            ('instagram', 40.00)
                        ON CONFLICT (platform) DO NOTHING;
                    """)
            except Exception as e:
                logging.info(f"Backend platform rates init note: {e}")
            logging.info("Backend connected to PostgreSQL database.")
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute("""
                    CREATE TABLE IF NOT EXISTS platform_rates (
                        platform      TEXT PRIMARY KEY,
                        rate_per_1000 REAL NOT NULL DEFAULT 50.0,
                        updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                await db.execute("""
                    CREATE TABLE IF NOT EXISTS app_settings (
                        key        TEXT PRIMARY KEY,
                        value      TEXT NOT NULL,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                await db.execute("""
                    INSERT OR IGNORE INTO platform_rates (platform, rate_per_1000)
                    VALUES 
                        ('youtube', 60.0),
                        ('tiktok', 60.0),
                        ('twitter', 45.0),
                        ('instagram', 40.0);
                """)
                await db.commit()
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
                    SELECT 
                        sa.id, 
                        sa.user_id, 
                        sa.platform, 
                        sa.handle, 
                        sa.password_encrypted, 
                        sa.created_at,
                        COALESCE(SUM(sub.views), 0)::INTEGER AS views,
                        COALESCE(SUM(sub.payment_amount), 0.0)::FLOAT AS money
                    FROM social_accounts sa
                    LEFT JOIN submissions sub ON sub.social_account_id = sa.id AND sub.status = 'approved'
                    GROUP BY sa.id, sa.user_id, sa.platform, sa.handle, sa.password_encrypted, sa.created_at
                    ORDER BY sa.id ASC
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
                async with db.execute("""
                    SELECT 
                        sa.id, 
                        sa.user_id, 
                        sa.platform, 
                        sa.handle, 
                        sa.password_encrypted, 
                        sa.created_at,
                        COALESCE(SUM(sub.views), 0) AS views,
                        COALESCE(SUM(sub.payment_amount), 0.0) AS money
                    FROM social_accounts sa
                    LEFT JOIN submissions sub ON sub.social_account_id = sa.id AND sub.status = 'approved'
                    GROUP BY sa.id, sa.user_id, sa.platform, sa.handle, sa.password_encrypted, sa.created_at
                    ORDER BY sa.id ASC
                """) as cur:
                    s_tuples = await cur.fetchall()
                    social_list = [
                        {"id": r[0], "user_id": r[1], "platform": r[2], "handle": r[3], "password_encrypted": r[4], "created_at": r[5], "views": r[6], "money": r[7]}
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
                "views": s.get("views", 0),
                "money": float(s.get("money", 0.0)),
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

    async def get_all_chat_ids(self) -> list[int]:
        """Returns distinct Telegram chat IDs for all registered clippers."""
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch("SELECT DISTINCT chat_id FROM users WHERE chat_id IS NOT NULL")
                return [r["chat_id"] for r in rows]
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute("SELECT DISTINCT chat_id FROM users WHERE chat_id IS NOT NULL") as cur:
                    rows = await cur.fetchall()
                    return [r[0] for r in rows]

    # --- PLATFORM RATES ---
    async def get_platform_rates(self) -> dict[str, float]:
        defaults = {"youtube": 60.0, "tiktok": 60.0, "twitter": 45.0, "instagram": 40.0}
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch("SELECT platform, rate_per_1000::FLOAT FROM platform_rates")
                if rows:
                    for r in rows:
                        defaults[r["platform"].lower()] = float(r["rate_per_1000"])
                return defaults
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute("SELECT platform, rate_per_1000 FROM platform_rates") as cur:
                    rows = await cur.fetchall()
                    if rows:
                        for r in rows:
                            defaults[r[0].lower()] = float(r[1])
                return defaults

    async def get_platform_rate(self, platform: str | None) -> float:
        rates = await self.get_platform_rates()
        p = (platform or "").lower().strip()
        if "youtube" in p or "youtu" in p:
            return rates.get("youtube", 60.0)
        if "tiktok" in p:
            return rates.get("tiktok", 60.0)
        if "twitter" in p or p == "x":
            return rates.get("twitter", 45.0)
        if "instagram" in p or p == "ig":
            return rates.get("instagram", 40.0)
        return rates.get(p, 50.0)

    async def update_platform_rates(self, rates: dict[str, float]) -> dict[str, float]:
        current = await self.get_platform_rates()
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                for plat, rate in rates.items():
                    plat_clean = plat.lower().strip()
                    try:
                        rate_val = float(rate)
                    except (ValueError, TypeError):
                        continue
                    await conn.execute("""
                        INSERT INTO platform_rates (platform, rate_per_1000, updated_at)
                        VALUES ($1, $2, NOW())
                        ON CONFLICT (platform)
                        DO UPDATE SET rate_per_1000 = EXCLUDED.rate_per_1000, updated_at = NOW()
                    """, plat_clean, rate_val)
                    current[plat_clean] = rate_val
                return current
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                for plat, rate in rates.items():
                    plat_clean = plat.lower().strip()
                    try:
                        rate_val = float(rate)
                    except (ValueError, TypeError):
                        continue
                    await db.execute("""
                        INSERT INTO platform_rates (platform, rate_per_1000, updated_at)
                        VALUES (?, ?, CURRENT_TIMESTAMP)
                        ON CONFLICT(platform) DO UPDATE SET rate_per_1000 = excluded.rate_per_1000, updated_at = CURRENT_TIMESTAMP
                    """, (plat_clean, rate_val))
                    current[plat_clean] = rate_val
                await db.commit()
                return current

    # --- APP SETTINGS (ADMIN PASSWORD, ETC.) ---
    async def get_app_setting(self, key: str, default: str | None = None) -> str | None:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                val = await conn.fetchval("SELECT value FROM app_settings WHERE key = $1", key)
                return str(val) if val is not None else default
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute("SELECT value FROM app_settings WHERE key = ?", (key,)) as cur:
                    row = await cur.fetchone()
                    return str(row[0]) if row else default

    async def set_app_setting(self, key: str, value: str):
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO app_settings (key, value, updated_at)
                    VALUES ($1, $2, NOW())
                    ON CONFLICT (key) DO UPDATE
                    SET value = EXCLUDED.value, updated_at = NOW()
                """, key, str(value))
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute("""
                    INSERT OR REPLACE INTO app_settings (key, value, updated_at)
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                """, (key, str(value)))
                await db.commit()

backend_db = BackendDatabase(DATABASE_URL)
