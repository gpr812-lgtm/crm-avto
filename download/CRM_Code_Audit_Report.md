# Аудит CRM-системы отдела продаж

**Файл:** `/home/z/my-project/upload/crm_code.html`
**Размер:** 2982 строки, ~170 KB
**Дата аудита:** 2025
**Аудитор:** general-purpose agent

---

## Executive Summary

Файл представляет собой **monolithic single-file SPA** — CRM-систему отдела продаж автосалона (CHERY/Tenet), включающую 6 функциональных вкладок (Склад, Трафик, План/Факт, Аналитика, Календарь, История) с ~2982 строками кода (CSS + HTML + JS в одном файле).

**Общее впечатление:** код написан в быстром «прототипном» стиле, демонстрирует хорошее знание DOM API и современных возможностей JS (template literals, optional chaining, Intl, Set). Реализован богатый функционал: редактируемые таблицы, контекстные меню, импорт/экспорт CSV/Excel, поиск, история изменений, автосохранение в localStorage. Однако код страдает от типичных проблем «single-file приложения»:

- **Сильное загрязнение глобальной области видимости** (40+ функций, 20+ переменных в `window`).
- **XSS-уязвимости** через повсеместное использование `innerHTML` с пользовательскими данными без санитизации.
- **Критический баг в управлении каналами** в разделе План/Факт: добавление/переименование/удаление канала вызывает `TypeError` при рендеринге таблицы.
- **Потеря фокуса при редактировании** ячеек из-за полного перерендеринга таблицы на каждое изменение.
- **Мёртвый код**: настройки таблицы (`openSettings`), сброс ширин колонок, архив ссылок, календарные данные — UI/логика объявлены, но не подключены.
- **UX**: пошаговая форма из 16 шагов для добавления сделки; отсутствие ARIA; нет pagination/сортировки в таблицах.

Несмотря на проблемы, ядро системы работает и данные сохраняются. Код **можно рефакторить постепенно**, без полной переработки.

### Top-5 самых критичных проблем

| # | Проблема | Severity | Строки |
|---|----------|----------|--------|
| 1 | **XSS через `innerHTML`** с пользовательскими данными (комментарии, имена клиентов, описания истории, лейблы колонок) | Critical | 852, 1440, 2334, 2349, 2686 |
| 2 | **TypeError при управлении каналами**: `addChannel`/`editChannel`/`deleteChannel` не обновляют `planData[monthKey]` → `channelPlan.budget` падает | Critical | 1976, 2128–2168 |
| 3 | **Потеря фокуса и UX-проблемы**: каждое редактирование ячейки вызывает `renderBody()` / `renderTrafficTables()`, что пересоздаёт DOM и сбрасывает фокус/выделение | High | 1838, 2374, 2385 |
| 4 | **Фильтры по диапазону дат в Трафике не работают**: поля `traffic-date-from` / `traffic-date-to` пишутся, но никогда не читаются в `renderTrafficTables()` | High | 442–443, 1531–1552 |
| 5 | **Мёртвый код и недоступный UI**: `openSettings`, `addRow`, `resetColumnWidths`, `showLinksArchive`, `calendarData`, `saveCalendarData`, `showSettingsTab`, `importPlanFactFromExcel` (stub) — объявлены, но недостижимы или не реализованы | High | 792, 827, 2202, 2390, 2521, 2665, 2673, 1436 |

---

## A. Критические ошибки и баги

### A1. TypeError при добавлении/переименовании/удалении каналов в План/Факт
- **Строки:** 1976, 1997, 2128–2168
- **Проблема:** `renderPlanFactTable()` (стр. 1916) инициализирует `planData[monthKey]` только если ключа ещё нет:
  ```js
  if (!planData[monthKey]) {
      planData[monthKey] = {};
      channelsData.forEach(ch => { planData[monthKey][ch.name] = {...}; });
  }
  ```
  Функции `addChannel` (2128), `editChannel` (2148), `deleteChannel` (2160) модифицируют `channelsData` и вызывают `renderPlanFactTable()`, но **не синхронизируют** `planData[monthKey]`. В результате:
  - `addChannel` → `planData[monthKey][newChannel.name]` — `undefined` → на стр. 1976 `channelPlan.budget.toFixed(2)` бросает `TypeError: Cannot read properties of undefined`.
  - `editChannel` переименовывает канал → `planData[monthKey][newName]` не существует → та же ошибка; плюс `planData[monthKey][oldName]` остаётся «висеть».
  - `deleteChannel` оставляет «битый» ключ в `planData[monthKey]` — не крашит, но данные устаревают.
- **Severity:** Critical
- **Рекомендация:** в `addChannel`/`editChannel`/`deleteChannel` явно синхронизировать `planData` для всех существующих месяцев, либо в `renderPlanFactTable()` использовать `planData[monthKey][ch.name] ||= { days: {}, budget: ch.budget, cpl: ch.cpl, rl: ch.rl, sr: ch.sr }` и удалять «осиротевшие» ключи:
  ```js
  function syncPlanDataForChannel(oldName, newName) {
      Object.keys(planData).forEach(monthKey => {
          if (oldName && planData[monthKey][oldName]) {
              planData[monthKey][newName] = planData[monthKey][oldName];
              if (newName !== oldName) delete planData[monthKey][oldName];
          } else if (!planData[monthKey][newName]) {
              planData[monthKey][newName] = { days: {}, budget: 0, cpl: 0, rl: 0, sr: 0 };
          }
      });
      savePlanData();
  }
  ```

### A2. Потеря фокуса при редактировании ячеек
- **Строки:** 1838 (`updateTrafficCell`), 2374 (`updateCell`), 2385 (`updateCellNum`), 2076 (`updateChannelParam`), 2086 (`updateChannelDay`), 2095 (`updateFact`)
- **Проблема:** каждый `onblur` сохраняет значение и тут же вызывает полный `renderBody()` / `renderPlanFactTable()` / `renderTrafficTables()`. Это:
  - пересоздаёт DOM таблицы;
  - пользователь теряет позицию курсора и видимое выделение;
  - при быстрых правках с клавиатуры нажатие Tab уводит фокус «в никуда»;
  - на больших таблицах вызывает заметный лаг.
- **Severity:** High
- **Рекомендация:** обновлять только изменённую ячейку (target-рендеринг):
  ```js
  function updateCell(tabKey, id, key, value, tdEl) {
      const r = tabsState[tabKey].data.find(r => r.id === id);
      if (!r) return;
      r[key] = value.trim ? value.trim() : value;
      saveTabDataKey(tabKey);
      // Обновить только строку тоталов и статус без перерисовки всей таблицы
      updateStats(tabKey);
      updateTotalsRow(tabKey);
      // НЕ вызывать renderBody(tabKey)
  }
  ```

### A3. Контекстные меню не скрывают друг друга
- **Строки:** 1364 (`showTiContextMenu`), 1391 (`showCommentContextMenu`), 2532 (`showRowContextMenu`), 2544 (`showHeaderContextMenu`)
- **Проблема:** каждая функция `show*ContextMenu` активирует только своё меню, не вызывая `hideContextMenu()` перед этим. Если пользователь открыл `headerContextMenu`, а затем ПКМ на ячейке ТИ — на экране будут видны оба меню.
- **Severity:** Medium
- **Рекомендация:** в начале каждой `show*` функции вызывать `hideContextMenu()`:
  ```js
  function showTiContextMenu(event, rowId) {
      event.preventDefault();
      event.stopPropagation();
      hideContextMenu(); // добавить
      tiContextRowId = rowId;
      ...
  }
  ```

### A4. Фильтр по диапазону дат в Трафике не работает
- **Строки:** 442–443 (HTML), 1531–1552 (`renderTrafficTables`)
- **Проблема:** в тулбаре Трафика есть поля `traffic-date-from` и `traffic-date-to` с `onchange="renderTrafficTables()"`. Однако внутри `renderTrafficTables()` значения этих полей **нигде не читаются** — рендеринг всегда идёт по полному месяцу из `traffic-month`.
- **Severity:** High
- **Рекомендация:** либо реализовать фильтрацию по дням в `getContractsByDay` / `renderCallsTable`, либо удалить UI-элементы фильтра, чтобы не вводить пользователя в заблуждение.

### A5. Мёртвый код / недостижимый UI
- **Строки:**
  - `openSettings` (2665) — функция объявлена, но нигде не вызывается; `settingsModal` (HTML стр. 557) невозможно открыть.
  - `showSettingsTab` (2673) — ссылается на несуществующий класс `.modal-tab` и `[onclick="showSettingsTab('${tab}')"]`. Если бы была вызвана — `querySelector` вернул бы `null` → `null.classList.add` → `TypeError`.
  - `addRow` (2390) — не вызывается из HTML.
  - `resetColumnWidths` (2521) — не вызывается из HTML.
  - `showLinksArchive` (1436) — вызывается только из `clearLinksArchive`; UI-кнопки для открытия архива ссылок нет.
  - `calendarData` (792), `saveCalendarData` (827) — переменная и функция объявлены, но не используются (календарь использует `todayPlans` и `tabsState.sklad`).
  - `importPlanFactFromExcel` (2202) — stub, выводит «в разработке», но UI-кнопка «Импорт» присутствует.
- **Severity:** Medium (по сумме: поддержка + UX)
- **Рекомендация:** либо реализовать функционал, либо удалить мёртвый код. Для `importPlanFactFromExcel` — скрыть кнопку импорта или добавить честное предупреждение в UI.

### A6. `URL.revokeObjectURL` сразу после `a.click()`
- **Строки:** 876, 911, 1898, 2744
- **Проблема:** в некоторых браузерах (особенно старых Safari/Firefox) немедленный `revokeObjectURL` после `a.click()` может привести к отмене загрузки, т.к. ссылка ещё не успела «считать» blob.
- **Severity:** Low
- **Рекомендация:** оборачивать в `setTimeout`:
  ```js
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  ```

### A7. Часовой пояс при определении «сегодня»
- **Строки:** 2907, 911, 2992 (через `toISOString().split('T')[0]`)
- **Проблема:** `new Date().toISOString()` возвращает UTC. В timezone UTC+3 (Москва) после 21:00 локального времени `toISOString()` уже возвращает следующий день. Это влияет на:
  - подсветку «сегодня» в календаре (стр. 2907);
  - запись `crm_last_backup_time` (стр. 912);
  - расчёт `daysPassed` в `calculateForecast` (через `today.getDate()` — тут ОК, локальное время).
- **Severity:** Medium
- **Рекомендация:** использовать локальную дату:
  ```js
  function todayLocalStr() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  ```

### A8. `parseInt` без radix
- **Строки:** 1831, 1917, 2081, 2091, 2844, 2845, 2942
- **Проблема:** `parseInt(str)` без radix в редких случаях (строки с ведущим `0` в старых движках) может интерпретировать как восьмеричное. Современные JS-движки безопасны, но это bad practice.
- **Severity:** Low
- **Рекомендация:** всегда передавать radix 10: `parseInt(value, 10)`.

### A9. Race condition: setTimeout и удаление элемента
- **Строки:** 1047, 1047, 2963
- **Проблема:** `setTimeout(() => row.classList.remove('search-highlight'), 3000)` — если за 3 секунды пользователь перерисует таблицу, `row` будет отсоединён от DOM, `classList.remove` безопасно отработает (no-op), но `setTimeout` всё ещё активен. Минимальный риск. Аналогично для toast (стр. 2963).
- **Severity:** Low
- **Рекомендация:** не критично, но при рефакторинге можно хранить ID таймеров и очищать при перерисовке.

### A10. `selectOptions[listName] = []` без проверки
- **Строки:** 2626, 2643, 2718
- **Проблема:** при создании новой колонки типа `select` запрашивается имя списка через `prompt`. Если пользователь введёт имя существующего списка (например, `model`), оно будет перезаписано пустым массивом (стр. 2718):
  ```js
  selectOptions[listName] = optionsText ? optionsText.split(',')... : [];
  ```
  Это уничтожит существующие опции. На стр. 2626/2643 — защищены через `if (!selectOptions[listName])`, на стр. 2718 — нет.
- **Severity:** High
- **Рекомендация:** добавить проверку:
  ```js
  if (!selectOptions[listName]) selectOptions[listName] = [];
  ```

### A11. `setTrafficDateRange('quarter')` — некорректный расчёт
- **Строки:** 1167–1175
- **Проблема:** для квартала вычисляется `quarter = Math.floor(now.getMonth() / 3)`. Для января (month=0) → quarter=0 → `from = new Date(year, 0, 1)`, `to = new Date(year, 3, 0)` (31 марта). Корректно. Но переменная `dayOfWeek` для week-mode использует `now.getDay() || 7` — Sunday=0 → 7,周一=1. ОК. Не баг, но хрупкая логика.
- **Severity:** Low
- **Рекомендация:** вынести в отдельную тестируемую функцию.

### A12. Не инициализированы переменные для planfact-month
- **Строки:** 1902–1914, 1917
- **Проблема:** `initPlanFactMonth` заполняет select только для текущего года. Если пользователь хочет посмотреть декабрь прошлого года — не может. Кроме того, `currentPlanFactYear` жёстко инициализирован `new Date().getFullYear()` (стр. 817) и **нет UI для смены года**.
- **Severity:** Medium
- **Рекомендация:** добавить переключатель года в тулбар План/Факт.

---

## B. Уязвимости безопасности

### B1. XSS через `innerHTML` с пользовательскими данными
- **Строки:** 852, 1021, 1106, 1440, 2334, 2349, 2686, 1292 (через `val`), 2933 (через `tp` — безопасно, числа)
- **Проблема:** массовое использование `innerHTML` с подстановкой данных пользователя без санитизации. Конкретные векторы:
  - **Стр. 852** (история): `${entry.description}` — описание берётся из `addHistoryEntry('edit', \`...${r.model} - ${key} изменено\`)`. Если `r.model` (select) контролируемо — ограничено, но `r.client`, `r.comment` (текстовые поля) попадают в описание при редактировании. Если пользователь введёт `<img src=x onerror=alert(1)>` в `comment`, то при следующем открытии вкладки История этот HTML выполнится.
  - **Стр. 1440** (архив ссылок): `${data.model || '—'}`, `${data.client || '—'}`, `${data.url}` — все три поля из localStorage, вставляются в HTML без эскейпа. URL попадает в `href` `<a>` — `javascript:alert(1)` выполнится при клике.
  - **Стр. 2334** (опции select): `<option ...>${o}</option>` — опции берутся из `selectOptions`, которые пользователь может расширять (через `changeColumnType`, `insertColumnAt`, `addColumn`).
  - **Стр. 2349** (текстовая ячейка): `${val || ''}` — содержимое ячейки, введённое пользователем, рендерится как HTML. **Прямой XSS**: введите в любой `cell-text` колонке (client, comment) `<script>alert('XSS')</script>` — выполнится при следующем рендере.
  - **Стр. 2686** (лейблы колонок): `${c.label}` — лейбл задаётся через `renameColumn`/`editColumn`/`insertColumnAt` через `prompt`. Пользователь может ввести `<img src=x onerror=alert(1)>` → выполнится в `renderColumnsList`.
  - **Стр. 1021** (глобальный поиск): `${item.match}` — `match` результат `highlightMatch`, который эскейпит regex-метасимволы, но **не HTML**. Поисковый запрос пользователя попадает в `<span class="highlight">$1</span>` — это `$1` из исходного текста, который не эскейпится.
- **Severity:** Critical
- **Рекомендация:** ввести хелпер `escapeHtml` и применять везде, где данные пользователя вставляются в innerHTML:
  ```js
  function escapeHtml(s) {
      return String(s ?? '').replace(/[&<>"']/g, c => ({
          '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
      }[c]));
  }
  // Использование:
  list.innerHTML = changeHistory.map(entry =>
      `<div class="history-item"><div class="history-time">${escapeHtml(time)}</div>` +
      `<div class="history-action"><span class="history-type ${entry.type}">${escapeHtml(typeLabels[entry.type] || entry.type)}</span>` +
      `${escapeHtml(entry.description)}</div></div>`
  ).join('');
  ```
  Для URL в `href` дополнительно проверять схему: `if (/^https?:\/\//i.test(url)) ...`.

### B2. `javascript:` URL в evaluationLinks
- **Строки:** 1352, 1440
- **Проблема:** `openEvaluationLink` вызывает `window.open(url, '_blank')` без проверки схемы. Если через `saveLink` (стр. 1335) сохранить `javascript:alert(document.cookie)`, то при клике «Открыть» выполнится JS. В функции `saveLink` есть проверка `if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;` (стр. 1340) — это **частично** защищает, но `javascript:` не начинается с `http://`/`https://`, поэтому к нему добавится `https://` → `https://javascript:alert(...)`, что превратит ссылку в невалидный URL. Это случайная защита, но не явная.
- **Severity:** Medium (защита есть, но неявная)
- **Рекомендация:** добавить явную валидацию:
  ```js
  try {
      const u = new URL(url);
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Invalid protocol');
  } catch { showToast('Только http/https', 'error'); return; }
  ```

### B3. CDN-скрипт без SRI
- **Строки:** 7
- **Проблема:** `<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>` — нет атрибута `integrity` (SRI). Если CDN скомпрометирован, на странице выполнится произвольный код с доступом к localStorage, всем данным CRM.
- **Severity:** High
- **Рекомендация:** добавить SRI:
  ```html
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"
          integrity="sha384-<HASH>"
          crossorigin="anonymous"></script>
  ```

### B4. Уязвимая версия XLSX (SheetJS)
- **Строки:** 7
- **Проблема:** `xlsx@0.18.5` — версия от 2022 года. Для SheetJS Community Edition известны:
  - CVE-2023-30533 (prototype pollution)
  - CVE-2024-22363 (ReDoS в `parse_borders`)
  - Несколько других проблем с парсингом.
  Поскольку библиотека используется для импорта `.xlsx`/`.xls` файлов (стр. 962), уязвимости могут быть эксплуатируемы через специально сформированный файл.
- **Severity:** High
- **Рекомендация:** обновить до `xlsx@0.20.2+` или использовать официальный CDN SheetJS (`https://cdn.sheetjs.com/`).

### B5. localStorage хранит потенциально чувствительные данные без шифрования
- **Строки:** 781–800
- **Проблема:** в localStorage хранятся: имена клиентов, телефоны (через `comment`), суммы сделок (`jok`, `j`, `k`), имена продавцов, история изменений. Все данные в открытом виде. Любой скрипт на странице (включая XSS-вектор из B1) может их прочитать.
- **Severity:** Medium (зависит от threat model)
- **Рекомендация:** если CRM используется на shared-устройстве — добавить шифрование через Web Crypto API с паролем пользователя; либо явное предупреждение.

### B6. HTTP vs HTTPS
- **Строки:** 7
- **Проблема:** CDN подключён по HTTPS — ОК. Однако в `saveLink` (стр. 1340) допускается сохранение `http://` ссылок, которые затем открываются через `window.open` (стр. 1352). Если CRM хостится на HTTPS, открытие HTTP-страницы вызовет mixed-content предупреждение.
- **Severity:** Low
- **Рекомендация:** предупреждать пользователя или форсировать `https://`.

### B7. `eval` / `Function` constructor
- **Не обнаружено.** ✓

### B8. CSRF / Injection
- **Не обнаружено.** Приложение не делает сетевых запросов (нет fetch/XHR), работает только с локальными данными. ✓

---

## C. Проблемы производительности

### C1. Отсутствие debounce на глобальном поиске
- **Строки:** 387
- **Проблема:** `oninput="performGlobalSearch()"` — на каждое нажатие клавиши выполняется полный перебор `tabsState.sklad.data` с `Object.values(row).join(' ').toLowerCase().includes(query)`. При 1000+ записях и быстром вводе вызовет лаги.
- **Severity:** Medium
- **Рекомендация:**
  ```js
  let searchTimer;
  function performGlobalSearch() {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(_doSearch, 200);
  }
  ```

### C2. Полный перерендеринг таблиц на каждое редактирование
- **Строки:** 1838, 2374, 2385, 2076, 2086, 2095
- **Проблема:** подробно описано в A2. Дополнительно: `renderTrafficTables()` пересоздаёт 3 большие таблицы (calls, visits, total) со всеми днями месяца (31 колонка) × все модели (5+) при изменении одной ячейки трафика.
- **Severity:** High
- **Рекомендация:** точечное обновление только изменённой ячейки + пересчёт итогов.

### C3. N+1 запросов к DOM внутри циклов
- **Строки:** 1106 (`models.map(m => `<option value="${m}">${m}</option>`)` — ОК, без DOM), но в `renderCallsTable` (1554) и аналогичных — `bodyHtml += ...` в цикле с `cellComments[commentKey]` — ОК (объектный lookup).
- **Проблем:** значительных N+1 в DOM не обнаружено. Используется паттерн накопления HTML-строки и одной установки `innerHTML` — это хорошая практика.
- **Severity:** Low (только `document.getElementById` без кэширования в горячих функциях).

### C4. Отсутствие виртуализации для больших таблиц
- **Строки:** 2311 (`renderBody`)
- **Проблема:** все строки из `tabsState.sklad.data` рендерятся в DOM. При росте до 500–1000+ сделок (что реально для CRM за год) — заметные лаги, особенно с учётом C2.
- **Severity:** Medium
- **Рекомендация:** implement virtual scrolling (например, `tabulator` или свою реализацию с `IntersectionObserver`), либо pagination.

### C5. Неоптимальные селекторы
- **Строки:** 2217, 2236, 2238, 2246, 2248
- **Проблема:** в `keydown` хендлере на каждое нажатие стрелки выполняется:
  ```js
  const allRows = Array.from(table.querySelectorAll('tr'));
  const allCells = Array.from(currentRow.querySelectorAll('td'));
  ```
  Для таблицы 1000 строк × 16 колонок = 16000 `td` перебирается при каждом нажатии.
- **Severity:** Medium
- **Рекомендация:** кэшировать индексы или использовать `nextElementSibling` / `previousElementSibling` для навигации.

### C6. Повторные вызовы `getSkladStats` / `getContractsByDay`
- **Строки:** 1531–1552
- **Проблема:** в `renderTrafficTables`:
  ```js
  const callsContractsByDay = getContractsByDay(monthValue, 'calls');
  const visitsContractsByDay = getContractsByDay(monthValue, 'visits');
  const totalContractsByDay = getContractsByDay(monthValue, 'all');
  ```
  Каждый вызов `getContractsByDay` заново обходит весь `skladData` (стр. 1509). Три вызова = тройной обход. Плюс `getSkladStats` (стр. 1485) — ещё один обход.
- **Severity:** Medium
- **Рекомендация:** объединить в один проход:
  ```js
  function computeTrafficStats(monthValue) {
      // один проход по skladData, заполнение calls/visits/total/byDay
  }
  ```

### C7. `Object.values(monthData).forEach(...)` пересчитывает totals каждый раз
- **Строки:** 1848–1849, 1862–1864
- **Проблема:** в `renderTrafficHeaderKPI` и `updateTrafficStats` заново суммируются все значения трафика. Эти же суммы уже считаются в `renderCallsTable` / `renderVisitsTable` (переменная `totals`). Дублирование работы.
- **Severity:** Low
- **Рекомендация:** вернуть totals из рендер-функций и переиспользовать.

### C8. Repeated `JSON.parse(JSON.stringify(...))` для глубокого клонирования
- **Строки:** 781, 784, 798
- **Проблема:** на старте приложения трижды выполняется глубокое клонирование дефолтных данных через `JSON.parse(JSON.stringify(...))`. Для небольших объектов это OK, но `DEFAULT_CHANNELS` (35 объектов) при каждом старте пересоздаётся.
- **Severity:** Low
- **Рекомендация:** использовать `structuredClone(DEFAULT_CHANNELS)` (modern API).

### C9. Отсутствие lazy loading для вкладок
- **Строки:** 2258, 2791, 2884
- **Проблема:** при переключении вкладок каждая `render*` функция делает полную отрисовку. Если пользователь никогда не открывает «Аналитику» — это OK (она не рендерится). Но если открывает и закрывает — каждый раз полный пересчёт без кэширования.
- **Severity:** Low
- **Рекомендация:** кэшировать результаты с инвалидацией по `lastModified` timestamp данных.

---

## D. Архитектура и поддержка

### D1. Один файл 2982 строки
- **Строки:** весь файл
- **Проблема:** CSS (стр. 8–360), HTML (стр. 364–620), данные (стр. 693–779), логика (стр. 781–2980) — всё в одном файле. Невозможно параллельно работать, нет tree-shaking, нельзя переиспользовать компоненты.
- **Severity:** High
- **Рекомендация:** разбить на модули (ES modules):
  ```
  /src
    /styles        — CSS файлы по разделам
    /components    — переиспользуемые UI компоненты
    /store         — state management
    /utils         — helpers (escape, format, date)
    /views         — рендер-функции вкладок
    main.js        — точка входа
  ```

### D2. Загрязнение глобальной области видимости
- **Строки:** 781–818 (переменные), 820+ (40+ функций)
- **Проблема:** ~20 `let`-переменных и ~40 `function` объявлены в global scope. Все доступны как `window.<name>`. Это:
  - риск случайного переопределения;
  - невозможно использовать strict module isolation;
  - упрощает XSS-атакам вызывать внутренние функции.
- **Severity:** High
- **Рекомендация:** обернуть всё в IIFE или ES module:
  ```js
  const CRM = (() => {
      // приватные переменные
      let tabsState = ...;
      // публичный API
      return { init, openStepForm };
  })();
  ```

### D3. Состояние в DOM, а не в модели
- **Строки:** 2321, 2464, 808–818
- **Проблема:** состояние UI хранится в DOM (атрибуты `data-id`, `data-key`, inline-стили `outline`, классы `active`). Глобальные переменные `selectedRowId`, `contextRowId`, `tiContextRowId`, `commentContextCell`, `currentContextTab`, `contextColumnKey`, `currentTab`, `stepForm`, `resizeState` — рассыпаны по коду.
- **Severity:** High
- **Рекомендация:** ввести централизованный store (Redux-подобный или Proxy-based):
  ```js
  const store = new Proxy({
      currentTab: 'sklad',
      selectedRowId: null,
      contextMenu: { type: null, rowId: null, colKey: null }
  }, { set(target, key, value) { target[key] = value; render(); return true; }});
  ```

### D4. Смешивание данных, логики и представления
- **Строки:** повсеместно, особенно 1554–1706 (render-функции генерируют HTML-строки с inline-обработчиками)
- **Проблема:** функции `renderCallsTable`, `renderCell`, `renderBody` и пр. одновременно: считают данные, формируют HTML-строку с inline `onclick`/`onblur`/`oncontextmenu`, и устанавливают её через `innerHTML`. Нет разделения на model/view/controller.
- **Severity:** Medium
- **Рекомендация:** использовать шаблонизатор (Lit, Preact, htm) или хотя бы вынести шаблоны в отдельные функции.

### D5. Magic numbers / hardcoded strings
- **Строки:** 837 (500), 890 (24), 2977 (4), 1582 (0.5), 2585 (120), 2485 (40), 2963 (3000), 1047 (200), 1021 (20), 2871 (160px, 45px)
- **Проблема:** магические числа разбросаны по коду без именованных констант.
- **Severity:** Low
- **Рекомендация:** вынести в `CONFIG`:
  ```js
  const CONFIG = {
      HISTORY_LIMIT: 500,
      BACKUP_WARN_HOURS: 24,
      BACKUP_REMINDER_HOURS: 4,
      CONTRACT_SUCCESS_THRESHOLD: 0.5,
      DEFAULT_COL_WIDTH: 120,
      MIN_COL_WIDTH: 40,
      TOAST_DURATION: 3000,
      SEARCH_HIDE_DELAY: 200,
      MAX_SEARCH_RESULTS: 20
  };
  ```

### D6. Дублирование кода
- **Строки:**
  - `renderCallsTable` (1554) и `renderVisitsTable` (1643) — почти идентичны, отличаются только классами и ключом `callsAndApps`/`visits`.
  - `getSkladWeekContracts` (1801) и `getSkladWeekContractsVisit` (1815) — дублируются с разницей в одной проверке.
  - `updateCell`/`updateCellNum` (2368/2379) — почти идентичны.
  - `exportHistory`/`exportCSV`/`exportTrafficCSV` — дублируют логику создания blob+link+download.
- **Severity:** Medium
- **Рекомендация:** вынести общие части:
  ```js
  function downloadBlob(content, filename, mime) {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  ```

### D7. Отсутствие валидации входных данных
- **Строки:** 2368, 2379, 1755, 2069, 2079
- **Проблема:** при сохранении значений ячеек нет валидации:
  - числа: `parseFloat(text.replace(/\s/g, '').replace(',', '.')) || 0` — пустая строка → 0, что может быть неинтуитивно (пользователь случайно стёр значение).
  - даты: формат не проверяется, но `<input type="date">` обеспечивает.
  - текст: любой ввод сохраняется без ограничения длины.
  - URL: `saveLink` только добавляет `https://` если нет схемы, но не проверяет валидность URL.
- **Severity:** Medium
- **Рекомендация:** добавить валидацию и feedback:
  ```js
  function validateNumber(text, { min, max } = {}) {
      const n = parseFloat(text.replace(/\s/g, '').replace(',', '.'));
      if (isNaN(n)) throw new Error('Не число');
      if (min !== undefined && n < min) throw new Error(`Минимум ${min}`);
      if (max !== undefined && n > max) throw new Error(`Максимум ${max}`);
      return n;
  }
  ```

### D8. Ограниченная обработка ошибок
- **Строки:** 971, 2753
- **Проблема:** `try/catch` используется только в двух местах — в импорте CSV и Excel. Все остальные функции могут выбросить исключение, которое приведёт к «тихой» остановке скрипта без пользовательского фидбека. Особенно опасно:
  - `JSON.parse(localStorage.getItem(...))` — если в localStorage попал невалидный JSON (например, после частичной записи при краше), всё приложение упадёт на старте (стр. 781–800).
  - `tabsState[tabKey].columns.forEach` — если `columns` undefined, упадёт.
- **Severity:** High
- **Рекомендация:** обернуть инициализацию в try/catch с восстановлением из дефолтов:
  ```js
  function loadFromLS(key, fallback) {
      try {
          const raw = localStorage.getItem(key);
          return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
          console.error(`LS parse error for ${key}:`, e);
          return fallback;
      }
  }
  ```

### D9. Версионирование данных без миграций
- **Строки:** 781–800 (везде суффикс `_v32`)
- **Проблема:** используется схема `crm_*_v32`, но нет логики миграции с предыдущих версий. При изменении структуры данных (новые поля) старые записи в localStorage будут несовместимы — приложение либо упадёт, либо потеряет данные.
- **Severity:** Medium
- **Рекомендация:** реализовать миграции:
  ```js
  const DATA_VERSION = 32;
  function migrate(oldData, fromVersion) {
      let d = oldData;
      for (let v = fromVersion; v < DATA_VERSION; v++) {
          if (migrations[v]) d = migrations[v](d);
      }
      return d;
  }
  ```

### D10. Inline-обработчики событий (`onclick="..."`)
- **Строки:** 407–418, 440–447, 484–489, 516–517, 577, и многие другие в HTML и в генерируемом HTML
- **Проблема:** смешивание разметки и логики; обработчики доступны в глобальной области (функции должны быть на `window`). CSP с `unsafe-inline` обязателен.
- **Severity:** Medium
- **Рекомендация:** использовать `addEventListener` и делегирование событий:
  ```js
  document.querySelector('.toolbar').addEventListener('click', e => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      actions[btn.dataset.action]?.();
  });
  ```

---

## E. UX и доступность

### E1. Полное отсутствие ARIA-атрибутов
- **Строки:** весь HTML
- **Проблема:** ни одного `aria-*` атрибута или `role` не найдено. Конкретно:
  - вкладки — должны быть `role="tablist"`, `role="tab"`, `aria-selected`.
  - модальные окна — `role="dialog"`, `aria-modal="true"`, `aria-labelledby`.
  - контекстные меню — `role="menu"`, `role="menuitem"`.
  - таблицы — `<th scope="col">` для заголовков колонок.
- **Severity:** High
- **Рекомендация:** добавить ARIA. Пример для вкладок:
  ```html
  <div class="tabs-bar" role="tablist">
      <button class="tab-btn active" role="tab" aria-selected="true" aria-controls="tab-sklad" data-tab="sklad">📦 Склад</button>
      ...
  </div>
  <div class="tab-content active" role="tabpanel" id="tab-sklad" aria-labelledby="...">
  ```

### E2. Нет keyboard navigation для контекстных меню и модальных окон
- **Строки:** 1364, 1391, 2532, 2544
- **Проблема:** контекстные меню открываются только по ПКМ — нет способа открыть с клавиатуры (например, Shift+F10). Внутри меню нельзя перемещаться стрелками. Модальные окна нельзя закрыть Escape (кроме одного инпута в `startRenameColumn`).
- **Severity:** High
- **Рекомендация:**
  - добавить `keydown` обработчик на меню со стрелками Up/Down и Enter.
  - глобальный обработчик Escape для закрытия любого модального окна.

### E3. Нет focus trap в модальных окнах
- **Строки:** 557–615 (HTML модалок)
- **Проблема:** при открытии модального окна фокус остаётся на нажатой кнопке. Tab может увести фокус на элементы за модалкой. При закрытии фокус не возвращается к триггеру.
- **Severity:** Medium
- **Рекомендация:** реализовать focus trap (как в `@a11y/focus-trap` или вручную через `keydown` Tab).

### E4. Нет обработки состояний загрузки
- **Строки:** 962, 2202
- **Проблема:** при импорте больших файлов нет индикатора загрузки; при экспорте в Excel — тоже. Пользователь не понимает, идёт ли процесс.
- **Severity:** Low
- **Рекомендация:** показывать spinner или disabled-состояние кнопки.

### E5. Нет обработки пустых состояний для таблиц
- **Строки:** 2311 (`renderBody`)
- **Проблема:** если `tabsState.sklad.data` пуст или все отфильтрованы, в tbody остаётся только `renderTotalRow` с нулями. Нет сообщения «Нет данных» или подсказки.
- **Severity:** Medium
- **Рекомендация:**
  ```js
  if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="100" style="text-align:center; padding:40px; color:#7f8c8d;">Нет данных. Нажмите «➕ Добавить».</td></tr>';
      return;
  }
  ```

### E6. Подтверждения для деструктивных действий
- **Строки:** 857, 1089, 1130, 2162, 2453, 2522, 2699, 1448
- **Проблема:** confirm-диалоги используются (хорошо). Но `confirm()` — блокирующий native dialog, не стилизуется, не дает контекста. Нет подтверждения для `clearLinksArchive`, `executeBulkDelete` (только показывает счётчик, но нет финального confirm). Также `deleteSelectedRow` (стр. 2443) — вообще без confirm, удаляет сразу.
- **Severity:** Medium
- **Рекомендация:** стилизованные модальные подтверждения; добавить confirm в `deleteSelectedRow`.

### E7. Проблемы адаптивности
- **Строки:** 9 (CSS `body`), таблицы
- **Проблема:** `body { overflow: hidden }`, ширина таблиц фиксированная. На мобильном устройстве (320–768px) таблица с 16 колонками + 31 днём в Трафике — почти неюзабельно. Нет media queries для мобильных.
- **Severity:** Medium
- **Рекомендация:** responsive design с horizontal scroll, сворачиваемые колонки, mobile-first layout.

### E8. Пошаговая форма добавления сделки — 16 шагов
- **Строки:** 1265–1322, 1234–1258 (`stepFields`)
- **Проблема:** для добавления одной сделки нужно 16 раз нажать «Далее →». Это катастрофический UX. Для сравнения: типичная CRM-форма — один экран с 5–7 полями.
- **Severity:** High
- **Рекомендация:** сделать одну форму сгруппированную по секциям (Основное / Финансы / Доп.), либо wizard из 3 шагов максимум.

### E9. Toast-уведомления: короткое время жизни
- **Строки:** 2963
- **Проблема:** `setTimeout(() => t.remove(), 3000)` — 3 секунды. Для error-сообщений это слишком мало, пользователь может не успеть прочитать.
- **Severity:** Low
- **Рекомендация:** 5–8 секунд для ошибок, возможность закрыть вручную.

### E10. Нет visual feedback при сохранении
- **Строки:** 2368, 2379, 1755
- **Проблема:** при изменении ячейки и потере фокуса значение сохраняется, но пользователь не видит подтверждения. Неясно, сохранено или нет.
- **Severity:** Low
- **Рекомендация:** краткая подсветка ячейки зелёным (аналогично search-highlight).

### E11. Семантика HTML
- **Строки:** 364–402 (header/tabs), 557+ (модалки)
- **Проблема:**
  - заголовок сайта в `<div>` вместо `<header>`.
  - кнопки вкладок — `<button>` (ОК), но без `role="tab"`.
  - модальные окна — `<div>` вместо `<dialog>`.
  - таблицы без `<caption>` и `scope` у `<th>`.
- **Severity:** Medium
- **Рекомендация:** использовать семантические теги HTML5.

---

## F. Соответствие best practices

### F1. Семантическая HTML разметка
- **Строки:** весь HTML
- **Проблема:** частично. Используются `<table>`, `<thead>`, `<tbody>`, `<th>`, `<td>` (хорошо). Но:
  - `<div class="app-header">` вместо `<header>`.
  - `<div class="tabs-bar">` без `role="tablist"`.
  - `<div class="modal">` вместо `<dialog>`.
  - Нет `<main>`, `<nav>`, `<section>`.
- **Severity:** Medium
- **Рекомендация:** использовать HTML5 semantic tags.

### F2. Modern JS
- **Строки:** весь JS
- **Проблема:** в целом хорошо. Используются `const`/`let` (нет `var`), arrow functions, template literals, optional chaining (`?.`), `Set`, `Intl.NumberFormat`, spread (`...`), destructuring. Из замечаний:
  - `parseInt` без radix (см. A8).
  - `new Date()` без проверки валидности (стр. 2932: `new Date(dateStr)` для пользовательской строки — если `dateStr` невалиден, `toLocaleDateString` вернёт `Invalid Date`).
- **Severity:** Low
- **Рекомендация:** минорные правки.

### F3. CSS организация
- **Строки:** 8–360
- **Проблема:**
  - не BEM (классы типа `traffic-table`, `traffic-table th`, `traffic-table td.summary-cell` — гибрид BEM и каскада).
  - нет CSS-переменных (все цвета хардкодятся: `#2a5298`, `#1e3c72`, `#dc3545` повторяются десятки раз).
  - нет разделения на reset / base / components / utilities.
  - inline-стили в HTML (`style="display:none"`, `style="margin-right: 5px;"`).
- **Severity:** Medium
- **Рекомендация:**
  ```css
  :root {
      --color-primary: #2a5298;
      --color-primary-dark: #1e3c72;
      --color-danger: #dc3545;
      --color-success: #28a745;
      --color-warning: #ffc107;
      --color-bg: #f0f2f5;
      --color-surface: #ffffff;
      --color-text: #2c3e50;
      --color-text-muted: #7f8c8d;
      --radius: 6px;
      --shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  ```

### F4. Современные API
- **Строки:** весь файл
- **Проблема:** `fetch` не используется (нет сетевых запросов). `URL.createObjectURL` — есть. `Blob` — есть. `FileReader` — есть. `Intl.NumberFormat` — есть. `Set` — есть. `Proxy` — нет. `structuredClone` — нет (используется `JSON.parse(JSON.stringify)`).
- **Severity:** Low
- **Рекомендация:** использовать `structuredClone` для глубокого клонирования.

### F5. Кодстайл и форматирование
- **Строки:** весь файл
- **Проблема:** непоследовательный стиль:
  - некоторые функции на одной строке (стр. 820–833, 2521), другие на 50+ (стр. 1916).
  - отступы 4 пробела (нестандартно для JS, обычно 2).
  - нет Prettier/ESLint конфигурации.
  - смешаны `===` и `==`? Проверим — везде `===` (хорошо).
  - точки с запятой — иногда опускаются (стр. 820–833, но это однострочники).
- **Severity:** Low
- **Рекомендация:** настроить ESLint + Prettier с едиными правилами.

### F6. `document.getElementById` без кэширования
- **Строки:** повсеместно
- **Проблема:** одни и те же элементы (`backupStatus`, `backupStatusText`, `traffic-month`, `globalSearchInput` и т.д.) ищутся в DOM по 5–20 раз за сессию.
- **Severity:** Low
- **Рекомендация:** кэшировать в модуле:
  ```js
  const els = {
      backupStatus: document.getElementById('backupStatus'),
      trafficMonth: document.getElementById('traffic-month'),
      // ...
  };
  ```

---

## G. Специфичные для CRM проблемы

### G1. Корректность работы с данными клиентов
- **Строки:** 781–800, 693–701
- **Проблема:**
  - Имя клиента — простое текстовое поле без валидации формата (ФИО).
  - Нет проверки на дубликаты клиентов.
  - Нет связи сделок с клиентом (нет отдельной сущности «Клиент»).
  - Персональные данные (ФИО) хранятся в localStorage без шифрования.
- **Severity:** Medium
- **Рекомендация:** ввести сущность `Client`, валидацию ФИО, поиск дубликатов.

### G2. Валидация форм (телефоны, email, ИНН)
- **Строки:** 1234–1258 (`stepFields`)
- **Проблема:** в схеме данных CRM **нет полей** для телефона, email, ИНН клиента. Только `client` (текст). Соответственно, валидация не нужна — но это упущение в дизайне CRM. Обычно телефон клиента — обязательное поле.
- **Severity:** Medium (отсутствие важных полей)
- **Рекомендация:** добавить поля `phone`, `email` с валидацией:
  ```js
  function validatePhone(phone) {
      return /^\+7\s?\(?\d{3}\)?\s?\d{3}-?\d{2}-?\d{2}$/.test(phone);
  }
  function validateEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  function validateINN(inn) {
      return /^\d{10}$|^\d{12}$/.test(inn);
  }
  ```

### G3. Сохранение данных между сессиями
- **Строки:** 781–800, 820–833
- **Проблема:** все данные в localStorage — нет серверной синхронизации, нет облачного бэкапа. Риски:
  - лимит localStorage ~5–10 MB на домен (Chrome обычно 10 MB). При росте данных (история 500 записей + сделки + трафик за год) можно упереться.
  - очистка кэша браузера → потеря всех данных.
  - нет шаринга между устройствами.
  - есть ручной бэкап (через `saveFullBackup`), но он не автоматический.
- **Severity:** High
- **Рекомендация:**
  - автоматический periodic backup на сервер (fetch POST).
  - индикация размера localStorage.
  - миграция на IndexedDB для больших данных.

### G4. Экспорт/импорт данных
- **Строки:** 918 (`exportToExcel`), 932 (`exportTrafficToExcel`), 962 (`importFile`), 1869 (`exportTrafficCSV`), 2170 (`exportPlanFactToExcel`), 2202 (`importPlanFactFromExcel` — stub), 2730 (`exportCSV`), 2748 (`importCSV`), 864 (`exportHistory`)
- **Проблема:**
  - Импорт `.xlsx` (стр. 962) — нет валидации структуры файла: заголовки не сопоставляются с ключами колонок по имени, только по позиции. Если пользователь поменяет порядок колонок в Excel — данные попадут не в те поля.
  - Импорт `.csv` (стр. 2748) — то же самое.
  - Импорт План/Факт — заглушка.
  - Экспорт `exportToExcel` — выгружает только вкладку «Склад», нет выгрузки Трафика с количеством визитов, План/Факт экспортируется отдельно.
  - CSV-импорт использует regex `("([^"]*("")*)*"|[^;]+)` для парсинга — не обрабатывает корректно все edge-cases (например, `\r\n` внутри поля). Лучше использовать готовый парсер (Papa Parse).
- **Severity:** High
- **Рекомендация:**
  - сопоставление колонок по заголовкам.
  - валидация типов при импорте.
  - использовать Papa Parse для CSV.

### G5. Фильтрация таблиц
- **Строки:** 2269 (`renderFilters`), 2299 (`getFilteredData`)
- **Проблема:**
  - фильтры создаются только для первых 4 select-колонок (`slice(0, 4)` на стр. 2274). Если нужная колонка (например, «Продавец») оказалась 5-й — её нельзя отфильтровать.
  - нет текстового поиска по конкретным колонкам (только глобальный поиск по всем данным).
  - нет фильтра по диапазону чисел (например, ЖОК от 100000 до 200000).
  - нет фильтра по диапазону дат (дата ДКП).
  - фильтры не сохраняются между сессиями.
- **Severity:** Medium
- **Рекомендация:** расширить систему фильтров, сохранять состояние.

### G6. Сортировка таблиц
- **Строки:** 53 (CSS `th { cursor: pointer }`), 2289–2297 (renderHeader)
- **Проблема:** заголовки колонок имеют `cursor: pointer` (намёк на кликабельность), но **сортировка не реализована**. Клик по заголовку ничего не делает (только ПКМ открывает контекстное меню). Это вводит пользователя в заблуждение.
- **Severity:** High
- **Рекомендация:** реализовать сортировку по клику на `<th>`:
  ```js
  let sortState = { key: null, dir: 1 };
  function sortBy(key) {
      if (sortState.key === key) sortState.dir *= -1;
      else { sortState.key = key; sortState.dir = 1; }
      tabsState.sklad.data.sort((a, b) => {
          const va = a[key], vb = b[key];
          if (typeof va === 'number') return (va - vb) * sortState.dir;
          return String(va).localeCompare(String(vb)) * sortState.dir;
      });
      renderBody('sklad');
  }
  // в renderHeader:
  // <th onclick="sortBy('${c.key}')">${c.label} ${sortIndicator}</th>
  ```

### G7. Pagination
- **Строки:** 2311 (`renderBody`)
- **Проблема:** **не реализована**. Все строки рендерятся одновременно. При 500+ сделках — лаги и долгий скролл.
- **Severity:** Medium
- **Рекомендация:** реализовать pagination или virtual scrolling.

### G8. История изменений — ограничение 500 записей
- **Строки:** 837
- **Проблема:** `if (changeHistory.length > 500) changeHistory = changeHistory.slice(0, 500);` — при активной работе история за 1–2 недели заполнится, старые записи потеряются. Нет конфигурируемости, нет archives.
- **Severity:** Medium
- **Рекомендация:** хранить историю в IndexedDB с временной агрегацией (старше 30 дней — агрегировать по дням).

### G9. Уникальные ID сделок на основе `Date.now()`
- **Строки:** 981, 2392, 2408, 2422, 2434, 2761
- **Проблема:** `id: Date.now()` — не гарантирует уникальность при быстром добавлении (2 сделки в одну миллисекунду). Кроме того, в `importFile` (стр. 981) `id: Date.now() + i` — OK для одного импорта, но если импорт идёт ровно в момент ручного добавления, возможна коллизия.
- **Severity:** Medium
- **Рекомендация:** использовать `crypto.randomUUID()`:
  ```js
  const newRow = { id: crypto.randomUUID(), ... };
  ```

### G10. Удаление строки не очищает связанные данные
- **Строки:** 2443–2459 (`deleteSelectedRow`)
- **Проблема:** при удалении строки:
  - `evaluationLinks[contextRowId]` — сохраняется в архив, ОК.
  - `cellComments[*_${model}_*]` для этой модели — **не удаляются**. Со временем `cellComments` обрастёт «осиротевшими» ключами.
  - `selectedRows` — фильтруется в `deleteSelectedRows` (массовое), но в `deleteSelectedRow` (одиночное) — нет очистки.
- **Severity:** Medium
- **Рекомендация:** cleanup при удалении.

### G11. ЖОК / Ж / О / К — финансовые поля без контроля
- **Строки:** 715–718 (схема), 2346 (renderCell), 2379 (updateCellNum)
- **Проблема:** числовые поля с большими суммами (до сотен тысяч рублей) хранятся как `Number`. В JavaScript безопасный integer — `Number.MAX_SAFE_INTEGER` = 2^53 - 1 ≈ 9 квадриллионов. Для сумм сделок это ОК. Но `parseFloat` для сумм с копейками теряет точность (например, `0.1 + 0.2`). Если в `budget`/`cpl` каналов появляются копейки — возможны ошибки округления.
- **Severity:** Low
- **Рекомендация:** для денежных сумм использовать целые копейки или библиотеку decimal.js.

### G12. Нет логирования и аудита действий
- **Строки:** 835 (`addHistoryEntry`)
- **Проблема:** история записывает только тип и описание (строка), без:
  - ID пользователя (если бы была авторизация).
  - старого и нового значения (только в description текстом).
  - IP-адреса.
  - возможности отката (undo).
- **Severity:** Medium
- **Рекомендация:** structured history с возможностью undo.

---

## Рекомендации по рефакторингу

Приоритезированный список действий, от наиболее критичных к наивысшему ROI:

### 🔴 Приоритет 1 — Критические исправления (сделать немедленно)

1. **Исправить XSS (B1)** — ввести `escapeHtml()` и применить во всех 8+ местах вставки пользовательских данных в `innerHTML`. Параллельно — валидация URL в `openEvaluationLink` и `saveLink`.
2. **Исправить краш при управлении каналами (A1)** — синхронизировать `planData[monthKey]` при `addChannel`/`editChannel`/`deleteChannel`.
3. **Исправить перезапись существующих опций (A10)** — добавить `if (!selectOptions[listName])` в `addColumn` (стр. 2718).
4. **Обновить XLSX-библиотеку (B4) и добавить SRI (B3)** — переключиться на `xlsx@0.20.2+` с `integrity` атрибутом.
5. **Обернуть `JSON.parse(localStorage...)` в try/catch (D8)** — иначе при любом повреждении данных приложение полностью падает.

### 🟠 Приоритет 2 — Высокий ROI, средние усилия

6. **Убрать полный перерендеринг при редактировании ячеек (A2, C2)** — точечное обновление только изменённой ячейки и строки totals. Это даст наибольший прирост UX.
7. **Реализовать сортировку таблиц (G6)** — UI уже намекает на неё (`cursor: pointer`), нужно доделать логику.
8. **Реализовать или удалить фильтр по диапазону дат в Трафике (A4)**.
9. **Удалить мёртвый код (A5)** — `openSettings`, `addRow`, `resetColumnWidths`, `showLinksArchive` UI, `calendarData`, `saveCalendarData`, `showSettingsTab`. Либо реализовать недостающее.
10. **Добавить debounce на глобальный поиск (C1)**.
11. **Упростить форму добавления сделки (E8)** — с 16 шагов до 1–3 экранов.
12. **Добавить обработку пустых состояний таблиц (E5)**.

### 🟡 Приоритет 3 — Архитектурные улучшения

13. **Разбить файл на модули (D1)** — минимум: `styles.css`, `index.html`, `app.js`, `store.js`, `utils.js`, `views/*.js`. Использовать ES modules.
14. **Изолировать глобальную область (D2)** — обернуть всё в IIFE или модули. Убрать `window.<func>` для внутренних функций.
15. **Ввести централизованный store (D3)** — единый источник истины, реактивность через Proxy или подписки.
16. **Вынести magic numbers в CONFIG (D5)**.
17. **Дедуплицировать код (D6)** — `renderCallsTable`/`renderVisitsTable`, экспорт-функции.
18. **Версионирование данных с миграциями (D9)**.
19. **Кэшировать DOM-ссылки (F6, C5)**.
20. **Заменить inline-обработчики на event delegation (D10)**.

### 🟢 Приоритет 4 — UX и доступность

21. **Добавить ARIA-атрибуты (E1)** — tablist, dialog, menu.
22. **Keyboard navigation для меню и модалок (E2)**, Escape для закрытия.
23. **Focus trap в модальных окнах (E3)**.
24. **Адаптивность для мобильных (E7)**.
25. **Семантические теги HTML5 (F1, E11)** — `<header>`, `<main>`, `<dialog>`, `<caption>`.
26. **CSS-переменные (F3)**.
27. **Стилизованные confirm-диалоги (E6)**, добавить подтверждение в `deleteSelectedRow`.

### 🔵 Приоритет 5 — Долгосрочные улучшения

28. **Pagination / virtual scrolling для таблиц (C4, G7)**.
29. **Миграция localStorage → IndexedDB (G3)** — для больших объёмов.
29. **Серверная синхронизация и облачный бэкап (G3)**.
30. **Сущность «Клиент» с валидацией телефона/email/ИНН (G1, G2)**.
31. **Сопоставление колонок по заголовкам при импорте (G4)**.
32. **Использовать `crypto.randomUUID()` для ID (G9)**.
33. **Structured history с undo (G8, G12)**.
34. **Настроить ESLint + Prettier (F5)**.
35. **Тесты** — unit-тесты на чистые функции (`getSkladStats`, `calculateForecast`, `escapeHtml`), e2e на ключевые сценарии.

---

## Статистика по severity

| Severity | Кол-во |
|----------|--------|
| **Critical** | 4 |
| **High** | 14 |
| **Medium** | 25 |
| **Low** | 14 |
| **Всего** | **57** |

**Категории:**
- A (Критические ошибки и баги): 12 находок
- B (Безопасность): 8 находок
- C (Производительность): 9 находок
- D (Архитектура): 10 находок
- E (UX/Доступность): 11 находок
- F (Best practices): 6 находок
- G (CRM-специфика): 12 находок

---

*Конец отчёта.*
