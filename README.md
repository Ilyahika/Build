# Viva — рыбацкий клуб (Telegram Mini App)

Сервер: FastAPI + aiogram + SQLite. Страницу и API отдаёт один сервис на Render.

## Что есть
* Экран загрузки Viva с анимацией; при проблемах на нём же выводится диагностика (какой шаг сломался).
* Главный экран: «Технические работы». Меню снизу: Рыбалка, Снасти, Рюкзак, Настройки (+ «Админ» для администратора).
* Верхняя панель: слева аватар с уровнем, справа баланс в рублях.
* Настройки: аватар и ник. Админ-панель: игроки, рассылка, журнал, проверка БД.

## Render
* Build: `pip install -r requirements.txt`
* Start: `uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1`
* Environment: `BOT_TOKEN` (токен ТОГО бота, из которого открываешь приложение), `WEBAPP_URL` (адрес сервиса на Render, https://…), `ADMIN_ID`, по желанию `DB_PATH`, `PYTHON_VERSION=3.12.8`.
* Проверка: `https://<сервис>.onrender.com/health` → `{"status":"ok",...}`.

## Файлы
main.py · config.py · db.py · auth.py · botapp.py · buildhouse.py (профиль/ник/аватар) · admin.py · catalog.py · index.html (загрузчик) · app.js · admin.js · style.css
