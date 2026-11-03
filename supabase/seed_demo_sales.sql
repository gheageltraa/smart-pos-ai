-- OPTIONAL DEMO DATA ONLY. Run after static_frontend.sql and reporting.sql,
-- only when you want demo history and real sales cover fewer than 30 distinct
-- Jakarta dates. DEMO-prefixed rows are excluded from stock-decrement triggers.
-- Safe to re-run: a missing date receives one stable DEMO transaction per
-- outlet. This does not update or delete existing transactions or inventory.
--
-- To remove only these demo sales later, run:
-- delete from public.sales where transaction_number like 'DEMO-%';
-- sale_items are removed by the sales foreign-key cascade.

do $$
declare
  outlet_row record;
  first_product record;
  second_product record;
  day_value date;
  product_count integer;
  product_offset integer;
  qty_one numeric;
  qty_two numeric;
  subtotal_value numeric;
  tax_value numeric;
  tax_rate numeric;
  sale_id_value bigint;
  transaction_code text;
begin
  for outlet_row in
    select id
    from public.outlets
    where active
    order by id
  loop
    select count(*)::integer
    into product_count
    from public.products
    where outlet_id = outlet_row.id
      and not is_bundle;

    if product_count = 0 then
      continue;
    end if;

    select coalesce(sum(tax) / nullif(sum(subtotal), 0), 0)
    into tax_rate
    from public.sales
    where outlet_id = outlet_row.id;

    for day_value in
      select (now() at time zone 'Asia/Jakarta')::date - days.offset_value
      from generate_series(29, 0, -1) as days(offset_value)
    loop
      if exists (
        select 1
        from public.sales
        where outlet_id = outlet_row.id
          and (created_at at time zone 'Asia/Jakarta')::date = day_value
      ) then
        continue;
      end if;

      product_offset :=
        mod((extract(doy from day_value)::integer + outlet_row.id::integer), product_count);

      select id, name, price, cost
      into first_product
      from public.products
      where outlet_id = outlet_row.id
        and not is_bundle
      order by id
      offset product_offset
      limit 1;

      qty_one := 1 + mod(extract(doy from day_value)::integer, 3);
      qty_two := 0;
      subtotal_value := first_product.price * qty_one;
      if product_count > 1 then
        select id, name, price, cost
        into second_product
        from public.products
        where outlet_id = outlet_row.id
          and not is_bundle
          and id <> first_product.id
        order by id
        offset mod(product_offset, product_count - 1)
        limit 1;
        qty_two := 1 + mod(extract(doy from day_value)::integer + 1, 2);
        subtotal_value := subtotal_value + second_product.price * qty_two;
      end if;
      tax_value := round(subtotal_value * tax_rate);
      transaction_code :=
        'DEMO-' || outlet_row.id || '-' || to_char(day_value, 'YYYYMMDD');

      insert into public.sales (
        transaction_number,
        outlet_id,
        payment_method,
        subtotal,
        tax,
        total,
        created_at
      )
      values (
        transaction_code,
        outlet_row.id,
        case mod(extract(doy from day_value)::integer, 3)
          when 0 then 'Tunai'
          when 1 then 'QRIS'
          else 'Debit'
        end,
        subtotal_value,
        tax_value,
        subtotal_value + tax_value,
        (day_value::timestamp at time zone 'Asia/Jakarta') + interval '13 hours'
      )
      on conflict (transaction_number) do nothing
      returning id into sale_id_value;

      if sale_id_value is null then
        continue;
      end if;

      insert into public.sale_items (
        sale_id,
        product_id,
        product_name,
        qty,
        unit_price,
        unit_cost,
        line_total
      )
      values (
        sale_id_value,
        first_product.id,
        first_product.name,
        qty_one,
        first_product.price,
        first_product.cost,
        first_product.price * qty_one
      );

      if product_count > 1 then
        insert into public.sale_items (
          sale_id,
          product_id,
          product_name,
          qty,
          unit_price,
          unit_cost,
          line_total
        )
        values (
          sale_id_value,
          second_product.id,
          second_product.name,
          qty_two,
          second_product.price,
          second_product.cost,
          second_product.price * qty_two
        );
      end if;
    end loop;
  end loop;
end;
$$;
