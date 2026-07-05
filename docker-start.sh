#!/bin/sh
# ============================
# docker-start.sh — запуск CRM
# ============================
set -e

echo "🚀 Starting CRM..."

# Generate Prisma client for PostgreSQL
echo "📋 Generating Prisma client..."
bunx prisma generate --schema=prisma/schema.prod.prisma

# Push schema to database (create tables)
echo "📋 Pushing schema to database..."
bunx prisma db push --schema=prisma/schema.prod.prisma --accept-data-loss

# Run seed if database is empty
echo "🌱 Checking if seed needed..."
node -e "
const { PrismaClient } = require('@prisma/client');
const { createHash } = require('crypto');
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.dealership.count();
  if (count === 0) {
    console.log('🌱 Seeding database...');
    const d = await prisma.dealership.create({ data: { name: 'CHERY ВН', code: 'CHERY-ВН' } });
    const u = await prisma.user.create({ data: { email: 'admin@crm.local', name: 'Администратор', passwordHash: createHash('sha256').update('admin123').digest('hex'), role: 'ADMIN', active: true } });
    await prisma.userDealershipAccess.create({ data: { userId: u.id, dealershipId: d.id } });
    const tabs = ['sklad','traffic','planfact','analytics','calendar','history','settings'];
    for (const t of tabs) await prisma.userTabAccess.create({ data: { userId: u.id, tabKey: t, allowed: true } });
    console.log('✅ Seed complete: admin@crm.local / admin123');
  } else {
    console.log('✅ Database already has data, skipping seed');
  }
}
main().catch(console.error).finally(() => prisma.\$disconnect());
"

# Start Next.js
echo "▶️ Starting Next.js server..."
exec bunx next start -p 3000
