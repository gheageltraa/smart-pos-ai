-- Kopipintar: dynamic Lucide icon metadata
-- Safe to run multiple times in Supabase SQL Editor.
alter table public.products
  add column if not exists icon_name text;

update public.products
set icon_name = case
  when emoji = '☕' then 'Coffee'
  when emoji = '🍵' then 'CupSoda'
  when emoji in ('🧊', '💧') then 'GlassWater'
  when emoji = '🥐' then 'Croissant'
  when emoji = '🍫' then 'CakeSlice'
  when emoji in ('🍯', '🫗') then 'CupSoda'
  when emoji = '🍮' then 'CakeSlice'
  when emoji = '🥖' then 'Sandwich'
  when emoji = '🍋' then 'Citrus'
  else 'Package'
end
where icon_name is null;
