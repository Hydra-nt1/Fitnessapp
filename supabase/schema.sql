-- FitTracker v2 — Datenbankschema
-- Im Supabase Dashboard (Projekt lambfcrvsvejmrabjspo) unter "SQL Editor" komplett einfügen und ausführen.
-- Idempotent: kann mehrfach ausgeführt werden.
-- Die alte Tabelle public.profiles (JSON-Backup der v1) bleibt unangetastet und wird
-- von der App beim ersten Login einmalig in die neuen Tabellen übernommen.

create extension if not exists "pgcrypto";

-- ── Einstellungen & Profil ───────────────────────────────────────
create table if not exists public.app_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text,
  birthday date,
  sex text,
  height_cm numeric,
  goal_weight numeric,
  goal text,
  level text,
  days_per_week int,
  equipment text,
  theme text not null default 'dark',
  accent text not null default '#4f7ef8',
  rest_seconds int not null default 90,
  weight_increment numeric not null default 2.5,
  bar_weight numeric not null default 20,
  streak_threshold int not null default 3,
  hidden_exercises text[] not null default '{}',
  legacy_imported_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ── Eigene Übungen ───────────────────────────────────────────────
create table if not exists public.custom_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  muscle_group text not null,
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- ── Trainingspläne (Routinen) ────────────────────────────────────
create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  muscle_group text,
  color text,
  position int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_id uuid not null references public.routines (id) on delete cascade,
  exercise_name text not null,
  position int not null default 0,
  sets int not null default 3,
  reps_min int not null default 8,
  reps_max int not null default 12,
  weight numeric not null default 0,
  rest_seconds int,
  superset_group text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists routine_exercises_routine_idx on public.routine_exercises (routine_id);

-- ── Wochenplan: weekday 0 = Montag … 6 = Sonntag ─────────────────
create table if not exists public.week_plan (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  routine_ids uuid[] not null default '{}',
  primary key (user_id, weekday)
);

-- ── Workouts & Sätze ─────────────────────────────────────────────
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_id uuid references public.routines (id) on delete set null,
  name text not null,
  kind text not null default 'full' check (kind in ('full', 'attendance')),
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_s int,
  rating smallint,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists workouts_user_started_idx on public.workouts (user_id, started_at desc);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_name text not null,
  exercise_position int not null default 0,
  set_number int not null default 1,
  set_type text not null default 'normal' check (set_type in ('warmup', 'normal', 'drop', 'failure')),
  weight numeric not null default 0,
  reps int not null default 0,
  rpe numeric,
  done boolean not null default true,
  superset_group text,
  note text
);
create index if not exists workout_sets_workout_idx on public.workout_sets (workout_id);
create index if not exists workout_sets_user_idx on public.workout_sets (user_id);

-- ── Schnell-Log: Sätze×Wdh×kg pro Übung und Woche (ohne Satz-Tracking) ──
create table if not exists public.quick_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_exercise_id uuid references public.routine_exercises (id) on delete cascade,
  exercise_name text not null,
  week_start date not null,
  sets int not null default 3,
  reps int not null default 10,
  weight numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (routine_exercise_id, week_start)
);

-- ── Körperdaten ─────────────────────────────────────────────────
create table if not exists public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_at timestamptz not null default now(),
  weight numeric,
  body_fat numeric,
  chest numeric,
  waist numeric,
  hips numeric,
  arms numeric,
  thighs numeric,
  note text
);
create index if not exists body_metrics_user_idx on public.body_metrics (user_id, measured_at desc);

-- ── Row Level Security: jede Person sieht nur ihre eigenen Daten ──
do $$
declare t text;
begin
  foreach t in array array['app_settings','custom_exercises','routines','routine_exercises',
                           'week_plan','workouts','workout_sets','quick_logs','body_metrics']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own_rows" on public.%I', t);
    execute format('create policy "own_rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
