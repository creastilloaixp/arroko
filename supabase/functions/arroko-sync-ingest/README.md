# Arroko normalized ingestion gateway

Machine-to-machine Edge Function for normalized Soft Restaurant and advertising
events. It does not scrape or write into the POS database.

## Authentication

The caller sends:

- `Authorization: Bearer <Supabase anon key>` for the Edge gateway.
- `x-arroko-timestamp`: current Unix timestamp in seconds.
- `x-arroko-signature`: lowercase hex HMAC-SHA256 of `<timestamp>.<raw body>`.

The HMAC secret lives only in the Edge Function secret
`ARROKO_INGEST_SECRET`. Requests older than five minutes are rejected.

## Envelope

```json
{
  "connector_id": "11111111-1111-4111-8111-111111111111",
  "cursor": "2026-09-10T12:00:00Z",
  "events": [
    {
      "id": "product-42-v3",
      "type": "product.upsert",
      "occurred_at": "2026-09-10T12:00:00Z",
      "data": {
        "external_id": "42",
        "name": "Nixi",
        "price": 240,
        "active": true
      }
    }
  ]
}
```

Accepted event types are defined in `contract.mjs`. A batch contains at most
250 events. Event IDs are idempotency keys per connector.

Raw phone numbers, emails, authorization values, tokens, secrets and payment
card data are rejected recursively. Customer events may contain only masked
display fields and an opaque `contact_ref` to an approved PII store.

## Deployment gate

Do not deploy until Arroko confirms its Soft Restaurant version, topology,
locations, licensed connector and the approved PII/consent policy.
