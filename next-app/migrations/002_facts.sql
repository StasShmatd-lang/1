alter table events
  add column if not exists facts_json text not null default '[]';
