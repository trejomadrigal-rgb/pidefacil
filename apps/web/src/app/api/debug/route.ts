import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function testFetch(url: string, opts: RequestInit) {
  try {
    const res = await fetch(url, opts);
    const body = await res.text();
    return { url, status: res.status, ok: res.ok, body: body.substring(0, 300) };
  } catch (e) {
    return {
      url,
      error: e instanceof Error ? e.message : String(e),
      cause: e instanceof Error && e.cause ? String((e.cause as { message?: string }).message) : undefined,
    };
  }
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') ?? 'dona-rosa';
  const API_URL =
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:3000';

  const [business, categories, featuredProduct] = await Promise.all([
    testFetch(`${API_URL}/public/business/${slug}`, { cache: 'no-store' }),
    testFetch(`${API_URL}/public/business/${slug}/categories`, { next: { revalidate: 60 } } as RequestInit),
    testFetch(`${API_URL}/public/business/${slug}/featured-product`, { next: { revalidate: 600 } } as RequestInit),
  ]);

  return NextResponse.json({
    slug,
    env_API_URL: process.env.API_URL,
    env_NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    business,
    categories,
    featuredProduct,
  });
}
