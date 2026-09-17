-- Supabase may materialize API-role EXECUTE grants for functions in public.
-- Make the Arroko function boundary explicit after all functions exist.

begin;

revoke execute on function public.arroko_has_org_role(uuid, text[]) from anon;
revoke execute on function public.arroko_dashboard_summary(uuid, uuid, timestamptz, timestamptz) from anon;
revoke execute on function public.arroko_decide_campaign(uuid, text, text) from anon;

revoke execute on function public.arroko_ingest_event(uuid, text, text, timestamptz, jsonb, text) from anon, authenticated;
grant execute on function public.arroko_ingest_event(uuid, text, text, timestamptz, jsonb, text) to service_role;

revoke execute on function public.arroko_public_checkin(text,text,text,text,text,boolean,boolean,text,integer,jsonb) from anon, authenticated;
revoke execute on function public.arroko_public_game_complete(text,text,text,text,text,integer,integer,jsonb) from anon, authenticated;
grant execute on function public.arroko_public_checkin(text,text,text,text,text,boolean,boolean,text,integer,jsonb) to service_role;
grant execute on function public.arroko_public_game_complete(text,text,text,text,text,integer,integer,jsonb) to service_role;

commit;
