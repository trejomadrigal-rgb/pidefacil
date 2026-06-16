import { NextRequest, NextResponse } from 'next/server';
import { getBusinessMenu, getPublicBranches } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') ?? 'dona-rosa';

  let menu: Awaited<ReturnType<typeof getBusinessMenu>> = null;
  let menuError: string | null = null;
  try {
    menu = await getBusinessMenu(slug);
  } catch (e) {
    menuError = e instanceof Error ? e.message : String(e);
  }

  let branches: Awaited<ReturnType<typeof getPublicBranches>> = [];
  let branchesError: string | null = null;
  try {
    branches = await getPublicBranches(slug);
  } catch (e) {
    branchesError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    slug,
    env_API_URL: process.env.API_URL,
    env_NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    menu_is_null: menu === null,
    menu_business_name: menu?.business?.name ?? null,
    menu_categories_count: menu?.categories?.length ?? null,
    menuError,
    branches_count: branches.length,
    branchesError,
  });
}
