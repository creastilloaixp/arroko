import assert from 'node:assert/strict';
import { authorizedMemberships, ContactVaultError, parseContactRequest } from './contract.mjs';

const clientId = '0d4ef6c4-b0d0-4d22-9e13-07315a36af15';
assert.deepEqual(parseContactRequest({ action: 'contact.detail', client_id: clientId, purpose: 'customer_360' }), {
  action: 'contact.detail', clientId, purpose: 'customer_360',
});
assert.throws(() => parseContactRequest({ action: 'contact.detail', client_id: 'bad', purpose: 'customer_360' }), ContactVaultError);
assert.deepEqual(authorizedMemberships([
  { org_id: 'one', role: 'viewer' },
  { org_id: 'two', role: 'Admin' },
  { org_id: 'three', role: 'owner' },
]).map((row) => row.org_id), ['two', 'three']);
console.log('arroko-crm-contact-vault contract: ok');
