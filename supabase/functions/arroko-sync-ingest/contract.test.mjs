import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasForbiddenKey,
  hmacHex,
  parseEnvelope,
  sha256Hex,
  stableStringify,
  timingSafeHexEqual,
} from './contract.mjs';

const validEnvelope = {
  connector_id: '11111111-1111-4111-8111-111111111111',
  cursor: '2026-09-10T12:00:00Z',
  events: [{
    id: 'product-42-v3',
    type: 'product.upsert',
    occurred_at: '2026-09-10T12:00:00Z',
    data: { external_id: '42', name: 'Nixi', price: 240 },
  }],
};

test('accepts a normalized envelope', () => {
  assert.deepEqual(parseEnvelope(validEnvelope), validEnvelope);
});

test('rejects raw PII at any depth', () => {
  assert.equal(hasForbiddenKey({ customer: { phone: '6670000000' } }), true);
  assert.throws(
    () => parseEnvelope({
      ...validEnvelope,
      events: [{ ...validEnvelope.events[0], data: { customer: { email: 'x@example.com' } } }],
    }),
    /raw_pii_or_secret_at_0/,
  );
});

test('rejects duplicate event ids inside one envelope', () => {
  assert.throws(
    () => parseEnvelope({ ...validEnvelope, events: [validEnvelope.events[0], validEnvelope.events[0]] }),
    /duplicate_event_id_at_1/,
  );
});

test('stable payload hashing ignores object key order', async () => {
  const left = await sha256Hex(stableStringify({ b: 2, a: { d: 4, c: 3 } }));
  const right = await sha256Hex(stableStringify({ a: { c: 3, d: 4 }, b: 2 }));
  assert.equal(left, right);
});

test('HMAC comparison accepts only the expected signature', async () => {
  const expected = await hmacHex('test-secret', '123.body');
  assert.equal(timingSafeHexEqual(expected, expected), true);
  assert.equal(timingSafeHexEqual(expected, `${expected.slice(0, -1)}0`), false);
  assert.equal(timingSafeHexEqual(expected, 'short'), false);
});
