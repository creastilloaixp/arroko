import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0';
import {
  ContractError,
  hmacHex,
  parseEnvelope,
  sha256Hex,
  stableStringify,
  timingSafeHexEqual,
} from './contract.mjs';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const INGEST_SECRET = Deno.env.get('ARROKO_INGEST_SECRET') || '';
const MAX_CLOCK_SKEW_SECONDS = 300;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function errorCode(error: unknown) {
  if (error instanceof ContractError) return error.code;
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code.slice(0, 80);
  }
  return 'internal_error';
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !INGEST_SECRET) {
    return json(503, { ok: false, error: 'ingest_not_configured' });
  }

  const timestamp = request.headers.get('x-arroko-timestamp') || '';
  const suppliedSignature = request.headers.get('x-arroko-signature') || '';
  const timestampNumber = Number(timestamp);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(timestampNumber) || Math.abs(nowSeconds - timestampNumber) > MAX_CLOCK_SKEW_SECONDS) {
    return json(401, { ok: false, error: 'expired_or_invalid_timestamp' });
  }

  const rawBody = await request.text();
  const expectedSignature = await hmacHex(INGEST_SECRET, `${timestamp}.${rawBody}`);
  if (!timingSafeHexEqual(expectedSignature, suppliedSignature.toLowerCase())) {
    return json(401, { ok: false, error: 'invalid_signature' });
  }

  let envelope;
  try {
    envelope = parseEnvelope(JSON.parse(rawBody));
  } catch (error) {
    const status = error instanceof ContractError ? error.status : 400;
    return json(status, { ok: false, error: errorCode(error) });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: connector, error: connectorError } = await supabase
    .from('arroko_connectors')
    .select('id,org_id,location_id,status')
    .eq('id', envelope.connector_id)
    .eq('status', 'active')
    .maybeSingle();

  if (connectorError) return json(500, { ok: false, error: 'connector_lookup_failed' });
  if (!connector) return json(404, { ok: false, error: 'connector_not_active' });

  const { data: syncRun, error: runError } = await supabase
    .from('arroko_sync_runs')
    .insert({
      org_id: connector.org_id,
      connector_id: connector.id,
      location_id: connector.location_id,
      cursor_value: envelope.cursor,
      status: 'running',
      rows_received: envelope.events.length,
    })
    .select('id')
    .single();

  if (runError || !syncRun) return json(500, { ok: false, error: 'sync_run_create_failed' });

  const results: Array<{ id: string; status: 'applied' | 'duplicate' | 'rejected'; error?: string }> = [];
  for (const event of envelope.events) {
    const payloadHash = await sha256Hex(stableStringify(event.data));
    const { data, error } = await supabase.rpc('arroko_ingest_event', {
      p_connector_id: envelope.connector_id,
      p_source_event_id: event.id,
      p_event_type: event.type,
      p_occurred_at: event.occurred_at,
      p_payload: event.data,
      p_payload_sha256: payloadHash,
    });

    if (error) {
      results.push({ id: event.id, status: 'rejected', error: errorCode(error) });
    } else {
      results.push({ id: event.id, status: data?.duplicate ? 'duplicate' : 'applied' });
    }
  }

  const applied = results.filter((result) => result.status === 'applied').length;
  const rejected = results.filter((result) => result.status === 'rejected').length;
  const duplicate = results.filter((result) => result.status === 'duplicate').length;
  const finalStatus = rejected === 0 ? 'succeeded' : applied > 0 || duplicate > 0 ? 'partial' : 'failed';

  await supabase
    .from('arroko_sync_runs')
    .update({
      status: finalStatus,
      rows_applied: applied,
      rows_rejected: rejected,
      finished_at: new Date().toISOString(),
      error_code: rejected ? 'event_rejections' : null,
      error_summary: rejected ? `${rejected} normalized events were rejected` : null,
    })
    .eq('id', syncRun.id);

  return json(finalStatus === 'failed' ? 422 : 200, {
    ok: finalStatus !== 'failed',
    sync_run_id: syncRun.id,
    status: finalStatus,
    counts: { received: envelope.events.length, applied, duplicate, rejected },
    results,
  });
});
