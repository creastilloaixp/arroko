const VISIT_TOKEN_KEY = 'arroko_visit_token_v1';
const CHILD_PROFILE_KEY = 'arrokids_child_profile_v1';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');
const endpoint = String(import.meta.env.VITE_ARROKO_EXPERIENCE_URL || (supabaseUrl ? `${supabaseUrl}/functions/v1/arroko-public-experience` : ''));

type CheckinInput = {
  checkinSlug: string;
  name: string;
  phone: string;
  instagram?: string;
  birthDate?: string;
  partySize: number;
  marketingConsent: boolean;
  childParticipationConsent: boolean;
  childAlias?: string;
  ageBand?: string;
};

type ApiResult = Record<string, unknown> & { ok: boolean; error?: string };

async function call(body: Record<string, unknown>): Promise<ApiResult> {
  if (!endpoint || !anonKey) throw new Error('La experiencia todavía no tiene configurada su conexión segura.');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: anonKey, authorization: `Bearer ${anonKey}` },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({ ok: false, error: 'invalid_response' }));
  if (!response.ok || !result.ok) throw new Error(publicMessage(result.error));
  return result;
}

function publicMessage(code?: string) {
  const messages: Record<string, string> = {
    checkin_point_not_found: 'Este punto de check-in no está activo. Pide ayuda al equipo de Arrokó.',
    child_consent_required: 'Un adulto debe autorizar la participación en ArroKids.',
    visit_not_found_or_expired: 'La visita terminó. Acerca nuevamente el teléfono al tótem.',
    game_not_available: 'Este juego no está disponible en este momento.',
    reward_not_available: 'Esta recompensa no está disponible en este momento.',
    public_experience_not_configured: 'El check-in todavía no está habilitado.',
    checkin_rate_limited: 'Ya registramos varias visitas en pocos minutos. Espera un momento o pide ayuda al equipo.',
  };
  return messages[code || ''] || 'No pudimos guardar la actividad. Intenta nuevamente.';
}

export async function startCheckin(input: CheckinInput) {
  const result = await call({
    action: 'checkin.start',
    checkin_slug: input.checkinSlug,
    name: input.name,
    phone: input.phone,
    instagram: input.instagram,
    birth_date: input.birthDate,
    party_size: input.partySize,
    marketing_consent: input.marketingConsent,
    child_participation_consent: input.childParticipationConsent,
    policy_version: 'arroko-demo-2026-09-v1',
    idempotency_key: crypto.randomUUID(),
  });
  const token = String(result.visit_token || '');
  if (!token) throw new Error('El check-in no devolvió una sesión válida.');
  sessionStorage.setItem(VISIT_TOKEN_KEY, token);
  if (input.childAlias) {
    sessionStorage.setItem(CHILD_PROFILE_KEY, JSON.stringify({ alias: input.childAlias, ageBand: input.ageBand || null }));
  }
  return result;
}

export async function recordGameComplete(gameKey: string, score: number, durationSeconds?: number) {
  const visitToken = sessionStorage.getItem(VISIT_TOKEN_KEY);
  const child = JSON.parse(sessionStorage.getItem(CHILD_PROFILE_KEY) || 'null') as { alias?: string; ageBand?: string | null } | null;
  if (!visitToken || !child?.alias) return null;
  return call({
    action: 'game.complete',
    visit_token: visitToken,
    game_key: gameKey,
    child_alias: child.alias,
    age_band: child.ageBand || null,
    idempotency_key: crypto.randomUUID(),
    score,
    duration_seconds: durationSeconds ?? null,
  });
}

export async function claimReward(rewardKey: string) {
  const visitToken = sessionStorage.getItem(VISIT_TOKEN_KEY);
  if (!visitToken) throw new Error('La visita no está activa. Registra tus datos nuevamente.');
  return call({
    action: 'reward.claim',
    visit_token: visitToken,
    reward_key: rewardKey,
    idempotency_key: crypto.randomUUID(),
  });
}

export function hasActiveVisit() {
  return Boolean(sessionStorage.getItem(VISIT_TOKEN_KEY));
}
