import { NextResponse } from 'next/server';

import { getOpenState } from '@/server/services/schedule.service';

/**
 * The header badge polls this so flipping the switch in /admin shows up in a
 * few seconds instead of waiting out the page's `revalidate = 60`.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const open = await getOpenState();
  return NextResponse.json(open, { headers: { 'Cache-Control': 'no-store' } });
}
