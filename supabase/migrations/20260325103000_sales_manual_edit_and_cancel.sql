create or replace function public.update_sale_manual(
  _sale_id uuid,
  _discount numeric,
  _payments jsonb,
  _total numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale record;
  v_subtotal numeric(12,2);
  v_total numeric(12,2);
  v_payment jsonb;
  v_method public.payment_method;
  v_amount numeric(12,2);
begin
  if _sale_id is null then
    raise exception 'sale_id obrigatório';
  end if;

  if _payments is null or jsonb_typeof(_payments) <> 'array' then
    raise exception 'payments inválido';
  end if;

  select *
    into v_sale
  from public.sales
  where id = _sale_id
  for update;

  if not found then
    raise exception 'venda não encontrada';
  end if;

  if v_sale.status <> 'completed' then
    raise exception 'somente vendas concluídas podem ser editadas';
  end if;

  select coalesce(sum(total), 0)
    into v_subtotal
  from public.sale_items
  where sale_id = _sale_id;

  v_total := coalesce(_total, greatest(0, v_subtotal - coalesce(_discount, 0)));

  update public.sales
  set
    subtotal = v_subtotal,
    discount = coalesce(_discount, 0),
    total = v_total
  where id = _sale_id;

  delete from public.cash_movements
  where sale_id = _sale_id
    and type = 'sale';

  for v_payment in select * from jsonb_array_elements(_payments)
  loop
    v_method := (v_payment->>'method')::public.payment_method;
    v_amount := (v_payment->>'amount')::numeric;

    if v_amount is null or v_amount <= 0 then
      continue;
    end if;

    insert into public.cash_movements (cash_register_id, type, amount, reason, date, sale_id, created_by, payment_method)
    values (
      v_sale.cash_register_id,
      'sale',
      v_amount,
      concat('Ajuste venda ', _sale_id),
      now(),
      _sale_id,
      auth.uid(),
      v_method
    );
  end loop;
end;
$$;

create or replace function public.cancel_sale_manual(
  _sale_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale record;
  v_item record;
  v_product record;
  v_prev_stock int;
  v_new_stock int;
begin
  if _sale_id is null then
    raise exception 'sale_id obrigatório';
  end if;

  select *
    into v_sale
  from public.sales
  where id = _sale_id
  for update;

  if not found then
    raise exception 'venda não encontrada';
  end if;

  if v_sale.status <> 'completed' then
    raise exception 'venda já cancelada';
  end if;

  for v_item in
    select product_id, quantity
    from public.sale_items
    where sale_id = _sale_id
  loop
    select *
      into v_product
    from public.products
    where id = v_item.product_id
    for update;

    v_prev_stock := coalesce(v_product.stock, 0);
    v_new_stock := v_prev_stock + coalesce(v_item.quantity, 0);

    update public.products
    set stock = v_new_stock
    where id = v_item.product_id;

    insert into public.stock_movements (product_id, type, quantity, reason, previous_stock, new_stock, created_by)
    values (
      v_item.product_id,
      'entrada',
      coalesce(v_item.quantity, 0),
      concat('Cancelamento venda ', _sale_id),
      v_prev_stock,
      v_new_stock,
      auth.uid()
    );
  end loop;

  delete from public.cash_movements
  where sale_id = _sale_id
    and type = 'sale';

  update public.sales
  set status = 'cancelled'
  where id = _sale_id;
end;
$$;
