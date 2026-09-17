const EVENT_TYPES = new Set([
  'product.upsert',
  'ingredient.upsert',
  'client.upsert',
  'inventory.snapshot',
  'order.upsert',
  'operation.event',
  'campaign.upsert',
  'campaign.metrics',
]);

const FORBIDDEN_KEYS = new Set([
  'phone',
  'email',
  'whatsapp',
  'card_number',
  'authorization',
  'password',
  'secret',
  'token',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ContractError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = 'ContractError';
    this.code = code;
    this.status = status;
  }
}

export function hasForbiddenKey(value) {
  if (Array.isArray(value)) return value.some(hasForbiddenKey);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, nested]) =>
    FORBIDDEN_KEYS.has(key.toLowerCase()) || hasForbiddenKey(nested),
  );
}

export function parseEnvelope(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContractError('invalid_envelope');
  }
  if (!UUID_RE.test(value.connector_id || '')) {
    throw new ContractError('invalid_connector_id');
  }
  if (!Array.isArray(value.events) || value.events.length < 1 || value.events.length > 250) {
    throw new ContractError('events_must_contain_1_to_250_items');
  }

  const ids = new Set();
  const events = value.events.map((event, index) => {
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      throw new ContractError(`invalid_event_at_${index}`);
    }
    if (typeof event.id !== 'string' || event.id.length < 1 || event.id.length > 180) {
      throw new ContractError(`invalid_event_id_at_${index}`);
    }
    if (ids.has(event.id)) throw new ContractError(`duplicate_event_id_at_${index}`);
    ids.add(event.id);
    if (!EVENT_TYPES.has(event.type)) throw new ContractError(`unsupported_event_type_at_${index}`);
    if (!event.occurred_at || Number.isNaN(Date.parse(event.occurred_at))) {
      throw new ContractError(`invalid_occurred_at_at_${index}`);
    }
    if (!event.data || typeof event.data !== 'object' || Array.isArray(event.data)) {
      throw new ContractError(`invalid_event_data_at_${index}`);
    }
    if (hasForbiddenKey(event.data)) throw new ContractError(`raw_pii_or_secret_at_${index}`);
    return { id: event.id, type: event.type, occurred_at: event.occurred_at, data: event.data };
  });

  return {
    connector_id: value.connector_id,
    cursor: typeof value.cursor === 'string' ? value.cursor.slice(0, 500) : null,
    events,
  };
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function timingSafeHexEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}
