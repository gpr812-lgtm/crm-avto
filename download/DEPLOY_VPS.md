# 🚀 Деплой CRM на российский VPS

## Что нужно
1. VPS сервер (Ubuntu 22.04+) — Beget / Timeweb / Reg.ru
2. Домен (необязательно, можно по IP)

---

## Шаг 1: Купить VPS

### Beget (рекомендую — проще всего)
1. Зайдите на https://beget.com
2. VPS → выберите тариф **«Тариф 1»** (199₽/мес, 1 ГБ RAM)
3. ОС: **Ubuntu 22.04**
4. Оплатите (можно помесячно)

### Timeweb
1. https://timeweb.com → Облачные серверы
2. Тариф от 200₽/мес
3. ОС: Ubuntu 22.04

---

## Шаг 2: Подключиться к серверу

После покупки вам дадут:
- IP адрес (например: `193.161.233.10`)
- Пароль root

Откройте терминал на компьютере (Командная строка / PowerShell на Windows, Terminal на Mac):

```bash
ssh root@ВАШ_IP
```
Введите пароль.

---

## Шаг 3: Установить Docker (одна команда)

Скопируйте и вставьте в терминал:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
```

---

## Шаг 4: Загрузить код на сервер

### Вариант А: Через GitHub (рекомендую)
```bash
# На сервере:
apt update && apt install -y git
git clone https://github.com/gpr812-lgtm/crm-avto.git /opt/crm
cd /opt/crm
```

### Вариант Б: Загрузить архив
1. Скачайте архив с кодом
2. Загрузите на сервер через SCP/SFTP

---

## Шаг 5: Запустить CRM

```bash
cd /opt/crm

# Установить пароль БД (замените на свой!)
export DB_PASSWORD="МойСложныйПароль2026"

# Запустить!
docker compose up -d --build
```

Это займёт 5-10 минут (первый раз собирается Docker образ).

---

## Шаг 6: Проверить

Откройте в браузере:
```
http://ВАШ_IP:3000
```

Вход:
- Email: `admin@crm.local`
- Пароль: `admin123`

**Данные сохраняются в PostgreSQL** — при обновлениях кода они не теряются!

---

## Шаг 7: Домен + HTTPS (необязательно)

### Привязать домен:
1. В DNS настройках домена добавьте A-запись → ваш IP
2. На сервере установите Nginx + SSL:

```bash
apt install -y nginx certbot python3-certbot-nginx

# Скопировать конфиг
cp /opt/crm/nginx.conf /etc/nginx/sites-available/crm
ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/

# Замените your-domain.ru на ваш домен
sed -i 's/your-domain.ru/ВАШ_ДОМЕН.ru/g' /etc/nginx/sites-available/crm

# Получить SSL сертификат
certbot --nginx -d ВАШ_ДОМЕН.ru

# Перезапустить Nginx
systemctl restart nginx
```

CRM доступна по: `https://ВАШ_ДОМЕН.ru`

---

## 🔄 Как обновлять код

Когда нужно обновить CRM:

```bash
# На сервере:
cd /opt/crm
git pull
docker compose up -d --build
```

Данные пользователей **не затираются** — они в PostgreSQL контейнере (volume `pgdata`).

---

## 📋 Полезные команды

```bash
# Посмотреть логи
docker compose logs -f app

# Перезапустить
docker compose restart

# Остановить
docker compose down

# Бэкап БД
docker exec crm-db pg_dump -U crm_user crm > backup.sql

# Восстановить из бэкапа
cat backup.sql | docker exec -i crm-db psql -U crm_user crm
```

---

## 💰 Стоимость

| Компонент | Цена |
|-----------|------|
| VPS Beget (1 ГБ RAM) | 199₽/мес |
| Домен .ru | ~200₽/год |
| SSL | Бесплатно (Let's Encrypt) |
| **Итого** | **~220₽/мес** |

---

## ❓ Частые вопросы

**В: Что если VPS перезагрузится?**
О: Docker автоматически запустит CRM (`restart: always` в docker-compose.yml).

**В: Как сделать бэкап?**
О: `docker exec crm-db pg_dump -U crm_user crm > backup_$(date +%Y%m%d).sql`

**В: Можно ли без домена?**
О: Да, доступ по IP: `http://ВАШ_IP:3000`

**В: Хватит ли 1 ГБ RAM?**
О: Да, для CRM с 1-5 автосалонами. Если будет тормозить — апгрейд до 2 ГБ.
