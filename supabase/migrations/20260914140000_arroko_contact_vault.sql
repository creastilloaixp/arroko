-- Recoverable customer contact data for authorized CRM workflows.
-- Ciphertext is produced by Edge Functions; browser roles never receive table access.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table public.arroko_contact_vault (
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null,
  phone_ref text not null check (char_length(phone_ref) = 64),
  phone_ciphertext text not null check (phone_ciphertext ~ '^v1[.]'),
  instagram_ref text check (instagram_ref is null or char_length(instagram_ref) = 64),
  instagram_ciphertext text check (instagram_ciphertext is null or instagram_ciphertext ~ '^v1[.]'),
  birth_date_ciphertext text check (birth_date_ciphertext is null or birth_date_ciphertext ~ '^v1[.]'),
  birth_month_day text check (birth_month_day is null or birth_month_day ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'),
  key_version smallint not null default 1 check (key_version > 0),
  source text not null default 'checkin' check (source in ('checkin','staff','import','customer_update')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, client_id),
  unique (org_id, phone_ref),
  foreign key (org_id, client_id)
    references public.arroko_clients(org_id, id) on delete cascade
);

comment on table public.arroko_contact_vault is
  'Encrypted adult contact channels. No anon/authenticated table access; use audited server functions.';

create table public.arroko_pii_access_audit (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null,
  actor_user_id uuid not null,
  action text not null check (action in ('view_customer_contact','campaign_dispatch','contact_update')),
  purpose text not null check (char_length(btrim(purpose)) between 3 and 120),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (org_id, client_id)
    references public.arroko_clients(org_id, id) on delete cascade
);

create index arroko_contact_vault_birthdays_idx
  on public.arroko_contact_vault (org_id, birth_month_day)
  where birth_month_day is not null;
create index arroko_pii_access_audit_timeline_idx
  on public.arroko_pii_access_audit (org_id, created_at desc, id desc);

create trigger arroko_contact_vault_updated_at
before update on public.arroko_contact_vault
for each row execute function public.arroko_set_updated_at();

alter table public.arroko_contact_vault enable row level security;
alter table public.arroko_pii_access_audit enable row level security;

revoke all on public.arroko_contact_vault from public, anon, authenticated;
revoke all on public.arroko_pii_access_audit from public, anon, authenticated;
grant all on public.arroko_contact_vault to service_role;
grant all on public.arroko_pii_access_audit to service_role;

create or replace function public.arroko_public_checkin_with_vault(
  p_checkin_slug text,
  p_contact_ref text,
  p_phone_last4 text,
  p_display_name text,
  p_access_token_hash text,
  p_marketing_consent boolean,
  p_child_participation_consent boolean,
  p_policy_version text,
  p_party_size integer,
  p_metadata jsonb,
  p_phone_ciphertext text,
  p_instagram_ref text,
  p_instagram_ciphertext text,
  p_birth_date_ciphertext text,
  p_birth_month_day text,
  p_key_version smallint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_client_id uuid;
  v_org_id uuid;
begin
  if p_phone_ciphertext is null or p_phone_ciphertext !~ '^v1[.]' then
    raise exception 'invalid_contact_ciphertext';
  end if;

  v_result := public.arroko_public_checkin(
    p_checkin_slug,
    p_contact_ref,
    p_phone_last4,
    p_display_name,
    p_access_token_hash,
    p_marketing_consent,
    p_child_participation_consent,
    p_policy_version,
    p_party_size,
    p_metadata
  );

  v_client_id := (v_result ->> 'client_id')::uuid;
  select org_id into strict v_org_id
  from public.arroko_clients
  where id = v_client_id;

  insert into public.arroko_contact_vault (
    org_id, client_id, phone_ref, phone_ciphertext,
    instagram_ref, instagram_ciphertext, birth_date_ciphertext,
    birth_month_day, key_version, source
  ) values (
    v_org_id, v_client_id, p_contact_ref, p_phone_ciphertext,
    p_instagram_ref, p_instagram_ciphertext, p_birth_date_ciphertext,
    p_birth_month_day, p_key_version, 'checkin'
  )
  on conflict (org_id, client_id) do update set
    phone_ref = excluded.phone_ref,
    phone_ciphertext = excluded.phone_ciphertext,
    instagram_ref = coalesce(excluded.instagram_ref, public.arroko_contact_vault.instagram_ref),
    instagram_ciphertext = coalesce(excluded.instagram_ciphertext, public.arroko_contact_vault.instagram_ciphertext),
    birth_date_ciphertext = coalesce(excluded.birth_date_ciphertext, public.arroko_contact_vault.birth_date_ciphertext),
    birth_month_day = coalesce(excluded.birth_month_day, public.arroko_contact_vault.birth_month_day),
    key_version = excluded.key_version,
    source = 'checkin';

  return v_result;
end;
$$;

revoke all on function public.arroko_public_checkin_with_vault(
  text,text,text,text,text,boolean,boolean,text,integer,jsonb,text,text,text,text,text,smallint
) from public, anon, authenticated;
grant execute on function public.arroko_public_checkin_with_vault(
  text,text,text,text,text,boolean,boolean,text,integer,jsonb,text,text,text,text,text,smallint
) to service_role;

commit;
