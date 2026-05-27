alter table public.brain_items
  add column if not exists no_export boolean not null default false;

create index if not exists brain_items_export_filter_idx
  on public.brain_items (status, no_export, created_at desc);
