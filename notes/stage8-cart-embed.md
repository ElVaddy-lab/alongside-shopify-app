# Етап 8 — app embed у кошику (2026-11-13)

## Як працює

- `blocks/cart-offers.liquid` — app embed «Add-on offers in cart» (`target: "body"`). Кожна пропозиція з `show_in_cart` рендериться один раз у неактивний `<template data-triggers="…">` тим самим сніпетом `alongside-offer` (ціни — з метаоб'єкта). Налаштування: «Show product images», «Cart form selector (other themes)».
- `storefront/alongside.js` (джерело) → `npm run build:storefront` (esbuild, мініфікація) → `extensions/alongside-theme/assets/alongside.js` (**4,6 KB raw / 2,0 KB gzip**). Збірка запускається й перед `npm run dev`. Причина: Theme Check рахує **сирий** розмір (`AssetSizeAppBlockJavaScript`, поріг 10 000 B), джерело з коментарями було 10,4 KB.
- Скрипт читає `/cart.js` і вставляє після форми кошика пропозиції, чий тригер у кошику; add-on'и, які вже в кошику, приховані. Місця вставки за замовчуванням:
  - Horizon: `cart-items-component form.cart-form` (шторка й сторінка кошика);
  - Dawn: `cart-drawer-items #CartDrawer-Form` (шторка), `cart-items form#cart` (сторінка).
  - Інші теми — CSS-селектор у налаштуваннях вбудування.
- Теми перемальовують кошик після кожної зміни → вставка зникає → `MutationObserver` повертає її зі свіжим `/cart.js`. Без подій конкретних тем; плюс слухач стандартної події `shopify:cart:lines-update`. Коли пропозиції немає — лишається прихований порожній маркер, щоб спостерігач не тягнув кошик на кожну зміну DOM.
- Додавання з кошика — `Shopify.actions.updateCart` з `context: "cart"` (без `openCart`).

## Доступність кошика

- У кошику заголовок пропозиції — `h3` (h2 — заголовок кошика).
- Після «Add» кнопка зникає разом із перемальовкою кошика. Фокус повертається **в той самий кошик**, з якого додали (шторка або сторінка): на рядок статусу пропозиції, якщо вона лишилась, інакше — на форму кошика (новий рядок угорі). Повернення — протягом 2,5 с, поки тема дорендерює; лише після реальної зміни кошика (стандартні події приходять на старті зміни).
- «Added to cart.» озвучується в статусі пропозиції або в постійній прихованій `role="status"` області, якщо пропозиції вже немає.
- Знайдені й виправлені вади: (1) фокус падав на `body` після перемальовки Horizon; (2) на `/cart` у Dawn код фокусував форму прихованої шторки (`visibility: hidden` → фокус не ставиться) — тепер береться видимий елемент того кошика, де натиснули (`checkVisibility`).
- CSS переведено з `rem` на `em`: Dawn має `html { font-size: 62.5% }`, і `1rem` = 10 px робив блок дрібним.

## Налаштування магазину (Claude у Chrome користувача)

- **«Копия Ostiv»** (Horizon, id 190821597405): увімкнено вбудування Alongside; вимкнено власний upsell теми (Theme settings → Cart → Upsell → «Suggest a product in the cart»). Жива тема не змінена.
- **«Dawn - Alongside test»** (Dawn 16.0.0 з `Site-Shopify/dawn-reference`, `shopify theme push --unpublished`, id 190821794013): вбудування ввімкнено, блок «Add-on offers» на шаблоні товару, Cart type → Drawer.

## Перевірка (2026-11-13, пропозиція Roll-Top → Rain Cover + Key Leash, −15 %)

| Тема | Де | Пропозиція | Add → кошик | Фокус після Add | Озвучення |
|---|---|---|---|---|---|
| Horizon | шторка | після `form#cart-form`, лише Key Leash (Rain Cover уже в кошику) | Key Leash €16,15, `_alongside_offer` | `form#cart-form` у шторці | «Added to cart.» |
| Horizon | `/cart` | після `form#cart-form` | Key Leash €16,15 | `form#cart-form` | «Added to cart.» |
| Dawn | товар → шторка | блок на Roll-Top з тими ж цінами; `Shopify.actions` оновив і відкрив шторку Dawn | Rain Cover €21,25 | — | «Added to cart.» |
| Dawn | шторка | після `#CartDrawer-Form` | Key Leash €16,15 | `#CartDrawer-Form` | «Added to cart.» |
| Dawn | `/cart` | після `form#cart` | Key Leash €16,15 | `form#cart` (через ~150 мс після перемальовки) | «Added to cart.» |

- Старий upsell Ostiv на копії не відображається (`ostiv-cart-upsell` відсутній).
- Theme Check: 5 файлів, без зауважень. ESLint, typecheck, `npm test` (21/21) — чисто.

## На потім

- E2E (Playwright) на обох темах — етап 9; там же axe і Lighthouse до / після.
- Кошик користувача після тестів: Key Leash, Rain Cover, Roll-Top.
