# Етап 6 — адмінка (2026-11-13)

## Що зроблено

- **Список** `app/routes/app._index.tsx`: порожній стан (`s-empty-state`) з «Create offer»; таблиця (`s-table`) — назва + заголовок, тригер, add-on'и, знижка, статус (`s-badge`); «Turn on / off» і «Delete» через `useFetcher` з оптимістичним станом; видалення — через `s-modal` з підтвердженням (незворотне). Тост «Offer saved» після збереження.
- **Форма** `app/routes/app.offers.$id.tsx` (`new` або GID метаоб'єкта): нативна `<form data-save-bar>` → контекстна панель збереження Shopify; поля Polaris web components з `name` + `defaultValue`; помилки біля полів і банер для помилок API; кнопка «Save offer» внизу дублює панель.
- **Вибір товарів** `app/components/ProductPicker.tsx`: `shopify.resourcePicker({ type: "product", multiple, selectionIds, filter: { variants: false } })`; вибір у прихованому `<input>` (JSON GID), подія `input` для панелі збереження, «Discard» повертає збережений список.
- **Модель** `app/models/offer.ts` (чиста, з тестами) і **шар Shopify** `app/models/offers.server.ts` (GraphQL).

## Як зберігається пропозиція

- Створення: спершу `discountAutomaticAppCreate` (`functionHandle: "alongside-discount"`, `discountClasses: [PRODUCT]`, метаполе `$app` / `function-configuration`), потім `metaobjectCreate` з `discount_id`. Якщо метаоб'єкт не створився — знижка видаляється (без «сиріт»).
- Редагування: `discountAutomaticAppUpdate` (метаполе з namespace + key оновлюється — перевірено) → `metaobjectUpdate`.
- Увімк. / вимк.: `discountAutomaticActivate` / `Deactivate` (вимкнена знижка має статус `EXPIRED`) + статус публікації метаоб'єкта ACTIVE / DRAFT.
- Видалення: `discountAutomaticDelete` + `metaobjectDelete`.
- Назва знижки в Shopify Discounts: «Alongside · <назва>». Повідомлення в кошику й на чекауті: «<заголовок>: 15% off» / «<заголовок>: €4.00 off».
- `combinesWith`: з order- і shipping-знижками — так; з іншими product-знижками — ні (інакше ціна add-on'а відрізнялася б від обіцяної). У README — як рішення.

## Тести й перевірки

- `npm test` (корінь): **21 / 21** тест моделі — розбір і валідація форми, підпис знижки, повідомлення, JSON для Function, вхід знижки, поля метаоб'єкта туди й назад. Спершу RED (20 «not implemented»), потім GREEN; мутаціями перевірено перетин тригер/add-on, дві десяткові в сумі, `combinesWith`.
- **Контрактний тест**: `functionConfig()` з адмінки проходить `parseConfig()` самої Function без змін — ціна у віджеті й на чекауті з одного джерела.
- **Живий цикл через API** (тимчасовий скрипт у scratchpad, справжній `offers.server.ts` проти Ostiv через GraphiQL-проксі CLI): create → list → update (15 % → €4) → off → on → delete, після — магазин чистий.
  - Знахідка: Shopify зберігає `number_decimal` канонічно (`"4.00"` → `"4.0"`); додано тест і нормалізацію при читанні.
- **Через інтерфейс** (користувач, 2026-11-13): пропозиція «Roll-Top add-ons» — Roll-Top → Rain Cover + Key Leash, 15 %. Кошик і чекаут Ostiv: Rain Cover €25,00 → **€21,25**, рядок «COMPLETE YOUR SETUP: 15% OFF (−€3.75)», Roll-Top за повною ціною, разом €170,25.
- Логи `app dev`: Function на реальному кошику — **0,288 млн** інструкцій (кошик лише з Rain Cover) і **0,410 млн** (Roll-Top + Rain Cover). Цей вхід збережено як фікстуру `ostiv-cart-roll-top-rain-cover.json` → тести Function **18 / 18**.

## Інше

- Генератор розширення побачив шаблонний `pnpm-workspace.yaml` і перевстановив `node_modules` через pnpm. Файл прибрано, залежності перевстановлено npm (866 пакетів); у корені — `vitest` і `npm test`, окремий `vitest.config.ts` (без плагіна React Router).
- У кошику Ostiv поруч видно власний upsell теми («Pairs well with») — вимкнути на копії теми на етапі 8.
- Вбудований браузер Claude не має доступу до Shopify Admin (сайт не схвалено, потрібен вхід користувача) — інтерфейс перевіряє користувач.
