-- Arroko Control backend foundation.
--
-- Scope: multi-tenant operational model for clients, supplies, operations,
-- reporting and advertising decisions. No production organization or demo data
-- is inserted by this migration.
--
-- Rollback (before productive data exists): drop objects prefixed arroko_ in
-- reverse dependency order. Once productive data exists, use a forward migration.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.arroko_has_org_role(
  target_org_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.org_members membership
    where membership.org_id = target_org_id
      and membership.user_id = (select auth.uid())
      and lower(membership.role) = any (allowed_roles)
  );
$$;

revoke all on function public.arroko_has_org_role(uuid, text[]) from public;
grant execute on function public.arroko_has_org_role(uuid, text[]) to authenticated;
grant execute on function public.arroko_has_org_role(uuid, text[]) to service_role;

create or replace function public.arroko_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.arroko_set_updated_at() from public;

create table public.arroko_locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  code text,
  timezone text not null default 'America/Mazatlan',
  currency text not null default 'MXN' check (currency ~ '^[A-Z]{3}$'),
  softrestaurant_company_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, code),
  unique (org_id, softrestaurant_company_id)
);

create table public.arroko_clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  external_id text,
  display_name text,
  phone_last4 text check (phone_last4 is null or phone_last4 ~ '^[0-9]{4}$'),
  email_masked text,
  contact_ref text,
  marketing_consent boolean not null default false,
  consent_source text,
  consent_recorded_at timestamptz,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  visit_count integer not null default 0 check (visit_count >= 0),
  lifetime_value numeric(14,2) not null default 0 check (lifetime_value >= 0),
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (last_seen_at >= first_seen_at),
  check (marketing_consent = false or consent_recorded_at is not null),
  unique (org_id, id),
  unique (org_id, external_id)
);

comment on column public.arroko_clients.contact_ref is
  'Opaque reference to contact data in an approved PII store; never place raw phone or email here.';

create table public.arroko_products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  external_id text not null,
  sku text,
  name text not null check (char_length(btrim(name)) between 1 and 180),
  category text,
  price numeric(14,2) not null check (price >= 0),
  active boolean not null default true,
  source_updated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, external_id),
  unique (org_id, sku)
);

create table public.arroko_ingredients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  external_id text,
  name text not null check (char_length(btrim(name)) between 1 and 180),
  unit text not null check (unit in ('g','kg','ml','l','piece','pack','portion')),
  current_cost numeric(14,4) check (current_cost is null or current_cost >= 0),
  reorder_point numeric(14,4) check (reorder_point is null or reorder_point >= 0),
  active boolean not null default true,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, external_id)
);

create table public.arroko_recipes (
  org_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null,
  ingredient_id uuid not null,
  quantity numeric(14,4) not null check (quantity > 0),
  yield_loss_pct numeric(6,3) not null default 0 check (yield_loss_pct between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (product_id, ingredient_id),
  foreign key (org_id, product_id)
    references public.arroko_products(org_id, id) on delete cascade,
  foreign key (org_id, ingredient_id)
    references public.arroko_ingredients(org_id, id) on delete restrict
);

create table public.arroko_inventory_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null,
  ingredient_id uuid not null,
  quantity numeric(14,4) not null check (quantity >= 0),
  captured_at timestamptz not null,
  source text not null default 'manual' check (source in ('manual','softrestaurant','bridge','import')),
  source_event_id text,
  created_at timestamptz not null default now(),
  foreign key (org_id, location_id)
    references public.arroko_locations(org_id, id) on delete cascade,
  foreign key (org_id, ingredient_id)
    references public.arroko_ingredients(org_id, id) on delete cascade,
  unique (org_id, location_id, ingredient_id, source_event_id)
);

create table public.arroko_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null,
  ingredient_id uuid not null,
  kind text not null check (kind in ('purchase','sale_usage','waste','adjustment','transfer_in','transfer_out')),
  quantity numeric(14,4) not null check (quantity <> 0),
  unit_cost numeric(14,4) check (unit_cost is null or unit_cost >= 0),
  note text,
  occurred_at timestamptz not null,
  external_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (org_id, location_id)
    references public.arroko_locations(org_id, id) on delete cascade,
  foreign key (org_id, ingredient_id)
    references public.arroko_ingredients(org_id, id) on delete restrict,
  unique (org_id, external_id)
);

create table public.arroko_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null,
  external_id text not null,
  client_id uuid,
  channel text not null default 'unknown' check (channel in ('dine_in','counter','takeaway','delivery','whatsapp','phone','unknown')),
  status text not null check (status in ('open','preparing','ready','completed','cancelled','refunded')),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  tax numeric(14,2) not null default 0 check (tax >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  opened_at timestamptz not null,
  closed_at timestamptz,
  source_updated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closed_at is null or closed_at >= opened_at),
  check (total <= subtotal + tax),
  unique (org_id, id),
  unique (org_id, external_id),
  foreign key (org_id, location_id)
    references public.arroko_locations(org_id, id) on delete restrict,
  foreign key (org_id, client_id)
    references public.arroko_clients(org_id, id) on delete set null
);

create table public.arroko_order_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null,
  product_id uuid,
  external_line_id text not null,
  product_name_snapshot text not null,
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  net_amount numeric(14,2) not null check (net_amount >= 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (org_id, order_id)
    references public.arroko_orders(org_id, id) on delete cascade,
  foreign key (org_id, product_id)
    references public.arroko_products(org_id, id) on delete set null,
  unique (order_id, external_line_id)
);

create table public.arroko_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null,
  external_id text,
  method text not null check (method in ('cash','card','transfer','delivery_platform','other')),
  amount numeric(14,2) not null check (amount >= 0),
  paid_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (org_id, order_id)
    references public.arroko_orders(org_id, id) on delete cascade,
  unique (order_id, external_id)
);

create table public.arroko_operation_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null,
  kind text not null,
  severity text not null check (severity in ('info','attention','critical')),
  summary text not null check (char_length(btrim(summary)) between 1 and 280),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  owner_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'open' check (status in ('open','acknowledged','resolved','dismissed')),
  occurred_at timestamptz not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (resolved_at is null or resolved_at >= occurred_at),
  foreign key (org_id, location_id)
    references public.arroko_locations(org_id, id) on delete cascade
);

create table public.arroko_connectors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid,
  provider text not null check (provider in ('softrestaurant','meta','google_ads','manual_import')),
  status text not null default 'draft' check (status in ('draft','active','paused','error','revoked')),
  external_account_id text,
  secret_ref text,
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, location_id)
    references public.arroko_locations(org_id, id) on delete cascade,
  unique nulls not distinct (org_id, location_id, provider, external_account_id)
);

comment on column public.arroko_connectors.secret_ref is
  'Reference to a Supabase secret or external vault entry. Secret values are prohibited.';

create table public.arroko_sync_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  connector_id uuid not null,
  location_id uuid,
  cursor_value text,
  status text not null check (status in ('running','succeeded','partial','failed')),
  rows_received integer not null default 0 check (rows_received >= 0),
  rows_applied integer not null default 0 check (rows_applied >= 0),
  rows_rejected integer not null default 0 check (rows_rejected >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_code text,
  error_summary text,
  created_at timestamptz not null default now(),
  check (finished_at is null or finished_at >= started_at),
  foreign key (org_id, connector_id)
    references public.arroko_connectors(org_id, id) on delete cascade,
  foreign key (org_id, location_id)
    references public.arroko_locations(org_id, id) on delete set null
);

create table public.arroko_raw_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  connector_id uuid not null,
  source_event_id text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (org_id, connector_id)
    references public.arroko_connectors(org_id, id) on delete cascade,
  unique (connector_id, source_event_id)
);

create table public.arroko_campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid,
  platform text not null check (platform in ('meta','google_ads','tiktok','other')),
  external_id text not null,
  name text not null check (char_length(btrim(name)) between 1 and 180),
  objective text,
  status text not null check (status in ('draft','active','paused','completed','archived')),
  daily_budget numeric(14,2) check (daily_budget is null or daily_budget >= 0),
  started_at timestamptz,
  ended_at timestamptz,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or started_at is null or ended_at >= started_at),
  unique (org_id, id),
  unique (org_id, platform, external_id),
  foreign key (org_id, location_id)
    references public.arroko_locations(org_id, id) on delete set null
);

create table public.arroko_campaign_metrics_daily (
  org_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null,
  metric_date date not null,
  spend numeric(14,2) not null default 0 check (spend >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  messages bigint not null default 0 check (messages >= 0),
  platform_conversions numeric(14,3) not null default 0 check (platform_conversions >= 0),
  attributed_orders integer not null default 0 check (attributed_orders >= 0),
  attributed_revenue numeric(14,2) not null default 0 check (attributed_revenue >= 0),
  attribution_model text not null default 'unverified' check (attribution_model in ('unverified','platform','coupon','phone','first_party')),
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, metric_date),
  foreign key (org_id, campaign_id)
    references public.arroko_campaigns(org_id, id) on delete cascade
);

create table public.arroko_campaign_decisions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null,
  recommendation text not null check (char_length(btrim(recommendation)) between 1 and 500),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  proposed_change jsonb not null check (jsonb_typeof(proposed_change) = 'object'),
  status text not null default 'proposed' check (status in ('proposed','approved','rejected','executed','expired')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  executed_at timestamptz,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (org_id, campaign_id)
    references public.arroko_campaigns(org_id, id) on delete cascade,
  check ((status <> 'approved') or (approved_by is not null and approved_at is not null)),
  check (executed_at is null or approved_at is not null)
);

create table public.arroko_audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_type text not null check (actor_type in ('user','connector','system')),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create trigger arroko_locations_updated_at
before update on public.arroko_locations
for each row execute function public.arroko_set_updated_at();

create trigger arroko_clients_updated_at
before update on public.arroko_clients
for each row execute function public.arroko_set_updated_at();

create trigger arroko_products_updated_at
before update on public.arroko_products
for each row execute function public.arroko_set_updated_at();

create trigger arroko_ingredients_updated_at
before update on public.arroko_ingredients
for each row execute function public.arroko_set_updated_at();

create trigger arroko_orders_updated_at
before update on public.arroko_orders
for each row execute function public.arroko_set_updated_at();

create trigger arroko_operation_events_updated_at
before update on public.arroko_operation_events
for each row execute function public.arroko_set_updated_at();

create trigger arroko_connectors_updated_at
before update on public.arroko_connectors
for each row execute function public.arroko_set_updated_at();

create trigger arroko_campaigns_updated_at
before update on public.arroko_campaigns
for each row execute function public.arroko_set_updated_at();

create trigger arroko_campaign_metrics_updated_at
before update on public.arroko_campaign_metrics_daily
for each row execute function public.arroko_set_updated_at();

create trigger arroko_campaign_decisions_updated_at
before update on public.arroko_campaign_decisions
for each row execute function public.arroko_set_updated_at();

-- Foreign keys and the principal dashboard access paths are indexed explicitly.
create index arroko_locations_org_active_idx on public.arroko_locations (org_id, active);
create index arroko_clients_org_last_seen_idx on public.arroko_clients (org_id, last_seen_at desc, id);
create index arroko_clients_org_consent_idx on public.arroko_clients (org_id, last_seen_at desc)
  where marketing_consent;
create index arroko_products_org_active_idx on public.arroko_products (org_id, category, name)
  where active;
create index arroko_ingredients_org_active_idx on public.arroko_ingredients (org_id, name)
  where active;
create index arroko_recipes_org_ingredient_idx on public.arroko_recipes (org_id, ingredient_id);
create index arroko_inventory_snapshots_latest_idx on public.arroko_inventory_snapshots
  (org_id, location_id, ingredient_id, captured_at desc, id desc);
create index arroko_inventory_movements_timeline_idx on public.arroko_inventory_movements
  (org_id, location_id, occurred_at desc, id desc);
create index arroko_inventory_movements_ingredient_idx on public.arroko_inventory_movements
  (org_id, ingredient_id, occurred_at desc);
create index arroko_orders_timeline_idx on public.arroko_orders
  (org_id, location_id, opened_at desc, id desc);
create index arroko_orders_status_idx on public.arroko_orders
  (org_id, location_id, status, opened_at desc)
  where status in ('open','preparing','ready');
create index arroko_orders_client_idx on public.arroko_orders (org_id, client_id, opened_at desc)
  where client_id is not null;
create index arroko_order_items_order_idx on public.arroko_order_items (org_id, order_id);
create index arroko_order_items_product_idx on public.arroko_order_items (org_id, product_id)
  where product_id is not null;
create index arroko_payments_order_idx on public.arroko_payments (org_id, order_id);
create index arroko_operation_events_open_idx on public.arroko_operation_events
  (org_id, location_id, severity, occurred_at desc)
  where status in ('open','acknowledged');
create index arroko_connectors_org_idx on public.arroko_connectors (org_id, status, provider);
create index arroko_sync_runs_connector_idx on public.arroko_sync_runs
  (connector_id, started_at desc, id desc);
create index arroko_sync_runs_org_failed_idx on public.arroko_sync_runs
  (org_id, started_at desc)
  where status in ('failed','partial');
create index arroko_raw_events_unprocessed_idx on public.arroko_raw_events
  (connector_id, occurred_at, id)
  where processed_at is null;
create index arroko_campaigns_org_status_idx on public.arroko_campaigns
  (org_id, status, started_at desc);
create index arroko_campaign_metrics_org_date_idx on public.arroko_campaign_metrics_daily
  (org_id, metric_date desc, campaign_id);
create index arroko_campaign_decisions_open_idx on public.arroko_campaign_decisions
  (org_id, created_at desc, id desc)
  where status = 'proposed';
create index arroko_audit_events_timeline_idx on public.arroko_audit_events
  (org_id, created_at desc, id desc);

alter table public.arroko_locations enable row level security;
alter table public.arroko_clients enable row level security;
alter table public.arroko_products enable row level security;
alter table public.arroko_ingredients enable row level security;
alter table public.arroko_recipes enable row level security;
alter table public.arroko_inventory_snapshots enable row level security;
alter table public.arroko_inventory_movements enable row level security;
alter table public.arroko_orders enable row level security;
alter table public.arroko_order_items enable row level security;
alter table public.arroko_payments enable row level security;
alter table public.arroko_operation_events enable row level security;
alter table public.arroko_connectors enable row level security;
alter table public.arroko_sync_runs enable row level security;
alter table public.arroko_raw_events enable row level security;
alter table public.arroko_campaigns enable row level security;
alter table public.arroko_campaign_metrics_daily enable row level security;
alter table public.arroko_campaign_decisions enable row level security;
alter table public.arroko_audit_events enable row level security;

-- Read policies. Raw connector events remain service-role only.
create policy "Arroko members read locations" on public.arroko_locations for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko CRM roles read clients" on public.arroko_clients for select
  to authenticated using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko members read products" on public.arroko_products for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko members read ingredients" on public.arroko_ingredients for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko members read recipes" on public.arroko_recipes for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko members read inventory snapshots" on public.arroko_inventory_snapshots for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko members read inventory movements" on public.arroko_inventory_movements for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko members read orders" on public.arroko_orders for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko members read order items" on public.arroko_order_items for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko members read payments" on public.arroko_payments for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko members read operation events" on public.arroko_operation_events for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko admins read connectors" on public.arroko_connectors for select
  to authenticated using (public.arroko_has_org_role(org_id, array['admin','owner']));
create policy "Arroko operators read sync runs" on public.arroko_sync_runs for select
  to authenticated using (public.arroko_has_org_role(org_id, array['ops','admin','owner']));
create policy "Arroko members read campaigns" on public.arroko_campaigns for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko members read campaign metrics" on public.arroko_campaign_metrics_daily for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko members read campaign decisions" on public.arroko_campaign_decisions for select
  to authenticated using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko admins read audit events" on public.arroko_audit_events for select
  to authenticated using (public.arroko_has_org_role(org_id, array['admin','owner']));

-- Human write policies. Imported commerce and metrics remain service-role writes.
create policy "Arroko admins insert locations" on public.arroko_locations for insert
  to authenticated with check (public.arroko_has_org_role(org_id, array['admin','owner']));
create policy "Arroko admins update locations" on public.arroko_locations for update
  to authenticated using (public.arroko_has_org_role(org_id, array['admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['admin','owner']));

create policy "Arroko CRM roles insert clients" on public.arroko_clients for insert
  to authenticated with check (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko CRM roles update clients" on public.arroko_clients for update
  to authenticated using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));

create policy "Arroko operators insert ingredients" on public.arroko_ingredients for insert
  to authenticated with check (public.arroko_has_org_role(org_id, array['ops','admin','owner']));
create policy "Arroko operators update ingredients" on public.arroko_ingredients for update
  to authenticated using (public.arroko_has_org_role(org_id, array['ops','admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['ops','admin','owner']));
create policy "Arroko operators insert recipes" on public.arroko_recipes for insert
  to authenticated with check (public.arroko_has_org_role(org_id, array['ops','admin','owner']));
create policy "Arroko operators update recipes" on public.arroko_recipes for update
  to authenticated using (public.arroko_has_org_role(org_id, array['ops','admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['ops','admin','owner']));
create policy "Arroko operators delete recipes" on public.arroko_recipes for delete
  to authenticated using (public.arroko_has_org_role(org_id, array['ops','admin','owner']));
create policy "Arroko operators insert inventory movements" on public.arroko_inventory_movements for insert
  to authenticated with check (
    public.arroko_has_org_role(org_id, array['ops','admin','owner'])
    and created_by = (select auth.uid())
  );

create policy "Arroko operators insert operation events" on public.arroko_operation_events for insert
  to authenticated with check (public.arroko_has_org_role(org_id, array['ops','admin','owner']));
create policy "Arroko operators update operation events" on public.arroko_operation_events for update
  to authenticated using (public.arroko_has_org_role(org_id, array['ops','admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['ops','admin','owner']));

create policy "Arroko admins insert connectors" on public.arroko_connectors for insert
  to authenticated with check (public.arroko_has_org_role(org_id, array['admin','owner']));
create policy "Arroko admins update connectors" on public.arroko_connectors for update
  to authenticated using (public.arroko_has_org_role(org_id, array['admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['admin','owner']));

create policy "Arroko admins insert campaigns" on public.arroko_campaigns for insert
  to authenticated with check (public.arroko_has_org_role(org_id, array['admin','owner']));
create policy "Arroko admins update campaigns" on public.arroko_campaigns for update
  to authenticated using (public.arroko_has_org_role(org_id, array['admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['admin','owner']));
create policy "Arroko admins insert campaign decisions" on public.arroko_campaign_decisions for insert
  to authenticated with check (
    public.arroko_has_org_role(org_id, array['admin','owner'])
    and created_by = (select auth.uid())
    and status = 'proposed'
  );

revoke all on table
  public.arroko_locations,
  public.arroko_clients,
  public.arroko_products,
  public.arroko_ingredients,
  public.arroko_recipes,
  public.arroko_inventory_snapshots,
  public.arroko_inventory_movements,
  public.arroko_orders,
  public.arroko_order_items,
  public.arroko_payments,
  public.arroko_operation_events,
  public.arroko_connectors,
  public.arroko_sync_runs,
  public.arroko_raw_events,
  public.arroko_campaigns,
  public.arroko_campaign_metrics_daily,
  public.arroko_campaign_decisions,
  public.arroko_audit_events
from anon, authenticated;

grant select, insert, update on public.arroko_locations to authenticated;
grant select, insert, update on public.arroko_clients to authenticated;
grant select on public.arroko_products to authenticated;
grant select, insert, update on public.arroko_ingredients to authenticated;
grant select, insert, update, delete on public.arroko_recipes to authenticated;
grant select on public.arroko_inventory_snapshots to authenticated;
grant select, insert on public.arroko_inventory_movements to authenticated;
grant select on public.arroko_orders to authenticated;
grant select on public.arroko_order_items to authenticated;
grant select on public.arroko_payments to authenticated;
grant select, insert, update on public.arroko_operation_events to authenticated;
grant select, insert, update on public.arroko_connectors to authenticated;
grant select on public.arroko_sync_runs to authenticated;
grant select, insert, update on public.arroko_campaigns to authenticated;
grant select on public.arroko_campaign_metrics_daily to authenticated;
grant select, insert on public.arroko_campaign_decisions to authenticated;
grant select on public.arroko_audit_events to authenticated;

grant all on public.arroko_locations to service_role;
grant all on public.arroko_clients to service_role;
grant all on public.arroko_products to service_role;
grant all on public.arroko_ingredients to service_role;
grant all on public.arroko_recipes to service_role;
grant all on public.arroko_inventory_snapshots to service_role;
grant all on public.arroko_inventory_movements to service_role;
grant all on public.arroko_orders to service_role;
grant all on public.arroko_order_items to service_role;
grant all on public.arroko_payments to service_role;
grant all on public.arroko_operation_events to service_role;
grant all on public.arroko_connectors to service_role;
grant all on public.arroko_sync_runs to service_role;
grant all on public.arroko_raw_events to service_role;
grant all on public.arroko_campaigns to service_role;
grant all on public.arroko_campaign_metrics_daily to service_role;
grant all on public.arroko_campaign_decisions to service_role;
grant all on public.arroko_audit_events to service_role;

notify pgrst, 'reload schema';

commit;
