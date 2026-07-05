#!/usr/bin/env python3
"""Patch all API routes to filter by dealershipIds"""
import os

API_DIR = '/opt/crm/src/app/api'

def patch_file(filepath, patches):
    """Apply patches to a file"""
    with open(filepath, 'r') as f:
        content = f.read()
    original = content
    for old, new in patches:
        if old in content and new not in content:
            content = content.replace(old, new, 1)
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

# 1. deals/route.ts
patch_file(f'{API_DIR}/deals/route.ts', [
    ("const search = url.searchParams.get('search') || undefined",
     "const search = url.searchParams.get('search') || undefined\n    const dIdsP = url.searchParams.get('dealershipIds')\n    const dIds = dIdsP ? dIdsP.split(',').map(Number) : undefined"),
    ("AND: [",
     "AND: [\n          dIds && dIds.length > 0 ? { dealershipId: { in: dIds } } : {},"),
])
print("✓ deals")

# 2. channels/route.ts
patch_file(f'{API_DIR}/channels/route.ts', [
    ("export async function GET() {",
     "export async function GET(req: NextRequest) {"),
    ("const channels = await db.channel.findMany({ orderBy: { order: 'asc' } })",
     "const url = new URL(req.url)\n    const dIdsP = url.searchParams.get('dealershipIds')\n    const dIds = dIdsP ? dIdsP.split(',').map(Number) : undefined\n    const channels = await db.channel.findMany({ where: dIds && dIds.length > 0 ? { dealershipId: { in: dIds } } : {}, orderBy: { order: 'asc' } })"),
])
print("✓ channels")

# 3. options/route.ts
patch_file(f'{API_DIR}/options/route.ts', [
    ("export async function GET() {",
     "export async function GET(req: NextRequest) {"),
    ("if (dict) {",
     "const url = new URL(req.url)\n    const dIdsP = url.searchParams.get('dealershipIds')\n    const dIds = dIdsP ? dIdsP.split(',').map(Number) : undefined\n  if (dict) {"),
    ("where: { dictName: dict },",
     "where: { dictName: dict, ...(dIds && dIds.length > 0 ? { dealershipId: { in: dIds } } : {}) },"),
    ("const all = await db.selectOption.findMany({ orderBy: [{ dictName: 'asc' }, { order: 'asc' }] })",
     "const all = await db.selectOption.findMany({ where: dIds && dIds.length > 0 ? { dealershipId: { in: dIds } } : {}, orderBy: [{ dictName: 'asc' }, { order: 'asc' }] })"),
])
print("✓ options")

# 4. columns/route.ts
patch_file(f'{API_DIR}/columns/route.ts', [
    ("export async function GET() {",
     "export async function GET(req: NextRequest) {"),
    ("const cols = await db.dealColumn.findMany({ orderBy: { order: 'asc' } })",
     "const url = new URL(req.url)\n    const dIdsP = url.searchParams.get('dealershipIds')\n    const dIds = dIdsP ? dIdsP.split(',').map(Number) : undefined\n    const cols = await db.dealColumn.findMany({ where: dIds && dIds.length > 0 ? { dealershipId: { in: dIds } } : {}, orderBy: { order: 'asc' } })"),
])
print("✓ columns")

# 5. traffic/route.ts
patch_file(f'{API_DIR}/traffic/route.ts', [
    ("const entries = await db.trafficEntry.findMany({ where: { monthKey: month } })",
     "const dIdsP = url.searchParams.get('dealershipIds')\n    const dIds = dIdsP ? dIdsP.split(',').map(Number) : undefined\n    const entries = await db.trafficEntry.findMany({ where: { monthKey: month, ...(dIds && dIds.length > 0 ? { dealershipId: { in: dIds } } : {}) } })"),
    ("const plans = await db.todayPlan.findMany({ where: { monthKey: month } })",
     "const plans = await db.todayPlan.findMany({ where: { monthKey: month, ...(dIds && dIds.length > 0 ? { dealershipId: { in: dIds } } : {}) } })"),
    ("const comments = await db.cellComment.findMany()",
     "const comments = await db.cellComment.findMany({ where: dIds && dIds.length > 0 ? { dealershipId: { in: dIds } } : {} })"),
])
print("✓ traffic")

# 6. plan-fact/route.ts
patch_file(f'{API_DIR}/plan-fact/route.ts', [
    ("if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })",
     "if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })\n  const dIdsP = url.searchParams.get('dealershipIds')\n  const dIds = dIdsP ? dIdsP.split(',').map(Number) : undefined"),
    ("db.channel.findMany({ orderBy: { order: 'asc' } })",
     "db.channel.findMany({ where: dIds && dIds.length > 0 ? { dealershipId: { in: dIds } } : {}, orderBy: { order: 'asc' } })"),
    ("db.planEntry.findMany({ where: { monthKey: month } })",
     "db.planEntry.findMany({ where: { monthKey: month, ...(dIds && dIds.length > 0 ? { dealershipId: { in: dIds } } : {}) } })"),
    ("db.factEntry.findFirst({ where: { monthKey: month } })",
     "db.factEntry.findFirst({ where: { monthKey: month, ...(dIds && dIds.length > 0 ? { dealershipId: { in: dIds } } : {}) } })"),
    ("db.channelFact.findMany({ where: { monthKey: month } })",
     "db.channelFact.findMany({ where: { monthKey: month, ...(dIds && dIds.length > 0 ? { dealershipId: { in: dIds } } : {}) } })"),
])
print("✓ plan-fact")

# 7. stats/route.ts
patch_file(f'{API_DIR}/stats/route.ts', [
    ("export async function GET() {",
     "export async function GET(req: NextRequest) {\n  const url = new URL(req.url)\n  const dIdsP = url.searchParams.get('dealershipIds')\n  const dIds = dIdsP ? dIdsP.split(',').map(Number) : undefined\n  const dF = dIds && dIds.length > 0 ? { dealershipId: { in: dIds } } : {}"),
    ("await db.deal.count()",
     "await db.deal.count({ where: dF })"),
    ("await db.deal.count({ where: { status: 'Продан' } })",
     "await db.deal.count({ where: { ...dF, status: 'Продан' } })"),
    ("await db.deal.count({ where: { status: 'Склад' } })",
     "await db.deal.count({ where: { ...dF, status: 'Склад' } })"),
    ("await db.deal.count({ where: { status: 'Отказ' } })",
     "await db.deal.count({ where: { ...dF, status: 'Отказ' } })"),
    ("await db.deal.count({ where: { status: 'Призрак' } })",
     "await db.deal.count({ where: { ...dF, status: 'Призрак' } })"),
])
print("✓ stats")

# 8. sklad-month-fact/route.ts
patch_file(f'{API_DIR}/sklad-month-fact/route.ts', [
    ("if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })",
     "if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })\n  const dIdsP = url.searchParams.get('dealershipIds')\n  const dIds = dIdsP ? dIdsP.split(',').map(Number) : undefined\n  const dF = dIds && dIds.length > 0 ? { dealershipId: { in: dIds } } : {}"),
    ("dateDkp: { startsWith: month },\n        status: { notIn: ['Отказ', 'Призрак'] },",
     "dateDkp: { startsWith: month },\n        status: { notIn: ['Отказ', 'Призрак'] },\n        ...(dIds && dIds.length > 0 ? { dealershipId: { in: dIds } } : {}),"),
    ("dateIssued: { startsWith: month },\n        status: { notIn: ['Отказ', 'Призрак'] },",
     "dateIssued: { startsWith: month },\n        status: { notIn: ['Отказ', 'Призрак'] },\n        ...(dIds && dIds.length > 0 ? { dealershipId: { in: dIds } } : {}),"),
])
print("✓ sklad-month-fact")

# 9. cell-comments/route.ts
patch_file(f'{API_DIR}/cell-comments/route.ts', [
    ("export async function GET() {",
     "export async function GET(req: NextRequest) {"),
    ("const comments = await db.cellComment.findMany()",
     "const url = new URL(req.url)\n    const dIdsP = url.searchParams.get('dealershipIds')\n    const dIds = dIdsP ? dIdsP.split(',').map(Number) : undefined\n    const comments = await db.cellComment.findMany({ where: dIds && dIds.length > 0 ? { dealershipId: { in: dIds } } : {} })"),
])
print("✓ cell-comments")

# 10. evaluation-links/route.ts
patch_file(f'{API_DIR}/evaluation-links/route.ts', [
    ("export async function GET() {",
     "export async function GET(req: NextRequest) {"),
    ("const links = await db.evaluationLink.findMany()",
     "const url = new URL(req.url)\n    const dIdsP = url.searchParams.get('dealershipIds')\n    const dIds = dIdsP ? dIdsP.split(',').map(Number) : undefined\n    const links = dIds && dIds.length > 0 ? await db.evaluationLink.findMany({ where: { deal: { dealershipId: { in: dIds } } }, include: { deal: true } }) : await db.evaluationLink.findMany()"),
])
print("✓ evaluation-links")

print("\n=== ALL API ROUTES PATCHED ===")
