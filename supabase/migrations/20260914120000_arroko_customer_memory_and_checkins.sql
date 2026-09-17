-- Arroko customer memory, NFC/QR check-ins and ArroKids engagement.
-- Extends the existing Arroko Control schema without changing prior migrations.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table public.arroko_households (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  primary_client_id uuid not null,
  display_label text,
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, primary_client_id)
    references public.arroko_clients(org_id, id) on delete restrict
);

create table public.arroko_household_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  household_id uuid not null,
  client_id uuid not null,
  relationship text not null default 'responsible_adult'
    check (relationship in ('responsible_adult','adult_member')),
  created_at timestamptz not null default now(),
  primary key (household_id, client_id),
  foreign key (org_id, household_id)
    references public.arroko_households(org_id, id) on delete cascade,
  foreign key (org_id, client_id)
    references public.arroko_clients(org_id, id) on delete cascade
);

create table public.arroko_child_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  household_id uuid not null,
  alias text not null check (char_length(btrim(alias)) between 1 and 40),
  age_band text check (age_band is null or age_band in ('3-5','6-8','9-12','13-15')),
  avatar_key text,
  preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (household_id, alias),
  foreign key (org_id, household_id)
    references public.arroko_households(org_id, id) on delete cascade
);

comment on table public.arroko_child_profiles is
  'Pseudonymous child profiles. Never store phone, email, address or full birth date here.';

create table public.arroko_checkin_points (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  label text not null check (char_length(btrim(label)) between 1 and 100),
  channel text not null default 'nfc' check (channel in ('nfc','qr','table','staff','campaign')),
  campaign_id uuid,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (slug),
  foreign key (org_id, location_id)
    references public.arroko_locations(org_id, id) on delete cascade,
  foreign key (org_id, campaign_id)
    references public.arroko_campaigns(org_id, id) on delete set null
);

create table public.arroko_visits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null,
  client_id uuid not null,
  household_id uuid,
  checkin_point_id uuid,
  access_token_hash text not null check (access_token_hash ~ '^[a-f0-9]{64}$'),
  source text not null default 'nfc' check (source in ('nfc','qr','table','staff','campaign','import')),
  status text not null default 'open' check (status in ('open','closed','cancelled')),
  party_size integer check (party_size is null or party_size between 1 and 40),
  table_ref text,
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (access_token_hash),
  foreign key (org_id, location_id)
    references public.arroko_locations(org_id, id) on delete restrict,
  foreign key (org_id, client_id)
    references public.arroko_clients(org_id, id) on delete restrict,
  foreign key (org_id, household_id)
    references public.arroko_households(org_id, id) on delete set null,
  foreign key (org_id, checkin_point_id)
    references public.arroko_checkin_points(org_id, id) on delete set null,
  check (checked_out_at is null or checked_out_at >= checked_in_at)
);

create table public.arroko_visit_orders (
  org_id uuid not null references public.organizations(id) on delete cascade,
  visit_id uuid not null,
  order_id uuid not null,
  match_method text not null default 'manual'
    check (match_method in ('external_customer','table_time','receipt_code','manual')),
  confidence numeric(4,3) not null default 1 check (confidence between 0 and 1),
  linked_at timestamptz not null default now(),
  primary key (visit_id, order_id),
  unique (order_id),
  foreign key (org_id, visit_id)
    references public.arroko_visits(org_id, id) on delete cascade,
  foreign key (org_id, order_id)
    references public.arroko_orders(org_id, id) on delete cascade
);

create table public.arroko_game_definitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  game_key text not null check (game_key ~ '^[a-z0-9][a-z0-9_-]{2,63}$'),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  points_rule jsonb not null default '{}'::jsonb check (jsonb_typeof(points_rule) = 'object'),
  active boolean not null default true,
  seasonal_from date,
  seasonal_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, game_key),
  check (seasonal_until is null or seasonal_from is null or seasonal_until >= seasonal_from)
);

create table public.arroko_game_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  visit_id uuid not null,
  child_profile_id uuid not null,
  game_definition_id uuid not null,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  status text not null default 'completed' check (status in ('started','completed','abandoned','invalidated')),
  score integer not null default 0 check (score >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds between 0 and 10800),
  points_awarded integer not null default 0 check (points_awarded >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, idempotency_key),
  foreign key (org_id, visit_id)
    references public.arroko_visits(org_id, id) on delete cascade,
  foreign key (org_id, child_profile_id)
    references public.arroko_child_profiles(org_id, id) on delete restrict,
  foreign key (org_id, game_definition_id)
    references public.arroko_game_definitions(org_id, id) on delete restrict,
  check (completed_at is null or completed_at >= started_at)
);

create table public.arroko_reward_ledger (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  household_id uuid not null,
  child_profile_id uuid,
  visit_id uuid,
  game_session_id uuid,
  points_delta integer not null check (points_delta <> 0),
  reason text not null check (reason in ('game_score','visit_bonus','manual_adjustment','redemption','expiration')),
  reference_key text not null check (char_length(reference_key) between 3 and 160),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, reference_key),
  foreign key (org_id, household_id)
    references public.arroko_households(org_id, id) on delete cascade,
  foreign key (org_id, child_profile_id)
    references public.arroko_child_profiles(org_id, id) on delete set null,
  foreign key (org_id, visit_id)
    references public.arroko_visits(org_id, id) on delete set null,
  foreign key (org_id, game_session_id)
    references public.arroko_game_sessions(org_id, id) on delete set null
);

create table public.arroko_reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  household_id uuid not null,
  child_profile_id uuid,
  visit_id uuid,
  reward_key text not null,
  reward_label text not null,
  points_cost integer not null check (points_cost > 0),
  status text not null default 'requested' check (status in ('requested','approved','fulfilled','cancelled')),
  approved_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  unique (org_id, id),
  foreign key (org_id, household_id)
    references public.arroko_households(org_id, id) on delete restrict,
  foreign key (org_id, child_profile_id)
    references public.arroko_child_profiles(org_id, id) on delete set null,
  foreign key (org_id, visit_id)
    references public.arroko_visits(org_id, id) on delete set null,
  check (fulfilled_at is null or fulfilled_at >= requested_at)
);

create table public.arroko_consent_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null,
  household_id uuid,
  scope text not null check (scope in ('service','loyalty','marketing_whatsapp','marketing_email','personalization','child_participation')),
  granted boolean not null,
  policy_version text not null,
  source text not null check (source in ('checkin','staff','web','import','withdrawal')),
  evidence_ref text,
  recorded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  foreign key (org_id, client_id)
    references public.arroko_clients(org_id, id) on delete cascade,
  foreign key (org_id, household_id)
    references public.arroko_households(org_id, id) on delete set null
);

create table public.arroko_knowledge_nodes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  node_type text not null check (node_type in ('client','household','child','visit','order','product','game','reward','campaign','preference','segment')),
  entity_id uuid,
  canonical_key text not null,
  label text,
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, canonical_key)
);

create table public.arroko_knowledge_edges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  subject_node_id uuid not null,
  predicate text not null check (predicate ~ '^[a-z][a-z0-9_]{1,63}$'),
  object_node_id uuid,
  value jsonb,
  assertion_kind text not null default 'fact' check (assertion_kind in ('fact','inference')),
  confidence numeric(4,3) not null default 1 check (confidence between 0 and 1),
  provenance_type text not null check (provenance_type in ('checkin','softrestaurant','game','staff','campaign','model','derived')),
  provenance_ref text not null,
  consent_scope text,
  observed_at timestamptz not null default now(),
  valid_until timestamptz,
  superseded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (org_id, subject_node_id)
    references public.arroko_knowledge_nodes(org_id, id) on delete cascade,
  foreign key (org_id, object_node_id)
    references public.arroko_knowledge_nodes(org_id, id) on delete cascade,
  check ((object_node_id is not null) <> (value is not null)),
  check (valid_until is null or valid_until >= observed_at)
);

-- Foreign-key and timeline indexes used by CRM and reporting queries.
create index arroko_households_primary_client_idx on public.arroko_households (org_id, primary_client_id);
create unique index arroko_clients_contact_ref_uidx on public.arroko_clients (org_id, contact_ref) where contact_ref is not null;
create index arroko_household_members_client_idx on public.arroko_household_members (org_id, client_id);
create index arroko_child_profiles_household_idx on public.arroko_child_profiles (org_id, household_id) where active;
create index arroko_checkin_points_location_idx on public.arroko_checkin_points (org_id, location_id) where active;
create index arroko_visits_client_time_idx on public.arroko_visits (org_id, client_id, checked_in_at desc);
create index arroko_visits_location_open_idx on public.arroko_visits (org_id, location_id, checked_in_at desc) where status = 'open';
create index arroko_visits_household_idx on public.arroko_visits (org_id, household_id, checked_in_at desc);
create index arroko_visit_orders_visit_idx on public.arroko_visit_orders (org_id, visit_id);
create index arroko_game_sessions_child_time_idx on public.arroko_game_sessions (org_id, child_profile_id, completed_at desc);
create index arroko_game_sessions_visit_idx on public.arroko_game_sessions (org_id, visit_id);
create index arroko_reward_ledger_household_idx on public.arroko_reward_ledger (org_id, household_id, created_at desc);
create index arroko_reward_ledger_child_idx on public.arroko_reward_ledger (org_id, child_profile_id, created_at desc);
create index arroko_reward_redemptions_status_idx on public.arroko_reward_redemptions (org_id, status, requested_at desc);
create index arroko_consent_events_client_idx on public.arroko_consent_events (org_id, client_id, scope, recorded_at desc);
create index arroko_knowledge_nodes_entity_idx on public.arroko_knowledge_nodes (org_id, node_type, entity_id);
create index arroko_knowledge_edges_subject_idx on public.arroko_knowledge_edges (org_id, subject_node_id, observed_at desc) where superseded_at is null;
create index arroko_knowledge_edges_object_idx on public.arroko_knowledge_edges (org_id, object_node_id) where object_node_id is not null and superseded_at is null;

-- Keep mutable entities timestamped consistently with the existing schema.
create trigger arroko_households_set_updated_at before update on public.arroko_households
  for each row execute function public.arroko_set_updated_at();
create trigger arroko_child_profiles_set_updated_at before update on public.arroko_child_profiles
  for each row execute function public.arroko_set_updated_at();
create trigger arroko_checkin_points_set_updated_at before update on public.arroko_checkin_points
  for each row execute function public.arroko_set_updated_at();
create trigger arroko_visits_set_updated_at before update on public.arroko_visits
  for each row execute function public.arroko_set_updated_at();
create trigger arroko_game_definitions_set_updated_at before update on public.arroko_game_definitions
  for each row execute function public.arroko_set_updated_at();
create trigger arroko_knowledge_nodes_set_updated_at before update on public.arroko_knowledge_nodes
  for each row execute function public.arroko_set_updated_at();

-- One row per adult client, with visit ticket and family engagement kept separate.
create view public.arroko_customer_360
with (security_invoker = true)
as
select
  c.org_id,
  c.id as client_id,
  c.display_name,
  c.phone_last4,
  c.marketing_consent,
  c.first_seen_at,
  coalesce(v.last_visit_at, c.last_seen_at) as last_visit_at,
  coalesce(v.visit_count, 0) as visit_count,
  coalesce(o.total_spend, 0)::numeric(14,2) as total_spend,
  coalesce(o.average_ticket, 0)::numeric(14,2) as average_ticket,
  coalesce(g.game_sessions, 0) as family_game_sessions,
  coalesce(g.points_balance, 0) as family_points_balance
from public.arroko_clients c
left join lateral (
  select count(*)::integer as visit_count, max(checked_in_at) as last_visit_at
  from public.arroko_visits v0
  where v0.org_id = c.org_id and v0.client_id = c.id and v0.status <> 'cancelled'
) v on true
left join lateral (
  select sum(ord.total) as total_spend, avg(ord.total) as average_ticket
  from public.arroko_visits v1
  join public.arroko_visit_orders vo on vo.org_id = v1.org_id and vo.visit_id = v1.id
  join public.arroko_orders ord on ord.org_id = vo.org_id and ord.id = vo.order_id
  where v1.org_id = c.org_id and v1.client_id = c.id and ord.status not in ('cancelled','voided')
) o on true
left join lateral (
  select
    (select count(*)::integer from public.arroko_game_sessions gs
      join public.arroko_visits gv on gv.org_id = gs.org_id and gv.id = gs.visit_id
      where gv.org_id = c.org_id and gv.client_id = c.id and gs.status = 'completed') as game_sessions,
    (select coalesce(sum(rl.points_delta),0)::integer from public.arroko_reward_ledger rl
      join public.arroko_households h on h.org_id = rl.org_id and h.id = rl.household_id
      where h.org_id = c.org_id and h.primary_client_id = c.id) as points_balance
) g on true;

alter table public.arroko_households enable row level security;
alter table public.arroko_household_members enable row level security;
alter table public.arroko_child_profiles enable row level security;
alter table public.arroko_checkin_points enable row level security;
alter table public.arroko_visits enable row level security;
alter table public.arroko_visit_orders enable row level security;
alter table public.arroko_game_definitions enable row level security;
alter table public.arroko_game_sessions enable row level security;
alter table public.arroko_reward_ledger enable row level security;
alter table public.arroko_reward_redemptions enable row level security;
alter table public.arroko_consent_events enable row level security;
alter table public.arroko_knowledge_nodes enable row level security;
alter table public.arroko_knowledge_edges enable row level security;

create policy "Arroko CRM roles read households" on public.arroko_households for select to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko CRM roles read household members" on public.arroko_household_members for select to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko CRM roles read child aliases" on public.arroko_child_profiles for select to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko members read checkin points" on public.arroko_checkin_points for select to authenticated
  using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko CRM roles read visits" on public.arroko_visits for select to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko CRM roles read visit orders" on public.arroko_visit_orders for select to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko members read games" on public.arroko_game_definitions for select to authenticated
  using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko CRM roles read game sessions" on public.arroko_game_sessions for select to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko CRM roles read rewards" on public.arroko_reward_ledger for select to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko CRM roles read redemptions" on public.arroko_reward_redemptions for select to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko admins read consents" on public.arroko_consent_events for select to authenticated
  using (public.arroko_has_org_role(org_id, array['admin','owner']));
create policy "Arroko CRM roles read knowledge nodes" on public.arroko_knowledge_nodes for select to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko CRM roles read knowledge edges" on public.arroko_knowledge_edges for select to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));

-- Human changes are restricted; public NFC/QR traffic is accepted only by the Edge Function using service_role.
create policy "Arroko admins manage checkin points" on public.arroko_checkin_points for all to authenticated
  using (public.arroko_has_org_role(org_id, array['admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['admin','owner']));
create policy "Arroko admins manage games" on public.arroko_game_definitions for all to authenticated
  using (public.arroko_has_org_role(org_id, array['admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['admin','owner']));
create policy "Arroko staff update visits" on public.arroko_visits for update to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko staff manage redemptions" on public.arroko_reward_redemptions for all to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));

-- Atomic write boundary used by the public check-in Edge Function. The raw phone never enters SQL.
create or replace function public.arroko_public_checkin(
  p_checkin_slug text,
  p_contact_ref text,
  p_phone_last4 text,
  p_display_name text,
  p_access_token_hash text,
  p_marketing_consent boolean,
  p_child_participation_consent boolean,
  p_policy_version text,
  p_party_size integer default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_point public.arroko_checkin_points%rowtype;
  v_client public.arroko_clients%rowtype;
  v_household public.arroko_households%rowtype;
  v_visit public.arroko_visits%rowtype;
  v_client_node_id uuid;
  v_visit_node_id uuid;
begin
  if p_contact_ref is null or char_length(p_contact_ref) < 32 then
    raise exception 'invalid_contact_ref';
  end if;
  if p_phone_last4 !~ '^[0-9]{4}$' or p_access_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_public_identifier';
  end if;
  if p_party_size is not null and (p_party_size < 1 or p_party_size > 40) then
    raise exception 'invalid_party_size';
  end if;

  select * into v_point
  from public.arroko_checkin_points
  where slug = p_checkin_slug and active
  limit 1;
  if not found then raise exception 'checkin_point_not_found'; end if;

  insert into public.arroko_clients (
    org_id, display_name, phone_last4, contact_ref, marketing_consent,
    consent_source, consent_recorded_at, first_seen_at, last_seen_at, visit_count
  ) values (
    v_point.org_id, nullif(btrim(p_display_name), ''), p_phone_last4, p_contact_ref,
    p_marketing_consent, 'checkin', case when p_marketing_consent then now() else null end,
    now(), now(), 1
  )
  on conflict (org_id, contact_ref) where contact_ref is not null do update set
    display_name = coalesce(excluded.display_name, public.arroko_clients.display_name),
    phone_last4 = excluded.phone_last4,
    marketing_consent = excluded.marketing_consent,
    consent_source = 'checkin',
    consent_recorded_at = case when excluded.marketing_consent then now() else public.arroko_clients.consent_recorded_at end,
    last_seen_at = now(),
    visit_count = public.arroko_clients.visit_count + 1
  returning * into v_client;

  select * into v_household
  from public.arroko_households
  where org_id = v_point.org_id and primary_client_id = v_client.id
  order by created_at asc limit 1;
  if not found then
    insert into public.arroko_households (org_id, primary_client_id, display_label)
    values (v_point.org_id, v_client.id, coalesce(v_client.display_name, 'Familia Arroko'))
    returning * into v_household;
    insert into public.arroko_household_members (org_id, household_id, client_id)
    values (v_point.org_id, v_household.id, v_client.id);
  end if;

  insert into public.arroko_visits (
    org_id, location_id, client_id, household_id, checkin_point_id,
    access_token_hash, source, party_size, metadata
  ) values (
    v_point.org_id, v_point.location_id, v_client.id, v_household.id, v_point.id,
    p_access_token_hash, v_point.channel, p_party_size, coalesce(p_metadata, '{}'::jsonb)
  ) returning * into v_visit;

  insert into public.arroko_consent_events
    (org_id, client_id, household_id, scope, granted, policy_version, source, evidence_ref)
  values
    (v_point.org_id, v_client.id, v_household.id, 'service', true, p_policy_version, 'checkin', v_visit.id::text),
    (v_point.org_id, v_client.id, v_household.id, 'marketing_whatsapp', p_marketing_consent, p_policy_version, 'checkin', v_visit.id::text),
    (v_point.org_id, v_client.id, v_household.id, 'child_participation', p_child_participation_consent, p_policy_version, 'checkin', v_visit.id::text);

  insert into public.arroko_knowledge_nodes (org_id, node_type, entity_id, canonical_key, label)
  values (v_point.org_id, 'client', v_client.id, 'client:' || v_client.id, v_client.display_name)
  on conflict (org_id, canonical_key) do update set label = coalesce(excluded.label, public.arroko_knowledge_nodes.label)
  returning id into v_client_node_id;
  insert into public.arroko_knowledge_nodes (org_id, node_type, entity_id, canonical_key, label)
  values (v_point.org_id, 'visit', v_visit.id, 'visit:' || v_visit.id, 'Visita ' || to_char(v_visit.checked_in_at, 'YYYY-MM-DD HH24:MI'))
  returning id into v_visit_node_id;
  insert into public.arroko_knowledge_edges (
    org_id, subject_node_id, predicate, object_node_id, assertion_kind,
    provenance_type, provenance_ref, consent_scope, observed_at
  ) values (
    v_point.org_id, v_client_node_id, 'checked_in', v_visit_node_id, 'fact',
    'checkin', v_visit.id::text, 'service', v_visit.checked_in_at
  );

  return jsonb_build_object(
    'visit_id', v_visit.id,
    'client_id', v_client.id,
    'household_id', v_household.id,
    'checked_in_at', v_visit.checked_in_at
  );
end;
$$;

create or replace function public.arroko_public_game_complete(
  p_access_token_hash text,
  p_game_key text,
  p_child_alias text,
  p_age_band text,
  p_idempotency_key text,
  p_score integer,
  p_duration_seconds integer default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visit public.arroko_visits%rowtype;
  v_child public.arroko_child_profiles%rowtype;
  v_game public.arroko_game_definitions%rowtype;
  v_session public.arroko_game_sessions%rowtype;
  v_consent boolean;
  v_points integer;
  v_balance integer;
  v_child_node_id uuid;
  v_game_node_id uuid;
begin
  select * into v_visit from public.arroko_visits
  where access_token_hash = p_access_token_hash and status = 'open'
    and checked_in_at >= now() - interval '18 hours'
  limit 1;
  if not found then raise exception 'visit_not_found_or_expired'; end if;
  if v_visit.household_id is null then raise exception 'household_required'; end if;

  select granted into v_consent from public.arroko_consent_events
  where org_id = v_visit.org_id and client_id = v_visit.client_id and scope = 'child_participation'
  order by recorded_at desc limit 1;
  if coalesce(v_consent, false) is not true then raise exception 'child_consent_required'; end if;

  select * into v_game from public.arroko_game_definitions
  where org_id = v_visit.org_id and game_key = p_game_key and active
    and (seasonal_from is null or seasonal_from <= current_date)
    and (seasonal_until is null or seasonal_until >= current_date)
  limit 1;
  if not found then raise exception 'game_not_available'; end if;

  insert into public.arroko_child_profiles (org_id, household_id, alias, age_band)
  values (v_visit.org_id, v_visit.household_id, btrim(p_child_alias), p_age_band)
  on conflict (household_id, alias) do update set
    age_band = coalesce(excluded.age_band, public.arroko_child_profiles.age_band), active = true
  returning * into v_child;

  v_points := least(
    coalesce((v_game.points_rule ->> 'max_points')::integer, 250),
    coalesce((v_game.points_rule ->> 'base_points')::integer, 10)
      + floor(greatest(p_score, 0)::numeric / greatest(coalesce((v_game.points_rule ->> 'score_divisor')::integer, 10), 1))::integer
  );

  insert into public.arroko_game_sessions (
    org_id, visit_id, child_profile_id, game_definition_id, idempotency_key,
    status, score, duration_seconds, points_awarded, completed_at, metadata
  ) values (
    v_visit.org_id, v_visit.id, v_child.id, v_game.id, p_idempotency_key,
    'completed', greatest(p_score, 0), p_duration_seconds, v_points, now(), coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (org_id, idempotency_key) do nothing
  returning * into v_session;

  if not found then
    select * into v_session from public.arroko_game_sessions
    where org_id = v_visit.org_id and idempotency_key = p_idempotency_key;
  else
    insert into public.arroko_reward_ledger (
      org_id, household_id, child_profile_id, visit_id, game_session_id,
      points_delta, reason, reference_key
    ) values (
      v_visit.org_id, v_visit.household_id, v_child.id, v_visit.id, v_session.id,
      v_points, 'game_score', 'game-session:' || v_session.id
    );

    insert into public.arroko_knowledge_nodes (org_id, node_type, entity_id, canonical_key, label)
    values (v_visit.org_id, 'child', v_child.id, 'child:' || v_child.id, v_child.alias)
    on conflict (org_id, canonical_key) do update set label = excluded.label
    returning id into v_child_node_id;
    insert into public.arroko_knowledge_nodes (org_id, node_type, entity_id, canonical_key, label)
    values (v_visit.org_id, 'game', v_game.id, 'game:' || v_game.id, v_game.name)
    on conflict (org_id, canonical_key) do update set label = excluded.label
    returning id into v_game_node_id;
    insert into public.arroko_knowledge_edges (
      org_id, subject_node_id, predicate, object_node_id, assertion_kind,
      confidence, provenance_type, provenance_ref, consent_scope, observed_at,
      metadata
    ) values (
      v_visit.org_id, v_child_node_id, 'played_game', v_game_node_id, 'fact',
      1, 'game', v_session.id::text, 'child_participation', v_session.completed_at,
      jsonb_build_object('score', v_session.score, 'points', v_session.points_awarded)
    );
  end if;

  select coalesce(sum(points_delta), 0)::integer into v_balance
  from public.arroko_reward_ledger
  where org_id = v_visit.org_id and household_id = v_visit.household_id;

  return jsonb_build_object(
    'game_session_id', v_session.id,
    'child_profile_id', v_child.id,
    'score', v_session.score,
    'points_awarded', v_session.points_awarded,
    'points_balance', v_balance
  );
end;
$$;

revoke all on function public.arroko_public_checkin(text,text,text,text,text,boolean,boolean,text,integer,jsonb) from public;
revoke all on function public.arroko_public_game_complete(text,text,text,text,text,integer,integer,jsonb) from public;
grant execute on function public.arroko_public_checkin(text,text,text,text,text,boolean,boolean,text,integer,jsonb) to service_role;
grant execute on function public.arroko_public_game_complete(text,text,text,text,text,integer,integer,jsonb) to service_role;

revoke all on table
  public.arroko_households,
  public.arroko_household_members,
  public.arroko_child_profiles,
  public.arroko_checkin_points,
  public.arroko_visits,
  public.arroko_visit_orders,
  public.arroko_game_definitions,
  public.arroko_game_sessions,
  public.arroko_reward_ledger,
  public.arroko_reward_redemptions,
  public.arroko_consent_events,
  public.arroko_knowledge_nodes,
  public.arroko_knowledge_edges
from anon;

grant select on public.arroko_customer_360 to authenticated;

commit;
