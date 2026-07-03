/**
 * Seed script for CRM
 * Run: bun run db:seed
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const DEFAULT_SELECT_OPTIONS: Record<string, string[]> = {
  model: ['Arrizo 8', 'Tenet T4', 'Tenet T4L', 'Tenet T7', 'Tenet T8'],
  status: ['Продан', 'Склад', 'Отказ'],
  seller: ['Лавреев Сергей', 'Мелузов Евгений', 'Буц Виктория', 'Алексеев Владимир', 'Даниленко Сергей', 'Коваленко Павел'],
  review: ['Нет отзыва', 'Яндекс карты', '2ГИС', 'Рекомендация'],
  traffic: ['🚶 Визит', '📞 Звонок', '📝 Заявка', '👥 Рекомендация'],
  risk: ['1', '2', '3', '4', '5'],
  kr: ['0', '1'],
  ti: ['0', '1', '2'],
}

const DEFAULT_COLUMNS = [
  { key: 'model', label: 'Модель', type: 'select', options: 'model', default: 'Tenet T7', width: 110, order: 1 },
  { key: 'status', label: 'Статус', type: 'select', options: 'status', default: 'Продан', width: 100, order: 2 },
  { key: 'dateDkp', label: 'Дата ДКП', type: 'date', default: '', width: 100, order: 3 },
  { key: 'dateIssued', label: 'Дата выдачи', type: 'date', default: '', width: 110, order: 4 },
  { key: 'seller', label: 'Продавец', type: 'select', options: 'seller', default: '', width: 170, order: 5 },
  { key: 'client', label: 'Клиент', type: 'text', default: '', width: 200, order: 6 },
  { key: 'jok', label: 'ЖОК', type: 'number', default: '0', width: 100, order: 7 },
  { key: 'j', label: 'Ж', type: 'number', default: '0', width: 80, order: 8 },
  { key: 'o', label: 'О', type: 'number', default: '0', width: 80, order: 9 },
  { key: 'k', label: 'К', type: 'number', default: '0', width: 80, order: 10 },
  { key: 'risk', label: 'РИСК', type: 'select', options: 'risk', default: '1', width: 60, order: 11 },
  { key: 'kr', label: 'КР', type: 'select', options: 'kr', default: '0', width: 50, order: 12 },
  { key: 'ti', label: 'ТИ', type: 'select', options: 'ti', default: '0', width: 60, order: 13 },
  { key: 'review', label: 'Отзывы', type: 'select', options: 'review', default: 'Нет отзыва', width: 130, order: 14 },
  { key: 'traffic', label: 'Трафик', type: 'select', options: 'traffic', default: '🚶 Визит', width: 130, order: 15 },
  { key: 'comment', label: 'Комментарий', type: 'text', default: '', width: 250, order: 16 },
]

const DEFAULT_CHANNELS = [
  { name: 'Я.Директ (без НДС)', group: 'Digital', budget: 100000, cpl: 6666.67, rl: 15, sr: 10.0 },
  { name: 'Яндекс органика-поиск', group: 'Digital', budget: 0, cpl: 0, rl: 5, sr: 7.0 },
  { name: 'Google органика-поиск', group: 'Digital', budget: 0, cpl: 0, rl: 0, sr: 7.0 },
  { name: 'LMS - дистибьютор', group: 'Digital', budget: 0, cpl: 0, rl: 5, sr: 7.0 },
  { name: 'Вконтакте таргет', group: 'Digital', budget: 20000, cpl: 2000, rl: 10, sr: 7.0 },
  { name: 'Реклама ВК сообщества', group: 'Digital', budget: 5000, cpl: 1000, rl: 5, sr: 7.0 },
  { name: 'Avito', group: 'Классифайды', budget: 15000, cpl: 1000, rl: 15, sr: 10.0 },
  { name: 'Avito CHERY', group: 'Классифайды', budget: 15000, cpl: 1000, rl: 15, sr: 10.0 },
  { name: 'Auto.ru', group: 'Классифайды', budget: 15000, cpl: 1000, rl: 15, sr: 10.0 },
  { name: 'Auto.ru CHERY', group: 'Классифайды', budget: 15000, cpl: 1000, rl: 15, sr: 10.0 },
  { name: 'Autospot', group: 'Классифайды', budget: 0, cpl: 0, rl: 10, sr: 7.0 },
  { name: 'Drom', group: 'Классифайды', budget: 1600, cpl: 800, rl: 2, sr: 7.0 },
  { name: 'Яндекс Карты', group: 'Геосервисы и SERM', budget: 35000, cpl: 3500, rl: 10, sr: 10.0 },
  { name: 'Яндекс Карты CHERY', group: 'Геосервисы и SERM', budget: 0, cpl: 0, rl: 2, sr: 10.0 },
  { name: '2Gis', group: 'Геосервисы и SERM', budget: 305, cpl: 0, rl: 0, sr: 7.0 },
  { name: 'SMS-рассылка', group: 'Direct', budget: 15000, cpl: 3000, rl: 5, sr: 10.0 },
  { name: 'Лидген', group: 'Direct', budget: 0, cpl: 0, rl: 0, sr: 10.0 },
  { name: 'Т-банк, Сбербанк', group: 'Direct', budget: 0, cpl: 0, rl: 0, sr: 0.0 },
  { name: 'Знакомые', group: 'Direct', budget: 0, cpl: 0, rl: 0, sr: 0.0 },
  { name: 'BTL', group: 'Offline', budget: 0, cpl: 0, rl: 0, sr: 7.0 },
  { name: 'Радио', group: 'Offline', budget: 206000, cpl: 20600, rl: 10, sr: 7.0 },
  { name: 'DOOH / OOH', group: 'Offline', budget: 120000, cpl: 24000, rl: 5, sr: 7.0 },
  { name: 'НДС Яндекс', group: 'Обязательное', budget: 24200, cpl: 0, rl: 0, sr: 0 },
  { name: 'Кабинет Авито', group: 'Обязательное', budget: 12000, cpl: 0, rl: 0, sr: 0 },
  { name: 'Кабинет Авито CHERY', group: 'Обязательное', budget: 12000, cpl: 0, rl: 0, sr: 0 },
  { name: 'Сайт импортера', group: 'Обязательное', budget: 20740, cpl: 0, rl: 0, sr: 0 },
  { name: 'Сайт импортера CHERY', group: 'Обязательное', budget: 20740, cpl: 0, rl: 0, sr: 0 },
  { name: 'Calltouch телефония', group: 'Обязательное', budget: 20000, cpl: 0, rl: 0, sr: 0 },
  { name: 'Calltouch аналитика', group: 'Обязательное', budget: 10000, cpl: 0, rl: 0, sr: 0 },
  { name: 'POSM для шоу-рума', group: 'Обязательное', budget: 10000, cpl: 0, rl: 0, sr: 0 },
  { name: 'POSM для сотрудников', group: 'Обязательное', budget: 10000, cpl: 0, rl: 0, sr: 0 },
  { name: 'Расклейка и оклейка а/м', group: 'Обязательное', budget: 10000, cpl: 0, rl: 0, sr: 0 },
  { name: 'Пешеходы', group: 'Прочее', budget: 0, cpl: 0, rl: 35, sr: 25.0 },
  { name: 'Выдачи других ДЦ', group: 'Прочее', budget: 0, cpl: 0, rl: 0, sr: 0.0 },
  { name: 'Холодные звонки', group: 'Прочее', budget: 0, cpl: 0, rl: 5, sr: 5.0 },
]

const SEED_DEALS = [
  { model: 'Tenet T7', status: 'Отказ', dateDkp: '2026-05-29', dateIssued: '', seller: 'Лавреев Сергей', client: 'Угрюмов Сергей Александрович', jok: 0, j: 0, o: 0, k: 0, risk: '4', kr: '0', ti: '1', review: 'Нет отзыва', traffic: '🚶 Визит', comment: 'Купил джолион у нас', order: 1 },
  { model: 'Tenet T7', status: 'Продан', dateDkp: '2026-06-01', dateIssued: '2026-06-01', seller: 'Мелузов Евгений', client: 'Матюнин Андрей Валентинович', jok: 162541, j: -19746, o: 0, k: 182287, risk: '1', kr: '1', ti: '1', review: 'Нет отзыва', traffic: '📞 Звонок', comment: 'Выдана', order: 2 },
  { model: 'Tenet T4L', status: 'Продан', dateDkp: '2026-06-03', dateIssued: '2026-06-03', seller: 'Буц Виктория', client: 'Евдокимова Елена Васильевна', jok: 140750, j: -39717, o: 0, k: 180467, risk: '1', kr: '1', ti: '1', review: 'Нет отзыва', traffic: '📝 Заявка', comment: 'Выдана', order: 3 },
  { model: 'Tenet T7', status: 'Продан', dateDkp: '2026-06-03', dateIssued: '2026-06-03', seller: 'Буц Виктория', client: 'Кузнецов Александр Сергеевич', jok: 181429, j: 24622, o: 0, k: 156807, risk: '1', kr: '1', ti: '0', review: 'Нет отзыва', traffic: '🚶 Визит', comment: 'Выдана', order: 4 },
  { model: 'Tenet T4', status: 'Продан', dateDkp: '2026-06-04', dateIssued: '2026-06-04', seller: 'Алексеев Владимир', client: 'Григорьев Сергей Павлович', jok: 205796, j: 6324, o: 0, k: 199472, risk: '1', kr: '1', ti: '1', review: 'Яндекс карты', traffic: '🚶 Визит', comment: 'Выдана', order: 5 },
]

async function main() {
  console.log('Seeding database...')

  for (const [dictName, values] of Object.entries(DEFAULT_SELECT_OPTIONS)) {
    for (let i = 0; i < values.length; i++) {
      await db.selectOption.upsert({
        where: { dictName_value: { dictName, value: values[i] } },
        update: { order: i },
        create: { dictName, value: values[i], order: i },
      })
    }
  }
  console.log(`✓ Select options seeded`)

  for (const col of DEFAULT_COLUMNS) {
    await db.dealColumn.upsert({
      where: { key: col.key },
      update: { label: col.label, type: col.type, options: col.options ?? null, default: col.default ?? null, width: col.width, order: col.order },
      create: col,
    })
  }
  console.log(`✓ Columns seeded`)

  for (let i = 0; i < DEFAULT_CHANNELS.length; i++) {
    const ch = DEFAULT_CHANNELS[i]
    await db.channel.upsert({
      where: { name: ch.name },
      update: { group: ch.group, budget: ch.budget, cpl: ch.cpl, rl: ch.rl, sr: ch.sr, order: i },
      create: { ...ch, order: i },
    })
  }
  console.log(`✓ Channels seeded (${DEFAULT_CHANNELS.length})`)

  const existingDeals = await db.deal.count()
  if (existingDeals === 0) {
    for (const deal of SEED_DEALS) {
      await db.deal.create({ data: deal })
    }
    console.log(`✓ Seed deals inserted (${SEED_DEALS.length})`)
  } else {
    console.log(`✓ Deals already exist (${existingDeals}), skipping seed`)
  }

  await db.setting.upsert({
    where: { key: 'analyticsGroupBy' },
    update: {},
    create: { key: 'analyticsGroupBy', value: 'seller' },
  })

  console.log('✅ Seed complete')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
