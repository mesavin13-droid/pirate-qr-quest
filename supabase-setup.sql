-- Pirate QR Quest: initial schema for shared quest content.
-- Review and run in Supabase SQL Editor only when ready to enable cloud sync.
-- Do not store service_role keys in frontend code.

create extension if not exists pgcrypto;

create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Охота за сокровищами!',
  owner_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.quest_stages (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests(id) on delete cascade,
  stage_number integer not null check (stage_number between 1 and 7),
  title text not null,
  emoji text not null default '🗺️',
  intro text not null default '',
  task text not null default '',
  hint text not null default '',
  photo_path text,
  updated_at timestamptz not null default now(),
  unique (quest_id, stage_number)
);

alter table public.quests enable row level security;
alter table public.quest_stages enable row level security;

-- Owner-only access until public QR access is implemented deliberately.
create policy "owners can read their quests"
on public.quests for select
using (auth.uid() = owner_id);

create policy "owners can create quests"
on public.quests for insert
with check (auth.uid() = owner_id);

create policy "owners can update their quests"
on public.quests for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "owners can delete their quests"
on public.quests for delete
using (auth.uid() = owner_id);

create policy "owners can read stages"
on public.quest_stages for select
using (exists (
  select 1 from public.quests q
  where q.id = quest_id and q.owner_id = auth.uid()
));

create policy "owners can create stages"
on public.quest_stages for insert
with check (exists (
  select 1 from public.quests q
  where q.id = quest_id and q.owner_id = auth.uid()
));

create policy "owners can update stages"
on public.quest_stages for update
using (exists (
  select 1 from public.quests q
  where q.id = quest_id and q.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.quests q
  where q.id = quest_id and q.owner_id = auth.uid()
));

create policy "owners can delete stages"
on public.quest_stages for delete
using (exists (
  select 1 from public.quests q
  where q.id = quest_id and q.owner_id = auth.uid()
));

-- Create a private Storage bucket named quest-photos in Supabase Storage.
-- Add owner-scoped Storage policies before enabling uploads.
-- Public QR viewing requires a deliberate read-only sharing model (e.g. share tokens);
-- do not make the entire bucket or all quests publicly writable.
