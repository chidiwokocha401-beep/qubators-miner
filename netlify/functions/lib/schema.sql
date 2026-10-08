-- Qubators Cloud Miner — Database schema for Netlify DB (Neon Postgres)
-- Canonical copy. This file is auto-applied by the API on boot (see lib/store.js),
-- so you normally do NOT need to run it by hand. Run it manually only if you want
-- to inspect or pre-create the tables in the Neon SQL runner.

create table if not exists users (
  id uuid primary key,
  email text unique not null,
  password_hash text not null,
  display_name text not null default 'Miner',
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token text primary key,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
create index if not exists sessions_user_idx on sessions (user_id);

create table if not exists progress (
  user_id uuid not null references users(id) on delete cascade,
  stage_id text not null check (stage_id in ('stage1', 'stage2', 'stage3')),
  completed boolean not null default false,
  completed_at timestamptz,
  quiz_score int,
  primary key (user_id, stage_id)
);

create table if not exists farm_config (
  user_id uuid primary key references users(id) on delete cascade,
  rig_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists market_data_cache (
  key text primary key check (key in ('btc_price', 'difficulty_change_pct', 'network_hashrate')),
  value numeric not null,
  fetched_at timestamptz not null default now()
);

create table if not exists leaderboard_cache (
  user_id uuid primary key references users(id) on delete cascade,
  display_name text not null,
  metric numeric not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists leaderboard_metric_idx on leaderboard_cache (metric asc);

create table if not exists certificates (
  id text primary key,
  user_id uuid not null references users(id) on delete cascade,
  display_name text not null,
  issued_at timestamptz not null default now()
);
create index if not exists certificates_user_idx on certificates (user_id);
