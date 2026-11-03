-- Purpose: RLS-respecting sales reports, 30-day demand, and atomic PO receipt.
-- Run order: schema.sql, functional/bundle migrations, static_frontend.sql,
-- then this file. Optional demo history belongs in seed_demo_sales.sql last.
-- Bundle sales revenue and profit stay attributed to the sold bundle row in
-- sale_items; reporting_product_demand_daily and the 30-day view additionally
-- allocate bundle quantity to components for demand and stock forecasting.
-- Average daily demand divides by the available calendar span in the 30-day
-- window, while history_days reports the dates that actually had transactions.

create index if not exists sales_created_at_idx
  on public.sales (created_at);

create index if not exists sale_items_sale_id_idx
  on public.sale_items (sale_id);

create index if not exists sale_items_product_id_idx
  on public.sale_items (product_id);

create or replace view public.reporting_daily_sales
with (security_invoker = true)
as
with item_totals as (
  select
    sale_items.sale_id,
    sum(sale_items.line_total - sale_items.unit_cost * sale_items.qty) as profit,
    sum(sale_items.qty) as units_sold
  from public.sale_items
  group by sale_items.sale_id
)
select
  sales.outlet_id,
  (sales.created_at at time zone 'Asia/Jakarta')::date as sale_date,
  sum(sales.subtotal) as revenue,
  sum(coalesce(item_totals.profit, 0)) as profit,
  count(*)::bigint as transaction_count,
  sum(coalesce(item_totals.units_sold, 0)) as units_sold
from public.sales
left join item_totals on item_totals.sale_id = sales.id
group by sales.outlet_id, (sales.created_at at time zone 'Asia/Jakarta')::date;

create or replace view public.reporting_top_products_daily
with (security_invoker = true)
as
select
  sales.outlet_id,
  (sales.created_at at time zone 'Asia/Jakarta')::date as sale_date,
  sale_items.product_id,
  sale_items.product_name,
  sum(sale_items.qty) as qty_sold,
  sum(sale_items.line_total) as revenue,
  sum(sale_items.line_total - sale_items.unit_cost * sale_items.qty) as profit
from public.sales
join public.sale_items on sale_items.sale_id = sales.id
group by
  sales.outlet_id,
  (sales.created_at at time zone 'Asia/Jakarta')::date,
  sale_items.product_id,
  sale_items.product_name;

create or replace view public.reporting_product_demand_daily
with (security_invoker = true)
as
with demand as (
  select
    sales.outlet_id,
    (sales.created_at at time zone 'Asia/Jakarta')::date as sale_date,
    sale_items.product_id,
    sale_items.qty
  from public.sales
  join public.sale_items on sale_items.sale_id = sales.id
  union all
  select
    sales.outlet_id,
    (sales.created_at at time zone 'Asia/Jakarta')::date as sale_date,
    bundle_items.component_product_id as product_id,
    sale_items.qty * bundle_items.quantity as qty
  from public.sales
  join public.sale_items on sale_items.sale_id = sales.id
  join public.products as bundle_product
    on bundle_product.id = sale_items.product_id
   and bundle_product.is_bundle
  join public.bundle_items
    on bundle_items.bundle_product_id = bundle_product.id
)
select
  demand.outlet_id,
  demand.sale_date,
  demand.product_id,
  sum(demand.qty) as qty_sold
from demand
group by demand.outlet_id, demand.sale_date, demand.product_id;

create or replace view public.reporting_payment_method_daily
with (security_invoker = true)
as
select
  sales.outlet_id,
  (sales.created_at at time zone 'Asia/Jakarta')::date as sale_date,
  sales.payment_method,
  count(*)::bigint as transaction_count,
  sum(sales.subtotal) as revenue
from public.sales
group by
  sales.outlet_id,
  (sales.created_at at time zone 'Asia/Jakarta')::date,
  sales.payment_method;

create or replace view public.reporting_category_daily
with (security_invoker = true)
as
select
  sales.outlet_id,
  (sales.created_at at time zone 'Asia/Jakarta')::date as sale_date,
  coalesce(nullif(products.category, ''), 'Tanpa kategori') as category,
  sum(sale_items.qty) as qty_sold,
  sum(sale_items.line_total) as revenue,
  sum(sale_items.line_total - sale_items.unit_cost * sale_items.qty) as profit
from public.sales
join public.sale_items on sale_items.sale_id = sales.id
left join public.products on public.products.id = sale_items.product_id
group by
  sales.outlet_id,
  (sales.created_at at time zone 'Asia/Jakarta')::date,
  coalesce(nullif(products.category, ''), 'Tanpa kategori');

create or replace view public.reporting_product_demand_30d
with (security_invoker = true)
as
with history as (
  select
    sales.outlet_id,
    count(distinct (sales.created_at at time zone 'Asia/Jakarta')::date)::integer as history_days,
    greatest(
      1,
      (now() at time zone 'Asia/Jakarta')::date
        - min((sales.created_at at time zone 'Asia/Jakarta')::date)
        + 1
    )::integer as observation_days
  from public.sales
  where (sales.created_at at time zone 'Asia/Jakarta')::date
    >= (now() at time zone 'Asia/Jakarta')::date - 29
  group by sales.outlet_id
),
direct_demand as (
  select
    sales.outlet_id,
    sale_items.product_id,
    sum(sale_items.qty) as qty
  from public.sales
  join public.sale_items on sale_items.sale_id = sales.id
  where (sales.created_at at time zone 'Asia/Jakarta')::date
    >= (now() at time zone 'Asia/Jakarta')::date - 29
  group by sales.outlet_id, sale_items.product_id
),
component_demand as (
  select
    sales.outlet_id,
    bundle_items.component_product_id as product_id,
    sum(sale_items.qty * bundle_items.quantity) as qty
  from public.sales
  join public.sale_items on sale_items.sale_id = sales.id
  join public.products as bundle_product
    on bundle_product.id = sale_items.product_id
   and bundle_product.is_bundle
  join public.bundle_items
    on bundle_items.bundle_product_id = bundle_product.id
  where (sales.created_at at time zone 'Asia/Jakarta')::date
    >= (now() at time zone 'Asia/Jakarta')::date - 29
  group by sales.outlet_id, bundle_items.component_product_id
),
all_demand as (
  select outlet_id, product_id, sum(qty) as qty
  from (
    select * from direct_demand
    union all
    select * from component_demand
  ) demand
  group by outlet_id, product_id
)
select
  products.outlet_id,
  products.id as product_id,
  case
    when history.observation_days > 0
      then coalesce(all_demand.qty, 0) / history.observation_days
    else 0
  end as average_daily_sales,
  coalesce(history.history_days, 0) as history_days
from public.products
left join all_demand
  on all_demand.product_id = products.id
 and all_demand.outlet_id = products.outlet_id
left join history on history.outlet_id = products.outlet_id;

create or replace view public.reporting_tax_rate
with (security_invoker = true)
as
select
  sales.outlet_id,
  coalesce(sum(sales.tax) / nullif(sum(sales.subtotal), 0), 0) as tax_rate
from public.sales
group by sales.outlet_id;

create or replace function public.get_outlet_tax_rate(p_outlet_id bigint)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  outlet_rate numeric;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles
    where id = auth.uid() and role in ('admin', 'kasir')
  ) then
    raise exception 'An approved POS account is required to read the tax rate';
  end if;

  select coalesce(sum(sales.tax) / nullif(sum(sales.subtotal), 0), 0)
  into outlet_rate
  from public.sales
  where sales.outlet_id = p_outlet_id;

  return outlet_rate;
end;
$$;

grant select on
  public.reporting_daily_sales,
  public.reporting_top_products_daily,
  public.reporting_product_demand_daily,
  public.reporting_payment_method_daily,
  public.reporting_category_daily,
  public.reporting_product_demand_30d,
  public.reporting_tax_rate
to authenticated;

create or replace function public.receive_purchase_order(p_order_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  order_row public.purchase_orders%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'An approved admin account is required to receive orders';
  end if;

  select *
  into order_row
  from public.purchase_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Purchase order was not found';
  end if;
  if order_row.status = 'Received' then
    raise exception 'Purchase order has already been received';
  end if;
  if order_row.status <> 'Ordered' then
    raise exception 'Purchase order must be ordered before receipt';
  end if;
  if order_row.product_id is null or order_row.qty <= 0 then
    raise exception 'Purchase order must reference a product and positive quantity';
  end if;

  update public.products
  set stock = stock + order_row.qty,
      updated_at = now()
  where id = order_row.product_id
    and outlet_id = order_row.outlet_id;

  if not found then
    raise exception 'Purchase order product does not belong to its outlet';
  end if;

  update public.purchase_orders
  set status = 'Received',
      updated_at = now()
  where id = order_row.id
  returning * into order_row;

  return to_jsonb(order_row);
end;
$$;

revoke all on function public.receive_purchase_order(bigint) from public, anon;
grant execute on function public.receive_purchase_order(bigint) to authenticated;
revoke all on function public.get_outlet_tax_rate(bigint) from public, anon;
grant execute on function public.get_outlet_tax_rate(bigint) to authenticated;
