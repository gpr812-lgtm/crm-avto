# CRM Extracted Specification

> **Источник:** `/home/z/my-project/upload/crm_code.html` (2982 строки, ~170KB)
> **Версия данных в localStorage:** `v32`
> **Назначение:** Документ для миграции CRM в Next.js приложение
> **Дата извлечения:** 2026

---

## Содержание

1. [Обзор системы](#1-обзор-системы)
2. [A. Структура данных (localStorage)](#a-структура-данных-localstorage)
3. [B. Вкладки UI](#b-вкладки-ui)
4. [C. Основные функции](#c-основные-функции)
5. [D. Шаги формы сделки](#d-шаги-формы-сделки)
6. [E. Колонки таблиц](#e-колонки-таблиц)
7. [F. Особенности бизнес-логики](#f-особенности-бизнес-логики)
8. [G. Цветовая схема и дизайн](#g-цветовая-схема-и-дизайн)
9. [H. Внешние зависимости](#h-внешние-зависимости)

---

## 1. Обзор системы

**CRM «Отдел продаж»** — одностраничное HTML-приложение для автомобильного дилерского центра. Управляет складом сделок (продаж/отказов), трафиком по моделям, план-фактом по каналам привлечения, аналитикой и календарём. Данные хранятся в `localStorage` (15 ключей с суффиксом `_v32`). Без серверной части.

**Заголовок приложения:** `🚗 CRM Отдел продаж` / `Управление сделками и аналитика`

**Технологии:** чистый HTML + CSS + ванильный JavaScript, единственная внешняя библиотека — **XLSX.js 0.18.5** (SheetJS) для импорта/экспорта Excel.

---

## A. Структура данных (localStorage)

Все ключи в localStorage имеют суффикс `_v32`. Версия бэкапа: `'32'`.

### A.1. `crm_data_sklad_v32` → `tabsState.sklad.data`

Массив объектов сделок. **Главная сущность системы.**

**Поля:**

| Поле | Тип | Описание |
|---|---|---|
| `id` | `number` (Date.now()) | Уникальный идентификатор |
| `model` | `string` | Модель автомобиля (select) |
| `status` | `'Продан' \| 'Склад' \| 'Отказ'` | Статус сделки |
| `dateDkp` | `string` (YYYY-MM-DD) | Дата ДКП |
| `dateIssued` | `string` (YYYY-MM-DD) | Дата выдачи |
| `seller` | `string` | Продавец |
| `client` | `string` | ФИО клиента |
| `jok` | `number` | ЖОК (сумма) |
| `j` | `number` | Ж |
| `o` | `number` | О |
| `k` | `number` | К |
| `risk` | `string` ('1'..'5') | РИСК |
| `kr` | `string` ('0' \| '1') | КР |
| `ti` | `string` ('0' \| '1' \| '2') | ТИ |
| `review` | `string` | Отзыв |
| `traffic` | `string` | Трафик |
| `comment` | `string` | Комментарий |

**Пример записи (из seed):**
```json
{
  "id": 2,
  "model": "Tenet T7",
  "status": "Продан",
  "dateDkp": "2026-06-01",
  "dateIssued": "2026-06-01",
  "seller": "Мелузов Евгений",
  "client": "Матюнин Андрей Валентинович",
  "jok": 162541,
  "j": -19746,
  "o": 0,
  "k": 182287,
  "risk": "1",
  "kr": "1",
  "ti": "1",
  "review": "Нет отзыва",
  "traffic": "📞 Звонок",
  "comment": "Выдана"
}
```

**Default seed (5 записей)** — функция `getDefaultSkladData()` (строки 693–701 исходника). См. [раздел Default Data](#default-data).

---

### A.2. `crm_cols_sklad_v32` → `tabsState.sklad.columns`

Массив описаний колонок таблицы Склад.

**Поля:**

| Поле | Тип | Описание |
|---|---|---|
| `key` | `string` | Ключ поля в данных |
| `label` | `string` | Заголовок колонки |
| `type` | `'text' \| 'number' \| 'date' \| 'url' \| 'select'` | Тип данных |
| `options` | `string` | (только для select) имя ключа в `selectOptions` |
| `default` | `any` | Значение по умолчанию |
| `width` | `number` | Ширина колонки в px |

Подробнее см. [раздел E. Колонки таблиц](#e-колонки-таблиц).

---

### A.3. `crm_select_options_v32` → `selectOptions`

Объект с опциями для всех select-колонок. Структура:

```json
{
  "model": ["Arrizo 8", "Tenet T4", "Tenet T4L", "Tenet T7", "Tenet T8"],
  "status": ["Продан", "Склад", "Отказ"],
  "seller": ["Лавреев Сергей", "Мелузов Евгений", "Буц Виктория", "Алексеев Владимир", "Даниленко Сергей", "Коваленко Павел"],
  "review": ["Нет отзыва", "Яндекс карты", "2ГИС", "Рекомендация"],
  "traffic": ["🚶 Визит", "📞 Звонок", "📝 Заявка", "👥 Рекомендация"],
  "risk": ["1", "2", "3", "4", "5"],
  "kr": ["0", "1"],
  "ti": ["0", "1", "2"]
}
```

Также может содержать пользовательские списки с ключом вида `custom_<timestamp>`.

---

### A.4. `crm_traffic_v32` → `trafficData`

Данные трафика по дням/моделям. Ключ верхнего уровня — месяц в формате `YYYY-MM`.

**Структура:**
```json
{
  "2026-06": {
    "Tenet T7": {
      "callsAndApps": { "01": 5, "02": 3, ... },
      "visits": { "01": 2, "02": 1, ... }
    },
    "Tenet T4": { ... }
  }
}
```

| Уровень | Ключ | Тип | Описание |
|---|---|---|---|
| 1 | `YYYY-MM` | `string` | Месяц |
| 2 | `<model>` | `string` | Модель авто |
| 3 | `callsAndApps` / `visits` | `object` | Тип трафика |
| 4 | `DD` (01-31) | `string` | День (zero-padded) → `number` значение |

Гарантируется функцией `ensureModelData(monthValue, model)`.

---

### A.5. `crm_eval_links_v32` → `evaluationLinks`

Ссылки на оценки (привязаны к полю ТИ в Складе).

```json
{
  "<rowId>": "https://example.com/review/123",
  "<rowId2>": "https://..."
}
```

Ключ — `id` строки склада (number→string при сериализации).

---

### A.6. `crm_links_archive_v32` → `linksArchive`

Архив ссылок, удалённых вместе со сделками.

```json
{
  "<rowId>": {
    "url": "https://...",
    "model": "Tenet T7",
    "client": "Иванов Иван",
    "deletedAt": "2026-06-01T12:00:00.000Z"
  }
}
```

---

### A.7. `crm_today_plans_v32` → `todayPlans`

Планы на день (встречи и контракты).

```json
{
  "2026-06": {
    "01": { "meetings": 5, "contracts": 2 },
    "02": { "meetings": 3, "contracts": 1 }
  }
}
```

| Уровень | Ключ | Описание |
|---|---|---|
| 1 | `YYYY-MM` | Месяц |
| 2 | `DD` | День (zero-padded) |
| 3 | `meetings` / `contracts` | `number` — значение плана |

**Важно:** структура `{ meetings: 0, contracts: 0 }` создаётся автоматически при отсутствии.

---

### A.8. `crm_cell_comments_v32` → `cellComments`

Комментарии к ячейкам трафика (ПКМ → Добавить).

```json
{
  "calls_01_Tenet T7": "Текст комментария",
  "visits_15_Tenet T4": "Другой текст"
}
```

Формат ключа: `<table>_<day>_<model>` где `table` ∈ `{'calls', 'visits'}`.

---

### A.9. `crm_change_history_v32` → `changeHistory`

Массив истории изменений (LIFO, максимум 500 записей).

```json
[
  {
    "time": "2026-06-01T12:34:56.789Z",
    "type": "add",
    "description": "Добавлена сделка: Tenet T7 — Иванов"
  }
]
```

| Поле | Тип | Описание |
|---|---|---|
| `time` | `ISO 8601` | Время события |
| `type` | `'add' \| 'edit' \| 'delete' \| 'bulk'` | Тип действия |
| `description` | `string` | Описание |

**Лейблы типов (для UI):** `{ add: 'Добавление', edit: 'Изменение', delete: 'Удаление', bulk: 'Массовое' }`

---

### A.10. `crm_channels_v32` → `channelsData`

Массив каналов трафика для вкладки План/Факт.

**Поля:**

| Поле | Тип | Описание |
|---|---|---|
| `name` | `string` | Название канала |
| `group` | `string` | Группа (из `DEFAULT_GROUPS`) |
| `budget` | `number` | Бюджет, ₽ |
| `cpl` | `number` | Cost Per Lead |
| `rl` | `number` | РЛ (расчётные лиды) |
| `sr` | `number` | SR% (Sales Rate) |

**Пример:**
```json
{
  "name": "Я.Директ (без НДС)",
  "group": "Digital",
  "budget": 100000,
  "cpl": 6666.67,
  "rl": 15,
  "sr": 10.0
}
```

**Default seed:** `DEFAULT_CHANNELS` — 33 канала (см. [Default Data](#default-data)).

---

### A.11. `crm_plan_data_v32` → `planData`

Плановые данные по каналам.

```json
{
  "2026-06": {
    "Я.Директ (без НДС)": {
      "days": { "1": 5, "2": 3, ..., "30": 4 },
      "budget": 100000,
      "cpl": 6666.67,
      "rl": 15,
      "sr": 10.0
    }
  }
}
```

| Уровень | Ключ | Описание |
|---|---|---|
| 1 | `YYYY-MM` | Месяц |
| 2 | `<channel.name>` | Название канала |
| 3 | `days` | Объект «день (1-31) → число лидов» |
| 3 | `budget` / `cpl` / `rl` / `sr` | Параметры (могут редактироваться) |

Создаётся в `renderPlanFactTable()` при первом открытии месяца.

---

### A.12. `crm_fact_data_v32` → `factData`

Фактические данные по месяцу.

```json
{
  "2026-06": { "contracts": 25, "issued": 20 }
}
```

| Поле | Тип | Описание |
|---|---|---|
| `contracts` | `number` | Контракты (факт) |
| `issued` | `number` | Выдачи (факт) |

**Важно:** фактические данные хранятся **на весь месяц**, а не по каналам (общая сумма для всего месяца).

---

### A.13. `crm_calendar_data_v32` → `calendarData`

⚠️ **Мёртвый код.** Переменная объявлена, но нигде не используется. В Next.js можно исключить.

---

### A.14. `crm_analytics_groupby_v32` → `analyticsGroupBy`

Строка: `'seller'` (по умолчанию) или `'model'`. Режим группировки аналитики.

---

### A.15. `crm_last_backup_time`

ISO-строка времени последнего бэкапа. Используется в `updateBackupStatus()` для индикации (норма / устарел >24ч / не создан).

---

### Default Data

#### `getDefaultSkladData()` — 5 seed-записей Склада

```js
[
  { id: 1, model: 'Tenet T7', status: 'Отказ', dateDkp: '2026-05-29', dateIssued: '', seller: 'Лавреев Сергей', client: 'Угрюмов Сергей Александрович', jok: 0, j: 0, o: 0, k: 0, risk: '4', kr: '0', ti: '1', review: 'Нет отзыва', traffic: '🚶 Визит', comment: 'Купил джолион у нас' },
  { id: 2, model: 'Tenet T7', status: 'Продан', dateDkp: '2026-06-01', dateIssued: '2026-06-01', seller: 'Мелузов Евгений', client: 'Матюнин Андрей Валентинович', jok: 162541, j: -19746, o: 0, k: 182287, risk: '1', kr: '1', ti: '1', review: 'Нет отзыва', traffic: '📞 Звонок', comment: 'Выдана' },
  { id: 3, model: 'Tenet T4L', status: 'Продан', dateDkp: '2026-06-03', dateIssued: '2026-06-03', seller: 'Буц Виктория', client: 'Евдокимова Елена Васильевна', jok: 140750, j: -39717, o: 0, k: 180467, risk: '1', kr: '1', ti: '1', review: 'Нет отзыва', traffic: '📝 Заявка', comment: 'Выдана' },
  { id: 4, model: 'Tenet T7', status: 'Продан', dateDkp: '2026-06-03', dateIssued: '2026-06-03', seller: 'Буц Виктория', client: 'Кузнецов Александр Сергеевич', jok: 181429, j: 24622, o: 0, k: 156807, risk: '1', kr: '1', ti: '0', review: 'Нет отзыва', traffic: '🚶 Визит', comment: 'Выдана' },
  { id: 5, model: 'Tenet T4', status: 'Продан', dateDkp: '2026-06-04', dateIssued: '2026-06-04', seller: 'Алексеев Владимир', client: 'Григорьев Сергей Павлович', jok: 205796, j: 6324, o: 0, k: 199472, risk: '1', kr: '1', ti: '1', review: 'Яндекс карты', traffic: '🚶 Визит', comment: 'Выдана' }
]
```

#### `DEFAULT_SELECT_OPTIONS` — словари селектов

```js
{
  model:    ['Arrizo 8', 'Tenet T4', 'Tenet T4L', 'Tenet T7', 'Tenet T8'],
  status:   ['Продан', 'Склад', 'Отказ'],
  seller:   ['Лавреев Сергей', 'Мелузов Евгений', 'Буц Виктория', 'Алексеев Владимир', 'Даниленко Сергей', 'Коваленко Павел'],
  review:   ['Нет отзыва', 'Яндекс карты', '2ГИС', 'Рекомендация'],
  traffic:  ['🚶 Визит', '📞 Звонок', '📝 Заявка', '👥 Рекомендация'],
  risk:     ['1', '2', '3', '4', '5'],
  kr:       ['0', '1'],
  ti:       ['0', '1', '2']
}
```

#### `DEFAULT_GROUPS` — 7 групп каналов

```js
['Digital', 'Классифайды', 'Геосервисы и SERM', 'Direct', 'Offline', 'Обязательное', 'Прочее']
```

#### `DEFAULT_CHANNELS` — 33 канала

| # | Название | Группа | Budget | CPL | РЛ | SR% |
|---|---|---|---|---|---|---|
| 1 | Я.Директ (без НДС) | Digital | 100000 | 6666.67 | 15 | 10.0 |
| 2 | Яндекс органика-поиск | Digital | 0 | 0 | 5 | 7.0 |
| 3 | Google органика-поиск | Digital | 0 | 0 | 0 | 7.0 |
| 4 | LMS - дистибьютор | Digital | 0 | 0 | 5 | 7.0 |
| 5 | Вконтакте таргет | Digital | 20000 | 2000 | 10 | 7.0 |
| 6 | Реклама ВК сообщества | Digital | 5000 | 1000 | 5 | 7.0 |
| 7 | Avito | Классифайды | 15000 | 1000 | 15 | 10.0 |
| 8 | Avito CHERY | Классифайды | 15000 | 1000 | 15 | 10.0 |
| 9 | Auto.ru | Классифайды | 15000 | 1000 | 15 | 10.0 |
| 10 | Auto.ru CHERY | Классифайды | 15000 | 1000 | 15 | 10.0 |
| 11 | Autospot | Классифайды | 0 | 0 | 10 | 7.0 |
| 12 | Drom | Классифайды | 1600 | 800 | 2 | 7.0 |
| 13 | Яндекс Карты | Геосервисы и SERM | 35000 | 3500 | 10 | 10.0 |
| 14 | Яндекс Карты CHERY | Геосервисы и SERM | 0 | 0 | 2 | 10.0 |
| 15 | 2Gis | Геосервисы и SERM | 305 | 0 | 0 | 7.0 |
| 16 | SMS-рассылка | Direct | 15000 | 3000 | 5 | 10.0 |
| 17 | Лидген | Direct | 0 | 0 | 0 | 10.0 |
| 18 | Т-банк, Сбербанк | Direct | 0 | 0 | 0 | 0.0 |
| 19 | Знакомые | Direct | 0 | 0 | 0 | 0.0 |
| 20 | BTL | Offline | 0 | 0 | 0 | 7.0 |
| 21 | Радио | Offline | 206000 | 20600 | 10 | 7.0 |
| 22 | DOOH / OOH | Offline | 120000 | 24000 | 5 | 7.0 |
| 23 | НДС Яндекс | Обязательное | 24200 | 0 | 0 | 0 |
| 24 | Кабинет Авито | Обязательное | 12000 | 0 | 0 | 0 |
| 25 | Кабинет Авито CHERY | Обязательное | 12000 | 0 | 0 | 0 |
| 26 | Сайт импортера | Обязательное | 20740 | 0 | 0 | 0 |
| 27 | Сайт импортера CHERY | Обязательное | 20740 | 0 | 0 | 0 |
| 28 | Calltouch телефония | Обязательное | 20000 | 0 | 0 | 0 |
| 29 | Calltouch аналитика | Обязательное | 10000 | 0 | 0 | 0 |
| 30 | POSM для шоу-рума | Обязательное | 10000 | 0 | 0 | 0 |
| 31 | POSM для сотрудников | Обязательное | 10000 | 0 | 0 | 0 |
| 32 | Расклейка и оклейка а/м | Обязательное | 10000 | 0 | 0 | 0 |
| 33 | Пешеходы | Прочее | 0 | 0 | 35 | 25.0 |
| 34 | Выдачи других ДЦ | Прочее | 0 | 0 | 0 | 0.0 |
| 35 | Холодные звонки | Прочее | 0 | 0 | 5 | 5.0 |

---

## B. Вкладки UI

Верхняя панель вкладок — `.tabs-bar` (строки 395–402). Активная вкладка `data-tab="sklad"`.

| # | Имя в UI | ID вкладки | data-tab | Иконка | Сущности | Функции |
|---|---|---|---|---|---|---|
| 1 | 📦 Склад | `tab-sklad` | `sklad` | 📦 | `tabsState.sklad.data` | CRUD, импорт/экспорт CSV/Excel, фильтры по select-колонкам, массовое выделение, контекстные меню, ТИ-ссылки, комментарии к ячейкам |
| 2 | 📊 Трафик | `tab-traffic` | `traffic` | 📊 | `trafficData`, `todayPlans`, `cellComments` | Редактирование ячеек звонков/визитов по дням, план встреч/контрактов, экспорт CSV/Excel, прогноз, KPI, недельные сводки |
| 3 | 📋 План/Факт | `tab-planfact` | `planfact` | 📋 | `planData`, `factData`, `channelsData` | Редактирование дней по каналам, параметры каналов (budget/cpl/rl/sr), экспорт Excel, настройки каналов (CRUD), импорт (stub) |
| 4 | 📈 Аналитика | `tab-analytics` | `analytics` | 📈 | агрегация `tabsState.sklad.data` | Группировка по продавцам/моделям, фильтры (статус, модель, трафик, РИСК, КР, ТИ), KPI-карточки |
| 5 | 📅 Календарь | `tab-calendar` | `calendar` | 📅 | `todayPlans`, `tabsState.sklad.data` | Месячный грид, навигация, модалка дня с планами встречами/контрактами и фактами |
| 6 | 📜 История | `tab-history` | `history` | 📜 | `changeHistory` | Просмотр, очистка, экспорт в CSV |

**Toolbar каждой вкладки** см. в исходнике строки 406–520.

---

## C. Основные функции

### C.1. CRUD операции

#### Склад (`sklad`)

| Функция | Строка | Описание |
|---|---|---|
| `openStepForm()` | 1265 | Открыть многошаговую форму добавления сделки |
| `stepFormNext()` | 1298 | Следующий шаг / сохранение сделки |
| `stepFormPrev()` | 1321 | Предыдущий шаг |
| `addRow(tabKey)` | 2390 | ⚠️ Мёртвый код — добавление пустой строки (не вызывается из UI) |
| `duplicateRow(tabKey)` | 2402 | Дублирование выбранной строки (с копированием ссылки ТИ) |
| `insertRowAbove(tabKey)` | 2419 | Вставить пустую строку выше |
| `insertRowBelow(tabKey)` | 2431 | Вставить пустую строку ниже |
| `deleteSelectedRow(tabKey)` | 2443 | Удаление с архивацией ссылки в `linksArchive` |
| `updateCell(tabKey, id, key, value)` | 2368 | Обновление текстовой/select/date ячейки |
| `updateCellNum(tabKey, id, key, text)` | 2379 | Обновление числовой ячейки (парсит с пробелами и запятой) |

#### Массовые операции

| Функция | Строка | Описание |
|---|---|---|
| `toggleRowSelection(tabKey, id, checkbox)` | 1061 | Выбор строки |
| `toggleAllRows(tabKey, checkbox)` | 1067 | Выбрать все |
| `clearSelection(tabKey)` | 1083 | Снять выделение |
| `deleteSelectedRows(tabKey)` | 1089 | Удалить выбранные |
| `openBulkDeleteModal(tabKey)` | 1103 | Открыть модалку массового удаления по фильтрам |
| `updateBulkDeleteCount()` | 1115 | Подсчёт строк под удаление |
| `executeBulkDelete()` | 1130 | Выполнить массовое удаление по фильтрам (статус, модель, период) |

#### Каналы (`channelsData`)

| Функция | Строка | Описание |
|---|---|---|
| `openChannelsSettings()` | 2100 | Открыть модалку настроек каналов |
| `closeChannelsSettings()` | 2106 | Закрыть |
| `renderChannelsList()` | 2108 | Отрисовка списка каналов по группам |
| `renderGroupSelector()` | 2123 | Заполнить select группами |
| `addChannel()` | 2128 | Добавить канал (name, group, budget, cpl, rl, sr) |
| `editChannel(idx)` | 2148 | Редактировать название канала (prompt) |
| `deleteChannel(idx)` | 2160 | Удалить канал |

#### План/Факт

| Функция | Строка | Описание |
|---|---|---|
| `updateChannelParam(td)` | 2069 | Обновить параметр канала (budget/cpl/rl/sr) |
| `updateChannelDay(td)` | 2079 | Обновить лиды канала на день |
| `updateFact(td)` | 2089 | Обновить факт (contracts/issued) — общий на месяц |
| `recalculateAll()` | 2098 | Перерисовать таблицу План/Факт |

#### Трафик

| Функция | Строка | Описание |
|---|---|---|
| `updateTrafficCell(td)` | 1828 | Сохранение значения ячейки трафика (calls/visits) |
| `updateDayPlan(monthKey, dayStr, field, value)` | 1755 | Обновить план встреч/контрактов на день |

#### Ссылки ТИ

| Функция | Строка | Описание |
|---|---|---|
| `openLinkModal(rowId)` | 1323 | Открыть модалку ввода ссылки |
| `saveLink()` | 1335 | Сохранить ссылку (с авто-добавлением https://) |
| `openEvaluationLink(rowId)` | 1349 | Открыть ссылку в новой вкладке |
| `removeEvaluationLink(rowId)` | 1355 | Удалить ссылку |
| `showLinksArchive()` | 1436 | Показать архив ссылок |
| `clearLinksArchive()` | 1446 | Очистить архив |

#### Комментарии к ячейкам

| Функция | Строка | Описание |
|---|---|---|
| `addOrEditComment()` | 1407 | Добавить/редактировать комментарий (prompt) |
| `removeComment()` | 1419 | Удалить комментарий |

### C.2. Фильтры / поиск / сортировка

| Функция | Строка | Описание |
|---|---|---|
| `performGlobalSearch()` | 1007 | Глобальный поиск по Складу (в шапке) |
| `highlightMatch(text, query)` | 1026 | Подсветка совпадений |
| `goToSearchResult(tabKey, rowId)` | 1031 | Переход к результату поиска |
| `showSearchResults()` | 1054 | Показать дропдаун результатов |
| `hideSearchResults()` | 1059 | Скрыть дропдаун |
| `renderFilters(tabKey)` | 2269 | Отрисовка фильтров по первым 4 select-колонкам |
| `getFilteredData(tabKey)` | 2299 | Фильтрация данных по активным фильтрам |
| `setAnalyticsGroupBy(mode)` | 2784 | Смена группировки в аналитике (`seller` / `model`) |
| `applyAnalyticsFilters()` | 2810 | Применить фильтры аналитики (status, model, traffic, risk, kr, ti) |
| `resetAnalyticsFilters()` | 2805 | Сбросить фильтры аналитики |

**Сортировка таблиц НЕ реализована.**

### C.3. Импорт / экспорт

| Функция | Строка | Описание |
|---|---|---|
| `exportCSV(tabKey)` | 2730 | Экспорт Склада в CSV (с BOM, `;`-разделитель, колонка «Ссылка») |
| `importCSV(event, tabKey)` | 2748 | Импорт CSV в Склад (парсинг кавычек, импорт ссылок) |
| `exportToExcel()` | 918 | Экспорт Склада в `.xlsx` через XLSX.js |
| `importFile(event, tabKey)` | 962 | Унифицированный импорт (CSV/XLSX/XLS) |
| `exportTrafficToExcel()` | 932 | Экспорт трафика (звонки) в XLSX |
| `exportTrafficCSV()` | 1869 | Экспорт трафика в CSV (только звонки) |
| `exportPlanFactToExcel()` | 2170 | Экспорт План/Факт в XLSX (все колонки) |
| `importPlanFactFromExcel(event)` | 2202 | ⚠️ Stub — выводит «в разработке» |
| `saveFullBackup()` | 900 | Полный бэкап всех данных в JSON |
| `exportHistory()` | 864 | Экспорт истории в CSV |
| `printReport()` | 1155 | Печать (`window.print()`) |

### C.4. Рендеринг

| Функция | Строка | Описание |
|---|---|---|
| `renderTab(tabKey)` | 2258 | Главная функция рендера вкладки (фильтры, ширины, header, body, stats) |
| `renderHeader(tabKey)` | 2289 | Заголовок таблицы с `col-resizer` и контекстным меню |
| `renderBody(tabKey)` | 2311 | Тело таблицы с фильтрацией |
| `renderCell(tabKey, r, c)` | 2331 | Рендер ячейки по типу колонки |
| `renderTotalRow(tabKey, rows)` | 2352 | Строка ИТОГО (сумма number-колонок) |
| `applyColumnWidths(tabKey)` | 2281 | Применение ширин колонок из `<colgroup>` |
| `updateStats(tabKey)` | 2468 | Обновление статистики (всего + по статусам) |
| `renderTrafficTables()` | 1531 | Главный рендер вкладки Трафик |
| `renderCallsTable(...)` | 1554 | Таблица «Звонки и Заявки» |
| `renderVisitsTable(...)` | 1643 | Таблица «Визиты в салон» |
| `renderTotalTable(...)` | 1709 | Таблица «Общий банк контрактов» |
| `renderCallsWeeks(...)` | 1763 | Недельная сводка по звонкам |
| `renderVisitsWeeks(...)` | 1782 | Недельная сводка по визитам |
| `renderTrafficHeaderKPI(...)` | 1841 | KPI-блок в шапке Трафика |
| `renderForecast()` | 1216 | Блок прогноза (сделано/прогноз/план/тренд/осталось) |
| `renderPlanFactTable()` | 1916 | Главный рендер План/Факт |
| `renderPlanFactHeader(daysInMonth)` | 1933 | Двухуровневый заголовок План/Факт |
| `renderPlanFactBody(daysInMonth, monthKey)` | 1959 | Тело таблицы План/Факт |
| `renderPlanFactGroupTotalRow(...)` | 2010 | Строка «Итого по группе» |
| `renderPlanFactGrandTotalRow(...)` | 2035 | Строка «ИТОГО» |
| `renderAnalytics()` | 2791 | Рендер вкладки Аналитика |
| `renderAnalyticsTable(data, statusFilter)` | 2830 | Таблица аналитики с группировкой |
| `renderCalendar()` | 2884 | Месячный грид календаря |
| `renderStepForm()` | 1268 | Рендер текущего шага формы сделки |
| `renderHistory()` | 842 | Список истории |

### C.5. События (event handlers)

| Источник | Строка | Описание |
|---|---|---|
| `document.querySelectorAll('.tab-btn').forEach(...)` | 1228 | Клик по вкладкам — переключение |
| `document.querySelectorAll('#contextMenu .context-menu-item')` | 2564 | Пункты меню строки (duplicate/insertAbove/insertBelow/delete) |
| `document.querySelectorAll('#headerContextMenu .context-menu-item')` | 2576 | Пункты меню колонки (rename/changeType/insertLeft/insertRight/deleteCol) |
| `document.querySelectorAll('#tiContextMenu .context-menu-item')` | 1380 | Пункты меню ТИ-ссылки |
| `document.querySelectorAll('#commentContextMenu .context-menu-item')` | 1428 | Пункты меню комментария |
| `document.addEventListener('click', hideContextMenu)` | 2562 | Глобальный клик — закрытие всех контекстных меню |
| `document.addEventListener('keydown', ...)` | 2209 | Горячие клавиши (`?`, `Ctrl+A`, `Ctrl+S`, `Ctrl+F`, `Ctrl+P`, стрелки) |
| `setInterval(...)` | 2975 | Каждый час — проверка устаревания бэкапа (>4ч → toast) |

### C.6. Утилиты

| Функция | Строка | Описание |
|---|---|---|
| `getDaysInMonth(month, year)` | 1461 | Число дней в месяце (month 0-based) |
| `getDayName(year, month, day)` | 1463 | Имя дня недели (`Вс`/`Пн`/.../`Сб`) |
| `getWeeksOfMonth(year, month)` | 1465 | Разбивка месяца на недели (с понедельника) |
| `ensureModelData(monthValue, model)` | 1479 | Гарантирует существование объекта `trafficData[monthValue][model]` |
| `getSkladStats(monthValue)` | 1485 | Подсчёт контрактов/отказов по моделям и типам трафика за месяц |
| `getContractsByDay(monthValue, trafficFilter)` | 1509 | Контракты по дням (фильтр: `all`/`calls`/`visits`) |
| `getSkladWeekContracts(year, month, days)` | 1801 | Контракты (звонки+заявки) за указанные дни |
| `getSkladWeekContractsVisit(year, month, days)` | 1815 | Контракты (визиты) за указанные дни |
| `calculateForecast()` | 1183 | Расчёт прогноза контрактов на месяц |
| `getFactForDate(dateStr)` | 2946 | Фактические контракты/выдачи за дату |
| `showToast(msg, type)` | 2958 | Toast-уведомление (`success`/`error`/`warning`) |
| `updateCurrentDate()` | 2966 | Обновление текущей даты в шапке |
| `updateBackupStatus()` | 880 | Обновление индикатора бэкапа |

### C.7. Сохранение в localStorage

| Функция | Ключ |
|---|---|
| `saveTabDataKey(k)` | `crm_data_<k>_v32` |
| `saveTabColumns(k)` | `crm_cols_<k>_v32` |
| `saveSelectOptions()` | `crm_select_options_v32` |
| `saveAnalyticsGroupBy()` | `crm_analytics_groupby_v32` |
| `saveTrafficData()` | `crm_traffic_v32` |
| `saveEvaluationLinks()` | `crm_eval_links_v32` |
| `saveLinksArchive()` | `crm_links_archive_v32` |
| `saveCalendarData()` | `crm_calendar_data_v32` (мёртвый) |
| `saveTodayPlans()` | `crm_today_plans_v32` |
| `saveCellComments()` | `crm_cell_comments_v32` |
| `saveChangeHistory()` | `crm_change_history_v32` |
| `saveChannelsData()` | `crm_channels_v32` |
| `savePlanData()` | `crm_plan_data_v32` |
| `saveFactData()` | `crm_fact_data_v32` |
| `addHistoryEntry(type, description)` | Добавляет запись в `changeHistory` (макс 500) |

---

## D. Шаги формы сделки

Многошаговая форма создания сделки (модалка `stepFormModal`). Поле `stepForm = { currentStep: 0, data: {} }`.

**Конфигурация шагов** — массив `stepFields` (строки 1246–1263). Каждый шаг — отдельное поле, всего **16 шагов**:

| Шаг | key | label | type | options |
|---|---|---|---|---|
| 1 | `model` | Модель | `select` | `model` |
| 2 | `status` | Статус | `select` | `status` |
| 3 | `dateDkp` | Дата ДКП | `date` | — |
| 4 | `dateIssued` | Дата выдачи | `date` | — |
| 5 | `seller` | Продавец | `select` | `seller` |
| 6 | `client` | Клиент | `text` | — |
| 7 | `jok` | ЖОК | `number` | — |
| 8 | `j` | Ж | `number` | — |
| 9 | `o` | О | `number` | — |
| 10 | `k` | К | `number` | — |
| 11 | `risk` | РИСК | `select` | `risk` |
| 12 | `kr` | КР | `select` | `kr` |
| 13 | `ti` | ТИ | `select` | `ti` |
| 14 | `review` | Отзывы | `select` | `review` |
| 15 | `traffic` | Трафик | `select` | `traffic` |
| 16 | `comment` | Комментарий | `textarea` | — |

**UI формы:**
- Заголовок: `➕ Новая сделка`
- Step indicator: точки (по числу шагов), активная — `#2a5298`, выполненная — `#28a745`
- Кнопка «Назад» (скрыта на 1 шаге)
- Кнопка «Далее →» / «✅ Сохранить» (на последнем шаге)
- При сохранении создаётся `{ id: Date.now(), ...data }`, добавляется в `tabsState.sklad.data`

---

## E. Колонки таблиц

### E.1. Таблица «Склад» (`tabsState.sklad.columns`)

Конфигурация по умолчанию — `TABS_CONFIG.sklad.defaultColumns` (строки 708–725).

**Статусная модель:** `statusField: 'status'`, `statusMap: { 'Продан': 'row-sold', 'Склад': 'row-sklad', 'Отказ': 'row-refusal' }`.

| # | key | label | type | options | default | width |
|---|---|---|---|---|---|---|
| 1 | `model` | Модель | `select` | `model` | `'Tenet T7'` | 110 |
| 2 | `status` | Статус | `select` | `status` | `'Продан'` | 100 |
| 3 | `dateDkp` | Дата ДКП | `date` | — | `''` | 100 |
| 4 | `dateIssued` | Дата выдачи | `date` | — | `''` | 110 |
| 5 | `seller` | Продавец | `select` | `seller` | `''` | 170 |
| 6 | `client` | Клиент | `text` | — | `''` | 200 |
| 7 | `jok` | ЖОК | `number` | — | `0` | 100 |
| 8 | `j` | Ж | `number` | — | `0` | 80 |
| 9 | `o` | О | `number` | — | `0` | 80 |
| 10 | `k` | К | `number` | — | `0` | 80 |
| 11 | `risk` | РИСК | `select` | `risk` | `'1'` | 60 |
| 12 | `kr` | КР | `select` | `kr` | `'0'` | 50 |
| 13 | `ti` | ТИ | `select` | `ti` | `'0'` | 60 |
| 14 | `review` | Отзывы | `select` | `review` | `'Нет отзыва'` | 130 |
| 15 | `traffic` | Трафик | `select` | `traffic` | `'🚶 Визит'` | 130 |
| 16 | `comment` | Комментарий | `text` | — | `''` | 250 |

Дополнительно в начале таблицы: колонка `№` (30px) + колонка с checkbox (30px).
В конце: строка «Σ» (итого по number-колонкам).

**Типы ячеек и их поведение:**
- `select` → `<select>` с options из `selectOptions[options]`
- `number` → `contenteditable` td, форматирование через `Intl.NumberFormat('ru-RU')`, класс `negative`/`positive` по знаку
- `date` → `<input type="date">`
- `text` → `contenteditable` td
- `url` → в коде есть, но в defaultColumns не используется

**Особое поведение колонки `ti`:** при наличии ссылки в `evaluationLinks[rowId]` ячейке добавляется класс `cell-ti has-link` (фон `#e8f0fe`, иконка 🔗), ПКМ открывает `tiContextMenu`.

### E.2. Таблица «Трафик» — Звонки (`calls-table`)

**Двухуровневый заголовок:**
- Rowspan 2: «Модель» (sticky слева, `#1e3c72`)
- Colspan = daysInMonth: «📞 Звонки + Заявки» (фон `#667eea`)
- Rowspan 2: «Итого» (`#28a745`), «📄 Контр.» (`#e67e22`), «% Контр.» (`#dc3545`)
- Вторая строка: `<day-num>` + `<day-name>` (Вс/Пн/.../Сб)

**Строки (для каждой модели из `selectOptions.model`):**
- Модель (sticky слева)
- N ячеек `contenteditable` (день) с `data-table="calls"`, `data-model`, `data-day`, `data-comment-key`
- Итого (сумма звонков)
- Контракты (`stats.calls.byModel[model]`)
- % контрактов (`контракты/звонки * 100`)

**Дополнительные строки после моделей:**
1. «ИТОГО» (total-row): суммы по каждому дню
2. «📅 План встреч» (plan-label): input для каждого дня + total
3. «📋 План контрактов» (plan-label): input для каждого дня + total
4. «📄 Контракты (Зв+Заявки)» (contracts-label): значение из `getContractsByDay(..., 'calls')`

### E.3. Таблица «Трафик» — Визиты (`visits-table`)

Аналогично `calls-table`, но:
- Colspan-заголовок: «🚶 Визиты» (фон `#11998e`)
- Источник данных: `trafficData[month][model].visits[day]`
- Дополнительная строка «📄 Контракты (Визиты)» (фильтр по `traffic.includes('Визит')`)
- Строки «План встреч/контрактов» отсутствуют (только в calls-table)

### E.4. Таблица «Трафик» — Общий банк (`total-table`)

Одноуровневый заголовок. Строки:
1. «💼 Общий банк» (bank-label): контракты по дням (все типы трафика)
2. «📋 План» (plan-label): input для каждого дня
3. «📊 Выполнение» (bank-label): `% = fact/plan * 100` по дням

### E.5. Таблица «План/Факт» (`planfact-table`)

**Двухуровневый заголовок:**
- Rowspan 2: «Канал» (sticky, `#1e3c72`)
- Rowspan 2: «Бюджет», «CPL», «РЛ», «SR%» (sub-header)
- Colspan = daysInMonth: «ПЛАН (по дням)» (group-header)
- Colspan 6: «НАРАСТАЮЩИМ ИТОГОМ» (total-header): Бюджет, CPL, РЛ, SR%, Контр., Выдачи
- Colspan 3: «ФАКТ» (fact-header): Контр., Выдачи, SR%
- Вторая строка: дни 1..N + 9 названий колонок итогов

**Строки:**
- Для каждой группы каналов — `group-header-row` (colspan = 4 + daysInMonth + 6 + 3)
- Для каждого канала:
  - name (sticky, ellipsis)
  - 4 параметра `contenteditable` (data-channel, data-field)
  - N дней `contenteditable` (data-channel, data-day)
  - 6 вычисляемых ячеек (calculated): Бюджет, CPL, РЛ, SR%, Контр.(=РЛ*SR/100), Выдачи(=totalLeads*SR/100)
  - 2 факта `contenteditable` (data-field=contracts/issued)
  - 1 вычисляемый SR% факт
- После каждой группы — `group-total` строка
- В конце — `grand-total` строка (ИТОГО по всем каналам)

### E.6. Таблица «Аналитика» (`summary-table`)

**Двухуровневый заголовок:**
- Rowspan 2: «Продавец» или «Модель» (sticky, `#1e3c72`) — в зависимости от `analyticsGroupBy`
- Rowspan 2: «АМ» (количество)
- Colspan 4: «Удельные на 1 АМ» (фон `#4a7bc7`): Ж уд., О уд., К уд., ЖОК уд.
- Colspan 2: «Количество» (фон `#3a6ab7`): ТИ, КР
- Colspan 4: «Суммы» (фон `#2a5298`): Ж, О, К, ЖОК
- Colspan 2: «Проценты» (фон `#1e3c72`): ТИ %, КР %

**Строки:** для каждой группы + строка «Итого» (total-row).

**KPI-карточки под таблицей:** Всего АМ, Общий ЖОК (₽), ТИ, КР.

### E.7. Календарь (`calendar-grid`)

Не таблица, а CSS Grid `grid-template-columns: repeat(7, 1fr)`. Ячейки:
- Заголовки дней: Пн, Вт, Ср, Чт, Пт, Сб, Вс
- `.calendar-day` — карточка дня с:
  - `.day-number`
  - 4 `.calendar-stat`: Встречи (`plan-meetings`), План (`plan-contracts`), Факт (`fact-contracts`), Выдачи (`fact-issued`)
- `.calendar-day.today` — выделение текущего дня
- `.calendar-day.other-month` — пустые ячейки в начале месяца

---

## F. Особенности бизнес-логики

### F.1. Каналы в План/Факт

**Иерархия:**
```
Группа (DEFAULT_GROUPS, 7 шт.)
  └── Канал (channelsData, 33 шт. по умолчанию)
        ├── Параметры: budget, cpl, rl, sr (редактируемые в planData[monthKey][channelName])
        └── Дни 1..N: число лидов (planData[monthKey][channelName].days[day])
```

**Логика расчётов (в `renderPlanFactBody`):**
- **Контракты (план)** = `РЛ * SR% / 100` (округление)
- **Выдачи (план)** = `totalLeads * SR% / 100` (округление), где `totalLeads = Σ дней`
- **SR% (факт)** = `issued / contracts * 100`

**Группы:**
```js
['Digital', 'Классифайды', 'Геосервисы и SERM', 'Direct', 'Offline', 'Обязательное', 'Прочее']
```

**CRUD каналов:** через модалку `channelsModal` (только name в `editChannel` через prompt, budget/cpl/rl/sr — только при создании). ⚠️ При удалении канала соответствующие данные в `planData` не очищаются.

**Факт хранится на весь месяц** (`factData[monthKey] = { contracts, issued }`), а не по каналам — это общий итог.

### F.2. Комментарии к ячейкам

- **Хранилище:** `cellComments` (ключ `crm_cell_comments_v32`)
- **Формат ключа:** `<table>_<day>_<model>` где `table ∈ {'calls', 'visits'}`
- **UI:** ПКМ по ячейке → контекстное меню `commentContextMenu`
  - Добавить (если нет)
  - Редактировать (если есть)
  - Удалить (если есть)
- **Визуализация:** ячейка с комментарием получает класс `has-comment` → иконка 💬 в левом верхнем углу, текст комментария в `title` атрибуте
- **Ввод:** через `prompt()` (стандартный браузерный диалог)

### F.3. История изменений

- **Хранилище:** `changeHistory` (ключ `crm_change_history_v32`)
- **Структура:** массив `{ time, type, description }`, LIFO (через `unshift`)
- **Лимит:** 500 записей (срезается `slice(0, 500)`)
- **Типы:** `add` (зелёный), `edit` (жёлтый), `delete` (красный), `bulk` (голубой)
- **События, записываемые в историю:**
  - Добавление сделки (через step form)
  - Дублирование строки
  - Обновление ячейки (сравнение oldValue !== newValue)
  - Удаление строки (через контекстное меню)
  - Массовое удаление (checkbox / bulk delete modal)
  - Импорт CSV/Excel
  - Добавление/удаление ссылки ТИ
  - Создание бэкапа
- **Экспорт:** CSV с колонками `Дата;Тип;Описание`

### F.4. Автосохранение

- ⚠️ **Реального автосохранения нет.** Кнопка «💾 Бэкап» сохраняет полное состояние в JSON-файл (`saveFullBackup()`).
- В шапке есть индикатор `.backup-status`:
  - `danger` (красный) — бэкап не создан
  - `warning` (жёлтый) — старше 24 часов
  - нейтральный — в течение 24 часов, показывает дату
- `setInterval(...)` каждый час проверяет: если бэкапа нет или он старше 4 часов → toast-предупреждение
- **Локальное автосохранение в localStorage:** при каждом изменении данных вызываются `save*()` функции — фактически данные сохраняются мгновенно, но визуально это не отображается

### F.5. Контекстные меню

Реализованы 4 отдельных меню:

#### a) `contextMenu` — для строки Склада (строки 525–531)
- 📋 Дублировать (`duplicate`)
- ⬆️ Вставить выше (`insertAbove`)
- ⬇️ Вставить ниже (`insertBelow`)
- — separator —
- 🗑️ Удалить (`delete`) — danger

Триггер: `oncontextmenu="showRowContextMenu(event, tabKey, id)"` на `<tr>`.

#### b) `tiContextMenu` — для ячейки ТИ (строки 533–539)
- 🔗 Внести ссылку (`addLink`) — виден, если ссылки нет
- 🌐 Открыть (`openLink`) — виден, если ссылка есть
- — separator —
- ✏️ Редактировать (`editLink`)
- 🗑️ Удалить (`removeLink`)

Триггер: `oncontextmenu="showTiContextMenu(event, rowId)"` на `<td>` ТИ-колонки.

#### c) `commentContextMenu` — для ячейки трафика (строки 541–546)
- 💬 Добавить (`addComment`)
- ✏️ Редактировать (`editComment`)
- — separator —
- 🗑️ Удалить (`removeComment`)

Триггер: `oncontextmenu="showCommentContextMenu(event, commentKey)"` на `td.day-cell`.

#### d) `headerContextMenu` — для заголовка колонки (строки 548–555)
- ✏️ Переименовать (`rename`)
- 🔄 Изменить тип (`changeType`)
- ⬅️ Вставить слева (`insertLeft`)
- ➡️ Вставить справа (`insertRight`)
- — separator —
- 🗑️ Удалить (`deleteCol`)

Триггер: `oncontextmenu="showHeaderContextMenu(event, tabKey, key)"` на `span.th-label`.
Также двойной клик по заголовку → инлайн-редактирование (`startRenameColumn`).

### F.6. Drag-and-drop

❌ **Не реализован.** Вместо него:
- **Resize колонок:** через `.col-resizer` (div в правой части `<th>`), `mousedown` → `mousemove` → `mouseup`, минимальная ширина 40px, сохранение в `crm_cols_sklad_v32`
- **Навигация стрелками:** ArrowUp/Down/Left/Right перемещает фокус между `contenteditable` ячейками в пределах таблицы

### F.7. Горячие клавиши (shortcuts)

| Клавиша | Действие | Условие |
|---|---|---|
| `?` | Показать/скрыть подсказку | фокус не в input/textarea/select |
| `Ctrl+A` | Выделить все строки Склада | `currentTab === 'sklad'`, фокус не в input |
| `Ctrl+S` | Бэкап | всегда |
| `Ctrl+F` | Фокус на глобальный поиск | всегда |
| `Ctrl+P` | Печать | всегда |
| `ArrowUp/Down/Left/Right` | Навигация по ячейкам | фокус на `td[contenteditable]` или `td.plan-cell input` или `td.day-cell` |

### F.8. Сортировка таблиц

❌ **Не реализована.** `th` имеет `cursor: pointer`, но обработчика клика нет.

### F.9. Связь Трафик ↔ Склад

Трафик-таблицы агрегируют данные из `tabsState.sklad.data`:
- **Контракты по дням** (`getContractsByDay`): фильтр Склада по `status === 'Продан'`, `dateDkp === YYYY-MM-DD`, типу трафика
- **Статистика по моделям** (`getSkladStats`): группировка по `model` с разделением на «продан/отказ» и «звонки+заявки/визиты»
- Критерий «звонок или заявка»: `traffic.includes('Звонок') || traffic.includes('Заявка')`
- Критерий «визит»: `traffic.includes('Визит')`

### F.10. Прогноз контрактов (`calculateForecast`)

Алгоритм:
1. Берутся все сделки со `status === 'Продан'` и `dateDkp` в выбранном месяце
2. Если текущий месяц — `daysPassed = today.getDate()`, иначе `daysInMonth`
3. `contractsSoFar` — сделки с `getDate() <= daysPassed`
4. `dailyAverage = contractsSoFar / daysPassed`
5. `forecastTotal = round(dailyAverage * daysInMonth)`
6. `planTotal = Σ todayPlans[monthValue][*].contracts`
7. `trendPct = (contractsSoFar / prevMonthContracts - 1) * 100`

UI прогноза:
- Если НЕ текущий месяц — упрощённый блок «Всего контрактов / Среднее в день»
- Если текущий месяц — полный блок с 5 карточками: Сделано, Прогноз, План, Тренд, Осталось

---

## G. Цветовая схема и дизайн

### G.1. Основные цвета

| Назначение | Цвет | HEX |
|---|---|---|
| Фон body | светло-серый | `#f0f2f5` |
| Текст по умолчанию | тёмно-синий | `#2c3e50` |
| **Primary** (заголовки, кнопки) | синий | `#2a5298` |
| Primary dark (gradient start) | тёмно-синий | `#1e3c72` |
| Success / Positive | зелёный | `#28a745` |
| Danger / Negative | красный | `#dc3545` |
| Warning | жёлтый | `#ffc107` |
| Accent (links, info) | синий | `#1a73e8` |
| Border | серый | `#e0e0e0` / `#dadce0` |
| Background hover | светло-серый | `#f8f9fa` |
| Background headers | светло-серый | `#f1f3f4` |
| Subtext | серый | `#7f8c8d` / `#95a5a6` |

### G.2. Специфические градиенты

- **Header:** `linear-gradient(135deg, #1e3c72, #2a5298)`
- **Звонки header:** `linear-gradient(135deg, #667eea, #764ba2)` (фиолетовый)
- **Визиты header:** `linear-gradient(135deg, #11998e, #38ef7d)` (зелёный)
- **Общий банк header:** `linear-gradient(135deg, #f093fb, #f5576c)` (розовый)
- **Прогноз секция:** фон `linear-gradient(135deg, #667eea, #764ba2)`, текст белый

### G.3. Цвета по статусам сделок (строки Склада)

| Статус | Класс | Фон |
|---|---|---|
| Продан | `row-sold` | `#e8f5e9` (светло-зелёный) |
| Склад | `row-sklad` | `#fff8e1` (светло-жёлтый) |
| Отказ | `row-refusal` | `#ffebee` (светло-красный) |

### G.4. Стили header

- `.app-header`: `linear-gradient(135deg, #1e3c72, #2a5298)`, белый текст, padding 8px 20px, flex justify-between
- H1: 16px, weight 600
- Подзаголовок: 11px, opacity 0.85
- `.tabs-bar`: белый фон, padding 0 15px, gap 3px, нижняя граница 2px `#e0e0e0`
- `.tab-btn`: padding 8px 14px, прозрачный фон, шрифт 12px weight 500, цвет `#7f8c8d`
- `.tab-btn.active`: цвет `#2a5298`, нижняя граница 3px `#2a5298`, weight 600
- `.tab-btn:hover`: цвет `#2a5298`, фон `#f8f9fa`

### G.5. Стили таблиц

- **Шрифт:** `'Segoe UI', Tahoma, sans-serif`, 12px (10–11px в compact-таблицах)
- `table`: `border-collapse: collapse`
- `thead`: `position: sticky; top: 0; z-index: 10`
- `th`: фон `#f1f3f4`, граница `1px solid #dadce0`, padding 6px 4px, центр, 10px weight 600, white-space nowrap, cursor pointer
- `td`: граница `1px solid #e0e0e0`, padding 3px 4px, центр
- `td.cell-number`: `font-variant-numeric: tabular-nums`
- `td.cell-number.negative`: `#dc3545`
- `td.cell-number.positive`: `#28a745`
- `tr:hover td`: фон `#f8f9fa`
- `tr.total-row td`: фон `#e8f0fe`, weight bold, верхняя граница 2px `#1a73e8`
- `td[contenteditable="true"]:focus`: outline 2px `#2a5298`, фон белый

### G.6. Стили кнопок

- `.toolbar button`: padding 5px 10px, граница 1px `#ddd`, radius 4px, белый фон, 11px
- `.toolbar button:hover`: фон `#f0f2f5`, граница `#2a5298`
- `.toolbar button.primary`: фон `#2a5298`, белый текст
- `.toolbar button.success`: фон `#28a745`, белый текст
- `.toolbar button.danger`: фон `#dc3545`, белый текст
- `.modal-actions button`: padding 7px 15px, без границы, radius 5px, 12px
- `.btn-cancel`: `#e0e0e0` / тёмный текст
- `.btn-confirm`: `#2a5298` / белый
- `.btn-danger`: `#dc3545` / белый
- `.btn-step`: `#28a745` / белый

### G.7. Модальные окна

- `.modal`: fixed, overlay `rgba(0,0,0,0.5)`, z-index 1000, `display: none` → `.active` = `flex`
- `.modal-content`: белый, padding 20px, radius 12px, 90% ширины, max 700px, max-height 85vh, overflow-y auto
- `.modal-content.small`: max 450px
- H2: 16px, цвет `#2c3e50`
- Label: block, margin-top 8px, weight 500, 12px
- Input/select/textarea: 100% ширина, padding 7px, граница 1px `#ddd`, radius 5px

### G.8. Step indicator

- `.step-indicator`: flex, gap 6px, центр
- `.step-dot`: 8px круг, фон `#ddd`
- `.step-dot.active`: `#2a5298`, scale(1.3)
- `.step-dot.done`: `#28a745`

### G.9. Toast

- `.toast`: fixed, bottom 15px, right 15px, фон `#28a745`, белый текст, padding 8px 15px, radius 6px, z-index 2000
- `.toast.error`: `#dc3545`
- `.toast.warning`: `#ffc107` / тёмный текст
- Автоудаление через 3000ms

### G.10. Иконки и шрифты

- **Иконки:** только эмодзи (никаких icon-font или SVG): 🚗 📦 📊 📋 📈 📅 📜 ➕ 🗑️ 💾 📥 📤 🖨️ 📋 ✏️ ⬆️ ⬇️ ⬅️ ➡️ 🔗 🌐 💬 🔄 ⚙️ 🔍 🔮 📞 🚶 📝 👥 💼 📄 ⚡ 📅 ✅
- **Шрифт:** `'Segoe UI', Tahoma, sans-serif` — системный, без CDN
- **Размеры:** body 12px, headers 11–16px, кнопки 11px, ячейки таблиц 10–12px
- `kbd`: моноширинный, в `.shortcuts-hint` — `rgba(255,255,255,0.2)` фон

### G.11. Цветовая логика в Трафике

| Элемент | Цвет |
|---|---|
| Модель (sticky слева) | `#1e3c72` / `#34495e` |
| Звонки header | `#667eea` |
| Визиты header | `#11998e` |
| Итого ячейка | фон `#e8f5e9`, текст `#1e7e34` |
| Контракты ячейка | фон `#fff3cd`, текст `#856404`, граница `#e67e22` |
| % контрактов (strike) | фон `#ffebee`, текст `#dc3545`; если ≥50% — `#28a745`/`#e8f5e9` |
| ИТОГО строка | `#e8f0fe` |
| План встреч/контрактов (plan-label) | фон `#f3e5f5`, текст `#6a1b9a` |
| План ячейка (plan-cell) | фон `#fce4ec` |
| План контрактов (contracts-label) | фон `#fff8e1`, текст `#f57f17` |
| Контракты ячейка (contracts-cell) | фон `#fff9c4`, текст `#f57f17` |
| Банк (bank-label/cell) | фон `#fce4ec`, текст `#c2185b` |

---

## H. Внешние зависимости

### H.1. CDN-библиотеки

**Единственная внешняя библиотека:**

```html
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
```

- **XLSX.js (SheetJS) v0.18.5**
- Назначение: импорт/экспорт `.xlsx`/`.xls` файлов
- Используется в функциях: `exportToExcel()`, `exportTrafficToExcel()`, `exportPlanFactToExcel()`, `importFile()` (для xlsx/xls)
- ⚠️ **Уязвимости:** CVE-2023-30533, CVE-2024-22363 — рекомендуется обновить до 0.20.2+

### H.2. Шрифты

- **`'Segoe UI', Tahoma, sans-serif`** — системные, без загрузки с CDN
- Никаких Google Fonts или других внешних шрифтов нет

### H.3. Иконки

- **Только эмодзи** в текстах (никаких icon-fonts, SVG-спрайтов, Material Icons, Font Awesome)
- Используются повсеместно в кнопках, заголовках, контекстных меню, KPI-карточках

### H.4. Прочее

- Никаких CSS-фреймворков (Bootstrap, Tailwind, Material-UI)
- Никаких JS-фреймворков (React, Vue, jQuery)
- Чистый ванильный JavaScript (ES6+, без modules, без сборки)
- CSS встроен в `<style>` внутри HTML — без внешних CSS-файлов

---

## Приложение: карта исходного файла

| Диапазон строк | Содержимое |
|---|---|
| 1–7 | `<head>`, meta, подключение XLSX.js |
| 8–375 | `<style>` — все CSS-правила |
| 377–393 | `.app-header` — шапка с поиском, бэкапом, датой |
| 395–402 | `.tabs-bar` — 6 кнопок вкладок |
| 404–522 | 6 секций `.tab-content` (Склад, Трафик, План/Факт, Аналитика, Календарь, История) |
| 524–555 | 4 контекстных меню |
| 557–583 | `#settingsModal` |
| 585–607 | `#linkModal`, `#linksArchiveModal` |
| 609–620 | `#stepFormModal` |
| 622–630 | `#calendarDayModal` |
| 632–654 | `#bulkDeleteModal` |
| 656–680 | `#channelsModal` |
| 682–689 | `.shortcuts-hint` |
| 691–697 | начало `<script>` |
| 693–701 | `getDefaultSkladData()` — seed склада |
| 703–727 | `TABS_CONFIG` |
| 729–738 | `DEFAULT_SELECT_OPTIONS` |
| 740–741 | `MONTHS`, `DEFAULT_GROUPS` |
| 743–779 | `DEFAULT_CHANNELS` (33 канала) |
| 781–833 | Инициализация переменных + save-функции |
| 835–878 | История (`addHistoryEntry`, `renderHistory`, `clearHistory`, `exportHistory`) |
| 880–916 | `updateBackupStatus`, `saveFullBackup` |
| 918–1004 | Экспорт/импорт Excel/CSV |
| 1007–1059 | Глобальный поиск |
| 1061–1153 | Массовые операции (select, bulk delete) |
| 1155–1181 | `printReport`, `setTrafficDateRange`, `clearTrafficDateRange` |
| 1183–1226 | `calculateForecast`, `renderForecast` |
| 1228–1243 | Обработчик переключения вкладок |
| 1245–1321 | Step form (multi-step сделка) |
| 1323–1451 | Ссылки ТИ (open/save/remove/archive) |
| 1453–1507 | Трафик: init, days/weeks helpers, `getSkladStats` |
| 1509–1529 | `getContractsByDay` |
| 1531–1552 | `renderTrafficTables` |
| 1554–1753 | `renderCallsTable`, `renderVisitsTable`, `renderTotalTable` |
| 1755–1761 | `updateDayPlan` |
| 1763–1799 | Недельные сводки |
| 1801–1826 | `getSkladWeekContracts`, `getSkladWeekContractsVisit` |
| 1828–1900 | `updateTrafficCell`, `renderTrafficHeaderKPI`, `updateTrafficStats`, `exportTrafficCSV` |
| 1902–1931 | `initPlanFactMonth`, `renderPlanFactTable` |
| 1933–2067 | Рендер План/Факт (header/body/group/grand-total) |
| 2069–2098 | `updateChannelParam`, `updateChannelDay`, `updateFact`, `recalculateAll` |
| 2100–2168 | Настройки каналов (CRUD) |
| 2170–2207 | `exportPlanFactToExcel`, `importPlanFactFromExcel` (stub) |
| 2209–2256 | Глобальный keydown handler |
| 2258–2350 | `renderTab`, `renderFilters`, `applyColumnWidths`, `renderHeader`, `getFilteredData`, `renderBody`, `renderCell` |
| 2352–2417 | `renderTotalRow`, `updateCell`, `updateCellNum`, `addRow` (мёртвый), `duplicateRow` |
| 2419–2482 | `insertRowAbove/Below`, `deleteSelectedRow`, `selectRow`, `updateStats` |
| 2484–2528 | Resize колонок |
| 2530–2587 | Контекстные меню (show/hide + обработчики) |
| 2589–2663 | Управление колонками (rename, changeType, insert, delete) |
| 2665–2728 | Settings modal (open/close/columns-list) |
| 2730–2782 | `exportCSV`, `importCSV` |
| 2784–2882 | Аналитика (`setAnalyticsGroupBy`, `renderAnalytics`, `applyAnalyticsFilters`, `renderAnalyticsTable`) |
| 2884–2956 | Календарь (`renderCalendar`, `changeCalendarMonth`, `openCalendarDay`, `getFactForDate`) |
| 2958–2969 | `showToast`, `updateCurrentDate` |
| 2971–2980 | Инициализация (render Склада, setInterval проверки бэкапа) |
| 2981–2983 | `</script></body></html>` |

---

## Рекомендации для миграции в Next.js

1. **Сущности БД (Prisma schema):** `SkladRow`, `Channel`, `TrafficEntry`, `TodayPlan`, `CellComment`, `EvaluationLink`, `LinksArchive`, `ChangeHistory`, `PlanFactEntry`, `FactEntry`, `SelectOption`. Большинство — пользовательские данные (нужен `userId`).

2. **Версионирование:** ключи `_v32` — при миграции можно использовать как `version: 32`.

3. **Seed данные:** `DEFAULT_CHANNELS`, `DEFAULT_SELECT_OPTIONS`, `DEFAULT_GROUPS`, `getDefaultSkladData()` — мигрировать в seed-скрипты Prisma.

4. **Что можно исключить (мёртвый код):**
   - `calendarData` / `crm_calendar_data_v32` — объявлено, не используется
   - `addRow()` — не вызывается из UI
   - `openSettings()` / `showSettingsTab()` / `renderColumnsList()` / `editColumn()` / `removeColumn()` / `addColumn()` (из settingsModal) — недостижимы (нет кнопки открытия)
   - `importPlanFactFromExcel()` — stub
   - `getDayName()` использует массив `['Вс','Пн',...]` (周日-сначала), но в `renderCalendar` явно Пн-Вс

5. **Что критично перенести:**
   - Многошаговая форма сделки (16 шагов)
   - Inline-редактирование ячеек (contenteditable pattern) → заменить на controlled inputs
   - Контекстные меню (4 типа) → заменить на Radix ContextMenu
   - Resize колонок → react-resizable / dnd-kit
   - Экспорт/импорт XLSX → `exceljs` или `xlsx-populate`
   - История изменений (server-side events / audit log)
   - localStorage → Postgres через Prisma

6. **Дизайн-система:**
   - Tailwind: `primary=#2a5298`, `accent=#1a73e8`, `success=#28a745`, `danger=#dc3545`, `warning=#ffc107`
   - Градиенты для секций: Зелёный (визиты), Фиолетовый (звонки), Розовый (общий банк)
   - Шрифт — системный `font-sans` (Segoe UI/Tahoma/Inter как fallback)
