import { NextRequest, NextResponse } from 'next/server';
import { getBusinessMenu } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') ?? 'dona-rosa';
  const API_URL =
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:3000';

  const url = `${API_URL}/public/business/${slug}`;

  // Test 1: direct fetch (como las versiones anteriores del debug)
  let directResult: Record<string, unknown> = {};
  try {
    const r1 = await fetch(url, { cache: 'no-store' });
    directResult = { status: r1.status, ok: r1.ok, body: (await r1.text()).substring(0, 200) };
  } catch (e) {
    directResult = { threw: true, error: String(e) };
  }

  // Test 2: EXACTAMENTE igual que getBusiness — sin await en .json()
  let getBizResult: Record<string, unknown> = {};
  try {
    const r2 = await fetch(url, { cache: 'no-store' });
    if (!r2.ok) {
      getBizResult = { returned_null: true, reason: 'not ok', status: r2.status };
    } else {
      const data = await r2.json();
      getBizResult = { returned_null: false, data };
    }
  } catch (e) {
    getBizResult = { threw: true, error: String(e) };
  }

  const menu = await getBusinessMenu(slug);

  return NextResponse.json({
    slug, url,
    route_env_API_URL: process.env.API_URL,
    directResult,
    getBizResult,
    getBusinessMenu_null: menu === null,
    menu_name: menu?.business?.name ?? null,
  });
}
