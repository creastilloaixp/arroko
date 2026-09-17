-- Contact-level abuse guard for public NFC/QR check-ins.

begin;

create or replace function public.arroko_enforce_checkin_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source in ('nfc','qr','table','campaign') and (
    select count(*)
    from public.arroko_visits recent
    where recent.org_id = new.org_id
      and recent.client_id = new.client_id
      and recent.checked_in_at >= now() - interval '10 minutes'
      and recent.status <> 'cancelled'
  ) >= 3 then
    raise exception 'checkin_rate_limited';
  end if;
  return new;
end;
$$;

revoke all on function public.arroko_enforce_checkin_rate_limit() from public, anon, authenticated;

create trigger arroko_visits_public_rate_limit
before insert on public.arroko_visits
for each row execute function public.arroko_enforce_checkin_rate_limit();

commit;
