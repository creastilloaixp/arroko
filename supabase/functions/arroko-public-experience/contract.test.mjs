import assert from 'node:assert/strict';
import { hmacHex, normalizePhone, parseRequest, sha256Hex } from './contract.mjs';

assert.equal(normalizePhone('(667) 123-4567'), '526671234567');
assert.throws(() => normalizePhone('123'), /invalid_phone/);

const checkin = parseRequest({
  action: 'checkin.start', checkin_slug: 'centro-nfc', name: 'Carlos', phone: '6671234567',
  party_size: 4, marketing_consent: true, child_participation_consent: true,
  instagram: '@arroko.qa', birth_date: '1990-01-15',
});
assert.equal(checkin.phone, '526671234567');
assert.equal(checkin.marketingConsent, true);
assert.equal(checkin.instagram, 'arroko.qa');
assert.equal(checkin.birthDate, '1990-01-15');
assert.equal(checkin.birthMonthDay, '01-15');

const reward = parseRequest({
  action: 'reward.claim', visit_token: 'x'.repeat(44), reward_key: 'p4',
  idempotency_key: 'reward-claim-123',
});
assert.equal(reward.rewardKey, 'p4');

const redeem = parseRequest({
  action: 'reward.redeem', claim_id: '11111111-2222-4333-8444-555555555555',
});
assert.equal(redeem.claimId, '11111111-2222-4333-8444-555555555555');
assert.throws(() => parseRequest({ action: 'reward.redeem', claim_id: 'not-a-uuid' }), /invalid_claim_id/);

const game = parseRequest({
  action: 'game.complete', visit_token: 'x'.repeat(44), game_key: 'roll-builder',
  child_alias: 'Sam', age_band: '6-8', idempotency_key: 'session-123', score: 840,
});
assert.equal(game.score, 840);
assert.throws(() => parseRequest({
  action: 'game.complete', visit_token: 'x'.repeat(44), game_key: 'roll-builder',
  child_alias: 'Sam', age_band: '2', idempotency_key: 'session-123', score: 840,
}), /invalid_age_band/);

assert.equal((await sha256Hex('arroko')).length, 64);
assert.equal((await hmacHex('secret', 'phone:526671234567')).length, 64);
console.log('arroko-public-experience contract: ok');
