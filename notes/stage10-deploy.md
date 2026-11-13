# Етап 10 — деплой (2026-11-13)

## Що де

| Частина | Де | Як оновлювати |
|---|---|---|
| Адмінка (React Router) | Vercel, проєкт `alongside-shopify-app` (акаунт `elvaddy-lab`) → https://alongside-shopify-app.vercel.app | `npx vercel@65.15.0 deploy --prod` |
| Сесії магазину (Prisma) | Neon Postgres `neon-cerulean-cave` (Vercel Marketplace, Free) | `prisma migrate deploy` (виконується у `vercel-build`) |
| Discount Function, theme app extension, конфіг застосунку | Shopify (версії застосунку) | `shopify app deploy --config production` |

Поточна версія застосунку: **1.0.3** (Dev Dashboard → Alongside → Versions).

## Зміни в коді

- `react-router.config.ts` — `vercelPreset()` (`@vercel/react-router` 1.3.7), `ssr: true`.
- `vercel.json` — `framework: "react-router"`, `buildCommand: "npm run vercel-build"`. Без нього проєкт, створений `vercel link`, отримав пресет «Other» → усі адреси 404.
- `package.json`: `build` = `prisma generate && react-router build`; `vercel-build` = `prisma generate && prisma migrate deploy && react-router build`; `engines.node` = `22.x` (з `>=22.12` Vercel брав Node 26).
- Prisma: `postgresql`, `url = env("DATABASE_URL")` (пул Neon), `directUrl = env("DATABASE_URL_UNPOOLED")` (міграції). Шаблонну SQLite-міграцію замінено на `20261113000000_init` (Postgres).
- `shopify.app.production.toml` — той самий `client_id`, `application_url` і `redirect_urls` на Vercel, `automatically_update_urls_on_dev = false`. Розробка лишається на `shopify.app.toml` (`shopify app dev` + тунель).
- `.vercelignore` — `.env*`, `e2e/.auth/`, локальні артефакти не вивантажуються.

## Змінні оточення

- Vercel production: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` (sensitive), `SCOPES`, `SHOPIFY_APP_URL` — скопійовано з `shopify app env show` скриптом без виводу значень; `DATABASE_URL`, `DATABASE_URL_UNPOOLED` та ін. — інтеграція Neon.
- Локально: `.env` (лише `DATABASE_URL*` для Prisma), `.env.local` (від `vercel link`) — обидва в `.gitignore`. Локальний `app dev` зараз пише сесії в ту саму базу Neon — для демо прийнятно; для справжнього проєкту — окрема гілка Neon для розробки.

## Перевірки

- `/` → 200; `/app` поза адмінкою → 410 (очікувано); вебхук без підпису → 400 (HMAC).
- Адмінка в Shopify Admin вантажиться з `alongside-shopify-app.vercel.app`; сесія створюється в Neon (`Creating new session` у логах Vercel).
- Пропозицію «Roll-Top add-ons» створено через продакшн-адмінку (Roll-Top → Key Leash, Rain Cover, 15 %); у Discounts — «Alongside · Roll-Top add-ons», активна, тип «Alongside add-on offer».
- Блок і вбудування заново додано в «Копия Ostiv» і «Dawn - Alongside test».
- **E2E на випущеній версії 1.0.3** (Function і розширення теми з релізу, адмінка на Vercel): **Horizon 7/7, Dawn 7/7 — обидва з першого прогону** (+ `auth`), включно з кошиком, фокусом, axe і чекаутом (€21.25 і €16.15 з «Complete your setup: 15% off»).

## Пастки (записати в README)

1. **`shopify app dev clean` після випуску версії на тому самому магазині** прибирає разом із dev-превʼю все, що під ним створювалось: визначення метаоб'єкта, знижки, а блоки тем лишаються з посиланнями на неіснуючі ідентифікатори розширення («app block path … does not exist»). Повторні `shopify app deploy` відновили визначення лише частково (деплой застосовує різницю з попередньою версією, а не стан магазину): без частини полів. **Вихід — перевстановити застосунок** (Settings → Apps → видалити → `admin.shopify.com/store/<store>/oauth/install?client_id=…`): визначення створюються з версії повністю.
2. Після перевстановлення Shopify **повернув старий метаоб'єкт** (дані застосунку зберігаються тимчасово після видалення) з `discount_id` на знижку, якої вже немає — пропозиція «активна», але без знижки на чекауті. Її видалено через адмінку й створено заново.
3. Vercel CLI `link` створив проєкт з пресетом «Other» — потрібен `vercel.json` з `framework`.

## Знайдено на продакшні й виправлено

- **Форма губила вибрані товари при повторному збереженні** після будь-якої помилки сервера: прихований `<input type="hidden" defaultValue>` React перезаписував при ре-рендері (для hidden-полів value і defaultValue — один атрибут). Тепер поле контрольоване (`value` зі стану). Перевірено: після «Enter a value above 0» товари доходять до сервера.
- **Видалення пропозиції, чия знижка вже зникла**, показувало помилку «Automatic discount does not exist» і повертало рядок у списку. Тепер «не існує» при видаленні не вважається помилкою.
