// POST /functions/v1/customer-signup — the mobile app's shop-signup endpoint.
//
// There is no SMS/OTP provider connected, so a shopkeeper's phone number
// becomes a synthetic email identity that only this function and the mobile
// app ever construct. This function exists ONLY because creating that
// account without triggering Supabase's email-confirmation flow requires the
// service-role key (via `auth.admin.createUser` with `email_confirm: true`)
// — a key the mobile app can never hold. Everything else (signing back in,
// placing orders, reading balances) talks to Supabase directly with no
// server in the middle.
//
// Deployed with --no-verify-jwt: this must be reachable by a phone that has
// no session yet. It does its own validation instead of relying on the
// platform JWT gate.
//
// Mirrors web/app/api/customer-signup/route.ts and mobile's src/lib/phone.ts
// — kept as the fallback path if the portal is unreachable, and as the
// primary path so the mobile app never depends on portal uptime at all.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let v = raw.replace(/[^0-9+]/g, '');
  v = v.replace(/^\+/, '');
  if (v.startsWith('00')) v = v.slice(2);
  if (v.startsWith('0')) v = `92${v.slice(1)}`;
  if (v.length === 10 && v.startsWith('3')) v = `92${v}`;
  return v || null;
}

// Called from native apps (no CORS involved) and Expo web (a browser, which
// does enforce it) — allow both without needing to track allowed origins.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
  });
}

interface SignupBody {
  phone?: unknown;
  password?: unknown;
  full_name?: unknown;
  shop_name?: unknown;
  city?: unknown;
}

function validate(body: SignupBody): { error: string } | {
  phone: string;
  password: string;
  full_name: string;
  shop_name: string;
  city: string | null;
} {
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  const shopName = typeof body.shop_name === 'string' ? body.shop_name.trim() : '';
  const city = typeof body.city === 'string' ? body.city.trim() : '';

  if (phone.length < 7 || phone.length > 20) return { error: 'Enter a valid phone number.' };
  if (password.length < 8 || password.length > 200) {
    return { error: 'Password must be at least 8 characters.' };
  }
  if (!fullName || fullName.length > 200) return { error: 'Enter your name.' };
  if (!shopName || shopName.length > 200) return { error: 'Enter your shop name.' };
  if (city.length > 200) return { error: 'City is too long.' };

  return { phone, password, full_name: fullName, shop_name: shopName, city: city || null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  let body: SignupBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid request body.' }, 400);
  }

  const parsed = validate(body);
  if ('error' in parsed) {
    return jsonResponse({ error: parsed.error }, 400);
  }
  const { phone, password, full_name, shop_name, city } = parsed;

  const normalized = normalizePhone(phone);
  if (!normalized || !/^923\d{9}$/.test(normalized)) {
    return jsonResponse({ error: 'Enter a valid Pakistani mobile number.' }, 400);
  }

  const syntheticEmail = `p${normalized}@ahsantraders.pk`;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    password,
    email_confirm: true, // never sends anything — this is what avoids needing SMS/email confirmation
    user_metadata: {
      account_type: 'customer',
      full_name,
      shop_name,
      city,
      phone: normalized,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes('already') || error.status === 422) {
      return jsonResponse(
        { error: 'An account already exists for that phone number. Try signing in instead.' },
        409,
      );
    }
    return jsonResponse({ error: error.message }, 400);
  }

  return jsonResponse({ ok: true, user_id: data.user?.id ?? null }, 200);
});
