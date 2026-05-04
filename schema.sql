-- Caffeine Rush leaderboard schema
-- Paste this whole file into Supabase Dashboard → SQL Editor → Run.
-- Idempotent — safe to re-run if you tweak something.

-- ──────────────────────────────────────────────────────────────────────────
-- Table
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.scores (
  id            bigint generated always as identity primary key,
  name          text   not null check (
                    char_length(trim(name)) between 1 and 20
                ),
  score         integer not null check (score between 0 and 50000),
  level_reached integer not null check (level_reached between 1 and 3),
  platform      text check (platform is null or platform in ('mobile', 'desktop')),
  created_at    timestamptz not null default now()
);

-- Migration: add platform column to existing tables (idempotent).
alter table public.scores
  add column if not exists platform text;

-- Migration: add drinks column for the "coffees refilled" counter (idempotent).
-- New games submit their actual drink count alongside the score.
alter table public.scores
  add column if not exists drinks integer not null default 0;

-- Backfill: estimate drinks for any pre-existing rows that still have drinks=0.
-- Formula: roughly 1 drink per ~60 score points, with a floor of 1 so even a
-- zero-score game contributes one refill (the player tapped at least once).
-- Heuristic only — driven by the fact that one starter-mug cycle is ~40-50
-- score and each subsequent drink-then-burn cycle is ~64-80 score.
-- Capped at 50 to prevent any single absurd score from dominating the counter.
update public.scores
   set drinks = least(50, greatest(1, round(score / 60.0)::int))
 where drinks = 0
   and score > 0;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.scores'::regclass
      and conname  = 'scores_platform_check'
  ) then
    alter table public.scores
      add constraint scores_platform_check
      check (platform is null or platform in ('mobile', 'desktop'));
  end if;
end $$;

-- Profanity backstop. Client-side filter in supabase.js does the
-- friendly inline rejection; this constraint is the "DevTools bypass"
-- safety net. Postgres ARE regex with \m word-start boundary. No leet
-- normalization here (would require a function); the literal forms
-- still cover ~95% of casual cases.
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.scores'::regclass
      and conname  = 'scores_name_clean_check'
  ) then
    alter table public.scores
      add constraint scores_name_clean_check
      check (
        name !~* '\m(fu*ck|shit|bitch|cunt|asshole|bastard|dickhead|pussy|twat|wanker|fagg?ot|retard|tranny|raghead|jiggaboo|rape|rapist|pedophile|molest|cuck|nigg(er|a|uh))'
        and name !~* '\m(whore|slut|slutty|fag|kike|spic|chink|gook|jap|wop|kraut|paki|cracker|beaner|redskin|coon|heil|sieg|kys|pedo|kill\s*yo?urself)\M'
      );
  end if;
end $$;

-- Index for the "top N" query
create index if not exists scores_top_idx
  on public.scores (score desc, created_at asc);

-- ──────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- Anyone can read; anyone can insert (validated by CHECK constraints above).
-- No update/delete policies → mutations and deletions are blocked entirely.
-- ──────────────────────────────────────────────────────────────────────────

alter table public.scores enable row level security;

drop policy if exists "scores_select_all"   on public.scores;
drop policy if exists "scores_insert_anon"  on public.scores;

create policy "scores_select_all"
  on public.scores for select
  using (true);

create policy "scores_insert_anon"
  on public.scores for insert
  with check (true);

-- ──────────────────────────────────────────────────────────────────────────
-- Custom event tracking — DIY analytics since Vercel Hobby gates custom
-- events behind Pro. Tracks button clicks, friend-tile clicks, tip clicks,
-- share clicks, etc. Read-only dashboard at /admin.html aggregates these.
--
-- props is a flexible jsonb so each event can carry the relevant detail
-- (e.g. friend_click → { "target": "siplist" }, tip_click → { "amount": "$3" }).
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.events (
  id          bigint generated always as identity primary key,
  event_name  text not null check (char_length(event_name) between 1 and 64),
  props       jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists events_created_idx on public.events (created_at desc);
create index if not exists events_name_idx    on public.events (event_name);

alter table public.events enable row level security;

drop policy if exists "events_select_all"   on public.events;
drop policy if exists "events_select_admin" on public.events;
drop policy if exists "events_insert_anon"  on public.events;

-- Reads are restricted to the admin email — server-enforced via RLS so
-- even if someone else manages to authenticate, they can't see events.
-- Update the email below to add/change admins.
create policy "events_select_admin"
  on public.events for select
  using (auth.email() = 'istand34@gmail.com');

-- Anon insert is open: anyone can fire events from the public page.
create policy "events_insert_anon"
  on public.events for insert
  with check (true);

-- ──────────────────────────────────────────────────────────────────────────
-- Optional: convenience view of top 10 (handy for poking around in SQL Editor)
-- ──────────────────────────────────────────────────────────────────────────

create or replace view public.scores_top10 as
select id, name, score, level_reached, platform, created_at
from public.scores
order by score desc, created_at asc
limit 10;
