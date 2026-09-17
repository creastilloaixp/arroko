import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0';
import { hmacHex, parseRequest, PublicExperienceError, randomToken, sha256Hex } from './contract.mjs';
import { encryptVaultValue } from '../_shared/arrokoVaultCrypto.mjs';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const CONTACT_SECRET = Deno.env.get('ARROKO_PUBLIC_CONTACT_SECRET') || '';
const PII_ENCRYPTION_KEY = Deno.env.get('ARROKO_PII_ENCRYPTION_KEY') || '';
const configuredOrigins = (Deno.env.get('ARROKO_PUBLIC_ORIGINS') || '')
  .split(',').map((value) => value.trim()).filter(Boolean);
const fallbackOrigins = [
  'https://arroko.creastilo-ai-xperience.com',
  'http://127.0.0.1:4310',
  'http://localhost:4310',
];

function cors(origin: string | null) {
  const allowed = [...configuredOrigins, ...fallbackOrigins];
  const selected = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    'access-control-allow-origin': selected,
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    'vary': 'Origin',
  };
}

function json(request: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(request.headers.get('origin')), 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function safeError(error: unknown) {
  if (error instanceof PublicExperienceError) return { code: error.code, status: error.status };
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String(error.message);
    const known = ['checkin_point_not_found','invalid_public_identifier','visit_not_found_or_expired','child_consent_required','game_not_available','reward_not_available','checkin_rate_limited'];
    const code = known.find((item) => message.includes(item));
    if (code) return { code, status: code === 'checkin_rate_limited' ? 429 : code.includes('not_found') || code.includes('expired') ? 404 : 400 };
  }
  return { code: 'internal_error', status: 500 };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request.headers.get('origin')) });
  if (request.method !== 'POST') return json(request, 405, { ok: false, error: 'method_not_allowed' });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !CONTACT_SECRET || !PII_ENCRYPTION_KEY) {
    return json(request, 503, { ok: false, error: 'public_experience_not_configured' });
  }

  try {
    const contentLength = Number(request.headers.get('content-length') || '0');
    if (contentLength > 16_384) throw new PublicExperienceError('body_too_large', 413);
    const input = parseRequest(await request.json());
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (input.action === 'checkin.start') {
      const phone = input.phone;
      if (!phone) throw new PublicExperienceError('invalid_phone');
      const visitToken = randomToken();
      const tokenHash = await sha256Hex(visitToken);
      const contactRef = await hmacHex(CONTACT_SECRET, `phone:${phone}`);
      const instagramRef = input.instagram
        ? await hmacHex(CONTACT_SECRET, `instagram:${input.instagram}`)
        : null;
      const phoneCiphertext = await encryptVaultValue(PII_ENCRYPTION_KEY, 'arroko:phone', phone);
      const instagramCiphertext = input.instagram
        ? await encryptVaultValue(PII_ENCRYPTION_KEY, 'arroko:instagram', input.instagram)
        : null;
      const birthDateCiphertext = input.birthDate
        ? await encryptVaultValue(PII_ENCRYPTION_KEY, 'arroko:birth_date', input.birthDate)
        : null;
      const { data, error } = await supabase.rpc('arroko_public_checkin_with_vault', {
        p_checkin_slug: input.checkinSlug,
        p_contact_ref: contactRef,
        p_phone_last4: phone.slice(-4),
        p_display_name: input.name,
        p_access_token_hash: tokenHash,
        p_marketing_consent: input.marketingConsent,
        p_child_participation_consent: input.childParticipationConsent,
        p_policy_version: input.policyVersion,
        p_party_size: input.partySize,
        p_metadata: { idempotency_key: input.idempotencyKey || null, user_agent: request.headers.get('user-agent')?.slice(0, 180) || null },
        p_phone_ciphertext: phoneCiphertext,
        p_instagram_ref: instagramRef,
        p_instagram_ciphertext: instagramCiphertext,
        p_birth_date_ciphertext: birthDateCiphertext,
        p_birth_month_day: input.birthMonthDay,
        p_key_version: 1,
      });
      if (error) throw error;
      return json(request, 201, { ok: true, ...data, visit_token: visitToken });
    }

    const tokenHash = await sha256Hex(input.visitToken);
    if (input.action === 'reward.claim') {
      const { data, error } = await supabase.rpc('arroko_public_reward_claim', {
        p_access_token_hash: tokenHash,
        p_reward_key: input.rewardKey,
        p_idempotency_key: input.idempotencyKey,
        p_metadata: { user_agent: request.headers.get('user-agent')?.slice(0, 180) || null },
      });
      if (error) throw error;
      return json(request, 201, { ok: true, ...data });
    }

    const { data, error } = await supabase.rpc('arroko_public_game_complete', {
      p_access_token_hash: tokenHash,
      p_game_key: input.gameKey,
      p_child_alias: input.childAlias,
      p_age_band: input.ageBand,
      p_idempotency_key: input.idempotencyKey,
      p_score: input.score,
      p_duration_seconds: input.durationSeconds,
      p_metadata: {},
    });
    if (error) throw error;
    return json(request, 200, { ok: true, ...data });
  } catch (error) {
    const safe = safeError(error);
    return json(request, safe.status, { ok: false, error: safe.code });
  }
});
