# RATEFLOW

Математическая система оценки фильмов, сериалов и игр.

## Стек

- **Next.js 14** (App Router) + TypeScript
- **MongoDB** + Mongoose
- **NextAuth.js** (JWT)
- **Framer Motion** + Tailwind CSS
- **TMDB API** — фильмы и сериалы
- **RAWG API** — игры

## Быстрый старт

### 1. Установка зависимостей

```bash
npm install
```

### 2. Получение API ключей

**TMDB (фильмы + сериалы):**
1. Зарегистрируйся на https://www.themoviedb.org/signup
2. Settings → API → Create → Developer
3. Скопируй **API Read Access Token** (длинный Bearer token)

**RAWG (игры):**
1. Зарегистрируйся на https://rawg.io/apidocs
2. Нажми "Get API Key"

### 3. Настройка окружения

```bash
cp .env.local.example .env.local
```

Заполни `.env.local`:

```env
MONGODB_URI=mongodb+srv://...
NEXTAUTH_SECRET=случайная-строка-32-символа
NEXTAUTH_URL=http://localhost:3000
TMDB_TOKEN=eyJ...
RAWG_API_KEY=...
```

Для `NEXTAUTH_SECRET` можно сгенерировать:
```bash
openssl rand -base64 32
```

### 4. Запуск

```bash
npm run dev
```

Открой http://localhost:3000

## Деплой на Render.com

1. Создай новый **Web Service** → подключи GitHub репо
2. Build Command: `npm install && npm run build`
3. Start Command: `npm start`
4. Добавь все переменные из `.env.local` в Environment Variables
5. Измени `NEXTAUTH_URL` на URL твоего сайта

## Система оценки

### Игры (макс. 110)
| Критерий | Множитель |
|---|---|
| Геймплей, Механики и Боевая система | ×1.3 |
| Сюжет, Нарратив и Сценарная структура | ×1.3 |
| Техническое исполнение | ×1.1 |
| Левелдизайн и Лор | ×1.2 |
| Режиссура и Постановка | ×1.1 |
| Саундтрек и Звук | ×1.0 |
| Арт-дизайн | ×1.0 |
| Темп и Плотность контента | ×1.0 |
| Цельность и Качество финала | ×1.0 |
| Влияние на индустрию | ×1.0 |

### Фильмы и Сериалы (макс. 110)
| Критерий | Множитель |
|---|---|
| Сценарий, Сюжет и Логика | ×1.3 |
| Развитие персонажей и Актёрская игра | ×1.3 |
| Атмосфера и Мироустройство | ×1.2 |
| Production Value | ×1.1 |
| Режиссура, Камера и Монтаж | ×1.1 |
| Саундтрек | ×1.0 |
| Темп и Бинж-фактор | ×1.0 |
| Кастинг | ×1.0 |
| Цельность и Финал | ×1.0 |
| Культурное влияние | ×1.0 |

Формула: `сумма(оценка × множитель)`, оценка от 1 до 10.
