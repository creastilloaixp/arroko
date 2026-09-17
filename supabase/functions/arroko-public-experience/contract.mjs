export class PublicExperienceError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

const text = (value, max = 120) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const normalized = digits.length === 10 ? `52${digits}` : digits;
  if (normalized.length < 11 || normalized.length > 15) throw new PublicExperienceError('invalid_phone');
  return normalized;
}

export function parseRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PublicExperienceError('invalid_body');
  const action = text(value.action, 40);
  if (action === 'checkin.start') {
    const name = text(value.name, 80);
    const checkinSlug = text(value.checkin_slug, 64).toLowerCase();
    const instagram = text(value.instagram, 31).replace(/^@/, '').toLowerCase();
    const birthDate = text(value.birth_date, 10);
    const partySize = value.party_size == null ? null : Number(value.party_size);
    if (!checkinSlug.match(/^[a-z0-9][a-z0-9-]{2,63}$/)) throw new PublicExperienceError('invalid_checkin_slug');
    if (!name) throw new PublicExperienceError('name_required');
    if (instagram && !instagram.match(/^[a-z0-9._]{1,30}$/)) throw new PublicExperienceError('invalid_instagram');
    let birthMonthDay = null;
    if (birthDate) {
      if (!birthDate.match(/^\d{4}-\d{2}-\d{2}$/)) throw new PublicExperienceError('invalid_birth_date');
      const parsedBirthDate = new Date(`${birthDate}T00:00:00Z`);
      if (Number.isNaN(parsedBirthDate.getTime()) || parsedBirthDate.toISOString().slice(0, 10) !== birthDate) {
        throw new PublicExperienceError('invalid_birth_date');
      }
      const today = new Date();
      let age = today.getUTCFullYear() - parsedBirthDate.getUTCFullYear();
      const monthDelta = today.getUTCMonth() - parsedBirthDate.getUTCMonth();
      if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < parsedBirthDate.getUTCDate())) age--;
      if (age < 18 || age > 120) throw new PublicExperienceError('adult_required');
      birthMonthDay = birthDate.slice(5);
    }
    if (partySize != null && (!Number.isInteger(partySize) || partySize < 1 || partySize > 40)) throw new PublicExperienceError('invalid_party_size');
    return {
      action,
      checkinSlug,
      name,
      phone: normalizePhone(value.phone),
      instagram: instagram || null,
      birthDate: birthDate || null,
      birthMonthDay,
      partySize,
      marketingConsent: value.marketing_consent === true,
      childParticipationConsent: value.child_participation_consent === true,
      policyVersion: text(value.policy_version, 40) || 'demo-2026-09',
      idempotencyKey: text(value.idempotency_key, 120),
    };
  }
  if (action === 'game.complete') {
    const visitToken = text(value.visit_token, 160);
    const gameKey = text(value.game_key, 64).toLowerCase();
    const childAlias = text(value.child_alias, 40);
    const ageBand = value.age_band == null ? null : text(value.age_band, 8);
    const idempotencyKey = text(value.idempotency_key, 120);
    const score = Number(value.score);
    const durationSeconds = value.duration_seconds == null ? null : Number(value.duration_seconds);
    if (visitToken.length < 40) throw new PublicExperienceError('invalid_visit_token', 401);
    if (!gameKey.match(/^[a-z0-9][a-z0-9_-]{2,63}$/)) throw new PublicExperienceError('invalid_game_key');
    if (!childAlias) throw new PublicExperienceError('child_alias_required');
    if (ageBand != null && !['3-5','6-8','9-12','13-15'].includes(ageBand)) throw new PublicExperienceError('invalid_age_band');
    if (!idempotencyKey || idempotencyKey.length < 8) throw new PublicExperienceError('idempotency_key_required');
    if (!Number.isInteger(score) || score < 0 || score > 10000000) throw new PublicExperienceError('invalid_score');
    if (durationSeconds != null && (!Number.isInteger(durationSeconds) || durationSeconds < 0 || durationSeconds > 10800)) throw new PublicExperienceError('invalid_duration');
    return { action, visitToken, gameKey, childAlias, ageBand, idempotencyKey, score, durationSeconds };
  }
  if (action === 'reward.claim') {
    const visitToken = text(value.visit_token, 160);
    const rewardKey = text(value.reward_key, 64).toLowerCase();
    const idempotencyKey = text(value.idempotency_key, 120);
    if (visitToken.length < 40) throw new PublicExperienceError('invalid_visit_token', 401);
    if (!rewardKey.match(/^[a-z0-9][a-z0-9_-]{1,63}$/)) throw new PublicExperienceError('invalid_reward_key');
    if (!idempotencyKey || idempotencyKey.length < 8) throw new PublicExperienceError('idempotency_key_required');
    return { action, visitToken, rewardKey, idempotencyKey };
  }
  throw new PublicExperienceError('unsupported_action');
}

export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
