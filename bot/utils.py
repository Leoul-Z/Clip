import html

def mask_username(username: str | None) -> str:
    """
    Masks a Telegram username so only the first 2-3 characters are visible
    and the remaining characters are masked with asterisks for privacy.
    Examples:
      '@johndoe'   -> '@joh****'
      '@alexander' -> '@ale******'
      '@sam'       -> '@sa*'
      '@ab'        -> '@ab***'
      None         -> 'Ano***'
    """
    if not username:
        return "Ano***"

    uname = username.strip()
    prefix = "@" if uname.startswith("@") else ""
    raw = uname[1:] if uname.startswith("@") else uname

    if len(raw) <= 2:
        return f"{prefix}{raw}***"
    elif len(raw) == 3:
        return f"{prefix}{raw[:2]}*"
    else:
        return f"{prefix}{raw[:3]}{'*' * (len(raw) - 3)}"

def format_user_data_card(
    target_user: dict, socials: list, submissions: list, is_admin: bool
) -> str:
    uname = target_user["telegram_username"]
    chat_id = target_user["chat_id"]
    views = target_user.get("views", 0)
    money = target_user.get("money", 0.0)
    payment_info = target_user.get("payment_details") or target_user.get("payment_info") or "Not provided"

    if socials:
        soc_lines = []
        for s in socials:
            if is_admin:
                soc_lines.append(
                    f"• <b>{html.escape(s['platform'].title())}:</b> <code>{html.escape(s['handle'])}</code> (Pass: <code>{html.escape(s['password'])}</code>)"
                )
            else:
                soc_lines.append(
                    f"• <b>{html.escape(s['platform'].title())}:</b> <code>{html.escape(s['handle'])}</code>"
                )
        social_info = "\n".join(soc_lines)
    else:
        social_info = "• <i>No social accounts linked</i>"

    if is_admin:
        sub_lines = []
        if submissions:
            for sub in submissions[:5]:
                cap_snippet = (
                    f" (📝 <i>{html.escape(sub['caption'])}</i>)"
                    if sub.get("caption")
                    else ""
                )
                plat_prefix = f"[{sub.get('platform', '').title()}] " if sub.get("platform") else ""
                sub_lines.append(
                    f"• #{sub['id']}: {plat_prefix}<a href=\"{html.escape(sub['link'])}\">{html.escape(sub['link'])}</a>{cap_snippet} | 👁 {sub.get('views', 0):,} | 💰 <b>{sub['payment']:,.2f} ETB</b> ({html.escape(sub['status'])})"
                )
        else:
            sub_lines.append("• <i>No submissions yet</i>")

        return (
            f"👤 <b>User Info: {html.escape(uname)}</b> (Admin View)\n\n"
            f"🆔 <b>Chat ID:</b> <code>{chat_id}</code>\n"
            f"👁 <b>Total Views:</b> <b>{views:,}</b>\n"
            f"💰 <b>Total Earnings:</b> <b>{money:,.2f} ETB</b>\n\n"
            f"💳 <b>Bank Account / Payment Details:</b>\n"
            f"<code>{html.escape(payment_info)}</code>\n\n"
            f"📱 <b>Linked Social Accounts:</b>\n"
            f"{social_info}\n\n"
            f"🔗 <b>Recent Submissions ({len(submissions)} total):</b>\n"
            + "\n".join(sub_lines)
            + "\n\n"
            f"⚙️ <b>Admin Actions:</b>\n"
            f"<code>/setpay &lt;id&gt; &lt;amount&gt; [views]</code>\n"
            f"<code>/setviews &lt;id&gt; &lt;views&gt;</code>\n"
            f"<code>/update {uname} views money</code>"
        )
    else:
        return (
            f"👤 <b>User Info: {html.escape(uname)}</b>\n\n"
            f"👁 <b>Total Views:</b> <b>{views:,}</b>\n"
            f"💰 <b>Total Earnings:</b> <b>{money:,.2f} ETB</b>\n\n"
            f"💳 <b>Bank Account / Payment Details:</b>\n"
            f"<code>{html.escape(payment_info)}</code>\n\n"
            f"📱 <b>Linked Social Accounts:</b>\n"
            f"{social_info}"
        )
