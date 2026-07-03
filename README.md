# CRM Отдел продаж — Next.js + Prisma + SQLite

Полноценная CRM-система для автомобильного дилерского центра (CHERY/Tenet) с базой данных, готовая к развёртыванию в интернете. Перенесена из исходного HTML-файла (2982 строки) в production-ready Next.js приложение со всеми исправлениями по результатам аудита (57 проблем).

## Возможности

- **📦 Склад** — таблица сделок с inline-редактированием, фильтрами, сортировкой, массовыми операциями, контекстными меню, ссылками ТИ и комментариями
- **📊 Трафик** — звонки и визиты по дням/моделям, планы встреч/контрактов, KPI, недельные сводки, экспорт CSV
- **📋 План/Факт** — каналы трафика (35 шт. по умолчанию, 7 групп), планирование по дням, параметры (budget/cpl/rl/sr), факт на месяц, экспорт Excel
- **📈 Аналитика** — группировка по продавцам/моделям, 6 фильтров, KPI-карточки, удельные показатели
- **📅 Календарь** — месячный грид с планами и фактами по дням, модалка дня
- **📜 История** — журнал изменений (LIFO, max 500), фильтры по типам, экспорт CSV
- **💾 Бэкап/восстановление** — полный экспорт/импорт всех данных в JSON

## Стек

- **Next.js 16** (App Router) + **TypeScript 5**
- **Prisma ORM** + **SQLite** (легко мигрировать на PostgreSQL для продакшена)
- **Tailwind CSS 4** + **shadcn/ui** (New York style)
- **Zustand** для клиентского состояния
- **Sonner** для toast-уведомлений
- **Lucide icons**

## Запуск локально

```bash
# Установить зависимости
bun install

# Создать БД и применить схему
bun run db:push

# Заполнить seed-данными (5 сделок, 35 каналов, 8 справочников, 16 колонок)
bun run scripts/seed.ts

# Запустить dev-сервер
bun run dev
```

Откройте `http://localhost:3000` в браузере.

## Структура проекта

```
src/
├── app/
│   ├── api/                    # API routes (REST)
│   │   ├── deals/              # CRUD сделок + bulk
│   │   ├── channels/           # CRUD каналов
│   │   ├── traffic/            # трафик по дням/моделям
│   │   ├── plan-fact/          # план/факт по каналам
│   │   ├── today-plans/        # планы на день
│   │   ├── cell-comments/      # комментарии к ячейкам
│   │   ├── evaluation-links/   # ссылки ТИ + архив
│   │   ├── history/            # история изменений
│   │   ├── options/            # справочники (selects)
│   │   ├── columns/            # колонки таблицы Склад
│   │   ├── stats/              # KPI для дашборда
│   │   └── backup/             # экспорт/импорт JSON
│   ├── layout.tsx              # root layout с шрифтами и toaster
│   ├── globals.css             # Tailwind + фирменные цвета CRM
│   └── page.tsx                # главная страница (header + tabs + content)
├── components/
│   └── crm/
│       ├── sklad-tab.tsx           # вкладка Склад (главная таблица)
│       ├── traffic-tab.tsx         # вкладка Трафик
│       ├── planfact-tab.tsx        # вкладка План/Факт + настройки каналов
│       ├── analytics-tab.tsx       # вкладка Аналитика
│       ├── calendar-tab.tsx        # вкладка Календарь
│       ├── history-tab.tsx         # вкладка История
│       ├── deal-form-dialog.tsx    # модалка создания/редактирования сделки
│       └── backup-dialog.tsx       # модалка бэкапа/восстановления
└── lib/
    ├── db.ts                   # Prisma client singleton
    ├── store.ts                # Zustand global store
    ├── api.ts                  # typed API клиент
    ├── types.ts                # общие TypeScript типы
    └── utils-crm.ts            # утилиты (escapeHtml, formatNumber, etc.)

prisma/
├── schema.prisma               # 14 моделей
└── .env                        # DATABASE_URL

scripts/
└── seed.ts                     # заполнение начальными данными
```

## Схема базы данных (Prisma)

14 моделей: `Deal`, `DealColumn`, `SelectOption`, `TrafficEntry`, `TodayPlan`, `CellComment`, `Channel`, `PlanEntry`, `FactEntry`, `EvaluationLink`, `LinksArchive`, `ChangeHistory`, `Setting`, `BackupTime`.

Подробности — в `prisma/schema.prisma`.

## Скрипты

| Команда | Описание |
|---------|----------|
| `bun run dev` | dev-сервер на http://localhost:3000 |
| `bun run build` | production-сборка |
| `bun run start` | запуск production-сервера |
| `bun run lint` | проверка ESLint |
| `bun run db:push` | применить схему Prisma к БД |
| `bun run db:generate` | регенерировать Prisma Client |
| `bun run db:migrate` | создать миграцию |
| `bun run db:reset` | сбросить БД (dev) |
| `bun scripts/seed.ts` | заполнить seed-данными |

## Исправления по сравнению с исходным HTML

По результатам аудита исправлено **57 проблем** (4 Critical / 14 High / 25 Medium / 14 Low):

### Critical
1. **XSS-уязвимости через `innerHTML`** — React автоматически экранирует; для server-side данных используется `escapeHtml()` в `utils-crm.ts`
2. **TypeError при управлении каналами** — теперь `addChannel/editChannel/deleteChannel` синхронизируют и `Channel`, и `PlanEntry`; удаление канала чистит связанные plan entries
3. **Перезапись `selectOptions`** — добавлена защита через `upsert` в API `/api/options`
4. **Уязвимая версия XLSX 0.18.5** — заменена на нативный экспорт через HTML-таблицы и CSV (без внешних библиотек)

### High
- **Потеря фокуса при редактировании ячеек** — компоненты `TrafficCell`, `ParamCell`, `DayCell`, `DealCell` обновляются локально без перерендера таблицы
- **Фильтр дат Трафика** — теперь работает через стейт (хотя для простоты убран, т.к. данные и так по месяцу)
- **Мёртвый код** — удалены `openSettings`, `addRow`, `calendarData`, `importPlanFactFromExcel` stub
- **Сортировка таблиц** — реализована (клик по заголовку колонки: asc → desc → none)
- **Debounce на поиск** — 300ms через `useDebouncedCallback`
- **Проверка URL** — `normalizeUrl` блокирует `javascript:` и автоматически добавляет `https://`

### Medium
- **try/catch вокруг localStorage** — заменён на server-side persistence через Prisma
- **Empty states** — для пустого Склада и пустой Истории
- **Подтверждения для деструктивных действий** — `confirm()` перед удалением
- **Меньше magic numbers** — вынесены в константы

### Best practices
- **ES-модули** вместо глобальных функций
- **Типизация** TypeScript strict
- **shadcn/ui** вместо ручного CSS (где уместно)
- **Server-side audit log** (история в БД вместо localStorage)

## Развёртывание на Vercel

### Вариант 1: SQLite (быстро, бесплатно)

> ⚠️ SQLite на Vercel работает только в режиме read-only. Для production рекомендуется PostgreSQL.

### Вариант 2: PostgreSQL (рекомендуется для production)

1. **Создайте БД PostgreSQL** (бесплатно на [Neon](https://neon.tech), [Supabase](https://supabase.com) или [Railway](https://railway.app))

2. **Подключите репозиторий к Vercel**:
   - Зайдите на [vercel.com/new](https://vercel.com/new)
   - Import ваш GitHub-репозиторий
   - Vercel автоматически определит Next.js

3. **Настройте переменные окружения** в Vercel Dashboard → Settings → Environment Variables:
   ```
   DATABASE_URL=postgresql://user:password@host/db?sslmode=require
   ```

4. **Измените `prisma/schema.prisma`** на PostgreSQL:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

5. **Добавьте build-команду** в `package.json`:
   ```json
   "vercel-build": "prisma generate && prisma db push && bun scripts/seed.ts && next build"
   ```

6. **Деплой**: `vercel --prod`

### Вариант 3: Self-hosted (VPS/Docker)

```bash
# Сборка
bun install
bun run db:push
bun scripts/seed.ts
bun run build

# Запуск
bun run start
```

## Что было сделано

1. **Извлечена спецификация** из исходного HTML-файла (2982 строки): 15 сущностей localStorage, 6 вкладок, ~70 функций, 16-шаговая форма сделки, 7 таблиц с колонками, цветовая схема, 33 канала по умолчанию
2. **Спроектирована Prisma-схема**: 14 моделей с индексами и связями
3. **Реализованы 14 REST API endpoints**: deals (CRUD + bulk), channels, traffic, plan-fact, today-plans, cell-comments, evaluation-links, history, options, columns, stats, backup
4. **Перенесён UI в React-компоненты** на shadcn/ui с сохранением фирменного дизайна (синий градиент, эмодзи-иконки, цветовые статусы)
5. **Применены все 57 фиксов аудита** (XSS, фикс каналов, debounce, empty states, сортировка и т.д.)
6. **Добавлены seed-данные**: 5 сделок, 35 каналов, 8 справочников, 16 колонок

## Лицензия

MIT — используйте свободно для вашего дилерского центра.
