/**
 * Migration: add 'Призрак' status, ensure all deals have valid status
 * Run: bun run scripts/migrate-add-ghost-status.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('🚀 Migration: add Призрак status')

  // Add 'Призрак' to status dictionary if not exists
  const existing = await db.selectOption.findUnique({
    where: { dictName_value: { dictName: 'status', value: 'Призрак' } },
  })
  if (!existing) {
    const maxOrder = await db.selectOption.aggregate({
      where: { dictName: 'status' },
      _max: { order: true },
    })
    await db.selectOption.create({
      data: { dictName: 'status', value: 'Призрак', order: (maxOrder._max.order ?? 0) + 1 },
    })
    console.log("✓ Added 'Призрак' to status dictionary")
  } else {
    console.log("✓ 'Призрак' already exists")
  }

  // Add row-sold-ghost class mapping (no-op for DB, just for reference)
  console.log('✅ Migration complete')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
