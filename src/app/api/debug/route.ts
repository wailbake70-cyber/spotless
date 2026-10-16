import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const reqUrl = new URL(request.url);
  const showKey = reqUrl.searchParams.get('showkey') === 'spotless2026';

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '(not set)';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '(not set)';

  const results: Record<string, unknown> = {
    supabase_url: url,
    anon_key_prefix: key.substring(0, 20) + '...',
    anon_key_length: key.length,
    anon_key_format: key.startsWith('eyJ') ? 'JWT (old format - OK)' : key.startsWith('sb_') ? 'sb_publishable (new format)' : 'unknown',
  };

  if (showKey) {
    // Split key into chunks to prevent truncation by fetchers
    const chunkSize = 40;
    const chunks: string[] = [];
    for (let i = 0; i < key.length; i += chunkSize) {
      chunks.push(key.substring(i, i + chunkSize));
    }
    results.key_chunks = chunks;
    results.key_chunk_count = chunks.length;
  }

  // Test 1: Can we reach the Supabase URL?
  try {
    const healthRes = await fetch(`${url}/rest/v1/`, {
      headers: { 'apikey': key },
    });
    results.rest_api_status = healthRes.status;
    results.rest_api_ok = healthRes.ok;
  } catch (e: unknown) {
    results.rest_api_error = e instanceof Error ? e.message : String(e);
  }

  // Test 2: Can we reach the auth endpoint?
  try {
    const authRes = await fetch(`${url}/auth/v1/settings`, {
      headers: { 'apikey': key },
    });
    results.auth_settings_status = authRes.status;
    if (authRes.ok) {
      const data = await authRes.json();
      results.auth_settings = { external_email_enabled: data?.external?.email };
    } else {
      const text = await authRes.text();
      results.auth_settings_body = text.substring(0, 200);
    }
  } catch (e: unknown) {
    results.auth_settings_error = e instanceof Error ? e.message : String(e);
  }

  // Test 3: Try a fake login to see the exact error
  try {
    const loginRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@test.com',
        password: 'testtest',
      }),
    });
    results.auth_login_status = loginRes.status;
    const loginBody = await loginRes.text();
    results.auth_login_body = loginBody.substring(0, 300);
  } catch (e: unknown) {
    results.auth_login_error = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(results, { status: 200 });
}
// force redeploy Fri Oct 16 18:09:01 UTC 2026
