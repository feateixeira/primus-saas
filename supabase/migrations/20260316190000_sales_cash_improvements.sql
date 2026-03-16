-- Improve sales/cash schema for PDV, dashboard and reports
-- - store payment method on cash movements
-- - store cost snapshot on sale items
-- - provide an atomic sale creation function

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'payment_method'
  ) then
    create type public.payment_method as enum ('dinheiro', 'pix', 'debito', 'credito');
  end if;
end $$;

alter table public.cash_movements
  add column if not exists payment_method public.payment_method;

alter table public.sale_items
  add column if not exists cost_price numeric(10,2);

create or replace function public.create_sale(
  _items jsonb,
  _discount numeric,
  _payments jsonb,
  _cash_register_id uuid default null,
  _client_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_subtotal numeric(12,2) := 0;
  v_total numeric(12,2);
  v_item jsonb;
  v_product_id uuid;
  v_qty int;
  v_unit_price numeric(10,2);
  v_product record;
  v_prev_stock int;
  v_new_stock int;
  v_payment jsonb;
  v_method public.payment_method;
  v_amount numeric(12,2);
begin
  if _items is null or jsonb_typeof(_items) <> 'array' or jsonb_array_length(_items) = 0 then
    raise exception 'items obrigatório';
  end if;

  if _payments is null or jsonb_typeof(_payments) <> 'array' or jsonb_array_length(_payments) = 0 then
    raise exception 'payments obrigatório';
  end if;

  -- calculate subtotal and validate products
  for v_item in select * from jsonb_array_elements(_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := greatest(0, (v_item->>'quantity')::int);
    v_unit_price := (v_item->>'unit_price')::numeric;

    if v_qty <= 0 then
      raise exception 'quantidade inválida';
    end if;

    select *
      into v_product
    from public.products
    where id = v_product_id
    for update;

    if not found then
      raise exception 'produto não encontrado: %', v_product_id;
    end if;

    v_subtotal := v_subtotal + (v_unit_price * v_qty);
  end loop;

  v_total := greatest(0, v_subtotal - coalesce(_discount, 0));

  insert into public.sales (client_id, subtotal, discount, total, date, status, cash_register_id)
  values (_client_id, v_subtotal, coalesce(_discount, 0), v_total, now(), 'completed', _cash_register_id)
  returning id into v_sale_id;

  -- insert items, update stock, register stock movement
  for v_item in select * from jsonb_array_elements(_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::int;
    v_unit_price := (v_item->>'unit_price')::numeric;

    select *
      into v_product
    from public.products
    where id = v_product_id
    for update;

    v_prev_stock := coalesce(v_product.stock, 0);
    v_new_stock := greatest(0, v_prev_stock - v_qty);

    update public.products
      set stock = v_new_stock
    where id = v_product_id;

    insert into public.sale_items (sale_id, product_id, name, quantity, unit_price, total, cost_price)
    values (
      v_sale_id,
      v_product_id,
      v_product.name,
      v_qty,
      v_unit_price,
      (v_unit_price * v_qty),
      coalesce(v_product.cost_price, 0)
    );

    insert into public.stock_movements (product_id, type, quantity, reason, previous_stock, new_stock, created_by)
    values (v_product_id, 'saida', v_qty, concat('Venda ', v_sale_id), v_prev_stock, v_new_stock, auth.uid());
  end loop;

  -- register payment breakdown as cash movements
  for v_payment in select * from jsonb_array_elements(_payments)
  loop
    v_method := (v_payment->>'method')::public.payment_method;
    v_amount := (v_payment->>'amount')::numeric;

    if v_amount is null or v_amount <= 0 then
      continue;
    end if;

    insert into public.cash_movements (cash_register_id, type, amount, reason, date, sale_id, created_by, payment_method)
    values (_cash_register_id, 'sale', v_amount, concat('Venda ', v_sale_id), now(), v_sale_id, auth.uid(), v_method);
  end loop;

  return v_sale_id;
end;
$$;

