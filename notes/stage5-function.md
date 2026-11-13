# Етап 5 — Discount Function (2026-11-13)

`extensions/alongside-discount` — згенеровано `shopify app generate extension --template discount --flavor typescript`, далі переписано тестами наперед.

## Що робить

- Таргет лише `cart.lines.discounts.generate.run` (доставку прибрано), API `2026-10`.
- Вхід: рядки кошика (`id`, `quantity`, `merchandise → ProductVariant.product.id`), `discount.discountClasses`, `discount.metafield(namespace: "$app", key: "function-configuration").jsonValue`.
- Конфіг (одна пропозиція = одна знижка):

```json
{
  "triggerProductIds": ["gid://shopify/Product/…"],
  "offerProductIds": ["gid://shopify/Product/…"],
  "discountType": "percentage",
  "discountValue": "15.0",
  "message": "Add-on offer: 15% off"
}
```

- Правило: **кожен запропонований товар знижується щонайбільше на стільки одиниць, скільки одиниць тригерів у кошику** (1 рюкзак → 1 чохол і 1 дощовик; 2 рюкзаки + 3 чохли → знижка на 2 чохли). Ліміт ділиться між рядками одного товару (різні варіанти).
- Вихід: один `productDiscountsAdd` з одним кандидатом; `percentage { value }` або `fixedAmount { amount, appliesToEachItem: true }`; Decimal — рядком; `selectionStrategy: FIRST`.
- Без знижки (`operations: []`), якщо: немає класу PRODUCT; немає / зламаний конфіг; невідомий тип; значення ≤ 0 або відсоток > 100; немає тригера; немає товару-пропозиції.
- «Пропозиція вимкнена» і «кілька пропозицій на один товар» — на рівні знижок Shopify: вимкнена пропозиція = деактивована знижка (Function не запускається); кожна пропозиція — окрема знижка, комбінування вирішують налаштування знижки.

## Тести (`npm test` у папці розширення) — 17 / 17

- **13 юніт-тестів** (Vitest, `tests/cart_lines_discounts_generate_run.test.ts`): спершу RED на заглушці (7 падали через відсутність знижки), потім GREEN. 6 «захисних» тестів перевірено мутаціями: вимкнення кожної перевірки в коді (клас PRODUCT, межа відсотка, тригер, тип знижки) ламає свій тест.
- **4 Wasm-фікстури** (`tests/fixtures/*.json`, `@shopify/shopify-function-test-helpers`): збирають справжній `function.wasm`, валідують вхід / вихід за схемою й порівнюють результат. Перевірено, що зіпсований очікуваний вихід дає червоний тест.

## Виміри (`shopify app function run --json`, 2026-11-13)

| Вхід | Інструкцій | % від ліміту 11 млн |
|---|---|---|
| 3 рядки, знижка застосовується | 439 848 | 4,0 % |
| 3 рядки, тригер + 2 пропозиції, фіксована сума | 470 337 | 4,3 % |
| 1 рядок, тригера немає | 274 202 | 2,5 % |
| 200 рядків, ранній вихід (немає класу PRODUCT) | 4 546 697 | 41 % |
| 200 рядків, жодного збігу | 5 473 158 | 50 % |
| 200 рядків, 20 тригерів + 40 рядків-пропозицій | 7 581 838 | 69 % |

- Розмір `function.wasm` — **3,7 KB** (ліміт 256 KiB).
- Ліміти — [Function APIs](https://shopify.dev/docs/api/functions/latest): 11 млн інструкцій, вхід 128 kB, вихід 40 kB для кошиків до 200 рядків.
- **Висновок для README:** ~4,5 млн з 200-рядкового кошика — фіксована ціна JS-рантайму (Javy) на розбір входу, ще до логіки. Для звичайних кошиків запас великий; для B2B-кошиків на сотні рядків варто переписати на Rust (саме це Shopify й радить). Це чесний компроміс TypeScript, не вигадка.

## Інше

- `app dev` після нового розширення треба перезапустити (`Error loading new extension … Please restart the process`).
- Функція видна в магазині: `shopifyFunctions` → «Alongside add-on offer», handle `alongside-discount`, apiType `discount`.
- ESLint: `extensions/*/tests/**` отримали `env: node` (згенерований `default.test.js` використовує `__dirname`).
- Живу перевірку на кошику Ostiv зробимо на етапі 6, коли адмінка створюватиме знижку (`discountAutomaticAppCreate` з `functionHandle: "alongside-discount"` і метаполем `$app` / `function-configuration`).
