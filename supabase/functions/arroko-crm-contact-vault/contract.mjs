const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ContactVaultError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export function parseContactRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContactVaultError('invalid_request');
  }
  if (value.action !== 'contact.detail') throw new ContactVaultError('invalid_action');
  const clientId = String(value.client_id || '').trim();
  if (!UUID.test(clientId)) throw new ContactVaultError('invalid_client_id');
  const purpose = String(value.purpose || '').trim();
  if (purpose.length < 3 || purpose.length > 120) throw new ContactVaultError('invalid_purpose');
  return { action: 'contact.detail', clientId, purpose };
}

export function authorizedMemberships(rows) {
  return (Array.isArray(rows) ? rows : []).filter((row) =>
    row?.org_id && ['admin', 'owner'].includes(String(row.role || '').toLowerCase())
  );
}
