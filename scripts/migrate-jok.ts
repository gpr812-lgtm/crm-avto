/**
 * Migration script: reorder columns (jok after k) and recompute jok = j + o + k
 * Run: bun run scripts/migrate-jok.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('🚀 Migration: jok reordering + recompute')

  // 1. Reorder columns: jok → after k
  // Current: jok(7), j(8), o(9), k(10)
  // Target:  j(7), o(8), k(9), jok(10)
  const cols = await db.dealColumn.findMany({ orderBy: { order: 'asc' } })
  console.log(`Found ${cols.length} columns`)

  for (const c of cols) {
    let newOrder = c.order
    if (c.key === 'jok') newOrder = 10
    else if (c.key === 'j') newOrder = 7
    else if (c.key === 'o') newOrder = 8
    else if (c.key === 'k') newOrder = 9

    if (newOrder !== c.order) {
      await db.dealColumn.update({ where: { id: c.id }, data: { order: newOrder } })
      console.log(`  ↻ ${c.key}: order ${c.order} → ${newOrder}`)
    }
  }

  // 2. Recompute jok for all existing deals
  const deals = await db.deal.findMany()
  console.log(`\nRecomputing jok for ${deals.length} deals...`)
  let updated = 0
  for (const d of deals) {
    const correctJok = (d.j || 0) + (d.o || 0) + (d.k || 0)
    if (d.jok !== correctJok) {
      await db.deal.update({ where: { id: d.id }, data: { jok: correctJok } })
      console.log(`  ↻ ${d.model} — ${d.client}: jok ${d.jok} → ${correctJok} (${d.j}+${d.o}+${d.k})`)
      updated++
    }
  }
  console.log(`\n✅ Updated ${updated} deals`)
  console.log('✅ Migration complete')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
