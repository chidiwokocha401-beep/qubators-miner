-- Qubators Cloud Miner — Database schema (Postgres / Supabase)
-- Run in the Supabase SQL editor or via migration tool.

-- Supabase Auth already provides auth.users; we extend with a public profile table.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Miner',
  created_at timestamptz not null default now()
);

create table if not exists public.progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  stage_id text not null check (stage_id in ('stage1', 'stage2', 'stage3')),
  completed boolean not null default false,
  completed_at timestamptz,
  quiz_score int,
  primary key (user_id, stage_id)
);

create table if not exists public.farm_config (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  rig_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.market_data_cache (
  key text primary key check (key in ('btc_price', 'difficulty_change_pct', 'network_hashrate')),
  value numeric not null,
  fetched_at timestamptz not null default now()
);

create table if not exists public.leaderboard_cache (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null,
  metric numeric not null default 0,
  rank int,
  updated_at timestamptz not null default now()
);

create table if not exists public.certificates (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  issued_at timestamptz not null default now()
);

-- Row Level Security
alter table public.progress enable row level security;
alter table public.farm_config enable row level security;
alter table public.profiles enable row level security;

create policy "own progress" on public.progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own farm config" on public.farm_config
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own profile read/write" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

alter table public.leaderboard_cache enable row level security;
create policy "public read leaderboard" on public.leaderboard_cache
  for select using (true);

alter table public.market_data_cache enable row level security;
create policy "public read market data" on public.market_data_cache
  for select using (true);

alter table public.certificates enable row level security;
create policy "own certificate read" on public.certificates
  for select using (auth.uid() = user_id);

-- Helpful index for leaderboard sorting
create index if not exists leaderboard_metric_idx on public.leaderboard_cache (metric desc);
