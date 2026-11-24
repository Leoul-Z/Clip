import logging
from bot.config import DATABASE_URL, decrypt_password, encrypt_password

class Database:
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
                        CREATE TABLE IF NOT EXISTS users (
                            id                SERIAL PRIMARY KEY,
                            chat_id           BIGINT UNIQUE NOT NULL,
                            telegram_username VARCHAR(64),
                            payment_details   TEXT,
                            created_at        TIMESTAMP NOT NULL DEFAULT NOW()
                        );

                        CREATE TABLE IF NOT EXISTS social_accounts (
                            id                 SERIAL PRIMARY KEY,
                            user_id            INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            platform           VARCHAR(20) NOT NULL
                                               CHECK (platform IN ('twitter','tiktok','youtube','instagram')),
                            handle             VARCHAR(100) NOT NULL,
                            password_encrypted TEXT,
                            created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
                            UNIQUE (platform, handle),
                            UNIQUE (user_id, platform)
                        );

                        CREATE TABLE IF NOT EXISTS submissions (
                            id                SERIAL PRIMARY KEY,
                            user_id           INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            social_account_id INT NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
                            link              TEXT NOT NULL,
                            caption           TEXT,
                            views             INT NOT NULL DEFAULT 0,
                            payment_amount    NUMERIC(10,2) DEFAULT 0.0,
                            status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                                              CHECK (status IN ('pending','under_review','approved','rejected')),
                            submitted_at      TIMESTAMP NOT NULL DEFAULT NOW()
                        );

                        CREATE INDEX IF NOT EXISTS idx_social_user      ON social_accounts(user_id);
                        CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);
                        CREATE INDEX IF NOT EXISTS idx_submissions_acct ON submissions(social_account_id);
                        CREATE INDEX IF NOT EXISTS idx_submissions_stat ON submissions(status);

                        CREATE TABLE IF NOT EXISTS platform_rates (
                            platform      VARCHAR(20) PRIMARY KEY,
                            rate_per_1000 NUMERIC(10,2) NOT NULL DEFAULT 50.00,
                            updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
                        );

                        INSERT INTO platform_rates (platform, rate_per_1000)
                        VALUES 
                            ('youtube', 60.00),
                            ('tiktok', 60.00),
                            ('twitter', 45.00),
                            ('instagram', 40.00)
                        ON CONFLICT (platform) DO NOTHING;

                        DO $$ 
                        BEGIN 
                            IF NOT EXISTS (
                                SELECT 1 FROM information_schema.columns 
                                WHERE table_name='social_accounts' AND column_name='status'
                            ) THEN 
                                ALTER TABLE social_accounts ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'approved';
                            END IF; 
                        END $$;
                    """)
            except Exception as e:
                logging.info(f"Database schema init note: {e}")
            logging.info(" Connected to Neon PostgreSQL database.")
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id                INTEGER PRIMARY KEY AUTOINCREMENT,
                        chat_id           INTEGER UNIQUE NOT NULL,
                        telegram_username TEXT,
                        payment_details   TEXT,
                        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                await db.execute("""
                    CREATE TABLE IF NOT EXISTS social_accounts (
                        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        platform           TEXT NOT NULL CHECK (platform IN ('twitter','tiktok','youtube','instagram')),
                        handle             TEXT NOT NULL,
                        password_encrypted TEXT,
                        created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE (platform, handle),
                        UNIQUE (user_id, platform)
                    );
                """)
                await db.execute("""
                    CREATE TABLE IF NOT EXISTS submissions (
                        id                INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        social_account_id INTEGER NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
                        link              TEXT NOT NULL,
                        caption           TEXT,
                        views             INTEGER DEFAULT 0,
                        payment_amount    REAL DEFAULT 0.0,
                        status            TEXT DEFAULT 'pending' CHECK (status IN ('pending','under_review','approved','rejected')),
                        submitted_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                await db.execute("CREATE INDEX IF NOT EXISTS idx_social_user ON social_accounts(user_id);")
                await db.execute("CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);")
                await db.execute("CREATE INDEX IF NOT EXISTS idx_submissions_acct ON submissions(social_account_id);")
                await db.execute("CREATE INDEX IF NOT EXISTS idx_submissions_stat ON submissions(status);")

                await db.execute("""
                    CREATE TABLE IF NOT EXISTS platform_rates (
                        platform      TEXT PRIMARY KEY,
                        rate_per_1000 REAL NOT NULL DEFAULT 50.0,
                        updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
                async with db.execute("PRAGMA table_info(social_accounts)") as cur:
                    columns = [row[1] for row in await cur.fetchall()]
                    if "status" not in columns:
                        await db.execute("ALTER TABLE social_accounts ADD COLUMN status TEXT DEFAULT 'approved'")
                await db.commit()
            logging.info(" Connected to local SQLite database (bot_database.db).")

    async def close(self):
        if self.is_postgres and self.pool:
            await self.pool.close()

    async def get_user(self, chat_id: int):
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT 
                        u.id,
                        u.chat_id,
                        u.telegram_username,
                        u.payment_details,
                        u.payment_details AS payment_info,
                        COALESCE(SUM(s.views), 0)::INTEGER AS views,
                        COALESCE(SUM(s.payment_amount), 0.0)::FLOAT AS money
                    FROM users u
                    LEFT JOIN submissions s ON s.user_id = u.id AND s.status = 'approved'
                    WHERE u.chat_id = $1
                    GROUP BY u.id, u.chat_id, u.telegram_username, u.payment_details
                    """,
                    chat_id,
                )
                return dict(row) if row else None
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(
                    """
                    SELECT 
                        u.id,
                        u.chat_id,
                        u.telegram_username,
                        u.payment_details,
                        COALESCE(SUM(s.views), 0) AS views,
                        COALESCE(SUM(s.payment_amount), 0.0) AS money
                    FROM users u
                    LEFT JOIN submissions s ON s.user_id = u.id AND s.status = 'approved'
                    WHERE u.chat_id = ?
                    GROUP BY u.id, u.chat_id, u.telegram_username, u.payment_details
                    """,
                    (chat_id,),
                ) as cursor:
                    row = await cursor.fetchone()
                    if row:
                        return {
                            "id": row[0],
                            "chat_id": row[1],
                            "telegram_username": row[2],
                            "payment_details": row[3],
                            "payment_info": row[3],
                            "views": row[4],
                            "money": row[5],
                        }
                    return None

    async def update_payment_info(self, chat_id: int, payment_details: str):
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                await conn.execute(
                    "UPDATE users SET payment_details = $1 WHERE chat_id = $2",
                    payment_details,
                    chat_id,
                )
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute(
                    "UPDATE users SET payment_details = ? WHERE chat_id = ?",
                    (payment_details, chat_id),
                )
                await db.commit()

    async def add_payment_detail(self, chat_id: int, new_detail: str) -> str:
        """Appends a new payment detail to the user's existing details."""
        clean_detail = new_detail.strip()
        user = await self.get_user(chat_id)
        current = (user.get("payment_info") or "").strip() if user else ""
        if current:
            existing_lines = [l.strip() for l in current.split("\n") if l.strip()]
            if clean_detail not in existing_lines:
                existing_lines.append(clean_detail)
            combined = "\n".join(existing_lines)
        else:
            combined = clean_detail

        await self.update_payment_info(chat_id, combined)
        return combined

    async def get_user_payment_details(self, chat_id: int) -> list[str]:
        """Returns a list of distinct payment details saved by the user."""
        user = await self.get_user(chat_id)
        if not user:
            return []
        raw = (user.get("payment_info") or "").strip()
        if not raw:
            return []
        return [l.strip() for l in raw.split("\n") if l.strip()]

    async def get_user_by_username(self, username: str):
        clean_user = username.strip()
        if not clean_user.startswith("@"):
            clean_user = f"@{clean_user}"

        if self.is_postgres:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT 
                        u.id,
                        u.chat_id,
                        u.telegram_username,
                        u.payment_details,
                        u.payment_details AS payment_info,
                        COALESCE(SUM(s.views), 0)::INTEGER AS views,
                        COALESCE(SUM(s.payment_amount), 0.0)::FLOAT AS money
                    FROM users u
                    LEFT JOIN submissions s ON s.user_id = u.id AND s.status = 'approved'
                    WHERE LOWER(u.telegram_username) = LOWER($1)
                    GROUP BY u.id, u.chat_id, u.telegram_username, u.payment_details
                    """,
                    clean_user,
                )
                return dict(row) if row else None
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(
                    """
                    SELECT 
                        u.id,
                        u.chat_id,
                        u.telegram_username,
                        u.payment_details,
                        COALESCE(SUM(s.views), 0) AS views,
                        COALESCE(SUM(s.payment_amount), 0.0) AS money
                    FROM users u
                    LEFT JOIN submissions s ON s.user_id = u.id AND s.status = 'approved'
                    WHERE LOWER(u.telegram_username) = LOWER(?)
                    GROUP BY u.id, u.chat_id, u.telegram_username, u.payment_details
                    """,
                    (clean_user,),
                ) as cursor:
                    row = await cursor.fetchone()
                    if row:
                        return {
                            "id": row[0],
                            "chat_id": row[1],
                            "telegram_username": row[2],
                            "payment_details": row[3],
                            "payment_info": row[3],
                            "views": row[4],
                            "money": row[5],
                        }
                    return None

    async def get_user_social_accounts_full(self, chat_id: int) -> list[dict]:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT sa.id, sa.platform, sa.handle, sa.password_encrypted, COALESCE(sa.status, 'approved') AS status
                    FROM social_accounts sa
                    JOIN users u ON sa.user_id = u.id
                    WHERE u.chat_id = $1
                    ORDER BY sa.id ASC
                    """,
                    chat_id,
                )
                res = []
                for r in rows:
                    res.append({
                        "id": r["id"],
                        "platform": r["platform"],
                        "handle": r["handle"],
                        "status": r["status"],
                        "password": decrypt_password(r["password_encrypted"]),
                        "password_encrypted": r["password_encrypted"],
                    })
                return res
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(
                    """
                    SELECT sa.id, sa.platform, sa.handle, sa.password_encrypted, COALESCE(sa.status, 'approved') AS status
                    FROM social_accounts sa
                    JOIN users u ON sa.user_id = u.id
                    WHERE u.chat_id = ?
                    ORDER BY sa.id ASC
                    """,
                    (chat_id,),
                ) as cursor:
                    rows = await cursor.fetchall()
                    res = []
                    for r in rows:
                        res.append({
                            "id": r[0],
                            "platform": r[1],
                            "handle": r[2],
                            "password": decrypt_password(r[3]),
                            "password_encrypted": r[3],
                            "status": r[4],
                        })
                    return res

    async def get_user_platform_stats(self, chat_id: int) -> list[dict]:
        """Returns views and approved earnings broken down by platform for a user."""
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT 
                        sa.platform,
                        COALESCE(SUM(s.views), 0)::INTEGER AS views,
                        COALESCE(SUM(s.payment_amount), 0.0)::FLOAT AS money,
                        COUNT(s.id) FILTER (WHERE s.status = 'approved')::INTEGER AS approved_count,
                        COUNT(s.id)::INTEGER AS total_submissions
                    FROM social_accounts sa
                    JOIN users u ON sa.user_id = u.id
                    LEFT JOIN submissions s ON s.social_account_id = sa.id AND s.status = 'approved'
                    WHERE u.chat_id = $1
                    GROUP BY sa.platform
                    ORDER BY views DESC, money DESC
                    """,
                    chat_id,
                )
                return [dict(r) for r in rows]
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row
                async with db.execute(
                    """
                    SELECT 
                        sa.platform,
                        COALESCE(SUM(s.views), 0) AS views,
                        COALESCE(SUM(s.payment_amount), 0.0) AS money,
                        SUM(CASE WHEN s.status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
                        COUNT(s.id) AS total_submissions
                    FROM social_accounts sa
                    JOIN users u ON sa.user_id = u.id
                    LEFT JOIN submissions s ON s.social_account_id = sa.id AND s.status = 'approved'
                    WHERE u.chat_id = ?
                    GROUP BY sa.platform
                    ORDER BY views DESC, money DESC
                    """,
                    (chat_id,),
                ) as cursor:
                    rows = await cursor.fetchall()
                    return [dict(r) for r in rows]

    async def upsert_user(self, chat_id: int, telegram_username: str) -> int:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    INSERT INTO users (chat_id, telegram_username)
                    VALUES ($1, $2)
                    ON CONFLICT (chat_id) DO UPDATE SET
                        telegram_username = COALESCE(users.telegram_username, EXCLUDED.telegram_username)
                    RETURNING id
                    """,
                    chat_id,
                    telegram_username,
                )
                return row["id"]
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute(
                    """
                    INSERT INTO users (chat_id, telegram_username)
                    VALUES (?, ?)
                    ON CONFLICT (chat_id) DO UPDATE SET
                        telegram_username = COALESCE(users.telegram_username, excluded.telegram_username)
                    """,
                    (chat_id, telegram_username),
                )
                await db.commit()
                async with db.execute("SELECT id FROM users WHERE chat_id = ?", (chat_id,)) as cur:
                    r = await cur.fetchone()
                    return r[0]

    async def update_user_stats(self, target_username: str, views: int, money: float) -> bool:
        user = await self.get_user_by_username(target_username)
        if not user:
            return False
        user_id = user["id"]

        if self.is_postgres:
            async with self.pool.acquire() as conn:
                sub = await conn.fetchrow(
                    "SELECT id FROM submissions WHERE user_id = $1 ORDER BY id DESC LIMIT 1",
                    user_id,
                )
                if sub:
                    await conn.execute(
                        "UPDATE submissions SET views = $1, payment_amount = $2, status = 'approved' WHERE id = $3",
                        views, money, sub["id"],
                    )
                    return True
                else:
                    sa = await conn.fetchrow(
                        "SELECT id FROM social_accounts WHERE user_id = $1 LIMIT 1", user_id
                    )
                    sa_id = sa["id"] if sa else None
                    if not sa_id:
                        sa_id = await conn.fetchval(
                            "INSERT INTO social_accounts (user_id, platform, handle, password_encrypted) VALUES ($1, 'tiktok', $2, '') RETURNING id",
                            user_id, target_username,
                        )
                    await conn.execute(
                        """
                        INSERT INTO submissions (user_id, social_account_id, link, caption, views, payment_amount, status)
                        VALUES ($1, $2, 'https://t.me/' || SUBSTRING($3 FROM 2), 'Admin manual stats', $4, $5, 'approved')
                        """,
                        user_id, sa_id, target_username, views, money,
                    )
                    return True
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(
                    "SELECT id FROM submissions WHERE user_id = ? ORDER BY id DESC LIMIT 1",
                    (user_id,),
                ) as cur:
                    sub = await cur.fetchone()
                if sub:
                    await db.execute(
                        "UPDATE submissions SET views = ?, payment_amount = ?, status = 'approved' WHERE id = ?",
                        (views, money, sub[0]),
                    )
                    await db.commit()
                    return True
                else:
                    async with db.execute(
                        "SELECT id FROM social_accounts WHERE user_id = ? LIMIT 1", (user_id,)
                    ) as cur:
                        sa = await cur.fetchone()
                    if sa:
                        sa_id = sa[0]
                    else:
                        cursor = await db.execute(
                            "INSERT INTO social_accounts (user_id, platform, handle, password_encrypted) VALUES (?, 'tiktok', ?, '')",
                            (user_id, target_username),
                        )
                        sa_id = cursor.lastrowid
                    await db.execute(
                        """
                        INSERT INTO submissions (user_id, social_account_id, link, caption, views, payment_amount, status)
                        VALUES (?, ?, 'https://t.me', 'Admin manual stats', ?, ?, 'approved')
                        """,
                        (user_id, sa_id, views, money),
                    )
                    await db.commit()
                    return True

    async def add_social_account(
        self, chat_id: int, telegram_username: str, platform: str, handle: str, password: str
    ):
        norm_platform = platform.strip().lower()
        encrypted_pass = encrypt_password(password)

        if self.is_postgres:
            async with self.pool.acquire() as conn:
                user_row = await conn.fetchrow("SELECT id FROM users WHERE chat_id = $1", chat_id)
                if not user_row:
                    user_id = await self.upsert_user(chat_id, telegram_username)
                else:
                    user_id = user_row["id"]

                await conn.execute(
                    "DELETE FROM social_accounts WHERE user_id = $1 AND platform = $2",
                    user_id,
                    norm_platform,
                )
                await conn.execute(
                    "DELETE FROM social_accounts WHERE platform = $1 AND handle = $2",
                    norm_platform,
                    handle,
                )
                await conn.execute(
                    """
                    INSERT INTO social_accounts (user_id, platform, handle, password_encrypted, status)
                    VALUES ($1, $2, $3, $4, 'pending')
                    """,
                    user_id,
                    norm_platform,
                    handle,
                    encrypted_pass,
                )
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute("SELECT id FROM users WHERE chat_id = ?", (chat_id,)) as cur:
                    user_row = await cur.fetchone()
                if not user_row:
                    user_id = await self.upsert_user(chat_id, telegram_username)
                else:
                    user_id = user_row[0]

                await db.execute(
                    "DELETE FROM social_accounts WHERE user_id = ? AND platform = ?",
                    (user_id, norm_platform),
                )
                await db.execute(
                    "DELETE FROM social_accounts WHERE platform = ? AND handle = ?",
                    (norm_platform, handle),
                )
                await db.execute(
                    """
                    INSERT INTO social_accounts (user_id, platform, handle, password_encrypted, status)
                    VALUES (?, ?, ?, ?, 'pending')
                    """,
                    (user_id, norm_platform, handle, encrypted_pass),
                )
                await db.commit()

    async def add_submission(
        self,
        chat_id: int,
        telegram_username: str,
        link: str,
        social_account_id: int,
        caption: str | None = None,
    ) -> int:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                user_row = await conn.fetchrow("SELECT id FROM users WHERE chat_id = $1", chat_id)
                if not user_row:
                    user_id = await self.upsert_user(chat_id, telegram_username)
                else:
                    user_id = user_row["id"]

                row = await conn.fetchrow(
                    """
                    INSERT INTO submissions (user_id, social_account_id, link, caption, views, payment_amount, status)
                    VALUES ($1, $2, $3, $4, 0, 0.0, 'pending')
                    RETURNING id
                    """,
                    user_id,
                    social_account_id,
                    link,
                    caption,
                )
                return row["id"]
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute("SELECT id FROM users WHERE chat_id = ?", (chat_id,)) as cur:
                    user_row = await cur.fetchone()
                if not user_row:
                    user_id = await self.upsert_user(chat_id, telegram_username)
                else:
                    user_id = user_row[0]

                cursor = await db.execute(
                    """
                    INSERT INTO submissions (user_id, social_account_id, link, caption, views, payment_amount, status)
                    VALUES (?, ?, ?, ?, 0, 0.0, 'pending')
                    """,
                    (user_id, social_account_id, link, caption),
                )
                await db.commit()
                return cursor.lastrowid

    async def get_user_submissions(self, chat_id: int) -> list[dict]:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT 
                        s.id,
                        s.link,
                        COALESCE(s.payment_amount, 0.0)::FLOAT AS payment,
                        s.views,
                        s.status,
                        s.submitted_at AS created_at,
                        s.caption,
                        sa.platform,
                        sa.handle
                    FROM submissions s
                    JOIN users u ON s.user_id = u.id
                    JOIN social_accounts sa ON s.social_account_id = sa.id
                    WHERE u.chat_id = $1
                    ORDER BY s.id DESC
                    """,
                    chat_id,
                )
                return [dict(r) for r in rows]
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(
                    """
                    SELECT 
                        s.id,
                        s.link,
                        COALESCE(s.payment_amount, 0.0) AS payment,
                        s.views,
                        s.status,
                        s.submitted_at AS created_at,
                        s.caption,
                        sa.platform,
                        sa.handle
                    FROM submissions s
                    JOIN users u ON s.user_id = u.id
                    JOIN social_accounts sa ON s.social_account_id = sa.id
                    WHERE u.chat_id = ?
                    ORDER BY s.id DESC
                    """,
                    (chat_id,),
                ) as cursor:
                    rows = await cursor.fetchall()
                    return [
                        {
                            "id": r[0],
                            "link": r[1],
                            "payment": r[2],
                            "views": r[3],
                            "status": r[4],
                            "created_at": r[5],
                            "caption": r[6],
                            "platform": r[7],
                            "handle": r[8],
                        }
                        for r in rows
                    ]

    async def update_submission_payment(
        self, submission_id: int, payment: float, views: int | None = None
    ) -> dict | None:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                if views is not None:
                    row = await conn.fetchrow(
                        """
                        UPDATE submissions
                        SET payment_amount = $1, views = $2, status = 'approved'
                        WHERE id = $3
                        RETURNING (SELECT chat_id FROM users WHERE id = submissions.user_id) AS chat_id,
                                  (SELECT telegram_username FROM users WHERE id = submissions.user_id) AS telegram_username,
                                  link, caption, views, payment_amount
                        """,
                        payment,
                        views,
                        submission_id,
                    )
                else:
                    row = await conn.fetchrow(
                        """
                        UPDATE submissions
                        SET payment_amount = $1, status = 'approved'
                        WHERE id = $2
                        RETURNING (SELECT chat_id FROM users WHERE id = submissions.user_id) AS chat_id,
                                  (SELECT telegram_username FROM users WHERE id = submissions.user_id) AS telegram_username,
                                  link, caption, views, payment_amount
                        """,
                        payment,
                        submission_id,
                    )
                return dict(row) if row else None
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                if views is not None:
                    await db.execute(
                        "UPDATE submissions SET payment_amount = ?, views = ?, status = 'approved' WHERE id = ?",
                        (payment, views, submission_id),
                    )
                else:
                    await db.execute(
                        "UPDATE submissions SET payment_amount = ?, status = 'approved' WHERE id = ?",
                        (payment, submission_id),
                    )
                await db.commit()
                async with db.execute(
                    """
                    SELECT u.chat_id, u.telegram_username, s.link, s.caption, s.views, s.payment_amount
                    FROM submissions s
                    JOIN users u ON s.user_id = u.id
                    WHERE s.id = ?
                    """,
                    (submission_id,),
                ) as cur:
                    row = await cur.fetchone()
                    if not row:
                        return None
                    return {
                        "chat_id": row[0],
                        "telegram_username": row[1],
                        "link": row[2],
                        "caption": row[3],
                        "views": row[4],
                        "payment_amount": row[5],
                    }

    async def update_submission_views(self, submission_id: int, views: int) -> dict | None:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    UPDATE submissions
                    SET views = $1
                    WHERE id = $2
                    RETURNING (SELECT chat_id FROM users WHERE id = submissions.user_id) AS chat_id,
                              (SELECT telegram_username FROM users WHERE id = submissions.user_id) AS telegram_username,
                              (SELECT platform FROM social_accounts WHERE id = submissions.social_account_id) AS platform,
                              link, caption, views, payment_amount
                    """,
                    views,
                    submission_id,
                )
                return dict(row) if row else None
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute(
                    "UPDATE submissions SET views = ? WHERE id = ?",
                    (views, submission_id),
                )
                await db.commit()
                async with db.execute(
                    """
                    SELECT u.chat_id, u.telegram_username, sa.platform, s.link, s.caption, s.views, s.payment_amount
                    FROM submissions s
                    JOIN users u ON s.user_id = u.id
                    LEFT JOIN social_accounts sa ON s.social_account_id = sa.id
                    WHERE s.id = ?
                    """,
                    (submission_id,),
                ) as cur:
                    row = await cur.fetchone()
                    if not row:
                        return None
                    return {
                        "chat_id": row[0],
                        "telegram_username": row[1],
                        "platform": row[2],
                        "link": row[3],
                        "caption": row[4],
                        "views": row[5],
                        "payment_amount": row[6],
                    }

    async def get_leaderboard(self, limit: int = 5) -> list[dict]:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT 
                        u.telegram_username,
                        COALESCE(SUM(s.views), 0)::INTEGER AS views,
                        COALESCE(SUM(s.payment_amount), 0.0)::FLOAT AS money
                    FROM users u
                    JOIN submissions s ON s.user_id = u.id AND s.status = 'approved'
                    GROUP BY u.id, u.telegram_username
                    ORDER BY views DESC, money DESC
                    LIMIT $1
                    """,
                    limit,
                )
                return [dict(r) for r in rows]
        else:
            import aiosqlite
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(
                    """
                    SELECT 
                        u.telegram_username,
                        COALESCE(SUM(s.views), 0) AS views,
                        COALESCE(SUM(s.payment_amount), 0.0) AS money
                    FROM users u
                    JOIN submissions s ON s.user_id = u.id AND s.status = 'approved'
                    GROUP BY u.id, u.telegram_username
                    ORDER BY views DESC, money DESC
                    LIMIT ?
                    """,
                    (limit,),
                ) as cursor:
                    rows = await cursor.fetchall()
                    return [
                        {"telegram_username": r[0], "views": r[1], "money": r[2]}
                        for r in rows
                    ]

    async def get_admin_stats(self) -> dict:
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

    async def get_admin_users(self) -> list[dict]:
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

    async def get_admin_submissions(self) -> list[dict]:
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

    async def admin_update_submission(
        self,
        submission_id: int,
        views: int | None = None,
        payment_amount: float | None = None,
        status: str | None = None,
    ) -> dict | None:
        if self.is_postgres:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow("""
                    UPDATE submissions
                    SET 
                        views = COALESCE($1, views),
                        payment_amount = COALESCE($2, payment_amount),
                        status = COALESCE($3, status)
                    WHERE id = $4
                    RETURNING 
                        id, user_id, link, caption, views, payment_amount, status, submitted_at,
                        (SELECT chat_id FROM users WHERE id = submissions.user_id) AS chat_id,
                        (SELECT telegram_username FROM users WHERE id = submissions.user_id) AS telegram_username
                """, views, payment_amount, status, submission_id)
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

db = Database(DATABASE_URL)
