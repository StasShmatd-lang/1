# Угадай цифру

Новогодний корп-интерактив: ведущий собирает банк фактов (вопрос + число), гости угадывают с телефона, экран зала показывает таймер, гистограмму/облако и топ-3 ближайших.

## Запуск

Рабочее приложение — папка `next-app/` (Next.js + Postgres / локальный PGlite).

```bash
cd next-app
npm install
env -u DATABASE_URL npm run dev
```

Откройте http://127.0.0.1:3000

## Роли

1. **Ведущий** — банк фактов (ручной ввод + paste `вопрос | число`), QR гостей, ссылка экрана. Старт только из сохранённого факта.
2. **Гость** — имя + цифра (QR/ключ от ведущего).
3. **Экран зала** — edge-to-edge вопрос, таймер, гистограмма/облако, финал топ-3.

## Публикация

Cursor Cloud Apps → папка `next-app`, slug `guess-digit`, видимость **Public**. Postgres через `cursor-app.json`. Токены: экран `#s=…`, хост Bearer / sessionStorage.

Live: https://guess-digit.apps.grok.bot

## Бренд

Лого: `brand/logo.png` (и `next-app/public/brand/logo.png`). Instagram в футере: [@st.shmidt](https://www.instagram.com/st.shmidt?mdxt=emx1MzR3dmN0MmZx&utm_source=qr).
