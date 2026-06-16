import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const API_URL =
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:3000';
  const url = `${API_URL}/public/business/dona-rosa`;

  const result: Record<string, unknown> = {
    url,
    env_API_URL: process.env.API_URL,
    env_NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  };

  try {
    const res = await fetch(url, { cache: 'no-store' });
    const body = await res.text();
    result.status = res.status;
    result.ok = res.ok;
    result.body = body.substring(0, 500);
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
    result.cause =
      e instanceof Error && e.cause
        ? String((e.cause as { message?: string }).message)
        : undefined;
  }

  return NextResponse.json(result);
}
