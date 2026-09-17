-- Atomic, server-side redemption for arroko_reward_claims.
-- Fixes a client-side check-then-update race in RedeemPage/handleRedeem
-- that allowed the same claim to be redeemed twice (PRODUCTION-GATES.md #1).
-- Same-day restriction preserved: a reward can only be redeemed on a later visit.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.arroko_public_reward_redeem(
  p_claim_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.arroko_reward_claims%rowtype;
  v_reward public.arroko_reward_definitions%rowtype;
begin
  update public.arroko_reward_claims
  set status = 'redeemed', redeemed_at = now()
  where id = p_claim_id
    and status = 'claimed'
    and expires_at > now()
    and created_at::date < current_date
  returning * into v_claim;

  if found then
    select * into v_reward from public.arroko_reward_definitions where id = v_claim.reward_definition_id;
    return jsonb_build_object(
      'claim_id', v_claim.id,
      'reward_key', v_reward.reward_key,
      'reward_label', v_reward.label,
      'status', v_claim.status,
      'redeemed_at', v_claim.redeemed_at
    );
  end if;

  select * into v_claim from public.arroko_reward_claims where id = p_claim_id;
  if not found then raise exception 'claim_not_found'; end if;
  if v_claim.status = 'redeemed' then raise exception 'claim_already_redeemed'; end if;
  if v_claim.status <> 'claimed' then raise exception 'claim_not_redeemable'; end if;
  if v_claim.expires_at <= now() then raise exception 'claim_expired'; end if;
  if v_claim.created_at::date = current_date then raise exception 'claim_same_day'; end if;
  raise exception 'claim_not_redeemable';
end;
$$;

revoke all on function public.arroko_public_reward_redeem(uuid) from public;
grant execute on function public.arroko_public_reward_redeem(uuid) to service_role;

commit;
