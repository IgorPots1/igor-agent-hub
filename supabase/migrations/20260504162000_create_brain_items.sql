create extension if not exists pgcrypto;

create table if not exists public.brain_items (
  id uuid primary key default gen_random_uuid(),
  raw_text text not null,
  cleaned_text text,
  summary text,
  type text not null default 'note',
  project text,
  topic text,
  tags text[] not null default '{}',
  source text not null default 'telegram',
  telegram_chat_id text,
  telegram_user_id text,
  telegram_username text,
  telegram_message_id text,
  status text not null default 'inbox',
  created_at timestamptz not null default now()
);

create index if not exists brain_items_created_at_desc_idx
  on public.brain_items (created_at desc);

create index if not exists brain_items_source_idx
  on public.brain_items (source);

create index if not exists brain_items_project_idx
  on public.brain_items (project);

create index if not exists brain_items_type_idx
  on public.brain_items (type);

create index if not exists brain_items_status_idx
  on public.brain_items (status);

alter table public.brain_items enable row level security;
