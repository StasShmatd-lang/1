create table if not exists events (
  id text primary key,
  code text not null unique,
  host_token text not null,
  screen_token text not null,
  guest_key text not null,
  company_name text not null default '',
  question text not null default '',
  answer integer,
  cover_photo text,
  duration_sec integer not null default 45,
  phase text not null default 'setup',
  timer_ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists guesses (
  id text primary key,
  event_id text not null references events(id) on delete cascade,
  guest_token text not null,
  name text not null,
  value integer not null,
  created_at timestamptz not null default now(),
  unique (event_id, guest_token)
);

create index if not exists guesses_event_id_idx on guesses(event_id);
