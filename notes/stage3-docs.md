# Етап 3 — звірка з документацією shopify.dev (2026-11-12)

Shopify CLI 5.0.1, шаблон React Router (`@shopify/shopify-app-react-router` 4.0.3). Нижче — що збігається з `PLAN.md`, що ні, і що з цього випливає.

## Discount Function

Джерело: [Discount Function API](https://shopify.dev/docs/api/functions/latest/discount), [Build a Discount Function](https://shopify.dev/docs/apps/build/discounts/build-discount-function).

- **API version** — `2026-10`. Таргет `cart.lines.discounts.generate.run` (збігається з планом). Другий таргет `cart.delivery-options.discounts.generate.run` (доставка) нам не потрібен — у `shopify.extension.toml` лишаємо лише cart lines.
- **Класи знижки** — Function отримує `discount.discountClasses` і має перевіряти, що `PRODUCT` увімкнено, перш ніж повертати `productDiscountsAdd`.
- **Операція** — `productDiscountsAdd { candidates, selectionStrategy }`; кандидат: `targets: [{ cartLine: { id, quantity } }]`, `value: { percentage: { value } } | { fixedAmount: { amount } }`, `message`. `quantity` на таргеті — саме те, що треба для правила «не більше одиниць, ніж тригерів».
- **Decimal — рядками** (`"15.0"`), JSON-числа поки парсяться, але контракт — рядок.
- **Конфіг** — `discount { metafield(namespace: "$app", key: "...") { jsonValue } }`. Якщо метаполя немає — повертати порожні `operations`.
- **Створення знижки** — `discountAutomaticAppCreate` з **`functionHandle`** (handle з `shopify.extension.toml`) замість `functionId` — з API 2025-10. Запит `shopifyFunctions` для пошуку ID не потрібен.
- **Збій** — якщо Function падає, Shopify відкидає її вивід і знижки просто немає (чекаут не блокується).
- **Ліміт** — до 25 активних discount functions (автоматичних знижок застосунків) на магазин; всі виконуються паралельно й не знають одна про одну.
- **Input query** — бюджет 30 балів; `field(key:)` на метаоб'єкті коштує 3 бали. Тому Function читає один JSON-метаполе знижки, а не метаоб'єкти.
- **Поява в пікері типу знижки / Sidekick** — опційно, таргети `admin.app.intent.link` з `type = "shopify/Discount"`. Без них знижки застосунку не видно в пікері типу знижки. Додати — дешево.

### ⚠ Розбіжність: мова Function

- План: «JavaScript (компілюється в Wasm)».
- Документація: JS/TS **підтримується** (Javy, `@shopify/shopify_function` ≥ 2.0.0), але Shopify пише «strongly recommends Rust»; JS — «для прототипів». JS швидше впирається в ліміт інструкцій (приклад Shopify: доставка — ~48 тис. інструкцій у Rust проти ~429 тис. у JS).
- Туторіали Shopify тепер **лише на Rust**. Rust на машині не встановлено (`cargo` немає).
- CLI досі генерує discount-шаблон з `--flavor typescript | vanilla-js | rust`.
- **Рішення (2026-11-12): TypeScript** (`--flavor typescript`). Кількість інструкцій виміряти й показати в README.

## Тести Function

Джерело: [Test and debug Shopify Functions](https://shopify.dev/docs/apps/build/functions/test-debug-functions), [`app function run`](https://shopify.dev/docs/api/shopify-cli/app/app-function-run).

- JS/TS: **Vitest** — юніт-тести напряму на функції з JSON-входом; інтеграційні тести з `@shopify/shopify-function-test-helpers` (`buildFunction`, `loadFixture`, `validateTestAssets`, `runFunction`) збирають Wasm і ганяють `tests/fixtures/*.json` (`export`, `target`, `input`, `output`). Це покриває план «фікстури входу → очікувані операції».
- `shopify app function run --input input.json --json` — вивід і **виміри інструкцій** (цифра для кейсу — реальна, виміряна).
- `shopify app function replay` і логи працюють **лише на development stores і Plus sandbox**. Логи Function тепер у виводі `shopify app dev` (CLI 5 прибрав `app logs`).

## Адмінка для знижки

Джерело: [Build a discounts UI with React Router](https://shopify.dev/docs/apps/build/discounts/build-ui-with-react-router?extension=javascript).

- Сторінки застосунку (не UI-extension): `app/routes/app.discount.$functionId.new.tsx`, `app.discount.$functionId.$id.tsx`; у `shopify.extension.toml` Function — `[extensions.ui.paths] create / details`, тоді «Create discount → Alongside» в адмінці відкриває форму застосунку.
- Мутації: `discountAutomaticAppCreate` / `discountAutomaticAppUpdate` з `metafields: [{ namespace, key, type: "json", value }]`.
- ⚠ У туторіалі адмінка пише в `$app:example-discounts--ui-extension`, а Function читає `$app` — у нас **один і той самий namespace в обох місцях**, покрити тестом.
- Компоненти — Polaris web components (`s-page`, `s-section`, `s-text-field`, `s-number-field`, `s-select`, `s-checkbox`, `s-banner`, `s-button`), вибір товарів — `shopify.resourcePicker` з App Bridge. Збігається з планом.
- Scopes з туторіалу: `write_discounts,read_products`.

## Theme app extension

Джерело: [Theme app extension configuration](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration).

- App block: **`"target": "content"`** (значення `section` застаріле). App embed: `"target": "body"`.
- Ліміти: JS, підключений через schema, — **10 KB стиснутого (рекомендовано)**, CSS — 100 KB, Liquid сумарно — 100 KB (жорстко), 30 блоків. Бюджет плану < 10 KB gzip збігається з рекомендацією Shopify.
- `"javascript"` / `"stylesheet"` у schema — файл підключається один раз на сторінку, навіть якщо блоків кілька.
- `available_if` — тільки boolean-метаполе застосунку; можна ховати блок, поки немає жодної пропозиції (опційно).
- App embed не має доступу до динамічних джерел; `content_for_header` / `content_for_layout` недоступні.

## Метаоб'єкти застосунку

Джерела: [Metaobjects](https://shopify.dev/docs/apps/build/metaobjects), [Liquid `metaobject_definition`](https://shopify.dev/docs/api/liquid/objects/metaobject_definition).

- Оголошення декларативно в `shopify.app.toml`: `[metaobjects.app.upsell_offer]`, `access.admin`, `access.storefront = "public_read"`, поля `[metaobjects.app.upsell_offer.fields.*]`; створюється на `shopify app deploy` / `app dev` — **окремий крок «створити визначення при встановленні» з плану не потрібен**.
- GraphQL-тип — `"$app:upsell_offer"`; записи — `metaobjectCreate` / `metaobjectUpdate` (upsert — перевірити при реалізації).
- Liquid: `shop.metaobjects["$app:upsell_offer"].values` — **цикл бачить не більше 50 записів**; з `publishable` — лише `active`. Для демо це не обмеження; у README записати як відоме обмеження.
- Шаблон уже має `write_metaobjects,write_metaobject_definitions` у scopes і приклад `[metaobjects.app.example]` — замінити на наш тип.

## Polaris web components

Джерело: [Versioning](https://shopify.dev/docs/api/app-home/latest/web-components/versioning).

- `@shopify/shopify-app-react-router` 4.x за замовчуванням вантажить **`polaris-2.js`** (Polaris 2.x); `@shopify/polaris-types` у шаблоні — `^2.0.0`. Нічого міняти не треба. Відкрите питання плану «1.x чи 2.x» — **2.x**.

## Що змінити в PLAN.md

1. Мова Function — TypeScript (вирішено).
2. Етап 4: визначення метаоб'єкта — декларативно в `shopify.app.toml`, а не при встановленні.
3. Знижка: **одна автоматична знижка застосунку на одну пропозицію** (`functionHandle`, JSON-метаполе `$app` / `function-configuration`). Так продавець бачить кожну пропозицію в розділі Discounts, керує датами й комбінуванням штатно. Обмеження — 25 активних знижок застосунків на магазин; у README.
4. App block — `target: "content"`.
5. `shopify app function replay` і логи — лише на dev store; **треба з'ясувати тип магазину Ostiv** (dev store чи платний / trial) і чи він в організації «Мой магазин».
