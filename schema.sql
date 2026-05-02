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
-- Optional: convenience view of top 10 (handy for poking around in SQL Editor)
-- ──────────────────────────────────────────────────────────────────────────

create or replace view public.scores_top10 as
select id, name, score, level_reached, platform, created_at
from public.scores
order by score desc, created_at asc
limit 10;
