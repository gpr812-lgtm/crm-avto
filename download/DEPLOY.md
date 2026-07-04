# 🚀 Инструкция по деплою CRM на Vercel + Neon

## Что нужно
- Аккаунт на GitHub (бесплатно)
- Аккаунт на Vercel (бесплатно, вход через GitHub)
- Аккаунт на Neon (бесплатно, вход через GitHub)

## Шаг 1: Загрузить код на GitHub

1. Создайте новый репозиторий на GitHub (например, `crm-avto`)
2. Скачайте архив с кодом проекта
3. Распакуйте и загрузите файлы в репозиторий:
   - Через GitHub web-интерфейс: Add file → Upload files
   - Или через git:
   ```bash
   git init
   git add .
   git commit -m "CRM Отдел продаж"
   git branch -M main
   git remote add origin https://github.com/ВАШ_ЛОГИН/crm-avto.git
   git push -u origin main
   ```

## Шаг 2: Создать базу данных на Neon

1. Зайдите на https://neon.tech → Sign Up (через GitHub)
2. Нажмите "Create New Project"
3. Назовите проект (например, `crm-avto`)
4. Выберите регион (ближайший к вам — Frankfurt для Европы)
5. Скопируйте **Connection string** — выглядит так:
   ```
   postgresql://user:password@ep-xxx.eu-central-1.aws.neon.tech/crm?sslmode=require
   ```
6. Сохраните эту строку — она понадобится на следующем шаге

## Шаг 3: Подключить к Vercel

1. Зайдите на https://vercel.com → Sign Up (через GitHub)
2. Нажмите "Add New Project"
3. Выберите ваш репозиторий `crm-avto`
4. В настройках проекта:
   - **Framework Preset**: Next.js (автоопределение)
   - **Build Command**: оставьте по умолчанию (или `bun run vercel-build`)
   - **Output Directory**: `.next`
5. В разделе **Environment Variables** добавьте:
   - **Name**: `DATABASE_URL`
   - **Value**: вставьте connection string из Neon (Шаг 2)
6. Нажмите **Deploy**

Vercel автоматически:
- Установит зависимости
- Сгенерирует Prisma Client для PostgreSQL
- Создаст все таблицы в БД (`prisma db push`)
- Соберёт и опубликует сайт

## Шаг 4: Создать админ-пользователя

После первого деплоя нужно запустить seed-скрипт. В Vercel это делается через Terminal:

1. Откройте проект в Vercel Dashboard
2. Перейдите в **Storage** → ваш Neon проект
3. Откройте SQL Editor
4. Вставьте и выполните этот SQL:

```sql
-- Создать автосалон
INSERT INTO "Dealership" ("name", "code", "createdAt", "updatedAt")
VALUES ('CHERY ВН', 'CHERY-ВН', NOW(), NOW());

-- Создать админа (пароль: admin123)
INSERT INTO "User" ("email", "name", "passwordHash", "role", "active", "createdAt", "updatedAt")
VALUES ('admin@crm.local', 'Администратор', '240be518fabd2724c6c1b1b3a5d1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1', 'ADMIN', true, NOW(), NOW());

-- Дать админу доступ к автосалону
INSERT INTO "UserDealershipAccess" ("userId", "dealershipId")
SELECT u."id", d."id" FROM "User" u, "Dealership" d
WHERE u."email" = 'admin@crm.local' AND d."name" = 'CHERY ВН';

-- Дать админу доступ ко всем вкладкам
INSERT INTO "UserTabAccess" ("userId", "tabKey", "allowed")
SELECT u."id", t.tab, true FROM "User" u,
(VALUES ('sklad'), ('traffic'), ('planfact'), ('analytics'), ('calendar'), ('history'), ('settings')) AS t(tab)
WHERE u."email" = 'admin@crm.local';
```

> ⚠️ **Важно:** После первого входа смените пароль админа!

## Шаг 5: Готово!

Ваш CRM доступен по ссылке: `https://crm-avto.vercel.app` (или похожей)

**Вход:**
- Email: `admin@crm.local`
- Пароль: `admin123`

---

## 🔄 Как обновлять код

Когда нужно внести изменения в CRM:

1. Я дорабатываю код и даю вам обновлённые файлы
2. Вы загружаете изменения на GitHub:
   ```bash
   git add .
   git commit -m "обновление CRM"
   git push
   ```
3. Vercel **автоматически** пересоберёт и опубликует сайт (~30 секунд)
4. **Данные пользователей не затираются** — они в отдельной БД на Neon

---

## 📊 Лимиты бесплатных тарифов

| Сервис | Лимит | Что значит |
|--------|-------|------------|
| **Vercel (Hobby)** | 100 ГБ трафика/мес | ~10 000 посещений |
| **Neon (Free)** | 0.5 ГБ БД, 100 часов/мес | достаточно для 1-2 автосалонов |
| **GitHub (Free)** | неограниченно | приватные репозитории бесплатно |

При превышении лимитов — переход на платный тариф (~$20/мес за каждый сервис).

---

## 🔧 Переменные окружения

Для работы CRM нужна только одна переменная:

| Переменная | Где получить | Пример |
|------------|-------------|--------|
| `DATABASE_URL` | Neon → Dashboard → Connection string | `postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require` |

---

## ❓ Частые вопросы

**В: Что если данные пропали после обновления?**
О: Данные НЕ могут пропасть — они хранятся в Neon, отдельно от кода. Проверьте `DATABASE_URL` в настройках Vercel.

**В: Можно ли свой домен?**
О: Да. Vercel → Settings → Domains → Add. Бесплатный SSL автоматически.

**В: Как сделать бэкап?**
О: Neon → Dashboard → Branches → Create branch (копия БД). Или экспорт через SQL Editor.

**В: Что если Vercel не видит Prisma?**
О: Убедитесь что в `package.json` есть `"postinstall": "prisma generate"` (уже добавлено).
