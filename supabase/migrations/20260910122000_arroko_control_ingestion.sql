-- Atomic normalized-event ingestion for Arroko Control.
-- Only service_role may call this function. Transport authentication lives in
-- the arroko-sync-ingest Edge Function; this function owns idempotency and writes.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.arroko_ingest_event(
  p_connector_id uuid,
  p_source_event_id text,
  p_event_type text,
  p_occurred_at timestamptz,
  p_payload jsonb,
  p_payload_sha256 text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  connector public.arroko_connectors;
  raw_event_id uuid;
  target_id uuid;
  target_location_id uuid;
  target_ingredient_id uuid;
  target_order_id uuid;
  target_product_id uuid;
  target_campaign_id uuid;
  item jsonb;
  payment jsonb;
begin
  if p_source_event_id is null or char_length(p_source_event_id) not between 1 and 180 then
    raise exception 'invalid_source_event_id' using errcode = '22023';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  if p_payload_sha256 is null or p_payload_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_payload_hash' using errcode = '22023';
  end if;

  select *
  into connector
  from public.arroko_connectors row_to_lock
  where row_to_lock.id = p_connector_id
    and row_to_lock.status = 'active'
  for share;

  if not found then
    raise exception 'connector_not_active' using errcode = 'P0002';
  end if;

  insert into public.arroko_raw_events (
    org_id,
    connector_id,
    source_event_id,
    event_type,
    occurred_at,
    payload,
    payload_sha256
  ) values (
    connector.org_id,
    connector.id,
    p_source_event_id,
    p_event_type,
    p_occurred_at,
    p_payload,
    p_payload_sha256
  )
  on conflict (connector_id, source_event_id) do nothing
  returning id into raw_event_id;

  if raw_event_id is null then
    return jsonb_build_object(
      'applied', false,
      'duplicate', true,
      'source_event_id', p_source_event_id
    );
  end if;

  if p_event_type = 'product.upsert' then
    insert into public.arroko_products (
      org_id,
      external_id,
      sku,
      name,
      category,
      price,
      active,
      source_updated_at,
      metadata
    ) values (
      connector.org_id,
      p_payload->>'external_id',
      nullif(p_payload->>'sku', ''),
      p_payload->>'name',
      nullif(p_payload->>'category', ''),
      (p_payload->>'price')::numeric,
      coalesce((p_payload->>'active')::boolean, true),
      coalesce((p_payload->>'source_updated_at')::timestamptz, p_occurred_at),
      coalesce(p_payload->'metadata', '{}'::jsonb)
    )
    on conflict (org_id, external_id) do update set
      sku = excluded.sku,
      name = excluded.name,
      category = excluded.category,
      price = excluded.price,
      active = excluded.active,
      source_updated_at = excluded.source_updated_at,
      metadata = excluded.metadata
    where public.arroko_products.source_updated_at is null
       or excluded.source_updated_at >= public.arroko_products.source_updated_at
    returning id into target_id;

  elsif p_event_type = 'ingredient.upsert' then
    insert into public.arroko_ingredients (
      org_id,
      external_id,
      name,
      unit,
      current_cost,
      reorder_point,
      active,
      source_updated_at
    ) values (
      connector.org_id,
      p_payload->>'external_id',
      p_payload->>'name',
      p_payload->>'unit',
      nullif(p_payload->>'current_cost', '')::numeric,
      nullif(p_payload->>'reorder_point', '')::numeric,
      coalesce((p_payload->>'active')::boolean, true),
      coalesce((p_payload->>'source_updated_at')::timestamptz, p_occurred_at)
    )
    on conflict (org_id, external_id) do update set
      name = excluded.name,
      unit = excluded.unit,
      current_cost = excluded.current_cost,
      reorder_point = excluded.reorder_point,
      active = excluded.active,
      source_updated_at = excluded.source_updated_at
    where public.arroko_ingredients.source_updated_at is null
       or excluded.source_updated_at >= public.arroko_ingredients.source_updated_at
    returning id into target_id;

  elsif p_event_type = 'client.upsert' then
    if p_payload ?| array['phone','email','whatsapp'] then
      raise exception 'raw_pii_not_allowed' using errcode = '22023';
    end if;

    insert into public.arroko_clients (
      org_id,
      external_id,
      display_name,
      phone_last4,
      email_masked,
      contact_ref,
      marketing_consent,
      consent_source,
      consent_recorded_at,
      first_seen_at,
      last_seen_at,
      visit_count,
      lifetime_value,
      attributes
    ) values (
      connector.org_id,
      p_payload->>'external_id',
      nullif(p_payload->>'display_name', ''),
      nullif(p_payload->>'phone_last4', ''),
      nullif(p_payload->>'email_masked', ''),
      nullif(p_payload->>'contact_ref', ''),
      coalesce((p_payload->>'marketing_consent')::boolean, false),
      nullif(p_payload->>'consent_source', ''),
      nullif(p_payload->>'consent_recorded_at', '')::timestamptz,
      coalesce((p_payload->>'first_seen_at')::timestamptz, p_occurred_at),
      coalesce((p_payload->>'last_seen_at')::timestamptz, p_occurred_at),
      coalesce((p_payload->>'visit_count')::integer, 0),
      coalesce((p_payload->>'lifetime_value')::numeric, 0),
      coalesce(p_payload->'attributes', '{}'::jsonb)
    )
    on conflict (org_id, external_id) do update set
      display_name = excluded.display_name,
      phone_last4 = excluded.phone_last4,
      email_masked = excluded.email_masked,
      contact_ref = excluded.contact_ref,
      marketing_consent = excluded.marketing_consent,
      consent_source = excluded.consent_source,
      consent_recorded_at = excluded.consent_recorded_at,
      first_seen_at = least(public.arroko_clients.first_seen_at, excluded.first_seen_at),
      last_seen_at = greatest(public.arroko_clients.last_seen_at, excluded.last_seen_at),
      visit_count = greatest(public.arroko_clients.visit_count, excluded.visit_count),
      lifetime_value = greatest(public.arroko_clients.lifetime_value, excluded.lifetime_value),
      attributes = public.arroko_clients.attributes || excluded.attributes
    returning id into target_id;

  elsif p_event_type = 'inventory.snapshot' then
    target_location_id := connector.location_id;
    if target_location_id is null then
      select location.id into target_location_id
      from public.arroko_locations location
      where location.org_id = connector.org_id
        and location.softrestaurant_company_id = p_payload->>'location_external_id';
    end if;

    select ingredient.id into target_ingredient_id
    from public.arroko_ingredients ingredient
    where ingredient.org_id = connector.org_id
      and ingredient.external_id = p_payload->>'ingredient_external_id';

    if target_location_id is null or target_ingredient_id is null then
      raise exception 'inventory_reference_not_found' using errcode = 'P0002';
    end if;

    insert into public.arroko_inventory_snapshots (
      org_id,
      location_id,
      ingredient_id,
      quantity,
      captured_at,
      source,
      source_event_id
    ) values (
      connector.org_id,
      target_location_id,
      target_ingredient_id,
      (p_payload->>'quantity')::numeric,
      coalesce((p_payload->>'captured_at')::timestamptz, p_occurred_at),
      case when connector.provider = 'softrestaurant' then 'softrestaurant' else 'bridge' end,
      p_source_event_id
    ) returning id into target_id;

  elsif p_event_type = 'order.upsert' then
    target_location_id := connector.location_id;
    if target_location_id is null then
      select location.id into target_location_id
      from public.arroko_locations location
      where location.org_id = connector.org_id
        and location.softrestaurant_company_id = p_payload->>'location_external_id';
    end if;

    if target_location_id is null then
      raise exception 'order_location_not_found' using errcode = 'P0002';
    end if;

    insert into public.arroko_orders (
      org_id,
      location_id,
      external_id,
      client_id,
      channel,
      status,
      subtotal,
      discount,
      tax,
      total,
      opened_at,
      closed_at,
      source_updated_at,
      metadata
    ) values (
      connector.org_id,
      target_location_id,
      p_payload->>'external_id',
      (
        select client.id
        from public.arroko_clients client
        where client.org_id = connector.org_id
          and client.external_id = p_payload->>'client_external_id'
      ),
      coalesce(nullif(p_payload->>'channel', ''), 'unknown'),
      p_payload->>'status',
      coalesce((p_payload->>'subtotal')::numeric, 0),
      coalesce((p_payload->>'discount')::numeric, 0),
      coalesce((p_payload->>'tax')::numeric, 0),
      coalesce((p_payload->>'total')::numeric, 0),
      (p_payload->>'opened_at')::timestamptz,
      nullif(p_payload->>'closed_at', '')::timestamptz,
      coalesce((p_payload->>'source_updated_at')::timestamptz, p_occurred_at),
      coalesce(p_payload->'metadata', '{}'::jsonb)
    )
    on conflict (org_id, external_id) do update set
      location_id = excluded.location_id,
      client_id = coalesce(excluded.client_id, public.arroko_orders.client_id),
      channel = excluded.channel,
      status = excluded.status,
      subtotal = excluded.subtotal,
      discount = excluded.discount,
      tax = excluded.tax,
      total = excluded.total,
      opened_at = excluded.opened_at,
      closed_at = excluded.closed_at,
      source_updated_at = excluded.source_updated_at,
      metadata = excluded.metadata
    where public.arroko_orders.source_updated_at is null
       or excluded.source_updated_at >= public.arroko_orders.source_updated_at
    returning id into target_order_id;

    if target_order_id is null then
      select existing_order.id into target_order_id
      from public.arroko_orders existing_order
      where existing_order.org_id = connector.org_id
        and existing_order.external_id = p_payload->>'external_id';
    end if;

    if coalesce((p_payload->>'replace_lines')::boolean, false) then
      delete from public.arroko_order_items where order_id = target_order_id;
      delete from public.arroko_payments where order_id = target_order_id;
    end if;

    for item in select value from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb))
    loop
      select product.id into target_product_id
      from public.arroko_products product
      where product.org_id = connector.org_id
        and product.external_id = item->>'product_external_id';

      insert into public.arroko_order_items (
        org_id,
        order_id,
        product_id,
        external_line_id,
        product_name_snapshot,
        quantity,
        unit_price,
        discount,
        net_amount,
        metadata
      ) values (
        connector.org_id,
        target_order_id,
        target_product_id,
        item->>'external_line_id',
        item->>'name',
        (item->>'quantity')::numeric,
        (item->>'unit_price')::numeric,
        coalesce((item->>'discount')::numeric, 0),
        (item->>'net_amount')::numeric,
        coalesce(item->'metadata', '{}'::jsonb)
      )
      on conflict (order_id, external_line_id) do update set
        product_id = excluded.product_id,
        product_name_snapshot = excluded.product_name_snapshot,
        quantity = excluded.quantity,
        unit_price = excluded.unit_price,
        discount = excluded.discount,
        net_amount = excluded.net_amount,
        metadata = excluded.metadata;
    end loop;

    for payment in select value from jsonb_array_elements(coalesce(p_payload->'payments', '[]'::jsonb))
    loop
      insert into public.arroko_payments (
        org_id,
        order_id,
        external_id,
        method,
        amount,
        paid_at
      ) values (
        connector.org_id,
        target_order_id,
        nullif(payment->>'external_id', ''),
        coalesce(nullif(payment->>'method', ''), 'other'),
        (payment->>'amount')::numeric,
        coalesce((payment->>'paid_at')::timestamptz, p_occurred_at)
      )
      on conflict (order_id, external_id) do update set
        method = excluded.method,
        amount = excluded.amount,
        paid_at = excluded.paid_at;
    end loop;

    target_id := target_order_id;

  elsif p_event_type = 'operation.event' then
    target_location_id := connector.location_id;
    if target_location_id is null then
      raise exception 'operation_location_not_found' using errcode = 'P0002';
    end if;

    insert into public.arroko_operation_events (
      org_id,
      location_id,
      kind,
      severity,
      summary,
      details,
      status,
      occurred_at
    ) values (
      connector.org_id,
      target_location_id,
      p_payload->>'kind',
      p_payload->>'severity',
      p_payload->>'summary',
      coalesce(p_payload->'details', '{}'::jsonb),
      coalesce(nullif(p_payload->>'status', ''), 'open'),
      coalesce((p_payload->>'occurred_at')::timestamptz, p_occurred_at)
    ) returning id into target_id;

  elsif p_event_type = 'campaign.upsert' then
    insert into public.arroko_campaigns (
      org_id,
      location_id,
      platform,
      external_id,
      name,
      objective,
      status,
      daily_budget,
      started_at,
      ended_at,
      source_updated_at
    ) values (
      connector.org_id,
      connector.location_id,
      p_payload->>'platform',
      p_payload->>'external_id',
      p_payload->>'name',
      nullif(p_payload->>'objective', ''),
      p_payload->>'status',
      nullif(p_payload->>'daily_budget', '')::numeric,
      nullif(p_payload->>'started_at', '')::timestamptz,
      nullif(p_payload->>'ended_at', '')::timestamptz,
      coalesce((p_payload->>'source_updated_at')::timestamptz, p_occurred_at)
    )
    on conflict (org_id, platform, external_id) do update set
      location_id = excluded.location_id,
      name = excluded.name,
      objective = excluded.objective,
      status = excluded.status,
      daily_budget = excluded.daily_budget,
      started_at = excluded.started_at,
      ended_at = excluded.ended_at,
      source_updated_at = excluded.source_updated_at
    where public.arroko_campaigns.source_updated_at is null
       or excluded.source_updated_at >= public.arroko_campaigns.source_updated_at
    returning id into target_id;

  elsif p_event_type = 'campaign.metrics' then
    select campaign.id into target_campaign_id
    from public.arroko_campaigns campaign
    where campaign.org_id = connector.org_id
      and campaign.platform = p_payload->>'platform'
      and campaign.external_id = p_payload->>'campaign_external_id';

    if target_campaign_id is null then
      raise exception 'campaign_not_found' using errcode = 'P0002';
    end if;

    insert into public.arroko_campaign_metrics_daily (
      org_id,
      campaign_id,
      metric_date,
      spend,
      impressions,
      clicks,
      messages,
      platform_conversions,
      attributed_orders,
      attributed_revenue,
      attribution_model,
      source_updated_at
    ) values (
      connector.org_id,
      target_campaign_id,
      (p_payload->>'metric_date')::date,
      coalesce((p_payload->>'spend')::numeric, 0),
      coalesce((p_payload->>'impressions')::bigint, 0),
      coalesce((p_payload->>'clicks')::bigint, 0),
      coalesce((p_payload->>'messages')::bigint, 0),
      coalesce((p_payload->>'platform_conversions')::numeric, 0),
      coalesce((p_payload->>'attributed_orders')::integer, 0),
      coalesce((p_payload->>'attributed_revenue')::numeric, 0),
      coalesce(nullif(p_payload->>'attribution_model', ''), 'unverified'),
      coalesce((p_payload->>'source_updated_at')::timestamptz, p_occurred_at)
    )
    on conflict (campaign_id, metric_date) do update set
      spend = excluded.spend,
      impressions = excluded.impressions,
      clicks = excluded.clicks,
      messages = excluded.messages,
      platform_conversions = excluded.platform_conversions,
      attributed_orders = excluded.attributed_orders,
      attributed_revenue = excluded.attributed_revenue,
      attribution_model = excluded.attribution_model,
      source_updated_at = excluded.source_updated_at
    where public.arroko_campaign_metrics_daily.source_updated_at is null
       or excluded.source_updated_at >= public.arroko_campaign_metrics_daily.source_updated_at;

    target_id := target_campaign_id;

  else
    raise exception 'unsupported_event_type: %', p_event_type using errcode = '22023';
  end if;

  update public.arroko_raw_events
  set processed_at = now()
  where id = raw_event_id;

  return jsonb_build_object(
    'applied', true,
    'duplicate', false,
    'event_id', raw_event_id,
    'target_id', target_id,
    'event_type', p_event_type
  );
end;
$$;

revoke all on function public.arroko_ingest_event(uuid, text, text, timestamptz, jsonb, text) from public;
grant execute on function public.arroko_ingest_event(uuid, text, text, timestamptz, jsonb, text)
  to service_role;

notify pgrst, 'reload schema';

commit;
