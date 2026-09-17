import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0';
import { decryptVaultValue } from '../_shared/arrokoVaultCrypto.mjs';
import { authorizedMemberships, ContactVaultError, parseContactRequest } from './contract.mjs';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const PII_ENCRYPTION_KEY = Deno.env.get('ARROKO_PII_ENCRYPTION_KEY') || '';
const configuredOrigins = (Deno.env.get('ARROKO_PUBLIC_ORIGINS') || '')
  .split(',').map((value) => value.trim()).filter(Boolean);
const fallbackOrigins = [
  'https://arroko.creastilo-ai-xperience.com',
  'http://127.0.0.1:4177',
  'http://localhost:4177',
];

function cors(origin: string | null) {
  const allowed = [...configuredOrigins, ...fallbackOrigins];
  return {
    'access-control-allow-origin': origin && allowed.includes(origin) ? origin : allowed[0],
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'Origin',
  };
}

function json(request: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(request.headers.get('origin')), 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request.headers.get('origin')) });
  if (request.method !== 'POST') return json(request, 405, { ok: false, error: 'method_not_allowed' });
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY || !PII_ENCRYPTION_KEY) {
    return json(request, 503, { ok: false, error: 'contact_vault_not_configured' });
  }

  try {
    const contentLength = Number(request.headers.get('content-length') || '0');
    if (contentLength > 8_192) throw new ContactVaultError('body_too_large', 413);
    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) throw new ContactVaultError('authentication_required', 401);
    const input = parseContactRequest(await request.json());

    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) throw new ContactVaultError('authentication_required', 401);

    const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: memberships, error: membershipError } = await service
      .from('org_members').select('org_id,role').eq('user_id', authData.user.id);
    if (membershipError) throw membershipError;
    const authorized = authorizedMemberships(memberships);
    if (!authorized.length) throw new ContactVaultError('insufficient_role', 403);

    const { data: vault, error: vaultError } = await service
      .from('arroko_contact_vault')
      .select('org_id,client_id,phone_ciphertext,instagram_ciphertext,birth_date_ciphertext,key_version,updated_at')
      .eq('client_id', input.clientId)
      .in('org_id', authorized.map((membership) => membership.org_id))
      .maybeSingle();
    if (vaultError) throw vaultError;
    if (!vault) throw new ContactVaultError('contact_not_found', 404);

    const [phone, instagram, birthDate] = await Promise.all([
      decryptVaultValue(PII_ENCRYPTION_KEY, 'arroko:phone', vault.phone_ciphertext),
      vault.instagram_ciphertext
        ? decryptVaultValue(PII_ENCRYPTION_KEY, 'arroko:instagram', vault.instagram_ciphertext)
        : Promise.resolve(null),
      vault.birth_date_ciphertext
        ? decryptVaultValue(PII_ENCRYPTION_KEY, 'arroko:birth_date', vault.birth_date_ciphertext)
        : Promise.resolve(null),
    ]);

    const { error: auditError } = await service.from('arroko_pii_access_audit').insert({
      org_id: vault.org_id,
      client_id: vault.client_id,
      actor_user_id: authData.user.id,
      action: 'view_customer_contact',
      purpose: input.purpose,
      metadata: { edge_function: 'arroko-crm-contact-vault', key_version: vault.key_version },
    });
    if (auditError) throw auditError;

    return json(request, 200, {
      ok: true,
      contact: { phone, instagram, birth_date: birthDate, updated_at: vault.updated_at },
    });
  } catch (error) {
    if (error instanceof ContactVaultError) return json(request, error.status, { ok: false, error: error.code });
    console.error('arroko-crm-contact-vault failed', error instanceof Error ? error.message : 'unknown');
    return json(request, 500, { ok: false, error: 'internal_error' });
  }
});
