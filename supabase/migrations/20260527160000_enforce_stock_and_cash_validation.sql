-- Bloqueia venda sem estoque, exige caixa aberto e valida total dos pagamentos.

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
  v_payments_total numeric(12,2) := 0;
  v_item jsonb;
  v_agg record;
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

  if _cash_register_id is null then
    raise exception 'caixa obrigatório';
  end if;

  if not exists (
    select 1
    from public.cash_registers cr
    where cr.id = _cash_register_id
      and cr.status = 'open'
  ) then
    raise exception 'caixa fechado. abra o caixa antes de vender';
  end if;

  -- Valida produtos, agrega quantidades e reserva estoque com lock.
  for v_agg in
    select
      (elem->>'product_id')::uuid as product_id,
      sum(greatest(0, (elem->>'quantity')::int))::int as qty,
      sum((elem->>'unit_price')::numeric * greatest(0, (elem->>'quantity')::int)) as line_total
    from jsonb_array_elements(_items) elem
    group by 1
  loop
    if v_agg.qty <= 0 then
      raise exception 'quantidade inválida';
    end if;

    select *
      into v_product
    from public.products
    where id = v_agg.product_id
    for update;

    if not found then
      raise exception 'produto não encontrado: %', v_agg.product_id;
    end if;

    if coalesce(v_product.stock, 0) < v_agg.qty then
      raise exception 'estoque insuficiente para "%": disponível %, solicitado %',
        v_product.name,
        coalesce(v_product.stock, 0),
        v_agg.qty;
    end if;

    v_subtotal := v_subtotal + coalesce(v_agg.line_total, 0);
  end loop;

  v_total := greatest(0, v_subtotal - coalesce(_discount, 0));

  for v_payment in select * from jsonb_array_elements(_payments)
  loop
    v_amount := (v_payment->>'amount')::numeric;
    if v_amount is null or v_amount <= 0 then
      continue;
    end if;
    v_payments_total := v_payments_total + v_amount;
  end loop;

  if v_payments_total <= 0 then
    raise exception 'pagamentos obrigatório';
  end if;

  if abs(v_payments_total - v_total) > 0.01 then
    raise exception 'pagamentos (R$ %) não conferem com o total da venda (R$ %)',
      round(v_payments_total, 2),
      round(v_total, 2);
  end if;

  insert into public.sales (client_id, subtotal, discount, total, date, status, cash_register_id)
  values (_client_id, v_subtotal, coalesce(_discount, 0), v_total, now(), 'completed', _cash_register_id)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::int;
    v_unit_price := (v_item->>'unit_price')::numeric;

    if v_qty <= 0 then
      continue;
    end if;

    select *
      into v_product
    from public.products
    where id = v_product_id
    for update;

    v_prev_stock := coalesce(v_product.stock, 0);
    v_new_stock := v_prev_stock - v_qty;

    if v_new_stock < 0 then
      raise exception 'estoque insuficiente para "%"', v_product.name;
    end if;

    update public.products
      set stock = v_new_stock,
          updated_at = now()
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
  v_payments_total numeric(12,2) := 0;
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

  for v_payment in select * from jsonb_array_elements(_payments)
  loop
    v_amount := (v_payment->>'amount')::numeric;
    if v_amount is null or v_amount <= 0 then
      continue;
    end if;
    v_payments_total := v_payments_total + v_amount;
  end loop;

  if v_payments_total <= 0 then
    raise exception 'pagamentos obrigatório';
  end if;

  if abs(v_payments_total - v_total) > 0.01 then
    raise exception 'pagamentos (R$ %) não conferem com o total da venda (R$ %)',
      round(v_payments_total, 2),
      round(v_total, 2);
  end if;

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
