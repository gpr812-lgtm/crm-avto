#!/bin/bash
# Deploy script: update all API routes to filter by dealershipIds
# Run on server: bash /tmp/update_api_filter.sh

set -e
cd /opt/crm

echo "=== Updating API routes to filter by dealershipIds ==="

# Helper: parse dealershipIds from query or body
# We'll add this to each API route

# 1. /api/deals — filter GET by dealershipIds
cat > /tmp/patch_deals.py << 'PYEOF'
import re

with open('src/app/api/deals/route.ts', 'r') as f:
    content = f.read()

# Add dealershipIds parsing to GET
content = content.replace(
    "const search = url.searchParams.get('search') || undefined",
    "const search = url.searchParams.get('search') || undefined\n    const dealershipIdsParam = url.searchParams.get('dealershipIds')\n    const dealershipIds = dealershipIdsParam ? dealershipIdsParam.split(',').map(Number) : undefined"
)

# Add dealershipIds filter to where clause
content = content.replace(
    "AND: [",
    "AND: [\n          dealershipIds && dealershipIds.length > 0 ? { dealershipId: { in: dealershipIds } } : {},"
)

with open('src/app/api/deals/route.ts', 'w') as f:
    f.write(content)
print("✓ deals route updated")
PYEOF
python3 /tmp/patch_deals.py

# 2. /api/channels — filter GET by dealershipIds
cat > /tmp/patch_channels.py << 'PYEOF'
with open('src/app/api/channels/route.ts', 'r') as f:
    content = f.read()
content = content.replace(
    "const channels = await db.channel.findMany({ orderBy: { order: 'asc' } })",
    """const url = new URL(req.url)
    const dIds = url.searchParams.get('dealershipIds')
    const dealershipIds = dIds ? dIds.split(',').map(Number) : undefined
    const channels = await db.channel.findMany({ 
      where: dealershipIds && dealershipIds.length > 0 ? { dealershipId: { in: dealershipIds } } : {},
      orderBy: { order: 'asc' } 
    })"""
)
with open('src/app/api/channels/route.ts', 'w') as f:
    f.write(content)
print("✓ channels route updated")
PYEOF
python3 /tmp/patch_channels.py

# 3. /api/options — filter GET by dealershipIds
cat > /tmp/patch_options.py << 'PYEOF'
with open('src/app/api/options/route.ts', 'r') as f:
    content = f.read()
content = content.replace(
    "const opts = await db.selectOption.findMany({\n      where: { dictName: dict },\n      orderBy: { order: 'asc' },\n    })",
    """const dIds = url.searchParams.get('dealershipIds')
    const dealershipIds = dIds ? dIds.split(',').map(Number) : undefined
    const opts = await db.selectOption.findMany({
      where: { 
        dictName: dict,
        ...(dealershipIds && dealershipIds.length > 0 ? { dealershipId: { in: dealershipIds } } : {}),
      },
      orderBy: { order: 'asc' },
    })"""
)
content = content.replace(
    "const all = await db.selectOption.findMany({ orderBy: [{ dictName: 'asc' }, { order: 'asc' }] })",
    """const dIds2 = url.searchParams.get('dealershipIds')
    const dealershipIds2 = dIds2 ? dIds2.split(',').map(Number) : undefined
    const all = await db.selectOption.findMany({ 
      where: dealershipIds2 && dealershipIds2.length > 0 ? { dealershipId: { in: dealershipIds2 } } : {},
      orderBy: [{ dictName: 'asc' }, { order: 'asc' }] 
    })"""
)
with open('src/app/api/options/route.ts', 'w') as f:
    f.write(content)
print("✓ options route updated")
PYEOF
python3 /tmp/patch_options.py

# 4. /api/columns — filter GET
cat > /tmp/patch_columns.py << 'PYEOF'
with open('src/app/api/columns/route.ts', 'r') as f:
    content = f.read()
content = content.replace(
    "const cols = await db.dealColumn.findMany({ orderBy: { order: 'asc' } })",
    """const url = new URL(req.url)
    const dIds = url.searchParams.get('dealershipIds')
    const dealershipIds = dIds ? dIds.split(',').map(Number) : undefined
    const cols = await db.dealColumn.findMany({
      where: dealershipIds && dealershipIds.length > 0 ? { dealershipId: { in: dealershipIds } } : {},
      orderBy: { order: 'asc' }
    })"""
)
with open('src/app/api/columns/route.ts', 'w') as f:
    f.write(content)
print("✓ columns route updated")
PYEOF
python3 /tmp/patch_columns.py

# 5. /api/traffic — filter GET
cat > /tmp/patch_traffic.py << 'PYEOF'
with open('src/app/api/traffic/route.ts', 'r') as f:
    content = f.read()
content = content.replace(
    "const entries = await db.trafficEntry.findMany({ where: { monthKey: month } })",
    """const dIds = url.searchParams.get('dealershipIds')
    const dealershipIds = dIds ? dIds.split(',').map(Number) : undefined
    const entries = await db.trafficEntry.findMany({ where: { monthKey: month, ...(dealershipIds && dealershipIds.length > 0 ? { dealershipId: { in: dealershipIds } } : {}) } })"""
)
content = content.replace(
    "const plans = await db.todayPlan.findMany({ where: { monthKey: month } })",
    """const plans = await db.todayPlan.findMany({ where: { monthKey: month, ...(dealershipIds && dealershipIds.length > 0 ? { dealershipId: { in: dealershipIds } } : {}) } })"""
)
# Comments — filter by dealershipIds too
content = content.replace(
    "const comments = await db.cellComment.findMany()",
    """const comments = await db.cellComment.findMany({ where: dealershipIds && dealershipIds.length > 0 ? { dealershipId: { in: dealershipIds } } : {} })"""
)
with open('src/app/api/traffic/route.ts', 'w') as f:
    f.write(content)
print("✓ traffic route updated")
PYEOF
python3 /tmp/patch_traffic.py

# 6. /api/plan-fact — filter GET
cat > /tmp/patch_planfact.py << 'PYEOF'
with open('src/app/api/plan-fact/route.ts', 'r') as f:
    content = f.read()
content = content.replace(
    "db.channel.findMany({ orderBy: { order: 'asc' } })",
    "db.channel.findMany({ where: dIds && dIds.length > 0 ? { dealershipId: { in: dIds } } : {}, orderBy: { order: 'asc' } })"
)
content = content.replace(
    "db.planEntry.findMany({ where: { monthKey: month } })",
    "db.planEntry.findMany({ where: { monthKey: month, ...(dIds && dIds.length > 0 ? { dealershipId: { in: dIds } } : {}) } })"
)
content = content.replace(
    "db.channelFact.findMany({ where: { monthKey: month } })",
    "db.channelFact.findMany({ where: { monthKey: month, ...(dIds && dIds.length > 0 ? { dealershipId: { in: dIds } } : {}) } })"
)
# Add dIds parsing
content = content.replace(
    "if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })",
    "if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })\n  const dIdsParam = url.searchParams.get('dealershipIds')\n  const dIds = dIdsParam ? dIdsParam.split(',').map(Number) : undefined"
)
with open('src/app/api/plan-fact/route.ts', 'w') as f:
    f.write(content)
print("✓ plan-fact route updated")
PYEOF
python3 /tmp/patch_planfact.py

# 7. /api/stats — filter by dealershipIds
cat > /tmp/patch_stats.py << 'PYEOF'
with open('src/app/api/stats/route.ts', 'r') as f:
    content = f.read()
content = content.replace(
    "export async function GET() {",
    "export async function GET(req: NextRequest) {\n  const url = new URL(req.url)\n  const dIds = url.searchParams.get('dealershipIds')\n  const dealershipIds = dIds ? dIds.split(',').map(Number) : undefined\n  const dFilter = dealershipIds && dealershipIds.length > 0 ? { dealershipId: { in: dealershipIds } } : {}"
)
content = content.replace(
    "await db.deal.count()",
    "await db.deal.count({ where: dFilter })"
)
content = content.replace(
    "await db.deal.count({ where: { status: 'Продан' } })",
    "await db.deal.count({ where: { ...dFilter, status: 'Продан' } })"
)
content = content.replace(
    "await db.deal.count({ where: { status: 'Склад' } })",
    "await db.deal.count({ where: { ...dFilter, status: 'Склад' } })"
)
content = content.replace(
    "await db.deal.count({ where: { status: 'Отказ' } })",
    "await db.deal.count({ where: { ...dFilter, status: 'Отказ' } })"
)
content = content.replace(
    "await db.deal.count({ where: { status: 'Призрак' } })",
    "await db.deal.count({ where: { ...dFilter, status: 'Призрак' } })"
)
content = content.replace(
    "includedInFinancials",
    "dFilter"
)
with open('src/app/api/stats/route.ts', 'w') as f:
    f.write(content)
print("✓ stats route updated")
PYEOF
python3 /tmp/patch_stats.py

# 8. /api/sklad-month-fact — filter by dealershipIds
cat > /tmp/patch_sklad_month.py << 'PYEOF'
with open('src/app/api/sklad-month-fact/route.ts', 'r') as f:
    content = f.read()
content = content.replace(
    "if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })",
    "if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })\n  const dIds = url.searchParams.get('dealershipIds')\n  const dealershipIds = dIds ? dIds.split(',').map(Number) : undefined\n  const dFilter = dealershipIds && dealershipIds.length > 0 ? { dealershipId: { in: dealershipIds } } : {}"
)
content = content.replace(
    "dateDkp: { startsWith: month },\n        status: { notIn: ['Отказ', 'Призрак'] },",
    "dateDkp: { startsWith: month },\n        status: { notIn: ['Отказ', 'Призрак'] },\n        ...(dealershipIds && dealershipIds.length > 0 ? { dealershipId: { in: dealershipIds } } : {}),"
)
content = content.replace(
    "dateIssued: { startsWith: month },\n        status: { notIn: ['Отказ', 'Призрак'] },",
    "dateIssued: { startsWith: month },\n        status: { notIn: ['Отказ', 'Призрак'] },\n        ...(dealershipIds && dealershipIds.length > 0 ? { dealershipId: { in: dealershipIds } } : {}),"
)
with open('src/app/api/sklad-month-fact/route.ts', 'w') as f:
    f.write(content)
print("✓ sklad-month-fact route updated")
PYEOF
python3 /tmp/patch_sklad_month.py

# 9. /api/history — no filter needed (global)
# 10. /api/evaluation-links — filter by deals' dealershipId
# 11. /api/cell-comments — filter GET
cat > /tmp/patch_comments.py << 'PYEOF'
with open('src/app/api/cell-comments/route.ts', 'r') as f:
    content = f.read()
content = content.replace(
    "const comments = await db.cellComment.findMany()",
    """const url = new URL(req.url)
    const dIds = url.searchParams.get('dealershipIds')
    const dealershipIds = dIds ? dIds.split(',').map(Number) : undefined
    const comments = await db.cellComment.findMany({ where: dealershipIds && dealershipIds.length > 0 ? { dealershipId: { in: dealershipIds } } : {} })"""
)
with open('src/app/api/cell-comments/route.ts', 'w') as f:
    f.write(content)
print("✓ cell-comments route updated")
PYEOF
python3 /tmp/patch_comments.py

# 12. /api/evaluation-links — filter GET
cat > /tmp/patch_eval_links.py << 'PYEOF'
with open('src/app/api/evaluation-links/route.ts', 'r') as f:
    content = f.read()
content = content.replace(
    "const links = await db.evaluationLink.findMany()",
    """const url = new URL(req.url)
    const dIds = url.searchParams.get('dealershipIds')
    const dealershipIds = dIds ? dIds.split(',').map(Number) : undefined
    const links = dealershipIds && dealershipIds.length > 0 
      ? await db.evaluationLink.findMany({ where: { deal: { dealershipId: { in: dealershipIds } } }, include: { deal: true } })
      : await db.evaluationLink.findMany()"""
)
with open('src/app/api/evaluation-links/route.ts', 'w') as f:
    f.write(content)
print("✓ evaluation-links route updated")
PYEOF
python3 /tmp/patch_eval_links.py

echo ""
echo "=== All API routes updated! ==="
echo "Rebuilding..."
DATABASE_URL="postgresql://postgres:Crm2026!@localhost:5432/crm?schema=public" npx next build > /tmp/build_filter.log 2>&1
echo "Build exit: $?"

systemctl restart crm
sleep 3
echo "Service restarted"
echo "=== DONE ==="
