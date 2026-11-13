# Етап 7 — app block на сторінці товару (2026-11-13)

`extensions/alongside-theme` (theme app extension, `shopify app generate extension --template theme_app_extension --flavor liquid`; демо «Star Rating» прибрано).

## Файли

- `blocks/product-offers.liquid` — блок «Add-on offers», `target: "content"`, `enabled_on: product`; налаштування — «Show product images». Бере `shop.metaobjects['$app:upsell_offer'].values`, показує активні пропозиції з `show_on_product`, де поточний товар — тригер. У редакторі теми без пропозицій — підказка.
- `snippets/alongside-offer.liquid` — картка пропозиції (спільна з app embed етапу 8): заголовок, до 3 add-on'ів, для кожного — нативна `<form action="/cart/add">` (працює без JS), ціна стара / нова, підпис знижки, `select` варіантів (з `data-compare` / `data-sale` для кожного), прихована властивість `_alongside_offer` = handle пропозиції.
- `assets/alongside.js` — **1,4 KB gzip** (3,5 KB raw); `assets/alongside.css` — 0,9 KB gzip.
- `locales/en.default.json` (тексти вітрини), `locales/en.default.schema.json` (редактор).

## Ключові рішення

- **Ціна в Liquid з метаоб'єкта** — без запитів до сервера застосунку, без зсуву макета (рендер на сервері). Відсоток: `price × (100 − p) / 100`, округлення до цента; сума: `price − amount`, не нижче 0.
- **Додавання через стандартні дії Shopify** (Spring '26, GA 17.06.2026): `Shopify.actions.updateCart({ lines: [{ merchandiseId, quantity: 1, attributes: [{ key: "_alongside_offer", … }] }] }, { event: { context } })`, далі `Shopify.actions.openCart()`. Тема сама оновлює свій кошик і отримує стандартні події — коду під Horizon / Dawn у застосунку немає. Без `Shopify.actions` форма просто відправляється (`/cart/add`). Помилки кошика (`userErrors`) показуються в `role="status"`.
- Делегування подій на `document` — працює і для форм, які тема перемальовує (кошик-шторка на етапі 8).
- `@shopify/events` у Horizon — це платформна бібліотека `https://cdn.shopify.com/storefront/standard-events.js`, а не модуль теми (з'ясовано по importmap у `Site-Shopify/theme/snippets/scripts.liquid`).

## Доступність

Секція з `aria-labelledby` на заголовок; кнопка «Add» з прихованим «Key Leash, 15% off» (дерево доступності: `button "Add"` у регіоні «Complete your setup»); ціни з прихованими «Regular price» / «Sale price»; `select` з `<label>` («Colour», «Colour / Size»); результат — `role="status"`; цілі 44 px; `:focus-visible`; перехід кольору лише без `prefers-reduced-motion`.

## Перевірка (Claude у Chrome користувача, 2026-11-13)

- Тема: **«Копия Ostiv»** (чернетка, id 190821597405, копію зробив користувач). Блок додано в Product information → Details, під «Buy buttons»; тему збережено. Жива тема не змінена.
- Превʼю Roll-Top: «Complete your setup» — Key Leash €19,00 → **€16,15**, Rain Cover €25,00 → **€21,25**, «15% off», вибір варіанта.
- `Shopify.actions` на сторінці є (`getCart`, `updateCart`, `openCart`), `alongside.js` завантажено.
- «Add» біля Key Leash → Horizon відкрив свою шторку, лічильник 3, Key Leash **€16,15** з «Complete your setup: 15% off», під формою «Added to cart.». У рядку — `_alongside_offer: roll-top-add-ons`. Ціна у блоці = ціна в кошику.
- Theme Check: 4 файли, без зауважень. ESLint — чисто.

## Відомі нюанси / на потім

- Заголовок блоку стилізовано нейтрально (жирний, без великих літер) — у Horizon заголовки секцій великими літерами; можна додати налаштування стилю.
- Усі варіанти Rain Cover мають однакову ціну, тож оновлення ціни при зміні варіанта на живих даних не видно (код відпрацював без помилок) — перевірити на e2e з товаром із різними цінами варіантів.
- Фіксована знижка рахується в валюті магазину (EUR); для інших валют Markets — не перевірено.
- У тестовому кошику користувача лишилися Rain Cover, Roll-Top і Key Leash.
