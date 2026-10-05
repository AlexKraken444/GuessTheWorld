create table if not exists public.rooms (
 code text primary key,
 state jsonb not null,
 version integer not null default 0,
 created_at timestamptz not null default now()
);
alter table public.rooms enable row level security;
revoke all on public.rooms from anon, authenticated;
-- No public policies: only server service_role may access rooms.
