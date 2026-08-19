-- Signed-in yards. Anonymous work stays on-device.
create table if not exists yards (
  id         text primary key,
  user_id    text not null,
  name       text not null,
  prompt     text not null default '',
  kind       text not null default 'custom',
  project    jsonb not null,
  saved_at   timestamptz not null default now()
);
create index if not exists yards_user_id_idx on yards (user_id, saved_at desc);
