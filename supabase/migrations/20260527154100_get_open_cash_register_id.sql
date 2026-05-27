-- Helper RPC to reliably resolve the current open cash register.
-- This avoids front-end "false closed" results when the caller can't directly
-- select from cash_registers due to RLS/policies.

create or replace function public.get_open_cash_register_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select cr.id
  from public.cash_registers cr
  where cr.status = 'open'
  order by cr.opened_at desc
  limit 1;
$$;

