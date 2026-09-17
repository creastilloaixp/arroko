-- Promotional rewards issued by the Arroko public roulette.
-- Public traffic stays behind a service-role RPC; CRM staff gets an auditable lifecycle.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table public.arroko_reward_definitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  reward_key text not null check (reward_key ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  label text not null check (char_length(btrim(label)) between 1 and 120),
  active boolean not null default true,
  is_winning boolean not null default true,
  expires_after_days smallint not null default 30 check (expires_after_days between 1 and 365),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, reward_key)
);

create table public.arroko_reward_claims (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  visit_id uuid not null,
  client_id uuid not null,
  reward_definition_id uuid not null,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  status text not null default 'claimed' check (status in ('claimed','redeemed','expired','cancelled')),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, idempotency_key),
  unique (visit_id),
  foreign key (org_id, visit_id) references public.arroko_visits(org_id, id) on delete cascade,
  foreign key (org_id, client_id) references public.arroko_clients(org_id, id) on delete restrict,
  foreign key (org_id, reward_definition_id) references public.arroko_reward_definitions(org_id, id) on delete restrict,
  check (redeemed_at is null or redeemed_at <= updated_at)
);

create index arroko_reward_claims_client_time_idx on public.arroko_reward_claims (org_id, client_id, created_at desc);
create index arroko_reward_claims_status_expiry_idx on public.arroko_reward_claims (org_id, status, expires_at);

create trigger arroko_reward_definitions_set_updated_at before update on public.arroko_reward_definitions
  for each row execute function public.arroko_set_updated_at();
create trigger arroko_reward_claims_set_updated_at before update on public.arroko_reward_claims
  for each row execute function public.arroko_set_updated_at();

alter table public.arroko_reward_definitions enable row level security;
alter table public.arroko_reward_claims enable row level security;

create policy "Arroko members read reward definitions" on public.arroko_reward_definitions for select to authenticated
  using (public.arroko_has_org_role(org_id, array['viewer','sales','ops','admin','owner']));
create policy "Arroko admins manage reward definitions" on public.arroko_reward_definitions for all to authenticated
  using (public.arroko_has_org_role(org_id, array['admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['admin','owner']));
create policy "Arroko CRM roles read reward claims" on public.arroko_reward_claims for select to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));
create policy "Arroko staff update reward claims" on public.arroko_reward_claims for update to authenticated
  using (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']))
  with check (public.arroko_has_org_role(org_id, array['sales','ops','admin','owner']));

create or replace function public.arroko_public_reward_claim(
  p_access_token_hash text,
  p_reward_key text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visit public.arroko_visits%rowtype;
  v_reward public.arroko_reward_definitions%rowtype;
  v_claim public.arroko_reward_claims%rowtype;
  v_client_node_id uuid;
  v_reward_node_id uuid;
begin
  select * into v_visit from public.arroko_visits
  where access_token_hash = p_access_token_hash and status = 'open'
    and checked_in_at >= now() - interval '18 hours'
  limit 1;
  if not found then raise exception 'visit_not_found_or_expired'; end if;

  select * into v_reward from public.arroko_reward_definitions
  where org_id = v_visit.org_id and reward_key = p_reward_key and active
  limit 1;
  if not found then raise exception 'reward_not_available'; end if;

  insert into public.arroko_reward_claims (
    org_id, visit_id, client_id, reward_definition_id, idempotency_key, expires_at, metadata
  ) values (
    v_visit.org_id, v_visit.id, v_visit.client_id, v_reward.id, p_idempotency_key,
    now() + make_interval(days => v_reward.expires_after_days), coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (visit_id) do nothing
  returning * into v_claim;

  if not found then
    select * into v_claim from public.arroko_reward_claims where visit_id = v_visit.id;
  else
    insert into public.arroko_knowledge_nodes (org_id, node_type, entity_id, canonical_key, label)
    values (v_visit.org_id, 'client', v_visit.client_id, 'client:' || v_visit.client_id, null)
    on conflict (org_id, canonical_key) do update set updated_at = now()
    returning id into v_client_node_id;

    insert into public.arroko_knowledge_nodes (org_id, node_type, entity_id, canonical_key, label, attributes)
    values (
      v_visit.org_id, 'reward', v_claim.id, 'reward-claim:' || v_claim.id, v_reward.label,
      jsonb_build_object('reward_key', v_reward.reward_key, 'is_winning', v_reward.is_winning)
    )
    returning id into v_reward_node_id;

    insert into public.arroko_knowledge_edges (
      org_id, subject_node_id, predicate, object_node_id, assertion_kind,
      provenance_type, provenance_ref, consent_scope, observed_at
    ) values (
      v_visit.org_id, v_client_node_id, 'claimed_reward', v_reward_node_id, 'fact',
      'campaign', v_claim.id::text, 'loyalty', v_claim.created_at
    );
  end if;

  return jsonb_build_object(
    'claim_id', v_claim.id,
    'reward_key', v_reward.reward_key,
    'reward_label', v_reward.label,
    'is_winning', v_reward.is_winning,
    'status', v_claim.status,
    'expires_at', v_claim.expires_at
  );
end;
$$;

revoke all on table public.arroko_reward_definitions, public.arroko_reward_claims from anon;
grant select on public.arroko_reward_definitions, public.arroko_reward_claims to authenticated;
grant update on public.arroko_reward_claims to authenticated;
grant all on public.arroko_reward_definitions, public.arroko_reward_claims to service_role;
revoke all on function public.arroko_public_reward_claim(text,text,text,jsonb) from public;
grant execute on function public.arroko_public_reward_claim(text,text,text,jsonb) to service_role;

commit;
