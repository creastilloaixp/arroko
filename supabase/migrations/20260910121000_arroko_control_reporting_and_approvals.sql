-- Read models and governed decisions for Arroko Control.
-- Depends on 20260910120000_arroko_control_core.sql.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create view public.arroko_latest_inventory
with (security_invoker = true)
as
select distinct on (snapshot.org_id, snapshot.location_id, snapshot.ingredient_id)
  snapshot.org_id,
  snapshot.location_id,
  snapshot.ingredient_id,
  ingredient.name as ingredient_name,
  ingredient.unit,
  ingredient.current_cost,
  ingredient.reorder_point,
  snapshot.quantity,
  snapshot.captured_at,
  snapshot.source,
  case
    when ingredient.reorder_point is null then 'unclassified'
    when snapshot.quantity <= ingredient.reorder_point then 'critical'
    when snapshot.quantity <= ingredient.reorder_point * 1.5 then 'watch'
    else 'healthy'
  end as stock_status
from public.arroko_inventory_snapshots snapshot
join public.arroko_ingredients ingredient
  on ingredient.org_id = snapshot.org_id
 and ingredient.id = snapshot.ingredient_id
order by
  snapshot.org_id,
  snapshot.location_id,
  snapshot.ingredient_id,
  snapshot.captured_at desc,
  snapshot.id desc;

create view public.arroko_daily_sales
with (security_invoker = true)
as
select
  orders.org_id,
  orders.location_id,
  (orders.closed_at at time zone locations.timezone)::date as sale_date,
  count(*)::bigint as order_count,
  count(orders.client_id)::bigint as identified_order_count,
  coalesce(sum(orders.total), 0)::numeric(14,2) as net_sales,
  coalesce(avg(orders.total), 0)::numeric(14,2) as average_ticket,
  coalesce(sum(orders.discount), 0)::numeric(14,2) as discounts
from public.arroko_orders orders
join public.arroko_locations locations
  on locations.org_id = orders.org_id
 and locations.id = orders.location_id
where orders.status = 'completed'
  and orders.closed_at is not null
group by orders.org_id, orders.location_id, sale_date;

revoke all on public.arroko_latest_inventory from anon, authenticated;
revoke all on public.arroko_daily_sales from anon, authenticated;
grant select on public.arroko_latest_inventory to authenticated;
grant select on public.arroko_daily_sales to authenticated;
grant select on public.arroko_latest_inventory to service_role;
grant select on public.arroko_daily_sales to service_role;

create or replace function public.arroko_dashboard_summary(
  p_org_id uuid,
  p_location_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  if p_to <= p_from then
    raise exception 'invalid_date_range' using errcode = '22007';
  end if;

  if not public.arroko_has_org_role(
    p_org_id,
    array['viewer','sales','ops','admin','owner']
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.arroko_locations location
    where location.org_id = p_org_id
      and location.id = p_location_id
  ) then
    raise exception 'location_not_found' using errcode = 'P0002';
  end if;

  with sales as (
    select
      count(*)::integer as order_count,
      coalesce(sum(orders.total), 0)::numeric(14,2) as net_sales,
      coalesce(avg(orders.total), 0)::numeric(14,2) as average_ticket,
      coalesce(
        round(100.0 * count(orders.client_id) / nullif(count(*), 0), 1),
        0
      ) as identified_pct
    from public.arroko_orders orders
    where orders.org_id = p_org_id
      and orders.location_id = p_location_id
      and orders.status = 'completed'
      and orders.closed_at >= p_from
      and orders.closed_at < p_to
  ), campaign as (
    select
      coalesce(sum(metrics.spend), 0)::numeric(14,2) as spend,
      coalesce(sum(metrics.attributed_revenue), 0)::numeric(14,2) as attributed_revenue,
      coalesce(sum(metrics.attributed_orders), 0)::integer as attributed_orders
    from public.arroko_campaign_metrics_daily metrics
    join public.arroko_campaigns campaign
      on campaign.org_id = metrics.org_id
     and campaign.id = metrics.campaign_id
    where metrics.org_id = p_org_id
      and (campaign.location_id is null or campaign.location_id = p_location_id)
      and metrics.metric_date >= p_from::date
      and metrics.metric_date < p_to::date
  ), inventory as (
    select count(*) filter (where latest.stock_status = 'critical')::integer as critical_count
    from public.arroko_latest_inventory latest
    where latest.org_id = p_org_id
      and latest.location_id = p_location_id
  ), operations as (
    select count(*)::integer as open_incident_count
    from public.arroko_operation_events event
    where event.org_id = p_org_id
      and event.location_id = p_location_id
      and event.status in ('open','acknowledged')
  ), decisions as (
    select count(*)::integer as proposed_decision_count
    from public.arroko_campaign_decisions decision
    join public.arroko_campaigns campaign
      on campaign.org_id = decision.org_id
     and campaign.id = decision.campaign_id
    where decision.org_id = p_org_id
      and decision.status = 'proposed'
      and (campaign.location_id is null or campaign.location_id = p_location_id)
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'sales', jsonb_build_object(
      'net', sales.net_sales,
      'orders', sales.order_count,
      'average_ticket', sales.average_ticket,
      'identified_client_pct', sales.identified_pct
    ),
    'inventory', jsonb_build_object('critical_count', inventory.critical_count),
    'operations', jsonb_build_object('open_incident_count', operations.open_incident_count),
    'campaigns', jsonb_build_object(
      'spend', campaign.spend,
      'attributed_revenue', campaign.attributed_revenue,
      'attributed_orders', campaign.attributed_orders,
      'roas', case
        when campaign.spend > 0 then round(campaign.attributed_revenue / campaign.spend, 2)
        else 0
      end,
      'proposed_decision_count', decisions.proposed_decision_count
    )
  )
  into result
  from sales, campaign, inventory, operations, decisions;

  return result;
end;
$$;

revoke all on function public.arroko_dashboard_summary(uuid, uuid, timestamptz, timestamptz) from public;
grant execute on function public.arroko_dashboard_summary(uuid, uuid, timestamptz, timestamptz)
  to authenticated;
grant execute on function public.arroko_dashboard_summary(uuid, uuid, timestamptz, timestamptz)
  to service_role;

create or replace function public.arroko_decide_campaign(
  p_decision_id uuid,
  p_action text,
  p_reason text default null
)
returns public.arroko_campaign_decisions
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  decision public.arroko_campaign_decisions;
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_action not in ('approve','reject') then
    raise exception 'invalid_action' using errcode = '22023';
  end if;

  select *
  into decision
  from public.arroko_campaign_decisions row_to_lock
  where row_to_lock.id = p_decision_id
  for update;

  if not found then
    raise exception 'decision_not_found' using errcode = 'P0002';
  end if;

  if not public.arroko_has_org_role(decision.org_id, array['admin','owner']) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if decision.status <> 'proposed' then
    raise exception 'decision_already_resolved' using errcode = '55000';
  end if;

  if decision.expires_at is not null and decision.expires_at <= now() then
    update public.arroko_campaign_decisions
    set status = 'expired'
    where id = decision.id
    returning * into decision;

    insert into public.arroko_audit_events (
      org_id,
      actor_id,
      actor_type,
      action,
      entity_type,
      entity_id,
      metadata
    ) values (
      decision.org_id,
      actor,
      'user',
      'campaign_decision.expired',
      'campaign_decision',
      decision.id::text,
      jsonb_build_object('attempted_action', p_action, 'campaign_id', decision.campaign_id)
    );

    return decision;
  end if;

  update public.arroko_campaign_decisions
  set
    status = case when p_action = 'approve' then 'approved' else 'rejected' end,
    approved_by = case when p_action = 'approve' then actor else null end,
    approved_at = case when p_action = 'approve' then now() else null end
  where id = decision.id
  returning * into decision;

  insert into public.arroko_audit_events (
    org_id,
    actor_id,
    actor_type,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    decision.org_id,
    actor,
    'user',
    'campaign_decision.' || decision.status,
    'campaign_decision',
    decision.id::text,
    jsonb_build_object('reason', p_reason, 'campaign_id', decision.campaign_id)
  );

  return decision;
end;
$$;

revoke all on function public.arroko_decide_campaign(uuid, text, text) from public;
grant execute on function public.arroko_decide_campaign(uuid, text, text) to authenticated;
grant execute on function public.arroko_decide_campaign(uuid, text, text) to service_role;

notify pgrst, 'reload schema';

commit;
