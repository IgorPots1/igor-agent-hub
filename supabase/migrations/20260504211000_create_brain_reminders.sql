create table if not exists public.brain_reminders (
  id uuid primary key default gen_random_uuid(),
  brain_item_id uuid not null references public.brain_items(id) on delete cascade,
  telegram_chat_id text not null,
  remind_at timestamptz not null,
  status text not null default 'pending',
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brain_reminders_status_remind_at_idx
  on public.brain_reminders (status, remind_at);

create index if not exists brain_reminders_chat_status_remind_at_idx
  on public.brain_reminders (telegram_chat_id, status, remind_at);

create index if not exists brain_reminders_brain_item_id_idx
  on public.brain_reminders (brain_item_id);

create or replace function public.set_brain_reminders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_brain_reminders_updated_at on public.brain_reminders;

create trigger set_brain_reminders_updated_at
before update on public.brain_reminders
for each row
execute function public.set_brain_reminders_updated_at();

grant select, insert, update on table public.brain_reminders to service_role;

alter table public.brain_reminders enable row level security;
