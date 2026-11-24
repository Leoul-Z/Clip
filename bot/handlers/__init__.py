from aiogram import Dispatcher, F
from aiogram.filters import Command
from bot.handlers.admin import (
    info_command,
    rates_command,
    set_pay_command,
    set_views_command,
    update_stats_command,
)
from bot.handlers.menu import menu_callback_router
from bot.handlers.payment import process_payment_info
from bot.handlers.registration import (
    platform_selected,
    process_handle,
    process_password,
)
from bot.handlers.start import process_username, start_command
from bot.handlers.submissions import (
    process_submission_caption,
    process_submission_link,
    submission_account_selected,
)
from bot.middlewares import UsernameLockMiddleware
from bot.states import BotStates

def register_all_handlers(dp: Dispatcher):
    # Middlewares
    dp.message.outer_middleware(UsernameLockMiddleware())
    dp.callback_query.outer_middleware(UsernameLockMiddleware())

    # Commands
    dp.message.register(start_command, Command("start"))
    dp.message.register(update_stats_command, Command("update"))
    dp.message.register(set_pay_command, Command("setpay"))
    dp.message.register(set_views_command, Command("setviews"))
    dp.message.register(info_command, Command("info"), Command("user"))
    dp.message.register(rates_command, Command("rates"))

    # FSM Message Handlers
    dp.message.register(process_username, BotStates.waiting_for_username)
    dp.message.register(process_handle, BotStates.entering_handle)
    dp.message.register(process_password, BotStates.entering_password)
    dp.message.register(process_payment_info, BotStates.entering_payment)
    dp.message.register(process_submission_link, BotStates.entering_submission_link)
    dp.message.register(process_submission_caption, BotStates.entering_submission_caption)

    # Callbacks
    dp.callback_query.register(
        menu_callback_router,
        F.data.startswith("menu_")
        | F.data.startswith("pay_")
        | (F.data == "back_to_menu")
        | (F.data == "sub_new"),
    )
    dp.callback_query.register(platform_selected, F.data.startswith("plat_"))
    dp.callback_query.register(submission_account_selected, F.data.startswith("subacc_"))
