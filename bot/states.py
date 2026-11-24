from aiogram.fsm.state import State, StatesGroup

class BotStates(StatesGroup):
    waiting_for_username = State()
    main_menu = State()
    entering_handle = State()
    entering_password = State()
    entering_payment = State()
    entering_submission_link = State()
    selecting_submission_account = State()
    entering_submission_caption = State()
    inspecting_user = State()
