alter table public.brain_items
  add column if not exists summary text,
  add column if not exists type text,
  add column if not exists category text,
  add column if not exists tags text[],
  add column if not exists status text,
  add column if not exists source text;

update public.brain_items
set
  type = coalesce(type, 'note'),
  category = coalesce(category, 'Inbox'),
  tags = coalesce(tags, '{}'::text[]),
  status = coalesce(status, 'active'),
  source = coalesce(source, 'telegram')
where
  type is null
  or category is null
  or tags is null
  or status is null
  or source is null;

alter table public.brain_items
  alter column type set default 'note',
  alter column type set not null,
  alter column category set default 'Inbox',
  alter column category set not null,
  alter column tags set default '{}'::text[],
  alter column tags set not null,
  alter column status set default 'active',
  alter column status set not null,
  alter column source set default 'telegram',
  alter column source set not null;
