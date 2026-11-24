from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

def get_main_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📱 Link Social Account", callback_data="menu_register")],
            [
                InlineKeyboardButton(text="📊 Stats", callback_data="menu_stats"),
                InlineKeyboardButton(text="🚀 Progress", callback_data="menu_progress"),
            ],
            [
                InlineKeyboardButton(text="💳 Payment", callback_data="menu_payment"),
                InlineKeyboardButton(text="🔗 Submission Links", callback_data="menu_submissions"),
            ],
            [
                InlineKeyboardButton(text="🏆 Leaderboard", callback_data="menu_leaderboard"),
                InlineKeyboardButton(text="💰 Rates / Payouts", callback_data="menu_rates"),
            ],
        ]
    )

def get_back_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🔙 Back to Menu", callback_data="back_to_menu")]
        ]
    )

def get_platforms_keyboard(linked_platforms=None) -> InlineKeyboardMarkup:
    linked = set(p.lower() for p in (linked_platforms or []))
    tw_text = "🐦 Twitter ✅" if "twitter" in linked else "🐦 Twitter"
    yt_text = "📺 YouTube ✅" if "youtube" in linked else "📺 YouTube"
    tt_text = "🎵 TikTok ✅" if "tiktok" in linked else "🎵 TikTok"
    ig_text = "📸 Instagram ✅" if "instagram" in linked else "📸 Instagram"

    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text=tw_text, callback_data="plat_twitter"),
                InlineKeyboardButton(text=yt_text, callback_data="plat_youtube"),
            ],
            [
                InlineKeyboardButton(text=tt_text, callback_data="plat_tiktok"),
                InlineKeyboardButton(text=ig_text, callback_data="plat_instagram"),
            ],
            [InlineKeyboardButton(text="🔙 Back to Menu", callback_data="back_to_menu")],
        ]
    )
