# Етап 4 — модель даних (2026-11-13)

## Де що зберігається

| Дані | Де | Хто пише | Хто читає |
|---|---|---|---|
| Пропозиція (offer) | метаоб'єкт `$app:upsell_offer` у Shopify | адмінка | Liquid (app block, app embed) |
| Ціна пропозиції для чекауту | JSON-метаполе на автоматичній знижці застосунку | адмінка (з тієї ж форми) | Discount Function |
| Сесія магазину (OAuth-токен) | Prisma → таблиця `Session` | бібліотека Shopify | сервер застосунку |

Власної таблиці пропозицій у БД **немає**: джерело правди — Shopify. Вітрина й чекаут працюють, навіть коли сервер застосунку спить. Prisma лишається тільки для сесій (схема шаблону без змін); журнал подій — у «Пізніше» (звіт).

## Метаоб'єкт `$app:upsell_offer`

Оголошено в `shopify.app.toml`, CLI створює/оновлює визначення сам (`app dev` / `app deploy`). У магазині тип розгортається в `app--446739578881--upsell_offer`; у коді завжди `$app:upsell_offer`.

- `access.admin = merchant_read_write`, `access.storefront = public_read`.
- `capabilities.publishable = true` — **увімкнено / вимкнено = active / draft**. Liquid-цикли повертають лише active.
- `display_name_field = "title"`.

| Поле | Тип | Обов'язкове | Валідація |
|---|---|---|---|
| `title` | single_line_text_field | так | — |
| `heading` | single_line_text_field | так | — |
| `trigger_products` | list.product_reference | так | `list.min` 1 |
| `offer_products` | list.product_reference | так | `list.min` 1, `list.max` 3 |
| `discount_type` | single_line_text_field | так | `choices` percentage / fixed_amount |
| `discount_value` | number_decimal | так | `min` 0 |
| `show_on_product` | boolean | ні | — |
| `show_in_cart` | boolean | ні | — |
| `discount_id` | single_line_text_field | ні | заповнює застосунок (GID знижки) |

Перевірено запитом `metaobjectDefinitionByType(type: "$app:upsell_offer")` на Ostiv — усі поля й валідації на місці.

## Рішення й обмеження

- **Тригер — лише товари** (`trigger_products`). Колекції як тригер — у «Пізніше»: у Function це потребує `inAnyCollection` зі змінними вхідного запиту, а в Liquid — інший шлях перевірки. Для демо достатньо товарів.
- **Відсоток 0–100** перевіряє форма адмінки (у валідації метаоб'єкта тільки `min 0`, бо те саме поле зберігає й фіксовану суму).
- **Одна пропозиція = одна автоматична знижка застосунку**; `discount_id` пов'язує їх. Вимкнення пропозиції = draft-метаоб'єкт + деактивована знижка (етап 6).
- Формат JSON для Function фіксується тестами на етапі 5.

## Що прибрано з шаблону

- Маршрути `app.additional.tsx`, `webhooks.products.update.tsx`; демо «Generate a product» на головній (тепер — заглушка «Upsell offers»).
- У `shopify.app.toml`: метаполе `demo_info`, метаоб'єкт `example` (у магазині видалено — перевірено), подію `product-price-change`, scope `write_products`.

## Що додано / змінено

- Scopes: `read_products, write_discounts, write_metaobject_definitions, write_metaobjects` (видано автоматично на dev store).
- Admin API `2026-10` скрізь (`shopify.server.ts`, `.graphqlrc.ts`, вебхуки).
- Обов'язкові вебхуки приватності → один маршрут `webhooks.compliance.tsx` (HMAC перевіряє `authenticate.webhook`; даних покупців застосунок не зберігає).
- `tsconfig.json`: `@shopify/app-bridge-types` у `types` — типи `<s-app-nav>` раніше приходили лише через імпорт у демо-коді.
- Зміни `shopify.app.toml` застосовуються **лише після перезапуску** `shopify app dev`.
