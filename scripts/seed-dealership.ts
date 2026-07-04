/**
 * Seed: create default dealership + admin user
 * Run: bun run scripts/seed-dealership.ts
 */
import { PrismaClient } from '@prisma/client'
import { createHash } from 'crypto'

const db = new PrismaClient()

// Simple password hashing (for production use bcrypt)
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

async function main() {
  console.log('🌱 Seeding dealership + admin user...')

  // 1. Create default dealership
  const dealership = await db.dealership.upsert({
    where: { name: 'CHERY ВН' },
    update: {},
    create: {
      name: 'CHERY ВН',
      code: 'CHERY-ВН',
    },
  })
  console.log(`✓ Dealership: ${dealership.name} (id=${dealership.id})`)

  // 2. Create admin user
  const adminEmail = 'admin@crm.local'
  const adminPassword = 'admin123'
  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Администратор',
      passwordHash: hashPassword(adminPassword),
      role: 'ADMIN',
      active: true,
    },
  })
  console.log(`✓ Admin user: ${admin.email} (password: ${adminPassword})`)

  // 3. Grant admin access to dealership
  await db.userDealershipAccess.upsert({
    where: { userId_dealershipId: { userId: admin.id, dealershipId: dealership.id } },
    update: {},
    create: { userId: admin.id, dealershipId: dealership.id },
  })
  console.log(`✓ Admin access to ${dealership.name}`)

  // 4. Grant admin access to all tabs
  const allTabs = ['sklad', 'traffic', 'planfact', 'analytics', 'calendar', 'history', 'settings']
  for (const tabKey of allTabs) {
    await db.userTabAccess.upsert({
      where: { userId_tabKey: { userId: admin.id, tabKey } },
      update: { allowed: true },
      create: { userId: admin.id, tabKey, allowed: true },
    })
  }
  console.log(`✓ Admin tab access: all 7 tabs`)

  // 5. Assign existing data to default dealership
  // Set dealershipId=null data to the new dealership
  await db.deal.updateMany({ where: { dealershipId: null }, data: { dealershipId: dealership.id } })
  await db.channel.updateMany({ where: { dealershipId: null }, data: { dealershipId: dealership.id } })
  await db.selectOption.updateMany({ where: { dealershipId: null }, data: { dealershipId: dealership.id } })
  await db.dealColumn.updateMany({ where: { dealershipId: null }, data: { dealershipId: dealership.id } })
  await db.trafficEntry.updateMany({ where: { dealershipId: null }, data: { dealershipId: dealership.id } })
  await db.todayPlan.updateMany({ where: { dealershipId: null }, data: { dealershipId: dealership.id } })
  await db.cellComment.updateMany({ where: { dealershipId: null }, data: { dealershipId: dealership.id } })
  await db.planEntry.updateMany({ where: { dealershipId: null }, data: { dealershipId: dealership.id } })
  await db.factEntry.updateMany({ where: { dealershipId: null }, data: { dealershipId: dealership.id } })
  await db.channelFact.updateMany({ where: { dealershipId: null }, data: { dealershipId: dealership.id } })
  console.log(`✓ Assigned existing data to ${dealership.name}`)

  console.log('\n✅ Seed complete!')
  console.log(`   Login: ${adminEmail}`)
  console.log(`   Password: ${adminPassword}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
