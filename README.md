# Угадай цифру

Новогодний корп-интерактив: ведущий загадывает число, гости угадывают с телефона, экран зала показывает таймер, живую визуализацию ответов и топ-3 ближайших.

## Запуск

Рабочее приложение — папка `next-app/` (Next.js + Postgres / локальный PGlite).

```bash
cd next-app
npm install
env -u DATABASE_URL npm run dev
```

Откройте http://127.0.0.1:3000

## Роли

1. **Ведущий** — «Создать раунд»: вопрос, правильный ответ, компания, обложка, таймер. QR для гостей + ссылка экрана зала.
2. **Гость** — имя + цифра (нужен QR/ключ от ведущего).
3. **Экран зала** — крупный вопрос, таймер, гистограмма/облако, финал топ-3.

## Публикация

Cursor Cloud Apps → папка `next-app`, видимость **Public**. Нужна Postgres (`cursor-app.json`). Токены ведущего/экрана не в query: экран — `#s=…`, хост — Bearer / sessionStorage.

## Бренд

Лого: `brand/logo.png` (и `next-app/public/brand/logo.png`). Instagram в футере: [@st.shmidt](https://www.instagram.com/st.shmidt?mdxt=emx1MzR3dmN0MmZx&utm_source=qr).
