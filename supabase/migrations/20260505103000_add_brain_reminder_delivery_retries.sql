alter table public.brain_reminders
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists next_attempt_at timestamptz;

create index if not exists brain_reminders_status_next_attempt_remind_at_idx
  on public.brain_reminders (status, next_attempt_at, remind_at);
