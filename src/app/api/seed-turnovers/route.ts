import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Simple auth check - require a secret token
  const { token } = await request.json();
  if (token !== 'spotless-seed-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  // Step 1: Get all apartments to map names to IDs
  const { data: apartments, error: aptError } = await supabase
    .from('apartments')
    .select('id, name');

  if (aptError) {
    return NextResponse.json({ error: 'Failed to load apartments', details: aptError }, { status: 500 });
  }

  // Build name→id map (case-insensitive, trimmed)
  const aptMap: Record<string, string> = {};
  for (const apt of apartments || []) {
    aptMap[apt.name.toLowerCase().trim()] = apt.id;
  }

  // Step 2: Define the 9 turnovers to insert
  const turnoversToInsert = [
    { date: '2026-10-12', apartment: 'Pearl wazou 27' },
    { date: '2026-10-12', apartment: 'Alia 40' },
    { date: '2026-10-13', apartment: 'C3/6' },
    { date: '2026-10-13', apartment: 'Alia 17' },
    { date: '2026-10-14', apartment: 'Pearl wazou 27' },
    { date: '2026-10-15', apartment: 'Alia 40' },
    { date: '2026-10-15', apartment: 'B1/1' },
    { date: '2026-10-15', apartment: 'C2/10' },
    { date: '2026-10-16', apartment: 'C3/6' },
  ];

  // Step 3: Match apartment names to IDs
  const records = [];
  const notFound: string[] = [];

  for (const t of turnoversToInsert) {
    const aptId = aptMap[t.apartment.toLowerCase().trim()];
    if (!aptId) {
      notFound.push(t.apartment);
      continue;
    }
    records.push({
      apartment_id: aptId,
      date: t.date,
      status: t.date < '2026-10-16' ? 'termine' : 'planifie',
      source: 'manual' as const,
    });
  }

  if (notFound.length > 0) {
    return NextResponse.json({
      error: 'Some apartments not found',
      notFound,
      availableApartments: apartments?.map(a => a.name),
      aptMap,
    }, { status: 400 });
  }

  // Step 4: Insert all turnovers
  const { data: inserted, error: insertError } = await supabase
    .from('turnovers')
    .insert(records)
    .select('id, date, apartment_id');

  if (insertError) {
    return NextResponse.json({ error: 'Insert failed', details: insertError }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    inserted: inserted?.length || 0,
    records: inserted,
    mapping: turnoversToInsert.map((t, i) => ({
      ...t,
      apartment_id: records[i]?.apartment_id,
    })),
  });
}
